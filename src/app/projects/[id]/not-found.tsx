import type { Metadata } from 'next';

import { NotFoundPanel } from '@/components/not-found-panel';

export const metadata: Metadata = {
  title: 'Projeto não encontrado',
};

export default function ProjectNotFound() {
  return <NotFoundPanel />;
}
