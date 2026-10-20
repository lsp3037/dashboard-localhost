import type { PackageManager } from '@/lib/shared/types';

/** Nome curto de cada tag de stack vinda do scan. Tags desconhecidas caem no próprio id. */
const STACK_LABELS: Readonly<Record<string, string>> = {
  next: 'Next.js',
  react: 'React',
  vite: 'Vite',
  vue: 'Vue',
  nuxt: 'Nuxt',
  svelte: 'Svelte',
  'react-native': 'React Native',
  expo: 'Expo',
  express: 'Express',
  fastify: 'Fastify',
  hono: 'Hono',
  astro: 'Astro',
  tailwind: 'Tailwind',
  typescript: 'TypeScript',
  test: 'Testes',
  'non-node': 'sem app',
};

export function stackLabel(tag: string): string {
  return STACK_LABELS[tag] ?? tag;
}

export const PACKAGE_MANAGER_LABELS: Readonly<Record<PackageManager, string>> = {
  npm: 'npm',
  pnpm: 'pnpm',
  yarn: 'yarn',
  bun: 'bun',
};

export const FILTER_LABELS = {
  all: 'Todos',
  running: 'Rodando',
  hidden: 'Ocultos',
} as const;
