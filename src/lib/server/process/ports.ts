import 'server-only';

import { execFile } from 'node:child_process';

/**
 * Detecção de portas e árvore de PIDs no Windows (§6.5).
 * Tudo aqui é somente leitura: nenhuma função mata processo.
 */

const MIN_PORT = 1024;
const MAX_PORT = 65_535;
const POWERSHELL_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_BUFFER = 8 * 1024 * 1024;
const MAX_PID_TREE_DEPTH = 8;

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*[A-Za-z]`, 'g');

const POWERSHELL_ARGS: readonly string[] = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];

const LISTENERS_SCRIPT =
  'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ' +
  'ForEach-Object { "$($_.LocalPort) $($_.OwningProcess)" }';

const PROCESS_LIST_SCRIPT = 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }';

/** Portas aceitas pelo parser: só faixa de usuário, nunca 80/443 de serviço do sistema. */
export function isValidPort(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_PORT && value <= MAX_PORT;
}

function toPort(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number.parseInt(raw, 10);
  return isValidPort(value) ? value : null;
}

/** Remove códigos ANSI de uma linha antes de tentar casar a porta. */
function normalizeLine(line: string): string {
  return line.replace(ANSI_PATTERN, '');
}

const PORT_FROM_LINE_PATTERNS: readonly RegExp[] = [
  // Next: `- Local: http://localhost:3000`
  /Local:\s+https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{2,5})/i,
  // Vite/outros: `http://localhost:4321`
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{2,5})/i,
  // Next: `started server on 0.0.0.0:3002`
  /started server on [^\s]*:(\d{2,5})/i,
  // Node/express: `listening on 4321` / `Server listening on http://0.0.0.0:4321`
  /listening (?:on|at) (?:[^\s]*:)?(\d{2,5})\b/i,
  // Genérico: `port: 4321` / `port=4321`
  /\bport\s*[:=]\s*(\d{2,5})\b/i,
];

/**
 * Parser de porta por linha de log (§6.5 item 1).
 * Nunca casa tempo (`ready in 3002ms`) porque toda porta exige host/URL ou o prefixo `port`.
 */
export function parsePortFromLine(line: string): number | null {
  const normalized = normalizeLine(line);

  for (const pattern of PORT_FROM_LINE_PATTERNS) {
    const match = pattern.exec(normalized);
    if (match === null) continue;

    const port = toPort(match[1]);
    if (port !== null) return port;
  }

  return null;
}

/** `-p 3002`, `--port=3005`, `--port 5173`. O separador é obrigatório: `--profile` não casa. */
const SCRIPT_PORT_PATTERN = /(?:^|\s)(?:--port|-p)(?:\s+|=)(\d{2,5})(?=\s|$)/;

/** Porta declarada no valor do script do `package.json` (§6.5 item 2). */
export function parseScriptPort(scriptCommand: string | null | undefined): number | null {
  if (typeof scriptCommand !== 'string') return null;

  const match = SCRIPT_PORT_PATTERN.exec(scriptCommand);
  if (match === null) return null;

  return toPort(match[1]);
}

/** Extrai porta → PID das duas saídas suportadas (`Get-NetTCPConnection` e `netstat -ano`). */
export function parseListenerLines(raw: string): Map<number, number> {
  const listeners = new Map<number, number>();

  for (const line of raw.split(/\r?\n/)) {
    const simple = /^\s*(\d{2,5})\s+(\d+)\s*$/.exec(line);

    if (simple !== null) {
      const port = toPort(simple[1]);
      const pid = Number.parseInt(simple[2] ?? '', 10);
      if (port !== null && Number.isInteger(pid) && pid > 0) listeners.set(port, pid);
      continue;
    }

    const netstat = /^\s*TCP\s+\S*:(\d{1,5})\s+\S+\s+LISTENING\s+(\d+)\s*$/i.exec(line);

    if (netstat !== null) {
      const port = toPort(netstat[1]);
      const pid = Number.parseInt(netstat[2] ?? '', 10);
      if (port !== null && Number.isInteger(pid) && pid > 0) listeners.set(port, pid);
    }
  }

  return listeners;
}

export interface ProcessParentPair {
  readonly pid: number;
  readonly parentPid: number;
}

