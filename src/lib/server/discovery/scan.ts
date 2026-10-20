import 'server-only';

import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { getConfig } from '@/lib/server/config';
import { EMPTY_GIT_INFO, readGitInfo } from '@/lib/server/discovery/git';
import { isSkippedDirName, shouldSkipEntry } from '@/lib/server/discovery/ignore';
import { detectLockfileManager } from '@/lib/server/discovery/package-manager';
import {
  canonicalizePath,
  comparisonKey,
  containsTraversal,
  isInsideRoot,
  isInsideRoots,
  resolveAllowedPath,
} from '@/lib/server/discovery/paths';
import { detectStack } from '@/lib/server/discovery/stack';
import type { ScannedProject } from '@/lib/server/discovery/types';
import { pathNotAllowed } from '@/lib/server/errors';
import { listProjects, markMissing, upsertScannedProjects } from '@/lib/server/repos/projects';
import type { PackageManager, ProjectKind } from '@/lib/shared/types';

export interface ScanOptions {
  /** Raízes pedidas; cada uma precisa estar na allowlist configurada. */
  readonly roots: readonly string[];
  /** Profundidade máxima (1 ou 2). Default: `HUB_SCAN_DEPTH`. */
  readonly maxDepth?: number;
  /** Timeout global; ao estourar, o scan devolve o que já coletou. */
  readonly scanTimeoutMs?: number;
}

export interface ScanResult {
  added: number;
  updated: number;
  unchanged: number;
  missing: number;
  skipped: number;
  durationMs: number;
}

export interface PackageJsonInfo {
  readonly name: string | null;
  readonly scripts: readonly string[];
  readonly dependencyNames: readonly string[];
  readonly workspacePatterns: readonly string[];
}

const PACKAGE_JSON = 'package.json';
const GIT_ENTRY = '.git';
const PNPM_WORKSPACE_FILES: readonly string[] = ['pnpm-workspace.yaml', 'pnpm-workspace.yml'];

const DIRECTORY_TIMEOUT_MS = 1_500;
const FS_CONCURRENCY = 8;
const GIT_CONCURRENCY = 2;
const MAX_WORKSPACE_MATCHES = 50;

const HUB_DIRECTORY = canonicalizePath(process.cwd());

interface DirectoryListing {
  readonly names: ReadonlySet<string>;
  readonly entries: readonly Dirent[];
}

interface DirectoryTask {
  readonly dir: string;
  readonly depth: number;
  readonly parentPath: string | null;
}

interface ProjectDraft extends ScannedProject {
  readonly hasGit: boolean;
  readonly workspacePatterns: readonly string[];
  /** Gerenciador declarado por lockfile no próprio diretório; `null` = herda do pai/workspace. */
  readonly lockfileManager: PackageManager | null;
}

interface ScanState {
  readonly roots: string[];
  readonly maxDepth: number;
  readonly deadline: number;
  readonly visited: Set<string>;
  readonly drafts: Map<string, ProjectDraft>;
  skipped: number;
}

/** `realpath` do hub: ele nunca aparece na listagem (não se gerencia). */
function isHubDirectory(dir: string): boolean {
  return comparisonKey(path.resolve(dir)) === comparisonKey(HUB_DIRECTORY);
}

function decodeUtf8(buffer: Buffer): string {
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  return (hasBom ? buffer.subarray(3) : buffer).toString('utf8');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout after ${String(ms)}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('unknown error'));
      },
    );
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** `workspaces` aceita array ou `{ packages: [] }`; `packages` no topo também é aceito (§7.1). */
function readWorkspacePatternsFromManifest(record: Record<string, unknown>): string[] {
  const workspaces = record.workspaces;

  if (Array.isArray(workspaces)) return readStringList(workspaces);

  const nestedPackages = asRecord(workspaces).packages;
  if (Array.isArray(nestedPackages)) return readStringList(nestedPackages);

  return readStringList(record.packages);
}

