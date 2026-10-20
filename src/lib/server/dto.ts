import 'server-only';

import type { ProjectRow } from '@/lib/server/repos/projects';
import type { ProjectDTO } from '@/lib/shared/types';

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
