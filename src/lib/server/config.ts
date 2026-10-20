import 'server-only';

import path from 'node:path';
import { z } from 'zod';

const DEFAULT_PROJECTS_ROOTS = String.raw`C:\Projetos`;
const DEFAULT_ALLOWED_SCRIPTS = 'dev,start,preview';
const SCRIPT_NAME_PATTERN = /^[a-z0-9:_-]{1,32}$/;

export interface HubConfig {
  /** Porta HTTP do hub. */
  readonly port: number;
  /** Raízes monitoradas, já resolvidas para caminho absoluto. */
  readonly projectsRoots: readonly string[];
  /** Profundidade máxima do scan (1 ou 2). */
  readonly scanDepth: number;
  /** Tempo máximo para considerar um run `running`. */
  readonly bootTimeoutMs: number;
  /** Carência antes de forçar o kill de um run. */
  readonly stopGraceMs: number;
  /** Linhas mantidas no ring buffer de log por run. */
  readonly logBufferLines: number;
  /** Tamanho máximo do arquivo de log por run. */
  readonly logMaxBytes: number;
  /** Runs simultâneos permitidos. */
  readonly maxRunning: number;
  /** Assinantes SSE simultâneos por run. */
  readonly maxStreams: number;
  /** Timeout global do scan de projetos. */
  readonly scanTimeoutMs: number;
  /** Scripts que o hub aceita executar. */
  readonly allowedScripts: readonly string[];
  /** Diretório de dados (SQLite + logs), absoluto. */
  readonly dataDir: string;
}

const envSchema = z.object({
  HUB_PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  HUB_PROJECTS_ROOTS: z.string().min(1).default(DEFAULT_PROJECTS_ROOTS),
  HUB_SCAN_DEPTH: z.coerce.number().int().min(1).max(2).default(2),
  HUB_BOOT_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  HUB_STOP_GRACE_MS: z.coerce.number().int().nonnegative().default(3_000),
  HUB_LOG_BUFFER_LINES: z.coerce.number().int().positive().default(1_000),
  HUB_LOG_MAX_BYTES: z.coerce.number().int().positive().default(5_242_880),
  HUB_MAX_RUNNING: z.coerce.number().int().positive().max(64).default(4),
  HUB_MAX_STREAMS: z.coerce.number().int().positive().max(1_000).default(20),
  HUB_SCAN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  HUB_ALLOWED_SCRIPTS: z.string().min(1).default(DEFAULT_ALLOWED_SCRIPTS),
  HUB_DATA_DIR: z.string().min(1).optional(),
});

function parseProjectsRoots(raw: string): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];

  for (const entry of raw.split(';')) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;

    const resolved = path.resolve(trimmed);
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    roots.push(resolved);
  }

  if (roots.length === 0) {
    throw new Error('Invalid hub configuration: HUB_PROJECTS_ROOTS must contain at least one path');
  }

  return roots;
}

function parseAllowedScripts(raw: string): string[] {
  const seen = new Set<string>();
  const scripts: string[] = [];

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;

    if (!SCRIPT_NAME_PATTERN.test(trimmed)) {
      throw new Error(`Invalid hub configuration: HUB_ALLOWED_SCRIPTS contains an invalid script name "${trimmed}"`);
    }

    if (seen.has(trimmed)) continue;

    seen.add(trimmed);
    scripts.push(trimmed);
  }

  if (scripts.length === 0) {
    throw new Error('Invalid hub configuration: HUB_ALLOWED_SCRIPTS must contain at least one script name');
  }

  return scripts;
}

function buildConfig(env: Record<string, string | undefined>): HubConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid hub configuration: ${details}`);
  }

  const data = parsed.data;
  const projectsRoots = parseProjectsRoots(data.HUB_PROJECTS_ROOTS);
  const allowedScripts = parseAllowedScripts(data.HUB_ALLOWED_SCRIPTS);
  const dataDir = data.HUB_DATA_DIR ? path.resolve(data.HUB_DATA_DIR) : path.join(process.cwd(), '.data');

  return {
    port: data.HUB_PORT,
    projectsRoots,
    scanDepth: data.HUB_SCAN_DEPTH,
    bootTimeoutMs: data.HUB_BOOT_TIMEOUT_MS,
    stopGraceMs: data.HUB_STOP_GRACE_MS,
    logBufferLines: data.HUB_LOG_BUFFER_LINES,
    logMaxBytes: data.HUB_LOG_MAX_BYTES,
    maxRunning: data.HUB_MAX_RUNNING,
    maxStreams: data.HUB_MAX_STREAMS,
    scanTimeoutMs: data.HUB_SCAN_TIMEOUT_MS,
    allowedScripts,
    dataDir,
  };
}

let cachedConfig: HubConfig | null = null;

/** Lê e valida o ambiente na primeira chamada; chamadas seguintes reutilizam o resultado. */
export function getConfig(): HubConfig {
  if (cachedConfig === null) {
    cachedConfig = buildConfig(process.env);
  }
  return cachedConfig;
}