function readDependencyNames(record: Record<string, unknown>): string[] {
  return [
    ...Object.keys(asRecord(record.dependencies)),
    ...Object.keys(asRecord(record.devDependencies)),
    ...Object.keys(asRecord(record.peerDependencies)),
  ];
}

/**
 * Lê o package.json tolerando BOM e JSON inválido.
 * `null` significa "não é um projeto Node legível" (inexistente ou inválido).
 */
export async function readPackageJson(dir: string): Promise<PackageJsonInfo | null> {
  let buffer: Buffer;

  try {
    buffer = await fs.readFile(path.join(dir, PACKAGE_JSON));
  } catch {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decodeUtf8(buffer));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const name = typeof record.name === 'string' && record.name.trim().length > 0 ? record.name.trim() : null;

  return {
    name,
    scripts: Object.keys(asRecord(record.scripts)),
    dependencyNames: readDependencyNames(record),
    workspacePatterns: readWorkspacePatternsFromManifest(record),
  };
}

/** Nome exibido: sempre o nome da pasta no disco (preserva acentos e espaços). */
export function resolveProjectName(dir: string): string {
  return path.basename(dir);
}

async function readDirectory(dir: string): Promise<DirectoryListing | null> {
  try {
    const entries = await withTimeout(fs.readdir(dir, { withFileTypes: true }), DIRECTORY_TIMEOUT_MS);
    return { names: new Set(entries.map((entry) => entry.name)), entries };
  } catch {
    return null;
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    const stats = await fs.stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pacotes de workspace não têm lockfile próprio: herdam o gerenciador do workspace pai
 * (`prenatal-saas/apps/*` → pnpm). Pais têm caminho mais curto, então entram primeiro.
 */
function inheritWorkspacePackageManager(drafts: readonly ProjectDraft[]): ProjectDraft[] {
  const resolved = new Map<string, ProjectDraft>();
  const ordered = [...drafts].sort((a, b) => a.path.length - b.path.length);

  for (const draft of ordered) {
    let packageManager = draft.packageManager;

    if (draft.kind === 'node' && draft.lockfileManager === null && draft.parentPath !== null) {
      const parent = resolved.get(comparisonKey(draft.parentPath));
      const inherited = parent?.packageManager ?? null;
      if (inherited !== null) packageManager = inherited;
    }

    resolved.set(comparisonKey(draft.path), { ...draft, packageManager });
  }

  return [...resolved.values()];
}

/** Resolve git para os candidatos com concorrência 2 (processos externos são caros). */async function resolveDraftsWithGit(drafts: readonly ProjectDraft[]): Promise<ProjectDraft[]> {
  const resolved: ProjectDraft[] = [];
  let cursor = 0;

  const runners = Array.from({ length: Math.min(GIT_CONCURRENCY, drafts.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;

      const draft = drafts[index];
      if (draft === undefined) return;

      if (!draft.hasGit) {
        resolved[index] = draft;
        continue;
      }

      const git = await readGitInfo(draft.path).catch(() => EMPTY_GIT_INFO);
      resolved[index] = { ...draft, gitBranch: git.branch, gitHeadAt: git.headAt };
    }
  });

  await Promise.all(runners);

  return resolved;
}

/** Checa existência em disco com concorrência limitada; devolve só os caminhos que sumiram. */
async function selectVanishedPaths(paths: readonly string[]): Promise<string[]> {
  const vanished: string[] = [];
  let cursor = 0;

  const runners = Array.from({ length: Math.min(FS_CONCURRENCY, paths.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;

      const target = paths[index];
      if (target === undefined) return;

      if (!(await pathExists(target))) vanished.push(target);
    }
  });

  await Promise.all(runners);

  return vanished;
}

/**
 * Fila com concorrência fixa; `handleTask` pode enfileirar novas tarefas (BFS dinâmico).
 * Um erro em um diretório nunca aborta o scan inteiro.
 */
async function drainDirectoryQueue(seeds: readonly DirectoryTask[], limit: number, state: ScanState): Promise<void> {
  const queue: DirectoryTask[] = [...seeds];
  let active = 0;

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      if (queue.length === 0 && active === 0) {
        resolve();
        return;
      }

      while (active < limit && queue.length > 0) {
        const task = queue.shift();
        if (task === undefined) break;

        active += 1;

        void handleTask(task, state)
          .then((children) => {
            queue.push(...children);
          })
          .catch(() => {
            // Erro em um diretório nunca aborta o scan inteiro.
          })
          .finally(() => {
            active -= 1;
            pump();
          });
      }
    };

    pump();
  });
}

