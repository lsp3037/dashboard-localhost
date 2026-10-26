import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

import { noScript, scriptNotAllowed } from '@/lib/server/errors';
import { parseScriptPort } from '@/lib/server/process/ports';
import type { PackageManager } from '@/lib/shared/types';

/**
 * Montagem do comando de execução (§6.3/§6.4) — C2, C3, C4 e C9.
 *
 * Regras que este módulo garante:
 * - o cliente nunca fornece comando nem argumentos: só um nome de script da allowlist;
 * - `cmd.exe /d /s /c <runner> run <script>` com `shell: false` no spawn;
 * - o caminho do projeto entra apenas como `cwd`, nunca concatenado no comando;
 * - o ambiente do filho não herda `PORT`/`NODE_OPTIONS`/`NEXT_RUNTIME`/`__NEXT_PRIVATE_*`.
 */

/** C2: mesmo padrão de `config.ts` (nome de script, nunca uma linha de shell). */
export const SCRIPT_NAME_PATTERN = /^[a-z0-9:_-]{1,32}$/;

/** Sempre `cmd.exe`: no Windows `npm` é `npm.cmd` e `spawn('npm', …, { shell: false })` falha com EINVAL. */
const SHELL_EXECUTABLE = 'cmd.exe';
const SHELL_FLAGS: readonly string[] = ['/d', '/s', '/c'];

export interface RunnerCommand {
  readonly file: string;
  readonly args: readonly string[];
  /** Linha exibida/auditada; o caminho do projeto nunca entra aqui. */
  readonly display: string;
}

type Runner = (script: string) => RunnerCommand;

function shell(commandLine: string): RunnerCommand {
  return {
    file: SHELL_EXECUTABLE,
    args: [...SHELL_FLAGS, commandLine],
    display: commandLine,
  };
}

/** Templates fixos por package manager (§6.3). Yarn não usa `run`. */
export const RUNNERS: Readonly<Record<PackageManager, Runner>> = {
  npm: (script) => shell(`npm run ${script}`),
  pnpm: (script) => shell(`pnpm run ${script}`),
  yarn: (script) => shell(`yarn ${script}`),
  bun: (script) => shell(`bun run ${script}`),
};

export function buildCommand(packageManager: PackageManager | null, script: string): RunnerCommand {
  const runner = RUNNERS[packageManager ?? 'npm'];
  return runner(script);
}

/**
 * Constrói o comando de execução considerando a stack do projeto.
 * - Para Laravel: usa `composer run dev`, `php artisan serve & <pm> run dev` ou `php artisan serve`.
 * - Para Django: usa `python manage.py runserver` se não houver script customizado em package.json.
 */
export async function buildProjectCommand(
  projectPath: string,
  packageManager: PackageManager | null,
  script: string,
  stack: readonly string[] = [],
): Promise<RunnerCommand> {
  const isLaravel = stack.includes('laravel');

  if (isLaravel && (script === 'dev' || script === 'start')) {
    try {
      const composerRaw = await fs.readFile(path.join(projectPath, 'composer.json'), 'utf8');
      const composer = JSON.parse(composerRaw.replace(/^\uFEFF/, ''));
      if (composer?.scripts && typeof composer.scripts[script] !== 'undefined') {
        return shell(`composer run ${script}`);
      }
    } catch {
      // ignora composer ausente ou inválido
    }

    const hasPackageDev = (await readScriptCommand(projectPath, script)) !== null;
    if (hasPackageDev) {
      const pm = packageManager ?? 'npm';
      const nodeCode = `const {spawn}=require('child_process');const p1=spawn('php',['artisan','serve'],{stdio:'inherit',shell:true});const p2=spawn('${pm}',['run','${script}'],{stdio:'inherit',shell:true});const k=()=>{try{p1.kill()}catch(e){}try{p2.kill()}catch(e){}process.exit()};process.on('SIGINT',k);process.on('SIGTERM',k);p1.on('exit',k);p2.on('exit',k);`;
      return {
        file: process.execPath,
        args: ['-e', nodeCode],
        display: `php artisan serve & ${pm} run ${script}`,
      };
    }

    return shell('php artisan serve');
  }

  const isDjango = stack.includes('django');
  if (isDjango && (script === 'dev' || script === 'start')) {
    const hasPackageScript = (await readScriptCommand(projectPath, script)) !== null;
    if (!hasPackageScript) {
      return shell('python manage.py runserver');
    }
  }

  return buildCommand(packageManager, script);
}

export interface ScriptContext {
  readonly scripts: readonly string[];
  readonly defaultScript: string | null;
}

