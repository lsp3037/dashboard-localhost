import { formatDateTime, formatElapsed, formatRelativeTime, latestIso, truncateMiddle } from '@/lib/shared/format';
import type { ProjectDTO, RunStatus } from '@/lib/shared/types';

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
 * Estados previstos em §5.3. O hub aparece como `running`; os demais projetos só
 * ficam ativos quando há um run correspondente. Sem run, o projeto é `parado`.
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

  // O hub é servido por este processo: está sempre rodando e não tem run gerenciado.
  if (project.isHub) return 'running';

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

  // Sem run ativo, o card ainda mostra o desfecho do último run (caiu/falhou).
  if (project.lastRun?.status === 'crashed') return 'crashed';
  if (project.lastRun?.status === 'failed') return 'failed';

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
  /** Uptime do run ativo ("3 min"); `null` quando parado. */
  readonly uptimeLabel: string | null;
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
    uptimeLabel:
      project.run === null ? null : formatElapsed(project.run.startedAt, project.run.endedAt ?? null, now),
  };
}

/** Linha mínima de `process_runs` necessária para render (sem importar tipos de servidor). */
export interface RunRecord {
  readonly id: string;
  readonly script: string;
  readonly status: RunStatus;
  readonly port: number | null;
  readonly pid: number | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly exitCode: number | null;
  readonly errorCode: string | null;
}

export interface RunView extends RunRecord {
  readonly statusLabel: string;
  readonly statusTone: StatusTone;
  readonly startedAtLabel: string | null;
  readonly endedAtLabel: string | null;
  readonly durationLabel: string | null;
}

export function toRunView(run: RunRecord, now: number = Date.now()): RunView {
  const meta = statusMeta(run.status);

  return {
    ...run,
    statusLabel: meta.label,
    statusTone: meta.tone,
    startedAtLabel: formatDateTime(run.startedAt),
    endedAtLabel: formatDateTime(run.endedAt),
    durationLabel: formatElapsed(run.startedAt, run.endedAt, now),
  };
}