function listChildDirectories(dir: string, listing: DirectoryListing): string[] {
  const children: string[] = [];

  for (const entry of listing.entries) {
    if (shouldSkipEntry(entry)) continue;

    const childPath = path.join(dir, entry.name);
    if (isHubDirectory(childPath)) continue;

    children.push(childPath);
  }

  return children;
}

async function buildProjectDraft(
  dir: string,
  listing: DirectoryListing,
  parentPath: string | null,
  nameOverride?: string,
): Promise<ProjectDraft | null> {
  const hasPackageJson = listing.names.has(PACKAGE_JSON);
  const hasGit = listing.names.has(GIT_ENTRY);

  if (!hasPackageJson && !hasGit) return null;

  const packageJson = hasPackageJson ? await readPackageJson(dir) : null;
  const kind: ProjectKind = packageJson === null ? 'non-node' : 'node';
  const lockfileManager = detectLockfileManager(listing.names);
  const packageManager: PackageManager | null = packageJson === null ? null : (lockfileManager ?? 'npm');

  return {
    path: dir,
    name: nameOverride ?? resolveProjectName(dir),
    packageName: packageJson?.name ?? null,
    parentPath,
    kind,
    stack: packageJson === null ? [] : detectStack({ dependencies: packageJson.dependencyNames, fileNames: listing.names }),
    packageManager,
    scripts: packageJson?.scripts ?? [],
    gitBranch: null,
    gitHeadAt: null,
    hasGit,
    workspacePatterns: packageJson?.workspacePatterns ?? [],
    lockfileManager: packageJson === null ? null : lockfileManager,
  };
}

function toScannedProject(draft: ProjectDraft): ScannedProject {
  return {
    path: draft.path,
    name: draft.name,
    packageName: draft.packageName,
    parentPath: draft.parentPath,
    kind: draft.kind,
    stack: draft.stack,
    packageManager: draft.packageManager,
    scripts: draft.scripts,
    gitBranch: draft.gitBranch,
    gitHeadAt: draft.gitHeadAt,
  };
}

async function readTextFile(target: string): Promise<string | null> {
  try {
    const buffer = await fs.readFile(target);
    return decodeUtf8(buffer);
  } catch {
    return null;
  }
}

