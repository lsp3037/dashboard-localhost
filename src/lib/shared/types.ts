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

/** Resumo de run exposto na API. Preenchido a partir de F3. */
export interface RunSummaryDTO {
  id: string;
  status: string;
  port: number | null;
  pid?: number | null;
  startedAt: string;
  endedAt?: string | null;
}

export interface ProjectDTO {
  id: string;
  name: string;
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
