import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/toaster';
import { loadInventory } from '@/lib/server/overview';

import './globals.css';

/**
 * O layout lê contadores direto do SQLite (Server Component). Para não congelar
 * esses números no build, a árvore inteira é renderizada por request.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Hub Local',
    template: '%s · Hub Local',
  },
  description: 'Inventário e operação dos projetos locais em C:\\Projetos.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const { projects } = loadInventory();
  const hidden = projects.filter((project) => project.hidden).length;
  const running = projects.filter(
    (project) => project.status === 'starting' || project.status === 'running' || project.status === 'stopping',
  ).length;
  const errors = projects.filter(
    (project) => project.status === 'crashed' || project.status === 'failed',
  ).length;
  const stopped = projects.filter((project) => project.status === 'stopped').length;

  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-hub-bg text-hub-text antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:border focus:border-hub-accent focus:bg-hub-bg focus:px-3 focus:py-1.5 focus:text-[12px] focus:text-hub-text"
        >
          ir para o conteúdo
        </a>

        <SiteHeader total={projects.length} running={running} stopped={stopped} errors={errors} hidden={hidden} />

        <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 pb-20 pt-20 sm:px-6">
          {children}
        </main>

        <Toaster />
      </body>
    </html>
  );
}
