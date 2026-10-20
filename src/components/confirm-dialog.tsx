'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { AlertIcon } from '@/components/ui/icons';
import { ApiError, deleteJson, patchJson } from '@/lib/client/api';
import { pushToast } from '@/lib/client/hub-events';
import type { ProjectView } from '@/lib/shared/view-model';

export type ConfirmActionKind = 'hide' | 'show' | 'remove';

export interface ConfirmAction {
  kind: ConfirmActionKind;
  project: ProjectView;
}

interface ConfirmDialogProps {
  action: ConfirmAction | null;
  onClose: () => void;
}

const COPY: Readonly<
  Record<ConfirmActionKind, { title: string; description: string; confirm: string; variant: 'primary' | 'danger' }>
> = {
  hide: {
    title: 'Ocultar projeto',
    description: 'O card sai do grid por padrão. Nada é apagado do disco nem do banco.',
    confirm: 'Ocultar',
    variant: 'primary',
  },
  show: {
    title: 'Mostrar projeto',
    description: 'O card volta ao grid na visão "Todos".',
    confirm: 'Mostrar',
    variant: 'primary',
  },
  remove: {
    title: 'Remover cadastro',
    description: 'A linha é removida do banco do hub. Os arquivos do projeto no disco não são tocados.',
    confirm: 'Remover cadastro',
    variant: 'danger',
  },
};

export function ConfirmDialog({ action, onClose }: ConfirmDialogProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (pending) return;
    setError(null);
    onClose();
  };

  const run = async () => {
    if (action === null) return;

    const { kind, project } = action;
    setPending(true);
    setError(null);

    try {
      if (kind === 'hide') {
        await deleteJson<unknown>(`/api/projects/${project.id}`);
        pushToast({
          tone: 'success',
          title: 'Projeto oculto',
          description: `${project.name} saiu do grid. Use o filtro Ocultos para reexibir.`,
        });
      } else if (kind === 'show') {
        await patchJson<unknown>(`/api/projects/${project.id}`, { hidden: false });
        pushToast({ tone: 'success', title: 'Projeto visível', description: project.name });
      } else {
        await deleteJson<void>(`/api/projects/${project.id}?hard=1`);
        pushToast({
          tone: 'success',
          title: 'Cadastro removido',
          description: `${project.name} saiu do hub. Nenhum arquivo foi apagado.`,
        });
      }

      onClose();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.friendlyMessage : 'Falha inesperada ao concluir a ação.');
    } finally {
      setPending(false);
    }
  };

  const copy = action !== null ? COPY[action.kind] : null;

  return (
    <Dialog
      open={action !== null}
      title={copy?.title ?? ''}
      description={copy?.description}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant={copy?.variant ?? 'primary'}
            onClick={() => void run()}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? 'Aplicando…' : (copy?.confirm ?? 'Confirmar')}
          </Button>
        </>
      }
    >
      {action !== null && (
        <div className="flex items-start gap-2.5">
          <span aria-hidden="true" className="mt-0.5 text-hub-text-muted">
            <AlertIcon width={16} height={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-hub-text">{action.project.name}</p>
            <p className="mt-0.5 break-all font-mono text-[11px] text-hub-text-muted">{action.project.path}</p>
            {error && (
              <p role="alert" className="mt-2 border border-status-error/50 bg-status-error/5 px-2 py-1 text-[11px] text-status-error">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
