import 'server-only';

import type { RunState } from '@/lib/server/process/runner';
import type { ProjectRow } from '@/lib/server/repos/projects';
import type { RunRow } from '@/lib/server/repos/runs';
import type { ProjectDTO, RunDTO, RunSummaryDTO } from '@/lib/shared/types';

/** `runnableScripts` = scripts do projeto ∩ allowlist, na ordem da allowlist (§7.2). */
export function getRunnableScripts(scripts: readonly string[], allowedScripts: readonly string[]): string[] {
  return allowedScripts.filter((script) => scripts.includes(script));
}

export function toProjectDto(row: ProjectRow, allowedScripts: readonly string[]): ProjectDTO {
  const runnableScripts = getRunnableScripts(row.scripts, allowedScripts);
  const defaultScript =
    row.defaultScript !== null && runnableScripts.includes(row.defaultScript)
      ? row.defaultScript
      : (runnableScripts[0] ?? null);

  return {
    id: row.id,
    name: row.name,
    packageName: row.packageName,
    path: row.path,
    parentId: row.parentId,
    kind: row.kind,
    hidden: row.hidden,
    missing: row.missing,
    stack: [...row.stack],
    packageManager: row.packageManager,
    scripts: [...row.scripts],
    runnableScripts,
    defaultScript,
    preferredPort: row.preferredPort,
    notes: row.notes,
    gitBranch: row.gitBranch,
    gitHeadAt: row.gitHeadAt,
    run: null,
    lastRun: null,
  };
}

/** Resumo embutido no card (§4.3). */
export function toRunSummary(row: RunRow): RunSummaryDTO {
  return {
    id: row.id,
    script: row.script,
    status: row.status,
    port: row.port,
    pid: row.pid,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    exitCode: row.exitCode,
    errorCode: row.errorCode,
  };
}

export function attachRuns(dto: ProjectDTO, run: RunRow | null, lastRun: RunRow | null): ProjectDTO {
  dto.run = run === null ? null : toRunSummary(run);
  dto.lastRun = lastRun === null ? null : toRunSummary(lastRun);
  return dto;
}

/** Payload completo de `/start`, `/stop` e `/status` (§4.3). */
export function toRunDto(run: RunRow | RunState): RunDTO {
  const id = 'runId' in run ? run.runId : run.id;

  return {
    id,
    projectId: run.projectId,
    script: run.script,
    command: run.command,
    status: run.status,
    pid: run.pid,
    port: run.port,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    exitCode: run.exitCode,
    errorCode: run.errorCode,
  };
}
