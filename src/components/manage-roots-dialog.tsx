'use client';

import { useState } from 'react';

import { OnboardingDialog } from '@/components/onboarding-dialog';
import { Button } from '@/components/ui/button';
import { FolderIcon } from '@/components/ui/icons';

interface ManageRootsDialogProps {
  roots: readonly string[];
  scanDepth: number;
  variant?: 'primary' | 'secondary' | 'ghost';
  label?: string;
  size?: 'sm' | 'md';
}

export function ManageRootsDialog({
  roots,
  scanDepth,
  variant = 'secondary',
  label = 'Alterar Pastas e Nível',
  size = 'sm',
}: ManageRootsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <FolderIcon width={13} height={13} />
        {label}
      </Button>

      {open && (
        <OnboardingDialog
          open={open}
          onClose={() => setOpen(false)}
          defaultRoots={roots}
          defaultScanDepth={scanDepth}
          isReconfiguration={true}
        />
      )}
    </>
  );
}