/** Parser mínimo de `pnpm-workspace.yaml` (só a lista `packages:`), sem dependência de YAML. */
export function parsePnpmWorkspacePatterns(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').replace(/\s+$/, '');
    const trimmed = line.trim();

    if (trimmed.length === 0) continue;

    if (/^packages\s*:/.test(trimmed)) {
      inPackages = true;
      continue;
    }

    if (!inPackages) continue;

    const item = /^-\s*(.+)$/.exec(trimmed);

    if (item !== null) {
      const value = (item[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
      if (value.length > 0) patterns.push(value);
      continue;
    }

    if (/^\S/.test(line)) inPackages = false;
  }

  return patterns;
}

async function readWorkspacePatterns(
  dir: string,
  listing: DirectoryListing,
  draft: ProjectDraft,
): Promise<string[]> {
  const patterns = new Set<string>(draft.workspacePatterns);

  for (const fileName of PNPM_WORKSPACE_FILES) {
    if (!listing.names.has(fileName)) continue;

    const content = await readTextFile(path.join(/* turbopackIgnore: true */ dir, fileName));
    if (content === null) continue;

    for (const pattern of parsePnpmWorkspacePatterns(content)) patterns.add(pattern);
  }

  return [...patterns];
}

async function listSubdirectories(dir: string): Promise<string[]> {
  const listing = await readDirectory(dir);
  if (listing === null) return [];

  return listing.entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && !isSkippedDirName(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

/** Expande um glob de workspace (`apps/*`, `packages/**`) em diretórios reais. */
async function matchWorkspacePattern(baseDir: string, pattern: string): Promise<string[]> {
  const normalized = pattern.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

  if (normalized.length === 0 || normalized.startsWith('/') || containsTraversal(normalized)) return [];

  const segments = normalized.split('/').filter((segment) => segment.length > 0 && segment !== '.');
  let current: string[] = [baseDir];

  for (const segment of segments) {
    const next: string[] = [];

    for (const dir of current) {
      if (segment === '**') {
        const level = await listSubdirectories(dir);
        next.push(dir, ...level);

        for (const child of level) {
          next.push(...(await listSubdirectories(child)));
        }
      } else if (segment === '*') {
        next.push(...(await listSubdirectories(dir)));
      } else {
        const candidate = path.join(dir, segment);
        if (await isDirectory(candidate)) next.push(candidate);
      }

      if (next.length >= MAX_WORKSPACE_MATCHES) break;
    }

    current = next.slice(0, MAX_WORKSPACE_MATCHES);
    if (current.length === 0) return [];
  }

  return current;
}

async function expandWorkspacePatterns(
  baseDir: string,
  patterns: readonly string[],
  state: ScanState,
): Promise<string[]> {
  const matches: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    // Negação (`!packages/x`) não é suportada: o custo de ignorar é listar um pacote a mais.
    if (pattern.startsWith('!')) continue;

    for (const candidate of await matchWorkspacePattern(baseDir, pattern)) {
      const key = comparisonKey(candidate);
      if (seen.has(key)) continue;

      seen.add(key);

      if (isHubDirectory(candidate)) continue;
      if (isSkippedDirName(path.basename(candidate))) continue;
      if (!isInsideRoots(candidate, state.roots)) continue;
      if (!(await isDirectory(candidate))) continue;

      matches.push(candidate);

      if (matches.length >= MAX_WORKSPACE_MATCHES) return matches;
    }
  }

  return matches;
}

async function handleTask(task: DirectoryTask, state: ScanState): Promise<readonly DirectoryTask[]> {
  if (Date.now() > state.deadline) return [];

  const key = comparisonKey(task.dir);
  if (state.visited.has(key)) return [];
  state.visited.add(key);

  if (isHubDirectory(task.dir)) return [];

  const listing = await readDirectory(task.dir);

  if (listing === null) {
    if (task.depth === 0) state.skipped += 1;
    return [];
  }

  const isCandidate = listing.names.has(PACKAGE_JSON) || listing.names.has(GIT_ENTRY);

  if (task.depth >= 1 && isCandidate) {
    const draft = await buildProjectDraft(task.dir, listing, task.parentPath);
    if (draft === null) return [];

    state.drafts.set(key, draft);

    const children: DirectoryTask[] = [];

    if (task.depth < state.maxDepth) {
      for (const child of listChildDirectories(task.dir, listing)) {
        children.push({ dir: child, depth: task.depth + 1, parentPath: task.dir });
      }
    }

    // Passo 3.1: filhos de workspace contam profundidade 1 relativa ao workspace.
    const patterns = await readWorkspacePatterns(task.dir, listing, draft);

    if (patterns.length > 0) {
      for (const match of await expandWorkspacePatterns(task.dir, patterns, state)) {
        children.push({ dir: match, depth: task.depth + 1, parentPath: task.dir });
      }
    }

    return children;
  }

  if (task.depth === 1) {
    // Pasta comum na raiz: aparece como `non-node`, não é iniciável.
    const nonNode: ProjectDraft = {
      path: task.dir,
      name: path.basename(task.dir),
      packageName: null,
      parentPath: null,
      kind: 'non-node',
      stack: [],
      packageManager: null,
      scripts: [],
      gitBranch: null,
      gitHeadAt: null,
      hasGit: false,
      workspacePatterns: [],
      lockfileManager: null,
    };

    state.drafts.set(key, nonNode);
    return [];
  }

  if (task.depth < state.maxDepth) {
    return listChildDirectories(task.dir, listing).map((child) => ({
      dir: child,
      depth: task.depth + 1,
      parentPath: null,
    }));
  }

  return [];
}

async function markVanishedProjects(projects: readonly ScannedProject[], roots: readonly string[]): Promise<number> {
  const seen = new Set(projects.map((project) => comparisonKey(project.path)));

  const candidates = listProjects({ includeHidden: true }).filter(
    (project) =>
      project.source === 'scan' &&
      !seen.has(comparisonKey(project.path)) &&
      roots.some((root) => isInsideRoot(root, project.path)),
  );

  if (candidates.length === 0) return 0;

  const vanished = await selectVanishedPaths(candidates.map((project) => project.path));

  return markMissing(vanished);
}

/**
 * Inspeciona um único diretório como candidato a projeto (usado pelo cadastro manual).
 * Retorna `null` quando o diretório não tem `package.json` nem `.git`.
 */
export async function inspectProjectPath(
  dir: string,
  options: { name?: string } = {},
): Promise<ScannedProject | null> {
  const listing = await readDirectory(dir);
  if (listing === null) return null;

  const draft = await buildProjectDraft(dir, listing, null, options.name);
  if (draft === null) return null;

  if (!draft.hasGit) return toScannedProject(draft);

  const git = await readGitInfo(dir);
  return { ...toScannedProject(draft), gitBranch: git.branch, gitHeadAt: git.headAt };
}

/**
 * Varre as raízes configuradas e persiste os projetos encontrados (§7.1).
 * Tolerante a falhas por diretório e a timeout global: sempre devolve os contadores do que coletou.
 */
export async function scanProjects(options: ScanOptions): Promise<ScanResult> {
  const startedAt = Date.now();
  const config = getConfig();
  const maxDepth = Math.min(Math.max(options.maxDepth ?? config.scanDepth, 1), 2);
  const deadline = startedAt + (options.scanTimeoutMs ?? config.scanTimeoutMs);
  const allowedRoots = config.projectsRoots.map((root) => canonicalizePath(root));

  const state: ScanState = {
    roots: [],
    maxDepth,
    deadline,
    visited: new Set<string>(),
    drafts: new Map<string, ProjectDraft>(),
    skipped: 0,
  };

  const seeds: DirectoryTask[] = [];

  for (const requested of options.roots) {
    let resolved: string;

    try {
      resolved = resolveAllowedPath(requested, allowedRoots);
    } catch {
      state.skipped += 1;
      continue;
    }

    if (!(await isDirectory(resolved))) {
      state.skipped += 1;
      continue;
    }

    state.roots.push(resolved);
    seeds.push({ dir: resolved, depth: 0, parentPath: null });
  }

  if (state.roots.length === 0) {
    throw pathNotAllowed('Nenhuma raiz válida para escanear.', { roots: [...options.roots] });
  }

  await drainDirectoryQueue(seeds, FS_CONCURRENCY, state);

  const drafts = inheritWorkspacePackageManager([...state.drafts.values()]);
  const withGit = await resolveDraftsWithGit(drafts);

  const projects = withGit.map(toScannedProject);
  const counters = upsertScannedProjects(projects);
  const missing = await markVanishedProjects(projects, state.roots);

  return {
    ...counters,
    missing,
    skipped: state.skipped,
    durationMs: Date.now() - startedAt,
  };
}
