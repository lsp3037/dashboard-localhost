import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/ui/status-dot';
import type { ProjectView, RunView } from '@/lib/shared/view-model';

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border border-hub-border bg-hub-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hub-border px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-hub-text-muted">{title}</h2>
        {description && <span className="font-mono text-[10px] text-hub-text-muted/70">{description}</span>}
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
      <dt className="text-[11px] uppercase tracking-[0.08em] text-hub-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-[12px] text-hub-text">{children}</dd>
    </div>
  );
}

export function FactGrid({ project }: { project: ProjectView }) {
  return (
    <dl className="grid gap-px border-t border-hub-border bg-hub-border sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-hub-surface px-3 py-2">
        <dt className="text-[10px] uppercase tracking-[0.1em] text-hub-text-muted">Branch</dt>
        <dd className="mt-0.5 truncate font-mono text-[12px] text-hub-text" title={project.gitBranch ?? 'Projeto sem .git'}>
          {project.gitBranch ?? 'sem git'}
        </dd>
      </div>
      <div className="bg-hub-surface px-3 py-2">
        <dt className="text-[10px] uppercase tracking-[0.1em] text-hub-text-muted">Porta preferida</dt>
        <dd className="mt-0.5 font-mono text-[12px] text-hub-text">{project.preferredPort ?? '—'}</dd>
      </div>
      <div className="bg-hub-surface px-3 py-2">
        <dt className="text-[10px] uppercase tracking-[0.1em] text-hub-text-muted">Package manager</dt>
        <dd className="mt-0.5 font-mono text-[12px] text-hub-text">{project.packageManager ?? '—'}</dd>
      </div>
      <div className="bg-hub-surface px-3 py-2">
        <dt className="text-[10px] uppercase tracking-[0.1em] text-hub-text-muted">Última atividade</dt>
        <dd
          className="mt-0.5 truncate font-mono text-[12px] text-hub-text"
          title={project.lastActivityTitle ?? 'Sem atividade registrada'}
        >
          {project.lastActivityLabel ?? '—'}
        </dd>
      </div>
    </dl>
  );
}

export function StatusPanel({ project }: { project: ProjectView }) {
  const run = project.run;
  const last = project.lastRun;
  const errorCode = run?.errorCode ?? last?.errorCode ?? null;
  const exitCode = last?.exitCode ?? null;

  return (
    <Panel title="Status" description="processo">
      <dl className="divide-y divide-hub-border">
        <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
          <dt className="text-[11px] uppercase tracking-[0.08em] text-hub-text-muted">Estado</dt>
          <dd>
            <StatusDot tone={project.statusTone} label={project.statusLabel} />
          </dd>
        </div>
        <Row label="PID">{run?.pid ?? '—'}</Row>
        <Row label="Porta">
          {run?.port !== null && run?.port !== undefined ? (
            <a
              href={`http://localhost:${String(run.port)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm hover:text-hub-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
            >
              localhost:{run.port}
            </a>
          ) : (
            (project.preferredPort ?? '—')
          )}
        </Row>
        <Row label="Uptime">{project.uptimeLabel ?? '—'}</Row>
        <Row label="Script">{run?.script ?? project.defaultScript ?? 'nenhum'}</Row>
        <Row label="Run ativo">
          {run === null ? 'nenhum' : `${run.id.slice(0, 8)} · ${run.status}`}
        </Row>
      </dl>

      {errorCode !== null && (
        <p className="border-t border-hub-border px-3 py-2 font-mono text-[11px] leading-4 text-status-error">
          {errorCode}
          {exitCode !== null ? ` · exit ${String(exitCode)}` : ''}
        </p>
      )}

      {run === null && (
        <p className="border-t border-hub-border px-3 py-2 text-[11px] leading-4 text-hub-text-muted">
          {last === null
            ? 'Nenhuma execução registrada neste projeto.'
            : `Último run: ${last.status}${last.exitCode !== null && last.exitCode !== undefined ? ` (exit ${String(last.exitCode)})` : ''}.`}
        </p>
      )}
    </Panel>
  );
}

export function ScriptsPanel({ project }: { project: ProjectView }) {
  return (
    <Panel title="Scripts" description="package.json">
      {project.scripts.length === 0 ? (
        <p className="px-3 py-3 text-[12px] text-hub-text-muted">Nenhum script declarado no package.json.</p>
      ) : (
        <ul className="divide-y divide-hub-border">
          {project.scripts.map((script) => {
            const runnable = project.runnableScripts.includes(script);
            const isDefault = project.defaultScript === script;

            return (
              <li key={script} className="flex items-center gap-2 px-3 py-1.5">
                <code className="font-mono text-[12px] text-hub-text">{script}</code>
                <span className="ml-auto flex items-center gap-1">
                  {isDefault && <Badge tone="neutral">padrão</Badge>}
                  {runnable && <Badge tone="accent">executável</Badge>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {project.runnableScripts.length === 0 && project.scripts.length > 0 && (
        <p className="border-t border-hub-border px-3 py-2 text-[11px] leading-4 text-hub-text-muted">
          Nenhum script <code className="font-mono">dev</code>, <code className="font-mono">start</code> ou{' '}
          <code className="font-mono">preview</code>: o projeto é listado, mas não é iniciável pelo hub.
        </p>
      )}
    </Panel>
  );
}

export function RunHistoryPanel({ runs }: { runs: RunView[] }) {
  return (
    <Panel title="Últimos runs" description="10 mais recentes">
      {runs.length === 0 ? (
        <div className="px-3 py-6">
          <p className="text-[12px] font-medium text-hub-text">Nenhuma execução registrada</p>
          <p className="mt-1 max-w-prose text-[11px] leading-4 text-hub-text-muted">
            Use Iniciar neste projeto. Cada execução guarda script, PID, porta e o desfecho do processo.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-hub-border">
          {runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
              <StatusDot tone={run.statusTone} label={run.statusLabel} />
              <code className="font-mono text-[12px] text-hub-text">{run.script}</code>
              <span className="font-mono text-[11px] text-hub-text-muted">
                {run.port !== null ? `localhost:${String(run.port)}` : 'porta —'}
              </span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-hub-text-muted">
                {run.startedAtLabel ?? '—'}
                {run.durationLabel !== null ? ` · ${run.durationLabel}` : ''}
              </span>
              {(run.errorCode !== null || run.exitCode !== null) && (
                <span className="w-full font-mono text-[10px] text-hub-text-muted/80">
                  {run.errorCode ?? `exit ${String(run.exitCode)}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