export function parseProcessListOutput(raw: string): ProcessParentPair[] {
  const pairs: ProcessParentPair[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
    if (match === null) continue;

    const pid = Number.parseInt(match[1] ?? '', 10);
    const parentPid = Number.parseInt(match[2] ?? '', 10);
    if (Number.isInteger(pid) && Number.isInteger(parentPid)) pairs.push({ pid, parentPid });
  }

  return pairs;
}

/**
 * Descendentes de `rootPid` (inclui a raiz), por `Win32_Process.ParentProcessId`.
 * Limite de 8 níveis evita loop em árvore corrompida.
 */
export function collectPidTree(
  rootPid: number,
  pairs: readonly ProcessParentPair[],
  maxDepth = MAX_PID_TREE_DEPTH,
): number[] {
  const childrenByParent = new Map<number, number[]>();

  for (const pair of pairs) {
    const children = childrenByParent.get(pair.parentPid);
    if (children === undefined) {
      childrenByParent.set(pair.parentPid, [pair.pid]);
    } else {
      children.push(pair.pid);
    }
  }

  const collected: number[] = [rootPid];
  const seen = new Set<number>([rootPid]);
  let frontier: number[] = [rootPid];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const next: number[] = [];

    for (const pid of frontier) {
      for (const child of childrenByParent.get(pid) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        collected.push(child);
        next.push(child);
      }
    }

    frontier = next;
  }

  return collected;
}

function runCommand(file: string, args: readonly string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      file,
      [...args],
      { windowsHide: true, timeout: POWERSHELL_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BUFFER, encoding: 'utf8' },
      (error, stdout) => {
        if (error !== null) {
          resolve(null);
          return;
        }

        resolve(stdout);
      },
    );
  });
}

function runPowerShell(script: string): Promise<string | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return runCommand('powershell.exe', [...POWERSHELL_ARGS, script]);
}

/** Mapa porta → PID dos sockets TCP em LISTEN. Falha de ferramenta → mapa vazio (nunca lança). */
export async function listListeners(): Promise<Map<number, number>> {
  const fromPowerShell = await runPowerShell(LISTENERS_SCRIPT);

  if (fromPowerShell !== null) {
    const parsed = parseListenerLines(fromPowerShell);
    if (parsed.size > 0) return parsed;
  }

  const fromNetstat = await runCommand('netstat.exe', ['-ano', '-p', 'TCP']);
  return fromNetstat === null ? new Map() : parseListenerLines(fromNetstat);
}

async function listProcessPairs(): Promise<ProcessParentPair[]> {
  const raw = await runPowerShell(PROCESS_LIST_SCRIPT);
  return raw === null ? [] : parseProcessListOutput(raw);
}

/** Nome do executável dono de um PID (só para mensagem de erro; falha → `null`). */
export async function getProcessName(pid: number): Promise<string | null> {
  if (!Number.isInteger(pid) || pid <= 0) return null;

  const raw = await runPowerShell(
    `Get-CimInstance Win32_Process -Filter "ProcessId=${String(pid)}" -ErrorAction SilentlyContinue | ` +
      'Select-Object -ExpandProperty Name',
  );

  if (raw === null) return null;

  const name = raw.trim().split(/\r?\n/)[0]?.trim();
  return name !== undefined && name.length > 0 ? name : null;
}

/**
 * Porta de um listener pertencente à árvore do run (§6.5 item 3).
 * Cruzamento somente leitura: nenhum processo é tocado.
 */
export async function findPortForPidTree(rootPid: number, preferredPort?: number | null): Promise<number | null> {
  if (!Number.isInteger(rootPid) || rootPid <= 0) return null;

  const [pairs, listeners] = await Promise.all([listProcessPairs(), listListeners()]);

  if (pairs.length === 0 || listeners.size === 0) return null;

  const tree = new Set(collectPidTree(rootPid, pairs));
  const ports: number[] = [];

  for (const [port, pid] of listeners.entries()) {
    if (tree.has(pid)) ports.push(port);
  }

  if (preferredPort !== undefined && preferredPort !== null && ports.includes(preferredPort)) {
    return preferredPort;
  }
  if (ports.includes(8000)) {
    return 8000;
  }

  ports.sort((a, b) => a - b);
  return ports[0] ?? null;
}
