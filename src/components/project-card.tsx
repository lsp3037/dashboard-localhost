'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  MoreIcon,
  PencilIcon,
  PlayIcon,
  TrashIcon,
} from '@/components/ui/icons';
import { StackBadges } from '@/components/ui/stack-badges';
import { StatusDot } from '@/components/ui/status-dot';
import { Tooltip } from '@/components/ui/tooltip';
import type { ProjectView } from '@/lib/shared/view-model';

interface ProjectCardProps {
  project: ProjectView;
  index?: number;
  onEdit: (project: ProjectView) => void;
  onToggleHidden: (project: ProjectView) => void;
  onRemove: (project: ProjectView) => void;
}

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-hub-text ' +
  'hover:bg-hub-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hub-accent';

function StartButton({ project }: { project: ProjectView }) {
  const reason =
    project.runnableScripts.length === 0
      ? 'Nenhum script dev/start/preview no package.json'
      : 'Controle de processos chega na F3';

  return (
    <Tooltip label={reason}>
      <Button
        size="sm"
        variant="secondary"
        disabled
        aria-label={`Iniciar ${project.name} — ${reason}`}
        data-script={project.defaultScript ?? undefined}
      >
        <PlayIcon width={12} height={12} />
        Iniciar
      </Button>
    </Tooltip>
  );
}

interface CardMenuProps {
  project: ProjectView;
  onEdit: (project: ProjectView) => void;
  onToggleHidden: (project: ProjectView) => void;
  onRemove: (project: ProjectView) => void;
}

function CardMenu({ project, onEdit, onToggleHidden, onRemove }: CardMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const openMenu = () => {
    setOpen(true);
    window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Ações de ${project.name}`}
        onClick={() => (open ? close() : openMenu())}
        className={[
          'inline-flex h-7 w-7 items-center justify-center rounded-sm border border-transparent',
          'text-hub-text-muted transition-colors hover:border-hub-border-strong hover:bg-hub-surface-raised hover:text-hub-text',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent',
          open ? 'bg-hub-surface-raised text-hub-text' : '',
        ].join(' ')}
      >
        <MoreIcon width={15} height={15} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Ações de ${project.name}`}
          className="absolute right-0 top-full z-30 mt-1 w-44 border border-hub-border-strong bg-hub-surface-raised py-1 shadow-[0_12px_28px_rgba(2,6,23,0.6)]"
        >
          <Link role="menuitem" href={`/projects/${project.id}`} className={MENU_ITEM_CLASS}>
            <ChevronDownIcon width={12} height={12} className="-rotate-90" />
            Detalhe
          </Link>
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM_CLASS}
            onClick={() => {
              close(false);
              onEdit(project);
            }}
          >
            <PencilIcon width={12} height={12} />
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM_CLASS}
            onClick={() => {
              close(false);
              onToggleHidden(project);
            }}
          >
            {project.hidden ? <EyeIcon width={12} height={12} /> : <EyeOffIcon width={12} height={12} />}
            {project.hidden ? 'Mostrar' : 'Ocultar'}
          </button>
          {project.missing && (
            <button
              type="button"
              role="menuitem"
              className={`${MENU_ITEM_CLASS} text-status-error hover:bg-status-error/10`}
              onClick={() => {
                close(false);
                onRemove(project);
              }}
            >
              <TrashIcon width={12} height={12} />
              Remover cadastro
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" className="text-hub-border-strong">
      ·
    </span>
  );
}

/** Card do inventário. Client apenas pelas ações; todo texto vem pronto do servidor. */
export function ProjectCard({ project, index = 0, onEdit, onToggleHidden, onRemove }: ProjectCardProps) {
  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
      className={[
        'group animate-reveal relative flex flex-col gap-2.5 border border-hub-border bg-hub-surface p-3',
        'transition-[border-color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-hub-border-strong',
        'focus-within:border-hub-border-strong',
        project.missing ? 'opacity-55' : '',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-px bg-hub-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusDot tone={project.statusTone} label={project.statusLabel} />
            {project.hidden && <Badge tone="warn">oculto</Badge>}
            {project.missing && <Badge tone="error">pasta não encontrada</Badge>}
          </div>

          <h3 className="mt-1 truncate text-[15px] font-semibold leading-5 tracking-tight">
            <Link
              href={`/projects/${project.id}`}
              className="rounded-sm hover:text-hub-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
            >
              {project.name}
            </Link>
          </h3>

          {project.packageName !== null && project.packageName.toLowerCase() !== project.name.toLowerCase() && (
            <p className="truncate font-mono text-[11px] leading-4 text-hub-text-muted" title={project.packageName}>
              {project.packageName}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <StartButton project={project} />
          <CardMenu project={project} onEdit={onEdit} onToggleHidden={onToggleHidden} onRemove={onRemove} />
        </div>
      </div>

      <StackBadges stack={project.stack} kind={project.kind} />

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[11px] leading-4 text-hub-text-muted">
        <span title={project.gitBranch ? `branch ${project.gitBranch}` : 'Projeto sem .git'}>
          {project.gitBranch ?? 'sem git'}
        </span>
        <Separator />
        <span title={project.cardPort !== null ? 'Porta preferida (o run real chega na F3)' : 'Porta desconhecida'}>
          porta {project.cardPort ?? '—'}
        </span>
        <Separator />
        <span title={project.lastActivityTitle ?? 'Sem atividade registrada'}>
          {project.lastActivityLabel ?? 'sem atividade'}
        </span>
      </div>

      <p className="truncate font-mono text-[11px] leading-4 text-hub-text-muted/70" title={project.path}>
        {project.shortPath}
      </p>
    </article>
  );
}
