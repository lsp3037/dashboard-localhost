import { formatDateTime, formatRelativeTime, latestIso, truncateMiddle } from '@/lib/shared/format';
import type { ProjectDTO } from '@/lib/shared/types';

export type StatusTone = 'idle' | 'starting' | 'running' | 'error' | 'blocked';

export type ProjectStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'crashed'
  | 'failed'
  | 'missing'
  | 'hidden';

export interface StatusMeta {
  readonly label: string;
  readonly tone: StatusTone;
}

/**
 * Estados previstos em §5.3. `run`/`lastRun` chegam sempre `null` até a F3 — nada aqui
 * inventa processo ativo: sem run, o projeto é `parado`.
 */
const STATUS_META: Readonly<Record<ProjectStatus, StatusMeta>> = {
  stopped: { label: 'parado', tone: 'idle' },
  starting: { label: 'subindo…', tone: 'starting' },
  running: { label: 'rodando', tone: 'running' },
  stopping: { label: 'encerrando…', tone: 'starting' },
  crashed: { label: 'caiu', tone: 'error' },
  failed: { label: 'falhou', tone: 'error' },
  missing: { label: 'pasta não encontrada', tone: 'blocked' },
  hidden: { label: 'oculto', tone: 'idle' },
};

export function statusMeta(status: ProjectStatus): StatusMeta {
  return STATUS_META[status];
}

function resolveStatus(project: ProjectDTO): ProjectStatus {
  if (project.missing) return 'missing';

  switch (project.run?.status) {
    case 'starting':
      return 'starting';
    case 'running':
      return 'running';
    case 'stopping':
      return 'stopping';
    case 'crashed':
      return 'crashed';
    case 'failed':
      return 'failed';
    default:
      break;
  }

  return project.hidden ? 'hidden' : 'stopped';
}

/** DTO + textos prontos para render (evita divergência entre SSR e hidratação). */
export interface ProjectView extends ProjectDTO {
  readonly status: ProjectStatus;
  readonly statusLabel: string;
  readonly statusTone: StatusTone;
  /** `gitHeadAt`/último run — `updatedAt` não faz parte do DTO público de F1. */
  readonly lastActivityLabel: string | null;
  readonly lastActivityTitle: string | null;
  readonly shortPath: string;
  /** Busca case-insensitive por nome, package name e caminho. */
  readonly searchText: string;
  /** Porta exibida no card: a do run (F3) ou a preferida declarada; nunca inventada. */
  readonly cardPort: number | null;
}

export function toProjectView(project: ProjectDTO, now: number = Date.now()): ProjectView {
  const status = resolveStatus(project);
  const meta = statusMeta(status);

  const lastActivityAt = latestIso([
    project.run?.startedAt,
    project.lastRun?.startedAt,
    project.gitHeadAt,
  ]);

  return {
    ...project,
    status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    lastActivityLabel: formatRelativeTime(lastActivityAt, now),
    lastActivityTitle: formatDateTime(lastActivityAt),
    shortPath: truncateMiddle(project.path, 44),
    searchText: `${project.name} ${project.packageName ?? ''} ${project.path}`.toLowerCase(),
    cardPort: project.run?.port ?? project.preferredPort,
  };
}
