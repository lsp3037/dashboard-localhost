'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface RunMonitorProps {
  /** Projetos com run ativo; quando vazio o polling nem liga. */
  projectIds: readonly string[];
  /** `false` desliga o timer (nada rodando). */
  active: boolean;
}

interface StatusResponse {
  run: { status: string; port: number | null } | null;
}

const POLL_INTERVAL_MS = 2_000;

function isActiveStatus(status: string): boolean {
  return status === 'starting' || status === 'running' || status === 'stopping';
}

/**
 * Polling de fallback (§5.3/§5.4) enquanto há run ativo: compara a assinatura
 * `status:porta` e pede `router.refresh()` quando muda (subiu, pegou porta, caiu).
 * O SSE da F4 substitui isto no log viewer, não no card.
 */
export function RunMonitor({ projectIds, active }: RunMonitorProps) {
  const router = useRouter();
  const previous = useRef(new Map<string, string>());
  const idsKey = projectIds.join(',');

  useEffect(() => {
    if (!active) return;

    const ids = idsKey.split(',').filter((id) => id.length > 0);
    if (ids.length === 0) return;

    let cancelled = false;

    const poll = async (): Promise<void> => {
      let changed = false;

      await Promise.all(
        ids.map(async (id) => {
          try {
            const response = await fetch(`/api/projects/${id}/status`, { cache: 'no-store' });
            if (!response.ok) return;

            const data = (await response.json()) as StatusResponse;
            const signature = data.run === null ? 'none' : `${data.run.status}:${String(data.run.port ?? '-')}`;
            const previousSignature = previous.current.get(id);

            if (previousSignature !== signature) {
              // Primeira leitura: se o servidor já diz "parado", o render está velho.
              if (previousSignature === undefined) {
                changed = data.run === null || !isActiveStatus(data.run.status);
              } else {
                changed = true;
              }

              previous.current.set(id, signature);
            }
          } catch {
            // Hub reiniciando/rede local: tenta de novo no próximo tick.
          }
        }),
      );

      if (changed && !cancelled) router.refresh();
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, idsKey, router]);

  return null;
}
