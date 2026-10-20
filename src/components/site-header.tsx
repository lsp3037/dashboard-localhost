import Link from 'next/link';

import { HeaderNav } from '@/components/header-nav';
import { ScanButton } from '@/components/scan-button';

interface SiteHeaderProps {
  total: number;
  running: number;
  stopped: number;
  errors: number;
  hidden: number;
}

function Counter({ tone, label, value }: { tone: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      <span className="font-mono text-[11px] tabular-nums text-hub-text">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.08em] text-hub-text-muted">{label}</span>
    </span>
  );
}

/** Header fixo: marca, navegação, contadores vivos e o gatilho do scan. */
export function SiteHeader({ total, running, stopped, errors, hidden }: SiteHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-hub-border bg-hub-bg">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <Link
          href="/"
          className="group flex items-baseline gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
        >
          <span className="text-[15px] font-semibold tracking-tight text-hub-text">
            Hub<span className="text-hub-accent group-hover:text-hub-accent-strong">Local</span>
          </span>
          <span className="hidden font-mono text-[10px] text-hub-text-muted sm:inline">:3100</span>
        </Link>

        <span aria-hidden="true" className="hidden h-5 w-px bg-hub-border sm:block" />

        <HeaderNav />

        <p
          aria-live="polite"
          aria-label="Resumo dos projetos"
          className="ml-auto hidden items-center gap-3 md:flex"
        >
          <Counter tone="bg-status-running" label="rodando" value={running} />
          <Counter tone="bg-status-idle" label="parados" value={stopped} />
          <Counter tone="bg-status-error" label="erro" value={errors} />
          {hidden > 0 && <span className="font-mono text-[10px] text-hub-text-muted">{hidden} oculto(s)</span>}
          <span className="sr-only">{total} projetos no inventário.</span>
        </p>

        <div className="ml-auto md:ml-0">
          <ScanButton />
        </div>
      </div>
    </header>
  );
}
