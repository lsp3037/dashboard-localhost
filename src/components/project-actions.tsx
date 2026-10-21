'use client';

import { useState } from 'react';

import { EditProjectDialog } from '@/components/edit-project-dialog';
import { StartStopButton } from '@/components/start-stop-button';
import { Button } from '@/components/ui/button';
import { PencilIcon } from '@/components/ui/icons';
import type { ProjectView } from '@/lib/shared/view-model';

/** Ações do detalhe: Iniciar/Parar (F3) + escolha do script quando há mais de um. */
export function ProjectActions({ project }: { project: ProjectView }) {
  const [editing, setEditing] = useState(false);
  const [script, setScript] = useState<string | null>(project.defaultScript ?? project.runnableScripts[0] ?? null);

  const active = project.run !== null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!active && !project.isHub && project.runnableScripts.length > 1 && (
        <>
          <label htmlFor={`script-${project.id}`} className="sr-only">
            Script para iniciar
          </label>
          <select
            id={`script-${project.id}`}
            value={script ?? ''}
            onChange={(event) => setScript(event.target.value)}
            className="h-8 rounded-sm border border-hub-border-strong bg-hub-bg px-2 font-mono text-[11px] text-hub-text focus-visible:border-hub-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hub-accent"
          >
            {project.runnableScripts.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </>
      )}

      <StartStopButton project={project} size="md" variant="primary" script={script} showScript />

      <Button variant="ghost" onClick={() => setEditing(true)}>
        <PencilIcon width={13} height={13} />
        Editar
      </Button>

      <EditProjectDialog project={editing ? project : null} onClose={() => setEditing(false)} />
    </div>
  );
}
