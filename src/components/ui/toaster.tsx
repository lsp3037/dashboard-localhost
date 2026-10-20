'use client';

import { useEffect, useState } from 'react';

import { CloseIcon } from '@/components/ui/icons';
import { subscribeToasts } from '@/lib/client/hub-events';
import type { ToastItem, ToastTone } from '@/lib/client/hub-events';

const TONE_CLASS: Readonly<Record<ToastTone, string>> = {
  success: 'border-status-running/50',
  error: 'border-status-error/60',
  info: 'border-hub-border-strong',
};

const TONE_DOT: Readonly<Record<ToastTone, string>> = {
  success: 'bg-status-running',
  error: 'bg-status-error',
  info: 'bg-hub-accent',
};

const MAX_VISIBLE = 3;

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers: number[] = [];

    const unsubscribe = subscribeToasts((toast) => {
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), toast]);

      const timeout = window.setTimeout(
        () => {
          setToasts((current) => current.filter((item) => item.id !== toast.id));
        },
        toast.tone === 'error' ? 8000 : 5000,
      );
      timers.push(timeout);
    });

    return () => {
      unsubscribe();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = (id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={[
            'pointer-events-auto flex items-start gap-2 border bg-hub-surface-raised px-3 py-2',
            'shadow-[0_10px_30px_rgba(2,6,23,0.55)]',
            TONE_CLASS[toast.tone],
          ].join(' ')}
        >
          <span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[toast.tone]}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium leading-5 text-hub-text">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 break-words text-[11px] leading-4 text-hub-text-muted">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Fechar aviso"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-hub-text-muted hover:text-hub-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
          >
            <CloseIcon width={12} height={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
