import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/ui/status-dot';
import type { ProjectView } from '@/lib/shared/view-model';

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
  return (
    <Panel title="Status" description="processo">
      <dl className="divide-y divide-hub-border">
        <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
          <dt className="text-[11px] uppercase tracking-[0.08em] text-hub-text-muted">Estado</dt>
          <dd>
            <StatusDot tone={project.statusTone} label={project.statusLabel} />
          </dd>
        </div>
        <Row label="PID">{'—'}</Row>
        <Row label="Porta">{'—'}</Row>
        <Row label="Uptime">{'—'}</Row>
        <Row label="Script padrão">{project.defaultScript ?? 'nenhum'}</Row>
        <Row label="Run ativo">{'nenhum'}</Row>
      </dl>
      <p className="border-t border-hub-border px-3 py-2 text-[11px] leading-4 text-hub-text-muted">
        PID, porta e uptime passam a ser preenchidos quando o controle de processos entrar na F3. Nada aqui é simulado.
      </p>
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

export function RunHistoryPanel() {
  return (
    <Panel title="Últimos runs" description="10 mais recentes">
      <div className="px-3 py-6">
        <p className="text-[12px] font-medium text-hub-text">Nenhuma execução registrada</p>
        <p className="mt-1 max-w-prose text-[11px] leading-4 text-hub-text-muted">
          O histórico aparece aqui quando o controle de processos (F3) e os logs (F4) estiverem ativos. O hub ainda não
          inicia nada.
        </p>
      </div>
    </Panel>
  );
}
