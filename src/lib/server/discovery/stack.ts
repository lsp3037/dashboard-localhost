import 'server-only';

import type { StackTag } from '@/lib/shared/types';

export interface StackSignals {
  /** Nomes de dependências de runtime, dev e peer. */
  readonly dependencies?: Iterable<string>;
  /** Arquivos presentes no diretório do projeto (para fallback por arquivo de config). */
  readonly fileNames?: Iterable<string>;
}

/** Ordem canônica de exibição das badges. */
const TAG_ORDER: readonly StackTag[] = [
  'next',
  'react',
  'vite',
  'vue',
  'nuxt',
  'svelte',
  'react-native',
  'expo',
  'express',
  'fastify',
  'hono',
  'astro',
  'tailwind',
  'typescript',
  'test',
];

const CONFIG_FILE_TAGS: readonly { readonly prefix: string; readonly tag: StackTag }[] = [
  { prefix: 'next.config.', tag: 'next' },
  { prefix: 'vite.config.', tag: 'vite' },
  { prefix: 'nuxt.config.', tag: 'nuxt' },
  { prefix: 'svelte.config.', tag: 'svelte' },
  { prefix: 'astro.config.', tag: 'astro' },
  { prefix: 'tailwind.config.', tag: 'tailwind' },
];

/**
 * Deriva as tags de stack (§7.2) a partir de dependências e arquivos de config.
 * Função pura: o scan passa os nomes já lidos do diretório.
 */
export function detectStack(signals: StackSignals): StackTag[] {
  const dependencies = new Set<string>();

  for (const dependency of signals.dependencies ?? []) {
    dependencies.add(dependency.toLowerCase());
  }

  const fileNames = new Set<string>();

  for (const fileName of signals.fileNames ?? []) {
    fileNames.add(fileName.toLowerCase());
  }

  const tags = new Set<StackTag>();
  const hasDependency = (name: string): boolean => dependencies.has(name);

  if (hasDependency('next')) {
    tags.add('next');
    tags.add('react');
  }

  if (hasDependency('vite')) tags.add('vite');
  if (hasDependency('react') || hasDependency('react-dom')) tags.add('react');
  if (hasDependency('nuxt')) {
    tags.add('nuxt');
    tags.add('vue');
  }
  if (hasDependency('vue')) tags.add('vue');
  if (hasDependency('svelte') || hasDependency('@sveltejs/kit')) tags.add('svelte');
  if (hasDependency('react-native')) tags.add('react-native');
  if (hasDependency('expo')) tags.add('expo');
  if (hasDependency('express')) tags.add('express');
  if (hasDependency('fastify')) tags.add('fastify');
  if (hasDependency('hono')) tags.add('hono');
  if (hasDependency('tailwindcss') || hasDependency('@tailwindcss/postcss')) tags.add('tailwind');
  if (hasDependency('typescript') || fileNames.has('tsconfig.json')) tags.add('typescript');
  if (hasDependency('vitest') || hasDependency('jest') || hasDependency('@playwright/test')) tags.add('test');

  for (const fileName of fileNames) {
    for (const config of CONFIG_FILE_TAGS) {
      if (fileName.startsWith(config.prefix)) tags.add(config.tag);
    }
  }

  return TAG_ORDER.filter((tag) => tags.has(tag));
}
