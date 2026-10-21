import 'server-only';

import { getDb } from '@/lib/server/db';
import { alreadyRunning } from '@/lib/server/errors';
import type { RunStatus } from '@/lib/shared/types';

/**
 * `process_runs` é o registro de auditoria dos processos (§3.3): toda linha guarda o
 * comando gerado internamente, o PID e o `pid_started_at` (anti-reuso de PID).
 */
export interface RunRow {
  id: string;
  projectId: string;
  script: string;
  command: string;
  pid: number | null;
  pidStartedAt: string | null;
  port: number | null;
  status: RunStatus;
  exitCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  logPath: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface NewRun {
  id: string;
  projectId: string;
  script: string;
  command: string;
  startedAt: string;
}

export interface RunResult {
  status: RunStatus;
  exitCode?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface RawRunRow {
  id: string;
  projectId: string;
  script: string;
  command: string;
  pid: number | null;
  pidStartedAt: string | null;
  port: number | null;
  status: RunStatus;
  exitCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  logPath: string | null;
  startedAt: string;
  endedAt: string | null;
}

const SELECT_RUN = `
  SELECT
    id,
    project_id     AS projectId,
    script,
    command,
    pid,
    pid_started_at AS pidStartedAt,
    port,
    status,
    exit_code      AS exitCode,
    error_code     AS errorCode,
    error_message  AS errorMessage,
    log_path       AS logPath,
    started_at     AS startedAt,
    ended_at       AS endedAt
  FROM process_runs
`;

function mapRun(row: RawRunRow): RunRow {
  return { ...row };
}

/** Run ativo = `ended_at IS NULL`; o índice único parcial garante no máximo um por projeto. */
export function getActiveRun(projectId: string): RunRow | null {
  const row = getDb()
    .prepare<[string], RawRunRow>(`${SELECT_RUN} WHERE project_id = ? AND ended_at IS NULL`)
    .get(projectId);

  return row === undefined ? null : mapRun(row);
}

export function getActiveRuns(): RunRow[] {
  return getDb()
    .prepare<[], RawRunRow>(`${SELECT_RUN} WHERE ended_at IS NULL ORDER BY started_at ASC`)
    .all()
    .map(mapRun);
}

export function getLastFinishedRun(projectId: string): RunRow | null {
  const row = getDb()
    .prepare<[string], RawRunRow>(
      `${SELECT_RUN} WHERE project_id = ? AND ended_at IS NOT NULL ORDER BY started_at DESC, rowid DESC LIMIT 1`,
    )
    .get(projectId);

  return row === undefined ? null : mapRun(row);
}

export function listRuns(projectId: string, limit = 10): RunRow[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);

  return getDb()
    .prepare<[string, number], RawRunRow>(
      `${SELECT_RUN} WHERE project_id = ? ORDER BY started_at DESC, rowid DESC LIMIT ?`,
    )
    .all(projectId, safeLimit)
    .map(mapRun);
}

/** Todos os runs ativos e o último encerrado de cada projeto: 2 queries para a lista inteira (sem N+1). */
export function getRunSummaries(): { active: Map<string, RunRow>; last: Map<string, RunRow> } {
  const db = getDb();

  const active = new Map<string, RunRow>();
  for (const row of db.prepare<[], RawRunRow>(`${SELECT_RUN} WHERE ended_at IS NULL`).all()) {
    active.set(row.projectId, mapRun(row));
  }

  const last = new Map<string, RunRow>();
  const latest = db
    .prepare<[], RawRunRow>(
      `SELECT
         id,
         project_id     AS projectId,
         script,
         command,
         pid,
         pid_started_at AS pidStartedAt,
         port,
         status,
         exit_code      AS exitCode,
         error_code     AS errorCode,
         error_message  AS errorMessage,
         log_path       AS logPath,
         started_at     AS startedAt,
         ended_at       AS endedAt
       FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY started_at DESC, rowid DESC) AS rn
         FROM process_runs
         WHERE ended_at IS NOT NULL
       )
       WHERE rn = 1`,
    )
    .all();

  for (const row of latest) {
    last.set(row.projectId, mapRun(row));
  }

  return { active, last };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT');
}

/**
 * Cria a linha do run antes do spawn (lock durável via índice único parcial).
 * Violação de unicidade = já existe run ativo para o projeto → 409.
 */
export function createRun(input: NewRun): RunRow {
  try {
    getDb()
      .prepare<NewRun>(
        `INSERT INTO process_runs (
           id, project_id, script, command, pid, pid_started_at, port, status,
           exit_code, error_code, error_message, log_path, started_at, ended_at
         ) VALUES (
           @id, @projectId, @script, @command, NULL, NULL, NULL, 'starting',
           NULL, NULL, NULL, NULL, @startedAt, NULL
         )`,
      )
      .run(input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw alreadyRunning('Projeto já possui uma execução ativa.', { projectId: input.projectId });
    }

    throw error;
  }

  const created = getDb()
    .prepare<[string], RawRunRow>(`${SELECT_RUN} WHERE id = ?`)
    .get(input.id);

  if (created === undefined) {
    throw alreadyRunning('Run recém-criado não encontrado.', { runId: input.id });
  }

  return mapRun(created);
}

/** Encerra o run (idempotente): só escreve enquanto `ended_at IS NULL`. */
export function finishRun(id: string, result: RunResult): void {
  getDb()
    .prepare<{
      id: string;
      status: RunStatus;
      exitCode: number | null;
      errorCode: string | null;
      errorMessage: string | null;
      endedAt: string;
    }>(
      `UPDATE process_runs SET
         status        = @status,
         exit_code     = @exitCode,
         error_code    = @errorCode,
         error_message = @errorMessage,
         ended_at      = @endedAt
       WHERE id = @id AND ended_at IS NULL`,
    )
    .run({
      id,
      status: result.status,
      exitCode: result.exitCode ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      endedAt: new Date().toISOString(),
    });
}

export function updateRunPort(id: string, port: number | null): void {
  getDb()
    .prepare<{ id: string; port: number | null }>(
      'UPDATE process_runs SET port = @port WHERE id = @id AND ended_at IS NULL',
    )
    .run({ id, port });
}

export function markRunRunning(id: string, port: number | null): void {
  getDb()
    .prepare<{ id: string; port: number | null }>(
      `UPDATE process_runs SET status = 'running', port = @port WHERE id = @id AND ended_at IS NULL`,
    )
    .run({ id, port });
}

export function setRunStatus(id: string, status: RunStatus): void {
  getDb()
    .prepare<{ id: string; status: RunStatus }>(
      'UPDATE process_runs SET status = @status WHERE id = @id AND ended_at IS NULL',
    )
    .run({ id, status });
}

/** `pid_started_at` é a identidade do PID (WMI CreationDate em UTC); usado antes de qualquer kill. */
export function updateRunIdentity(id: string, pid: number | null, pidStartedAt: string | null): void {
  getDb()
    .prepare<{ id: string; pid: number | null; pidStartedAt: string | null }>(
      'UPDATE process_runs SET pid = @pid, pid_started_at = @pidStartedAt WHERE id = @id AND ended_at IS NULL',
    )
    .run({ id, pid, pidStartedAt });
}

export function setRunError(id: string, errorCode: string, errorMessage: string | null): void {
  getDb()
    .prepare<{ id: string; errorCode: string; errorMessage: string | null }>(
      'UPDATE process_runs SET error_code = @errorCode, error_message = @errorMessage WHERE id = @id',
    )
    .run({ id, errorCode, errorMessage });
}
