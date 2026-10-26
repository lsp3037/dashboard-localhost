'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DirectoryPicker } from '@/components/directory-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FolderIcon, SpinnerIcon } from '@/components/ui/icons';
import { ApiError, postJson } from '@/lib/client/api';
import { pushToast } from '@/lib/client/hub-events';

interface ManageRootsDialogProps {
  roots: readonly string[];
  scanDepth: number;
}

interface OnboardingResponse {
  success: boolean;
  roots: string[];
  count?: number;
}

export function ManageRootsDialog({ roots: initialRoots, scanDepth: initialScanDepth }: ManageRootsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roots, setRoots] = useState<string[]>(() => [...initialRoots]);
  const [scanDepth, setScanDepth] = useState<number>(initialScanDepth);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpen = () => {
    setRoots([...initialRoots]);
    setScanDepth(initialScanDepth);
    setErrorMessage(null);
    setOpen(true);
  };

  const handleClose = () => {
    if (!pending) {
      setOpen(false);
      setErrorMessage(null);
    }
  };

  const handleSave = async () => {
    if (roots.length === 0) {
      setErrorMessage('Selecione ao menos uma pasta raiz de projetos.');
      return;
    }

    setPending(true);
    setErrorMessage(null);

    try {
      const response = await postJson<OnboardingResponse>('/api/settings/onboarding', {
        projectsRoots: roots,
        scanDepth,
      });

      pushToast({
        tone: 'success',
        title: 'Pastas atualizadas',
        description: `Configurações salvas. ${
          response.count !== undefined ? `${response.count} projetos indexados.` : 'Varredura iniciada.'
        }`,
      });

      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.friendlyMessage);
      } else {
        setErrorMessage('Falha ao atualizar as pastas monitoradas. Tente novamente.');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        <FolderIcon width={13} height={13} />
        Alterar Pastas
      </Button>

      <Dialog
        open={open}
        title="Configurar Pastas de Projetos"
        description="Selecione as pastas do seu computador onde seus repositórios e projetos estão localizados."
        maxWidthClass="w-[min(48rem,calc(100vw-2rem))]"
        onClose={handleClose}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] text-hub-text-muted">
              {roots.length} {roots.length === 1 ? 'pasta selecionada' : 'pastas selecionadas'}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleClose} disabled={pending}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleSave()}
                disabled={pending || roots.length === 0}
                aria-busy={pending}
              >
                {pending ? (
                  <>
                    <SpinnerIcon width={14} height={14} />
                    Salvando e varrendo...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {errorMessage && (
            <div className="rounded-sm border border-status-error/40 bg-status-error/10 p-2.5 text-[12px] text-status-error">
              {errorMessage}
            </div>
          )}

          <DirectoryPicker
            selectedRoots={roots}
            onRootsChange={(newRoots) => {
              setRoots(newRoots);
              if (errorMessage) setErrorMessage(null);
            }}
            initialPath={roots[0]}
          />

          <div className="rounded-sm border border-hub-border bg-hub-surface p-3">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-hub-text-muted">
              Profundidade de Varredura
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScanDepth(2)}
                className={[
                  'flex flex-col items-start gap-1 rounded-sm border p-2.5 text-left transition-colors',
                  scanDepth === 2
                    ? 'border-hub-accent bg-hub-accent/10'
                    : 'border-hub-border bg-hub-surface-raised hover:border-hub-border-strong',
                ].join(' ')}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium text-[12px] text-hub-text">2 Níveis (Recomendado)</span>
                  <span className="font-mono text-[10px] text-hub-accent">Padrão</span>
                </div>
                <p className="text-[11px] leading-4 text-hub-text-muted">
                  Varre até 2 pastas de profundidade. Ideal se você agrupa projetos por organização ou cliente.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScanDepth(1)}
                className={[
                  'flex flex-col items-start gap-1 rounded-sm border p-2.5 text-left transition-colors',
                  scanDepth === 1
                    ? 'border-hub-accent bg-hub-accent/10'
                    : 'border-hub-border bg-hub-surface-raised hover:border-hub-border-strong',
                ].join(' ')}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium text-[12px] text-hub-text">1 Nível</span>
                </div>
                <p className="text-[11px] leading-4 text-hub-text-muted">
                  Varre apenas projetos imediatamente na raiz.
                </p>
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
