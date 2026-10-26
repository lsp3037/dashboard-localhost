'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { AddProjectDialog } from '@/components/add-project-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { ConfirmAction } from '@/components/confirm-dialog';
import { EditProjectDialog } from '@/components/edit-project-dialog';
import { EmptyState, ScanCta } from '@/components/empty-state';
import { OnboardingDialog } from '@/components/onboarding-dialog';
import { ProjectGrid } from '@/components/project-grid';
import { RunMonitor } from '@/components/run-monitor';
import { Button } from '@/components/ui/button';
import { CloseIcon, FolderIcon, PlusIcon, SearchIcon } from '@/components/ui/icons';
import { ProjectGridSkeleton } from '@/components/ui/skeleton';
import { subscribeScanning } from '@/lib/client/hub-events';
import { FILTER_LABELS } from '@/lib/shared/labels';
import type { ProjectView } from '@/lib/shared/view-model';

type Filter = keyof typeof FILTER_LABELS;

interface ProjectBrowserProps {
  projects: ProjectView[];
  roots: readonly string[];
  /** "dados de 5 min atrás", calculado no servidor. */
  lastScanLabel: string | null;
  lastScanTitle: string | null;
  needsOnboarding?: boolean;
}

function isActiveRun(project: ProjectView): boolean {
  return project.status === 'starting' || project.status === 'running' || project.status === 'stopping';
}

