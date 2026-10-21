export type ProjectKind = 'node' | 'non-node';
export type ProjectSource = 'scan' | 'manual';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type StackTag =
  | 'next'
  | 'react'
  | 'vite'
  | 'vue'
  | 'nuxt'
  | 'svelte'
  | 'react-native'
  | 'expo'
  | 'express'
  | 'fastify'
  | 'hono'
  | 'astro'
  | 'tailwind'
  | 'typescript'
  | 'test';

export type RunStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'failed';

/** Run completo exposto por `/start`, `/stop` e `/status` (§4.3). */
export interface RunDTO {
  id: string;
  projectId: string;
  script: string;
  /** Comando gerado internamente (auditoria); nunca vem do cliente. */
  command: string;
  status: RunStatus;
  pid: number | null;
  port: number | null;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  errorCode: string | null;
}

/** Resumo de run embutido no `ProjectDTO`. */
export interface RunSummaryDTO {
  id: string;
  script?: string;
  status: string;
  port: number | null;
  pid?: number | null;
  startedAt: string;
  endedAt?: string | null;
  exitCode?: number | null;
  errorCode?: string | null;
}

export interface ProjectDTO {
  id: string;
  name: string;
  packageName: string | null;
  path: string;
  parentId: string | null;
  kind: ProjectKind;
  hidden: boolean;
  missing: boolean;
  stack: string[];
  packageManager: PackageManager | null;
  scripts: string[];
  runnableScripts: string[];
  defaultScript: string | null;
  preferredPort: number | null;
  notes: string | null;
  gitBranch: string | null;
  gitHeadAt: string | null;
  run: RunSummaryDTO | null;
  lastRun: RunSummaryDTO | null;
}

export interface ScanCountersDTO {
  added: number;
  updated: number;
  unchanged: number;
  missing: number;
  skipped: number;
  durationMs: number;
}