/**
 * Resolve o script a executar: explícito (validado contra allowlist + `package.json.scripts`)
 * ou o padrão do projeto. Sem nenhum script executável → 422 NO_SCRIPT.
 */
export function resolveRunnableScript(
  project: ScriptContext,
  requested: string | null,
  allowedScripts: readonly string[],
): string {
  const runnable = allowedScripts.filter((script) => project.scripts.includes(script));

  if (requested === null) {
    const preferred =
      project.defaultScript !== null && runnable.includes(project.defaultScript)
        ? project.defaultScript
        : runnable[0];

    if (preferred === undefined) {
      throw noScript('Nenhum script executável (dev/start/preview) neste projeto.', {
        scripts: [...project.scripts],
        allowedScripts: [...allowedScripts],
      });
    }

    return preferred;
  }

  if (!SCRIPT_NAME_PATTERN.test(requested)) {
    throw scriptNotAllowed(`Nome de script inválido: "${requested}".`, { script: requested });
  }

  if (!allowedScripts.includes(requested)) {
    throw scriptNotAllowed(`Script "${requested}" não está na allowlist.`, {
      script: requested,
      allowedScripts: [...allowedScripts],
    });
  }

  if (!project.scripts.includes(requested)) {
    throw scriptNotAllowed(`Script "${requested}" não existe no package.json do projeto.`, {
      script: requested,
      scripts: [...project.scripts],
    });
  }

  return requested;
}

/** Valor do script em `package.json` (ex.: `next dev -p 3002`), com BOM e JSON inválido tolerados. */
export async function readScriptCommand(projectPath: string, script: string): Promise<string | null> {
  let raw: string;

  try {
    raw = await fs.readFile(path.join(/* turbopackIgnore: true */ projectPath, 'package.json'), 'utf8');
  } catch {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const scripts = (parsed as { scripts?: unknown }).scripts;
  if (typeof scripts !== 'object' || scripts === null) return null;

  const command = (scripts as Record<string, unknown>)[script];
  return typeof command === 'string' ? command : null;
}

/** Variáveis herdadas do hub que nunca devem vazar para o dev server do projeto. */
const REMOVED_ENV_KEYS: ReadonlySet<string> = new Set(['PORT', 'NODE_OPTIONS', 'NEXT_RUNTIME']);

const SCRIPT_DECLARES_PORT = /(?:^|\s)(?:--port|-p)(?:\s|=)/;

export interface ChildEnvInput {
  readonly runId: string;
  readonly stack: readonly string[];
  /** Comando do script (`package.json`), usado para saber se a porta já está fixada. */
  readonly scriptCommand: string | null;
  readonly preferredPort: number | null;
  /** Injetável em testes; default `process.env`. */
  readonly baseEnv?: NodeJS.ProcessEnv;
}

/**
 * Ambiente do filho (§6.4): remove o que o hub herdou, fixa flags não interativas e
 * injeta `PORT` só para Next sem `-p/--port` e com `preferred_port`.
 */
export function buildChildEnv(input: ChildEnvInput): NodeJS.ProcessEnv {
  const base = input.baseEnv ?? process.env;
  const nodeEnv =
    base.NODE_ENV === 'production' || base.NODE_ENV === 'test' ? base.NODE_ENV : 'development';
  const env: NodeJS.ProcessEnv = { NODE_ENV: nodeEnv };

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (REMOVED_ENV_KEYS.has(key)) continue;
    if (key.startsWith('__NEXT_PRIVATE_')) continue;

    env[key] = value;
  }

  env.BROWSER = 'none';
  env.NO_COLOR = '1';
  env.FORCE_COLOR = '0';
  env.NEXT_TELEMETRY_DISABLED = '1';
  env.HUB_RUN_ID = input.runId;

  const isNext = input.stack.includes('next');
  const scriptHasPort =
    parseScriptPort(input.scriptCommand) !== null ||
    (input.scriptCommand !== null && SCRIPT_DECLARES_PORT.test(input.scriptCommand));

  if (isNext && input.preferredPort !== null && !scriptHasPort) {
    env.PORT = String(input.preferredPort);
  }

  return env;
}

/**
 * Porta alvo da pré-checagem (§6.7): a do script quando declarada, senão a preferida.
 * Vite ignora `PORT`, mas a porta preferida continua sendo o alvo que o usuário espera.
 */
export function resolveTargetPort(scriptCommand: string | null, preferredPort: number | null): number | null {
  return parseScriptPort(scriptCommand) ?? preferredPort;
}

export { parseScriptPort } from '@/lib/server/process/ports';
