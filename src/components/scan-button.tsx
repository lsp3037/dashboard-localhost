'use client';

import { Button } from '@/components/ui/button';
import type { ButtonVariant } from '@/components/ui/button';
import { ScanIcon, SpinnerIcon } from '@/components/ui/icons';
import { useScan } from '@/lib/client/use-scan';

interface ScanButtonProps {
  variant?: ButtonVariant;
  label?: string;
}

export function ScanButton({ variant = 'primary', label = 'Escanear' }: ScanButtonProps) {
  const { scanning, scan } = useScan();

  return (
    <Button
      variant={variant}
      onClick={() => {
        void scan();
      }}
      disabled={scanning}
      aria-busy={scanning}
      aria-label={scanning ? 'Varredura em andamento' : 'Escanear raízes monitoradas'}
    >
      {scanning ? <SpinnerIcon width={13} height={13} /> : <ScanIcon width={13} height={13} />}
      <span>{scanning ? 'Escaneando…' : label}</span>
    </Button>
  );
}
