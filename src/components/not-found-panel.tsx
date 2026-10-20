import Link from 'next/link';

import { ArrowLeftIcon } from '@/components/ui/icons';

/** Conteúdo compartilhado pelas páginas 404 (raiz e detalhe do projeto). */
export function NotFoundPanel() {
  return (
    <div className="animate-reveal mx-auto flex max-w-xl flex-col items-start gap-3 border border-hub-border bg-hub-surface px-5 py-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-hub-text-muted">404</p>
      <h1 className="text-[20px] font-semibold leading-6 tracking-tight text-hub-text">Não encontramos esta página</h1>
      <p className="max-w-prose text-[12px] leading-5 text-hub-text-muted">
        O projeto pode ter sido removido do inventário ou o endereço está errado. Rode uma varredura no dashboard para
        atualizar a lista.
      </p>
      <Link
        href="/"
        className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-sm border border-hub-border-strong bg-hub-surface-raised px-3 text-[12px] font-medium text-hub-text transition-colors hover:border-hub-accent hover:text-hub-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
      >
        <ArrowLeftIcon width={12} height={12} />
        Voltar ao inventário
      </Link>
    </div>
  );
}
