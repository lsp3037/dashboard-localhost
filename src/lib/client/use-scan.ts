'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ApiError, postJson } from '@/lib/client/api';
import { describeScan, pushToast, setScanning } from '@/lib/client/hub-events';
import type { ScanCountersDTO } from '@/lib/shared/types';

interface UseScanResult {
  scanning: boolean;
  scan: () => Promise<void>;
}

/** POST /api/projects/scan + toast + `router.refresh()`. Usado no header e no empty state. */
export function useScan(): UseScanResult {
  const router = useRouter();
  const [scanning, setScanningState] = useState(false);

  const scan = useCallback(async (): Promise<void> => {
    setScanningState(true);
    setScanning(true);

    try {
      const counters = await postJson<ScanCountersDTO>('/api/projects/scan', {});
      pushToast({
        tone: 'success',
        title: 'Varredura concluída',
        description: describeScan(counters),
      });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Não foi possível escanear',
        description: error instanceof ApiError ? error.friendlyMessage : 'Falha inesperada ao varrer as raízes.',
      });
    } finally {
      setScanningState(false);
      setScanning(false);
    }
  }, [router]);

  return { scanning, scan };
}
