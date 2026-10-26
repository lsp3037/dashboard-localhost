'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro capturado pelo ErrorBoundary:', error);
  }, [error]);

  return (
    <div className="animate-reveal mx-auto flex max-w-xl flex-col items-start gap-4 border border-hub-border bg-hub-surface p-6">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-status-error" />
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-status-error">
          Erro de execução
        </p>
      </div>

      <h1 className="text-[18px] font-semibold leading-snug tracking-tight text-hub-text">
        Algo deu errado ao carregar a página
      </h1>

      <p className="text-[12px] leading-5 text-hub-text-muted">
        Ocorreu uma falha inesperada durante a renderização. Você pode tentar recarregar os dados ou verificar os logs.
      </p>

      {error.message && (
        <div className="w-full rounded-sm border border-status-error/40 bg-status-error/5 p-3 font-mono text-[11px] text-status-error break-all">
          {error.message}
          {error.digest && (
            <span className="mt-1 block text-[10px] text-hub-text-muted">
              Digest: {error.digest}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button variant="primary" onClick={() => reset()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
