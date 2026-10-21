import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CopyPathButton } from '@/components/copy-path-button';
import { ProjectActions } from '@/components/project-actions';
import { FactGrid, RunHistoryPanel, ScriptsPanel, StatusPanel } from '@/components/project-sections';
import { RunMonitor } from '@/components/run-monitor';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftIcon } from '@/components/ui/icons';
import { StackBadges } from '@/components/ui/stack-badges';
import { StatusDot } from '@/components/ui/status-dot';
import { loadProjectDetail } from '@/lib/server/overview';
import { getProject } from '@/lib/server/repos/projects';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const row = getProject(id);

  return { title: row === null ? 'Projeto não encontrado' : row.name };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const snapshot = loadProjectDetail(id);

  if (snapshot === null) {
    notFound();
  }

  const { project, runs } = snapshot;
  const active = project.run !== null;

  return (
    <div className="flex flex-col gap-4">
      <RunMonitor projectIds={active ? [project.id] : []} active={active} />
      <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-2 text-[11px] text-hub-text-muted">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-sm hover:text-hub-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
        >
          <ArrowLeftIcon width={12} height={12} />
          Projetos
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-mono text-hub-text-muted/80">{project.parentId !== null ? 'workspace' : 'projeto'}</span>
        <span aria-hidden="true">/</span>
        <span className="truncate font-mono text-hub-text">{project.name}</span>
      </nav>

      <header className="animate-reveal border border-hub-border bg-hub-surface">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusDot tone={project.statusTone} label={project.statusLabel} />
              <Badge tone="neutral">{project.kind === 'node' ? 'node' : 'sem app'}</Badge>
              {project.hidden && <Badge tone="warn">oculto</Badge>}
              {project.missing && <Badge tone="error">pasta não encontrada</Badge>}
            </div>

            <h1 className="mt-2 text-[26px] font-semibold leading-8 tracking-tight text-hub-text">{project.name}</h1>

            {project.packageName !== null && project.packageName.toLowerCase() !== project.name.toLowerCase() && (
              <p className="mt-0.5 font-mono text-[12px] text-hub-text-muted">{project.packageName}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code
                className="max-w-full truncate rounded-sm border border-hub-border bg-hub-bg px-2 py-1 font-mono text-[11px] text-hub-text"
                title={project.path}
              >
                {project.path}
              </code>
              <CopyPathButton path={project.path} />
            </div>

            <div className="mt-3">
              <StackBadges stack={project.stack} kind={project.kind} max={6} />
            </div>
          </div>

          <ProjectActions project={project} />
        </div>

        <FactGrid project={project} />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusPanel project={project} />
        <ScriptsPanel project={project} />
      </div>

      <RunHistoryPanel runs={runs} />

      {project.notes !== null && project.notes.length > 0 && (
        <section className="border border-hub-border bg-hub-surface">
          <header className="border-b border-hub-border px-3 py-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-hub-text-muted">Notas</h2>
          </header>
          <p className="whitespace-pre-wrap px-3 py-3 text-[12px] leading-5 text-hub-text">{project.notes}</p>
        </section>
      )}
    </div>
  );
}
