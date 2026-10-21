import 'server-only';

import { randomUUID } from 'node:crypto';

import { getDb } from '@/lib/server/db';
import { notFound } from '@/lib/server/errors';
import type { ScannedProject } from '@/lib/server/discovery/types';
import type { PackageManager, ProjectKind, ProjectSource } from '@/lib/shared/types';

export interface ProjectRow {
  id: string;
  name: string;
  /** `package.json.name`, apenas informativo; o nome exibido é o da pasta. */
  packageName: string | null;
  path: string;
  parentId: string | null;
  source: ProjectSource;
  kind: ProjectKind;
  hidden: boolean;
  missing: boolean;
  stack: string[];
  packageManager: PackageManager | null;
  scripts: string[];
  defaultScript: string | null;
  preferredPort: number | null;
  gitBranch: string | null;
  gitHeadAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastScannedAt: string | null;
}

export interface ProjectPatch {
  name?: string;
  notes?: string | null;
  preferredPort?: number | null;
  defaultScript?: string | null;
  hidden?: boolean;
}

export interface UpsertCounters {
  added: number;
  updated: number;
  unchanged: number;
}

export interface ManualProjectInput {
  path: string;
  name: string;
  packageName: string | null;
  kind: ProjectKind;
  stack: readonly string[];
  packageManager: PackageManager | null;
  scripts: readonly string[];
  /** Porta declarada no script; vira preferência inicial se ainda não houver uma. */
  preferredPort: number | null;
  gitBranch: string | null;
  gitHeadAt: string | null;
}

interface RawProjectRow {
  id: string;
  name: string;
  packageName: string | null;
  path: string;
  parentId: string | null;
  source: ProjectSource;
  kind: ProjectKind;
  hidden: number;
  missing: number;
  stack: string;
  packageManager: PackageManager | null;
  scripts: string;
  defaultScript: string | null;
  preferredPort: number | null;
  gitBranch: string | null;
  gitHeadAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastScannedAt: string | null;
}

/** Ordem de preferência do script padrão (§7.2). */
export const DEFAULT_SCRIPT_PREFERENCE: readonly string[] = ['dev', 'start', 'preview'];

const SELECT_PROJECT = `
  SELECT
    id,
    name,
    package_name     AS packageName,
    path,
    parent_id        AS parentId,
    source,
    kind,
    hidden,
    missing,
    stack,
    package_manager  AS packageManager,
    scripts,
    default_script   AS defaultScript,
    preferred_port   AS preferredPort,
    git_branch       AS gitBranch,
    git_head_at      AS gitHeadAt,
    notes,
    created_at       AS createdAt,
    updated_at       AS updatedAt,
    last_scanned_at  AS lastScannedAt
  FROM projects
`;

const INSERT_PROJECT = `
  INSERT INTO projects (
    id, name, package_name, path, parent_id, source, kind, hidden, missing, stack, package_manager,
    scripts, default_script, preferred_port, git_branch, git_head_at, notes,
    created_at, updated_at, last_scanned_at
  ) VALUES (
    @id, @name, @packageName, @path, @parentId, @source, @kind, 0, 0, @stack, @packageManager,
    @scripts, @defaultScript, @preferredPort, @gitBranch, @gitHeadAt, NULL,
    @now, @now, @now
  )
`;

const UPDATE_SCANNED_PROJECT = `
  UPDATE projects SET
    name            = @name,
    package_name    = @packageName,
    parent_id       = @parentId,
    kind            = @kind,
    missing         = 0,
    stack           = @stack,
    package_manager = @packageManager,
    scripts         = @scripts,
    default_script  = @defaultScript,
    preferred_port  = COALESCE(preferred_port, @preferredPort),
    git_branch      = @gitBranch,
    git_head_at     = @gitHeadAt,
    last_scanned_at = @now,
    updated_at      = @now
  WHERE id = @id
`;

interface InsertProjectParams {
  id: string;
  name: string;
  packageName: string | null;
  path: string;
  parentId: string | null;
  source: ProjectSource;
  kind: ProjectKind;
  stack: string;
  packageManager: PackageManager | null;
  scripts: string;
  defaultScript: string | null;
  preferredPort: number | null;
  gitBranch: string | null;
  gitHeadAt: string | null;
  now: string;
}

interface UpdateScannedProjectParams {
  id: string;
  name: string;
  packageName: string | null;
  parentId: string | null;
  kind: ProjectKind;
  stack: string;
  packageManager: PackageManager | null;
  scripts: string;
  defaultScript: string | null;
  preferredPort: number | null;
  gitBranch: string | null;
  gitHeadAt: string | null;
  now: string;
}

