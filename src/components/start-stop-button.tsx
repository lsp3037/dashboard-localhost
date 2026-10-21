'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { ButtonSize, ButtonVariant } from '@/components/ui/button';
import { PlayIcon, StopIcon } from '@/components/ui/icons';
import { Tooltip } from '@/components/ui/tooltip';
import { ApiError, postJson } from '@/lib/client/api';
import { pushToast } from '@/lib/client/hub-events';
import type { RunDTO } from '@/lib/shared/types';
import type { ProjectView } from '@/lib/shared/view-model';

interface StartStopButtonProps {
  project: ProjectView;
  size?: ButtonSize;
  variant?: ButtonVariant;
  /** Sobrescreve o script padrão (ex.: escolha no detalhe). */
  script?: string | null;
  /** Mostra o script no rótulo ("Iniciar dev"). */
  showScript?: boolean;
}

interface RunResponse {
  run: RunDTO;
}

function isActive(project: ProjectView): boolean {
  return project.run !== null;
}

function disabledReason(project: ProjectView, pending: boolean): string | null {
  if (project.isHub) return 'O próprio hub não se inicia nem se para por aqui';
  if (project.missing) return 'Pasta do projeto não encontrada no disco';
  if (project.runnableScripts.length === 0) return 'Nenhum script dev/start/preview no package.json';
  if (pending) return 'Aguarde a operação terminar';
  if (project.status === 'stopping') return 'Encerrando o processo…';
  return null;
}

/** Botão Iniciar/Parar do card e do detalhe (§5.2/§5.3). */
export function StartStopButton({
  project,
  size = 'sm',
  variant = 'secondary',
  script = null,
  showScript = false,
}: StartStopButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState<'start' | 'stop' | null>(null);
  const busy = useRef(false);

  if (project.isHub) {
    return (
      <Tooltip label="Este é o próprio hub: ele não se inicia nem se para por aqui">
        <Button size={size} variant="ghost" disabled aria-label="Hub em execução">
          Hub
        </Button>
      </Tooltip>
    );
  }

  const active = isActive(project);
  const reason = disabledReason(project, pending !== null);
  const chosenScript = script ?? project.defaultScript;
  const label = showScript && !active && chosenScript !== null ? `Iniciar ${chosenScript}` : 'Iniciar';

  const runAction = async (): Promise<void> => {
    if (busy.current) return;

    busy.current = true;
    setPending(active ? 'stop' : 'start');

    try {
      const payload =
        active
          ? await postJson<RunResponse>(`/api/projects/${project.id}/stop`)
          : await postJson<RunResponse>(`/api/projects/${project.id}/start`, {
              script: chosenScript ?? undefined,
            });

      pushToast({
        tone: 'success',
        title: active ? `${project.name} encerrado` : `${project.name} iniciando`,
        description: active
          ? 'A árvore de processos foi encerrada.'
          : `Script ${payload.run.script} · PID ${payload.run.pid ?? '—'}`,
      });
    } catch (error) {
      const description =
        error instanceof ApiError ? error.friendlyMessage : 'Falha inesperada ao falar com o hub.';

      pushToast({ tone: 'error', title: project.name, description });
    } finally {
      busy.current = false;
      setPending(null);
      // ALREADY_RUNNING/NOT_RUNNING também se resolvem com dados frescos do servidor.
      router.refresh();
    }
  };

  return (
    <Tooltip label={reason ?? (active ? `Parar ${project.name}` : `Iniciar ${project.name}`)}>
      <Button
        size={size}
        variant={active ? 'danger' : variant}
        disabled={reason !== null}
        aria-label={
          reason !== null
            ? `${active ? 'Parar' : 'Iniciar'} ${project.name} — ${reason}`
            : `${active ? 'Parar' : 'Iniciar'} ${project.name}`
        }
        onClick={() => {
          void runAction();
        }}
      >
        {pending !== null ? (
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-current" />
        ) : active ? (
          <StopIcon width={12} height={12} />
        ) : (
          <PlayIcon width={12} height={12} />
        )}
        {pending === 'start' ? 'Iniciando…' : pending === 'stop' ? 'Encerrando…' : active ? 'Parar' : label}
      </Button>
    </Tooltip>
  );
}