export function ProjectBrowser({
  projects,
  roots,
  lastScanLabel,
  lastScanTitle,
  needsOnboarding = false,
}: ProjectBrowserProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(needsOnboarding);
  const [editing, setEditing] = useState<ProjectView | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => subscribeScanning(setScanning), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const activeElement = document.activeElement;
        const tagName = activeElement?.tagName.toLowerCase();
        const isEditable =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          (activeElement instanceof HTMLElement && activeElement.isContentEditable);

        if (!isEditable) {
          event.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const counts = useMemo(() => {
    const running = projects.filter(isActiveRun).length;
    const hidden = projects.filter((project) => project.hidden).length;
    return { all: projects.length - hidden, running, hidden };
  }, [projects]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matchesFilter = (project: ProjectView): boolean => {
      if (filter === 'hidden') return project.hidden;
      if (project.hidden) return false;
      if (filter === 'running') return isActiveRun(project);
      return true;
    };

    const matchesQuery = (project: ProjectView): boolean =>
      needle.length === 0 || project.searchText.includes(needle);

    const matched = projects.filter((project) => matchesFilter(project) && matchesQuery(project));

    // Um pacote visível mantém o workspace visível (mesmo que o pai não case com a busca).
    const byId = new Map(projects.map((project) => [project.id, project]));
    const included = new Set(matched.map((project) => project.id));

    for (const project of [...matched]) {
      if (project.parentId === null) continue;
      if (included.has(project.parentId)) continue;
      const parent = byId.get(project.parentId);
      if (parent !== undefined) {
        matched.push(parent);
        included.add(parent.id);
      }
    }

    return matched;
  }, [projects, filter, query]);

  const filters: Filter[] = ['all', 'running', 'hidden'];
  const rootLabel = roots[0] ?? String.raw`C:\Projetos`;
  const activeIds = useMemo(
    // O hub está sempre rodando, mas não tem run gerenciado para o polling consultar.
    () => projects.filter((project) => isActiveRun(project) && !project.isHub).map((project) => project.id),
    [projects],
  );

  return (
    <>
      <RunMonitor projectIds={activeIds} active={activeIds.length > 0} />
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-7 tracking-tight text-hub-text">Inventário</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-hub-text-muted">
              <span>
                {counts.all} {counts.all === 1 ? 'projeto' : 'projetos'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {counts.hidden} {counts.hidden === 1 ? 'oculto' : 'ocultos'}
              </span>
              {lastScanLabel !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span title={lastScanTitle ?? undefined}>
                    {lastScanLabel === 'agora'
                      ? 'dados atualizados agora'
                      : `dados de ${lastScanLabel.replace(/^há\s+/, '')} atrás`}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SearchIcon
                width={13}
                height={13}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-hub-text-muted"
              />
              <label htmlFor="project-search" className="sr-only">
                Buscar por nome ou caminho
              </label>
              <input
                id="project-search"
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    if (query.length > 0) {
                      setQuery('');
                    } else {
                      event.currentTarget.blur();
                    }
                  }
                }}
                placeholder="Buscar nome ou caminho"
                autoComplete="off"
                spellCheck={false}
                className="h-8 w-56 rounded-sm border border-hub-border-strong bg-hub-bg pl-7 pr-7 font-mono text-[11px] text-hub-text placeholder:font-sans placeholder:text-hub-text-muted/60 focus-visible:border-hub-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hub-accent sm:w-64"
              />
              {query.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Limpar busca"
                  className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-hub-text-muted hover:text-hub-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
                >
                  <CloseIcon width={12} height={12} />
                </button>
              ) : (
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  <kbd className="pointer-events-none hidden font-mono text-[10px] text-hub-text-muted sm:inline">/</kbd>
                </span>
              )}
            </div>

            <Button
              variant="secondary"
              onClick={() => setOnboardingOpen(true)}
              title="Reconfigurar pastas e nível de varredura"
            >
              <FolderIcon width={13} height={13} />
              Pastas
            </Button>
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <PlusIcon width={13} height={13} />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-hub-border pb-2" role="group" aria-label="Filtrar projetos">
          {filters.map((value) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(value)}
                className={[
                  'inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-[11px] transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent',
                  active
                    ? 'border-hub-border-strong bg-hub-surface-raised text-hub-text'
                    : 'border-transparent text-hub-text-muted hover:border-hub-border hover:text-hub-text',
                ].join(' ')}
              >
                {FILTER_LABELS[value]}
                <span className="font-mono text-[10px] tabular-nums text-hub-text-muted">{counts[value]}</span>
              </button>
            );
          })}
          <span aria-live="polite" className="ml-auto font-mono text-[10px] text-hub-text-muted">
            {visible.length} exibido(s)
          </span>
        </div>
      </div>

      {scanning ? (
        <ProjectGridSkeleton count={Math.max(6, Math.min(projects.length, 9))} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto no inventário"
          description="O hub lê as raízes monitoradas procurando package.json ou .git. A primeira varredura popula o grid."
        >
          <ScanCta rootLabel={rootLabel} />
          <Button variant="secondary" onClick={() => setOnboardingOpen(true)}>
            <FolderIcon width={13} height={13} />
            Configurar pastas
          </Button>
          <Button variant="ghost" onClick={() => setAddOpen(true)}>
            <PlusIcon width={13} height={13} />
            Adicionar por caminho
          </Button>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            query.trim().length > 0
              ? 'Nada corresponde à busca'
              : filter === 'running'
                ? 'Nenhum projeto rodando'
                : 'Nenhum projeto oculto'
          }
          description={
            query.trim().length > 0
              ? `Nenhum projeto tem "${query.trim()}" no nome ou no caminho.`
              : filter === 'running'
                ? 'Nenhum projeto com processo ativo. Use Iniciar em um card para subir o dev server.'
                : 'Use o menu ⋯ de um card para ocultá-lo. Projetos ocultos saem do grid sem apagar nada.'
          }
        >
          {query.trim().length > 0 && (
            <Button variant="secondary" onClick={() => setQuery('')}>
              Limpar busca
            </Button>
          )}
          <Button variant="ghost" onClick={() => setFilter('all')}>
            Ver todos
          </Button>
        </EmptyState>
      ) : (
        <ProjectGrid
          projects={visible}
          onEdit={setEditing}
          onToggleHidden={(project) => setConfirm({ kind: project.hidden ? 'show' : 'hide', project })}
          onRemove={(project) => setConfirm({ kind: 'remove', project })}
        />
      )}

      <AddProjectDialog open={addOpen} onClose={() => setAddOpen(false)} roots={roots} />
      <EditProjectDialog key={editing?.id ?? 'none'} project={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog action={confirm} onClose={() => setConfirm(null)} />
      <OnboardingDialog
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        defaultRoots={roots}
        isReconfiguration={projects.length > 0}
      />
    </>
  );
}
