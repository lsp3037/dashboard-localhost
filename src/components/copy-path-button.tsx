'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CheckIcon, CopyIcon } from '@/components/ui/icons';
import { pushToast } from '@/lib/client/hub-events';

export function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast({
        tone: 'error',
        title: 'Não foi possível copiar',
        description: 'O navegador bloqueou o acesso à área de transferência.',
      });
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={() => void copy()} aria-label={`Copiar caminho de ${path}`}>
      {copied ? <CheckIcon width={12} height={12} /> : <CopyIcon width={12} height={12} />}
      <span aria-live="polite">{copied ? 'Copiado' : 'Copiar'}</span>
    </Button>
  );
}
