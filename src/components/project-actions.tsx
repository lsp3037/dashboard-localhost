'use client';

import { useState } from 'react';

import { EditProjectDialog } from '@/components/edit-project-dialog';
import { Button } from '@/components/ui/button';
import { PencilIcon, PlayIcon, StopIcon } from '@/components/ui/icons';
import { Tooltip } from '@/components/ui/tooltip';
import type { ProjectView } from '@/lib/shared/view-model';

/** Ações do detalhe: Iniciar/Parar ficam desabilitados até a F3 (§9). */
export function ProjectActions({ project }: { project: ProjectView }) {
  const [editing, setEditing] = useState(false);

  const startReason =
    project.runnableScripts.length === 0
      ? 'Nenhum script dev/start/preview no package.json'
      : 'Controle de processos chega na F3';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip label={startReason}>
        <Button variant="primary" disabled aria-label={`Iniciar ${project.name} — ${startReason}`}>
          <PlayIcon width={13} height={13} />
          Iniciar
        </Button>
      </Tooltip>

      <Tooltip label="Nada para parar até o controle de processos entrar na F3">
        <Button variant="secondary" disabled aria-label={`Parar ${project.name} — controle de processos chega na F3`}>
          <StopIcon width={13} height={13} />
          Parar
        </Button>
      </Tooltip>

      <Button variant="ghost" onClick={() => setEditing(true)}>
        <PencilIcon width={13} height={13} />
        Editar
      </Button>

      <EditProjectDialog project={editing ? project : null} onClose={() => setEditing(false)} />
    </div>
  );
}
