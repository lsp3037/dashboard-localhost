'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ScanIcon, SpinnerIcon } from '@/components/ui/icons';
import { useScan } from '@/lib/client/use-scan';

interface EmptyStateProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="animate-reveal flex flex-col items-start gap-3 border border-dashed border-hub-border-strong bg-hub-surface px-5 py-8">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-hub-accent" />
        <h2 className="text-[14px] font-semibold tracking-tight text-hub-text">{title}</h2>
      </div>
      <p className="max-w-prose text-[12px] leading-5 text-hub-text-muted">{description}</p>
      {children && <div className="mt-1 flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** CTA que dispara o mesmo scan do header (com spinner próprio). */
export function ScanCta({ rootLabel }: { rootLabel: string }) {
  const { scanning, scan } = useScan();

  return (
    <Button
      variant="primary"
      onClick={() => {
        void scan();
      }}
      disabled={scanning}
      aria-busy={scanning}
    >
      {scanning ? <SpinnerIcon width={13} height={13} /> : <ScanIcon width={13} height={13} />}
      {scanning ? 'Escaneando…' : `Escanear ${rootLabel}`}
    </Button>
  );
}
