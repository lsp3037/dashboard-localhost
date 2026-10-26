import 'server-only';

import fs from 'node:fs';
import { cache } from 'react';

import { getConfig } from '@/lib/server/config';
import type { HubConfig } from '@/lib/server/config';
import { toProjectDto, attachRuns } from '@/lib/server/dto';
import { getProject, listProjects } from '@/lib/server/repos/projects';
import { getActiveRun, getLastFinishedRun, getRunSummaries, listRuns } from '@/lib/server/repos/runs';
import { getHubSettings } from '@/lib/server/repos/settings';
import type { ProjectRow } from '@/lib/server/repos/projects';
import { formatDateTime, formatRelativeTime, latestIso } from '@/lib/shared/format';
import { toProjectView, toRunView } from '@/lib/shared/view-model';
import type { ProjectView, RunView } from '@/lib/shared/view-model';

/**
 * Determina se o sistema precisa do fluxo de onboarding:
 * `true` se onboarding_completed for falso OU se nenhuma raiz configurada existir no sistema de arquivos host.
 */
export function checkNeedsOnboarding(roots: readonly string[]): boolean {
  const settings = getHubSettings();
  if (!settings.onboardingCompleted) {
    return true;
  }

  const anyRootExists = roots.some((root) => {
    try {
      return fs.existsSync(root) && fs.statSync(root).isDirectory();
    } catch {
      return false;
    }
  });

  return !anyRootExists;
}

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
  readonly needsOnboarding: boolean;
}

export const loadInventory = cache((): InventorySnapshot => {
  const config = getConfig();
  const rows = listProjects({ includeHidden: true });
  const now = Date.now();
  const lastScannedAt = latestIso(rows.map((row) => row.lastScannedAt));
  const { active, last } = getRunSummaries();
  const needsOnboarding = checkNeedsOnboarding(config.projectsRoots);

  const projects = rows.map((row) => {
    const dto = attachRuns(
      toProjectDto(row, config.allowedScripts),
      active.get(row.id) ?? null,
      last.get(row.id) ?? null,
    );

    return toProjectView(dto, now);
  });

  return {
    projects,
    roots: config.projectsRoots,
    lastScannedAt,
    lastScanLabel: formatRelativeTime(lastScannedAt, now),
    lastScanTitle: formatDateTime(lastScannedAt),
    needsOnboarding,
  };
});

export interface ProjectDetailSnapshot {
  readonly project: ProjectView;
  readonly runs: RunView[];
}

/** Detalhe lê o run ativo direto do banco: sem side effects no render (adoção é do `/status`). */
export function loadProjectDetail(id: string): ProjectDetailSnapshot | null {
  const row = getProject(id);
  if (row === null) return null;

  return buildProjectDetail(row, Date.now());
}

function buildProjectDetail(row: ProjectRow, now: number): ProjectDetailSnapshot {
  const config = getConfig();
  const dto = attachRuns(toProjectDto(row, config.allowedScripts), getActiveRun(row.id), getLastFinishedRun(row.id));

  return {
    project: toProjectView(dto, now),
    runs: listRuns(row.id, 10).map((run) => toRunView(run, now)),
  };
}

export interface SettingsSnapshot {
  readonly config: HubConfig;
  readonly projectCount: number;
  readonly lastScannedAt: string | null;
  readonly lastScanLabel: string | null;
  readonly lastScanTitle: string | null;
  readonly needsOnboarding: boolean;
  readonly onboardingCompleted: boolean;
}

export function loadSettings(): SettingsSnapshot {
  const config = getConfig();
  const rows = listProjects({ includeHidden: true });
  const now = Date.now();
  const lastScannedAt = latestIso(rows.map((row) => row.lastScannedAt));
  const settings = getHubSettings();
  const needsOnboarding = checkNeedsOnboarding(config.projectsRoots);

  return {
    config,
    projectCount: rows.length,
    lastScannedAt,
    lastScanLabel: formatRelativeTime(lastScannedAt, now),
    lastScanTitle: formatDateTime(lastScannedAt),
    needsOnboarding,
    onboardingCompleted: settings.onboardingCompleted,
  };
}
