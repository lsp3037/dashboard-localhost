'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

import { CloseIcon } from '@/components/ui/icons';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * `<dialog>` nativo: foco preso, `Esc` fecha e o foco volta ao gatilho sem lib.
 * O `open` é controlado por estado React; o efeito sincroniza com `showModal()`.
 */
export function Dialog({ open, title, description, onClose, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    if (open && !element.open) {
      element.showModal();
      return;
    }

    if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={[
        'm-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-3rem)] overflow-y-auto p-0',
        'rounded-sm border border-hub-border-strong bg-hub-surface text-hub-text',
        'backdrop:bg-hub-bg/85',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4 border-b border-hub-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[14px] font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-0.5 text-[11px] leading-4 text-hub-text-muted">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-sm text-hub-text-muted hover:bg-hub-surface-raised hover:text-hub-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="px-4 py-4">{children}</div>

      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hub-border bg-hub-surface-raised px-4 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
