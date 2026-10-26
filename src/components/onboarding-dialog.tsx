'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DirectoryPicker } from '@/components/directory-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SpinnerIcon } from '@/components/ui/icons';
import { ApiError, postJson } from '@/lib/client/api';
import { pushToast } from '@/lib/client/hub-events';

interface OnboardingDialogProps {
  open: boolean;
  onClose?: () => void;
  defaultRoots?: readonly string[];
  defaultScanDepth?: number;
  onCompleted?: () => void;
  title?: string;
  description?: string;
  isReconfiguration?: boolean;
}

interface OnboardingResponse {
  success: boolean;
  roots: string[];
  count?: number;
}

export function OnboardingDialog({
  open,
  onClose,
  defaultRoots,
  defaultScanDepth = 2,
  onCompleted,
  title,
  description,
  isReconfiguration = false,
}: OnboardingDialogProps) {
  const router = useRouter();
  const [roots, setRoots] = useState<string[]>(() =>
    defaultRoots && defaultRoots.length > 0 ? [...defaultRoots] : [],
  );
  const [scanDepth, setScanDepth] = useState<number>(defaultScanDepth);
  const [cleanPreviousScan, setCleanPreviousScan] = useState<boolean>(isReconfiguration);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (roots.length === 0) {
      setErrorMessage('Selecione pelo menos uma pasta raiz de projetos para continuar.');
      return;
    }

    setPending(true);
    setErrorMessage(null);

    try {
      const response = await postJson<OnboardingResponse>('/api/settings/onboarding', {
        projectsRoots: roots,
        scanDepth,
        cleanPreviousScan,
      });

      pushToast({
        tone: 'success',
        title: isReconfiguration ? 'Pastas e varredura atualizadas!' : 'Bem-vindo ao Dashboard!',
        description: `Configuração concluída. ${
          response.count !== undefined ? `${response.count} projetos descobertos.` : 'Iniciando varredura.'
        }`,
      });

      onCompleted?.();
      onClose?.();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.friendlyMessage);
      } else {
        setErrorMessage('Ocorreu uma falha ao salvar as configurações. Tente novamente.');
      }
    } finally {
      setPending(false);
    }
  };

  const dialogTitle = title ?? (isReconfiguration ? 'Configurar Pastas e Nível de Varredura' : 'Bem-vindo ao Dashboard de Projetos');
  const dialogDesc =
    description ??
    (isReconfiguration
      ? 'Ajuste os diretórios monitorados e o nível de profundidade. Se o nível selecionado anteriormente capturou subpastas indesejadas, você pode redefinir aqui.'
      : 'Para começar, selecione onde seus repositórios e projetos de código estão armazenados no seu computador.');

  return (
    <Dialog
      open={open}
      title={dialogTitle}
      description={dialogDesc}
      maxWidthClass="w-[min(48rem,calc(100vw-2rem))]"
      onClose={() => {
        if (!pending && onClose) {
          onClose();
        }
      }}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-hub-text-muted">
            {roots.length} {roots.length === 1 ? 'pasta selecionada' : 'pastas selecionadas'}
          </p>
          <div className="flex items-center gap-2">
            {onClose && (
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleSubmit()}
              disabled={pending || roots.length === 0}
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <SpinnerIcon width={14} height={14} />
                  Salvando e varrendo...
                </>
              ) : (
                'Salvar e Iniciar Varredura'
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

        {/* Directory Picker */}
        <DirectoryPicker
          selectedRoots={roots}
          onRootsChange={(newRoots) => {
            setRoots(newRoots);
            if (errorMessage) setErrorMessage(null);
          }}
          initialPath={roots[0]}
        />

        {/* Profundidade de Varredura */}
        <div className="rounded-sm border border-hub-border bg-hub-surface p-3">
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-hub-text-muted">
            Nível de Profundidade da Varredura
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
                <span className="font-medium text-[12px] text-hub-text">2 Níveis (Subpastas & Workspaces)</span>
                <span className="font-mono text-[10px] text-hub-accent">Padrão</span>
              </div>
              <p className="text-[11px] leading-4 text-hub-text-muted">
                Varre até 2 pastas de profundidade e busca pacotes dentro de monorepos/workspaces (ex:
                <code className="ml-1 font-mono text-[10px]">C:\Projetos\empresa\app</code>).
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
                <span className="font-medium text-[12px] text-hub-text">1 Nível (Apenas Raiz Imediata)</span>
              </div>
              <p className="text-[11px] leading-4 text-hub-text-muted">
                Varre <strong>apenas</strong> as pastas diretamente dentro da raiz (ex:
                <code className="ml-1 font-mono text-[10px]">C:\Projetos\meu-app</code>). Não lista subpastas internas.
              </p>
            </button>
          </div>

          {/* Opção para limpar varredura anterior */}
          <div className="mt-3 pt-3 border-t border-hub-border">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={cleanPreviousScan}
                onChange={(e) => setCleanPreviousScan(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-hub-border-strong bg-hub-bg text-hub-accent focus:ring-hub-accent"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[12px] font-medium text-hub-text">
                  Limpar inventário anterior antes de varrer
                </span>
                <span className="text-[11px] text-hub-text-muted">
                  Recomendado caso tenha selecionado o nível ou pasta errada: remove subpastas antigas do SQLite para deixar o inventário limpo.
                </span>
              </div>
            </label>
          </div>

          <p className="mt-2 text-[10px] text-hub-text-muted/70">
            * O Dashboard ignora automaticamente pastas como <code className="font-mono">node_modules</code>,{' '}
            <code className="font-mono">.git</code>, <code className="font-mono">dist</code> e pastas de sistema.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
