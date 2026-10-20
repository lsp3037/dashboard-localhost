import type { Metadata } from 'next';

import { NotFoundPanel } from '@/components/not-found-panel';

export const metadata: Metadata = {
  title: 'Página não encontrada',
};

export default function NotFound() {
  return <NotFoundPanel />;
}