interface FullUpdateParams {
  id: string;
  name: string;
  notes: string | null;
  preferredPort: number | null;
  defaultScript: string | null;
  hidden: number;
  now: string;
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function mapRow(raw: RawProjectRow): ProjectRow {
  return {
    id: raw.id,
    name: raw.name,
    packageName: raw.packageName,
    path: raw.path,
    parentId: raw.parentId,
    source: raw.source,
    kind: raw.kind,
    hidden: raw.hidden === 1,
    missing: raw.missing === 1,
    stack: parseStringArray(raw.stack),
    packageManager: raw.packageManager,
    scripts: parseStringArray(raw.scripts),
    defaultScript: raw.defaultScript,
    preferredPort: raw.preferredPort,
    gitBranch: raw.gitBranch,
    gitHeadAt: raw.gitHeadAt,
    notes: raw.notes,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastScannedAt: raw.lastScannedAt,
  };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/** Primeiro de `dev`/`start`/`preview` presente nos scripts; mantém `current` se ainda for válido. */
export function pickDefaultScript(scripts: readonly string[], current: string | null): string | null {
  if (current !== null && scripts.includes(current)) return current;

  for (const candidate of DEFAULT_SCRIPT_PREFERENCE) {
    if (scripts.includes(candidate)) return candidate;
  }

  return null;
}

export function findProjectByPath(projectPath: string): ProjectRow | null {
  const row = getDb()
    .prepare<[string], RawProjectRow>(`${SELECT_PROJECT} WHERE path = ?`)
    .get(projectPath);

  return row === undefined ? null : mapRow(row);
}

export function getProject(id: string): ProjectRow | null {
  const row = getDb().prepare<[string], RawProjectRow>(`${SELECT_PROJECT} WHERE id = ?`).get(id);
  return row === undefined ? null : mapRow(row);
}

export function listProjects(options: { includeHidden?: boolean } = {}): ProjectRow[] {
  const includeHidden = options.includeHidden ?? true;
  const suffix = includeHidden ? '' : ' WHERE hidden = 0';
  const rows = getDb()
    .prepare<[], RawProjectRow>(`${SELECT_PROJECT}${suffix} ORDER BY name COLLATE NOCASE ASC`)
    .all();

  return rows.map(mapRow);
}

/**
 * Insere ou atualiza um projeto descoberto pelo scan, dentro de uma transação.
 * Precedência: `hidden`, `notes` e `preferred_port` nunca são sobrescritos;
 * projeto `manual` mantém `source` e o nome escolhido pelo usuário.
 */
export function upsertScannedProjects(projects: readonly ScannedProject[]): UpsertCounters {
  const counters: UpsertCounters = { added: 0, updated: 0, unchanged: 0 };

  if (projects.length === 0) return counters;

  const db = getDb();
  const selectByPath = db.prepare<[string], RawProjectRow>(`${SELECT_PROJECT} WHERE path = ?`);
  const selectIdByPath = db.prepare<[string], { id: string }>('SELECT id FROM projects WHERE path = ?');
  const insert = db.prepare<InsertProjectParams>(INSERT_PROJECT);
  const update = db.prepare<UpdateScannedProjectParams>(UPDATE_SCANNED_PROJECT);
  const touch = db.prepare<[string, string]>('UPDATE projects SET last_scanned_at = ? WHERE id = ?');

  const resolveParentId = (parentPath: string | null): string | null => {
    if (parentPath === null) return null;
    return selectIdByPath.get(parentPath)?.id ?? null;
  };

  // Pais antes dos filhos: o id do workspace precisa existir para o filho apontar para ele.
  const ordered = [...projects].sort((a, b) => a.path.length - b.path.length);

  const transaction = db.transaction(() => {
    const now = new Date().toISOString();

    for (const project of ordered) {
      const existingRaw = selectByPath.get(project.path);
      const existing = existingRaw === undefined ? null : mapRow(existingRaw);
      const parentId = resolveParentId(project.parentPath);
      const defaultScript = pickDefaultScript(project.scripts, existing?.defaultScript ?? null);

      if (existing === null) {
        insert.run({
          id: randomUUID(),
          name: project.name,
          packageName: project.packageName,
          path: project.path,
          parentId,
          source: 'scan',
          kind: project.kind,
          stack: JSON.stringify(project.stack),
          packageManager: project.packageManager,
          scripts: JSON.stringify(project.scripts),
          defaultScript,
          preferredPort: project.preferredPort,
          gitBranch: project.gitBranch,
          gitHeadAt: project.gitHeadAt,
          now,
        });
        counters.added += 1;
        continue;
      }

      const nextName = existing.source === 'manual' ? existing.name : project.name;
      const unchanged =
        existing.kind === project.kind &&
        existing.packageName === project.packageName &&
        existing.packageManager === project.packageManager &&
        existing.gitBranch === project.gitBranch &&
        existing.gitHeadAt === project.gitHeadAt &&
        existing.parentId === parentId &&
        existing.defaultScript === defaultScript &&
        (existing.preferredPort !== null || project.preferredPort === null) &&
        !existing.missing &&
        arraysEqual(existing.stack, project.stack) &&
        arraysEqual(existing.scripts, project.scripts) &&
        existing.name === nextName;

      if (unchanged) {
        touch.run(now, existing.id);
        counters.unchanged += 1;
        continue;
      }

      update.run({
        id: existing.id,
        name: nextName,
        packageName: project.packageName,
        parentId,
        kind: project.kind,
        stack: JSON.stringify(project.stack),
        packageManager: project.packageManager,
        scripts: JSON.stringify(project.scripts),
        defaultScript,
        preferredPort: project.preferredPort,
        gitBranch: project.gitBranch,
        gitHeadAt: project.gitHeadAt,
        now,
      });
      counters.updated += 1;
    }
  });

  transaction();

  return counters;
}

export function upsertScannedProject(project: ScannedProject): 'added' | 'updated' | 'unchanged' {
  const counters = upsertScannedProjects([project]);

  if (counters.added > 0) return 'added';
  if (counters.updated > 0) return 'updated';
  return 'unchanged';
}

export function insertManualProject(input: ManualProjectInput): ProjectRow {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const defaultScript = pickDefaultScript(input.scripts, null);

  db.prepare<InsertProjectParams>(INSERT_PROJECT).run({
    id,
    name: input.name,
    packageName: input.packageName,
    path: input.path,
    parentId: null,
    source: 'manual',
    kind: input.kind,
    stack: JSON.stringify(input.stack),
    packageManager: input.packageManager,
    scripts: JSON.stringify(input.scripts),
    defaultScript,
    preferredPort: input.preferredPort,
    gitBranch: input.gitBranch,
    gitHeadAt: input.gitHeadAt,
    now,
  });

  const created = getProject(id);
  if (created === null) throw notFound('Projeto recém-criado não encontrado.');
  return created;
}

export function updateProject(id: string, patch: ProjectPatch): ProjectRow {
  const existing = getProject(id);
  if (existing === null) throw notFound(`Projeto ${id} não encontrado.`);

  const nextName = patch.name ?? existing.name;
  const nextNotes = patch.notes !== undefined ? patch.notes : existing.notes;
  const nextPreferredPort = patch.preferredPort !== undefined ? patch.preferredPort : existing.preferredPort;
  const nextDefaultScript = patch.defaultScript !== undefined ? patch.defaultScript : existing.defaultScript;
  const nextHidden = patch.hidden !== undefined ? patch.hidden : existing.hidden;

  getDb()
    .prepare<FullUpdateParams>(
      `UPDATE projects SET
         name           = @name,
         notes          = @notes,
         preferred_port = @preferredPort,
         default_script = @defaultScript,
         hidden         = @hidden,
         updated_at     = @now
       WHERE id = @id`,
    )
    .run({
      id,
      name: nextName,
      notes: nextNotes,
      preferredPort: nextPreferredPort,
      defaultScript: nextDefaultScript,
      hidden: nextHidden ? 1 : 0,
      now: new Date().toISOString(),
    });

  const updated = getProject(id);
  if (updated === null) throw notFound(`Projeto ${id} não encontrado.`);
  return updated;
}

/** Remove da listagem sem tocar no disco (soft delete). Retorna a linha já oculta. */
export function hideProject(id: string): ProjectRow {
  return updateProject(id, { hidden: true });
}

/** Remove a linha (e runs em cascata). Nunca toca nos arquivos do projeto. */
export function deleteProject(id: string): ProjectRow | null {
  const existing = getProject(id);
  if (existing === null) return null;

  getDb().prepare<[string]>('DELETE FROM projects WHERE id = ?').run(id);
  return existing;
}

/** Marca como `missing` os projetos de scan que sumiram do disco. Retorna quantos mudaram. */
export function markMissing(paths: readonly string[]): number {
  if (paths.length === 0) return 0;

  const db = getDb();
  const statement = db.prepare<[string, string]>(
    `UPDATE projects SET missing = 1, updated_at = ?
     WHERE path = ? AND missing = 0 AND source = 'scan'`,
  );
  const now = new Date().toISOString();
  let marked = 0;

  db.transaction(() => {
    for (const projectPath of paths) {
      marked += statement.run(now, projectPath).changes;
    }
  })();

  return marked;
}
