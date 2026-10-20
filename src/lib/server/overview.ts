import 'server-only';

import { getConfig } from '@/lib/server/config';
import type { HubConfig } from '@/lib/server/config';
import { toProjectDto } from '@/lib/server/dto';
import { listProjects } from '@/lib/server/repos/projects';
import { formatDateTime, formatRelativeTime, latestIso } from '@/lib/shared/format';
import { toProjectView } from '@/lib/shared/view-model';
import type { ProjectView } from '@/lib/shared/view-model';

/**
 * Leituras de tela prontas para render. Ficam fora dos componentes porque
 * `Date.now()` é impuro e não pode ser chamado durante o render (react-hooks/purity).
 */

export interface InventorySnapshot {
  readonly projects: ProjectView[];
  readonly roots: readonly string[];
  readonly lastScannedAt: string | null;
  readonly lastScanLabel: string | null;
  readonly lastScanTitle: string | null;
}

export function loadInventory(): InventorySnapshot {
  const config = getConfig();
  const rows = listProjects({ includeHidden: true });
  const now = Date.now();
  const lastScannedAt = latestIso(rows.map((row) => row.lastScannedAt));

  return {
    projects: rows.map((row) => toProjectView(toProjectDto(row, config.allowedScripts), now)),
    roots: config.projectsRoots,
    lastScannedAt,
    lastScanLabel: formatRelativeTime(lastScannedAt, now),
    lastScanTitle: formatDateTime(lastScannedAt),
  };
}

export interface SettingsSnapshot {
  readonly config: HubConfig;
  readonly projectCount: number;
  readonly lastScannedAt: string | null;
  readonly lastScanLabel: string | null;
  readonly lastScanTitle: string | null;
}

export function loadSettings(): SettingsSnapshot {
  const config = getConfig();
  const rows = listProjects({ includeHidden: true });
  const now = Date.now();
  const lastScannedAt = latestIso(rows.map((row) => row.lastScannedAt));

  return {
    config,
    projectCount: rows.length,
    lastScannedAt,
    lastScanLabel: formatRelativeTime(lastScannedAt, now),
    lastScanTitle: formatDateTime(lastScannedAt),
  };
}
