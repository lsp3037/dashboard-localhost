'use client';

import Link from 'next/link';
import { useId, useState } from 'react';

import { ProjectCard } from '@/components/project-card';
import { Badge } from '@/components/ui/badge';
import { ChevronDownIcon, ChevronRightIcon, ExternalIcon } from '@/components/ui/icons';
import { StatusDot } from '@/components/ui/status-dot';
import type { ProjectView } from '@/lib/shared/view-model';

interface WorkspaceGroupProps {
  parent: ProjectView;
  /** Pacotes do workspace. Não usar `children` para não colidir com a prop do React. */
  items: ProjectView[];
  onEdit: (project: ProjectView) => void;
  onToggleHidden: (project: ProjectView) => void;
  onRemove: (project: ProjectView) => void;
}

/**
 * O workspace não repete o card do pai: vira uma linha de cabeçalho e os
 * pacotes ficam numa sub-lista indentada e colapsável.
 */
export function WorkspaceGroup({ parent, items, onEdit, onToggleHidden, onRemove }: WorkspaceGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const panelId = useId();

  return (
    <section className="animate-reveal border border-hub-border bg-hub-surface">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="inline-flex items-center gap-1.5 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
        >
          {expanded ? <ChevronDownIcon width={13} height={13} /> : <ChevronRightIcon width={13} height={13} />}
          <span className="text-[13px] font-semibold tracking-tight text-hub-text">{parent.name}</span>
          <span className="sr-only">{expanded ? 'Recolher pacotes' : 'Expandir pacotes'}</span>
        </button>

        <Badge tone="accent">workspace</Badge>
        <span className="font-mono text-[11px] text-hub-text-muted">
          {items.length} {items.length === 1 ? 'pacote' : 'pacotes'}
        </span>
        <StatusDot tone={parent.statusTone} label={parent.statusLabel} />

        <span className="ml-auto flex items-center gap-2">
          <span className="hidden max-w-[22rem] truncate font-mono text-[11px] text-hub-text-muted/70 sm:inline" title={parent.path}>
            {parent.shortPath}
          </span>
          <Link
            href={`/projects/${parent.id}`}
            aria-label={`Abrir detalhe de ${parent.name}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-hub-text-muted hover:bg-hub-surface-raised hover:text-hub-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
          >
            <ExternalIcon width={13} height={13} />
          </Link>
        </span>
      </div>

      {expanded && (
        <div id={panelId} className="border-t border-hub-border bg-hub-bg/40 px-3 py-3">
          <div className="ml-1 border-l border-hub-border pl-3 sm:ml-2 sm:pl-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((child, index) => (
                <ProjectCard
                  key={child.id}
                  project={child}
                  index={index}
                  onEdit={onEdit}
                  onToggleHidden={onToggleHidden}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
