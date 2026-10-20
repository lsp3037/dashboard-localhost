import 'server-only';

import fs from 'node:fs/promises';

import type { PackageManager } from '@/lib/shared/types';

export type { PackageManager };

interface LockfileSignal {
  readonly file: string;
  readonly manager: PackageManager;
}

/** Ordem importa: o primeiro lockfile encontrado define o gerenciador. */
export const LOCKFILE_SIGNALS: readonly LockfileSignal[] = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'bun.lock', manager: 'bun' },
  { file: 'package-lock.json', manager: 'npm' },
];

/** Detecção pura a partir dos nomes já listados do diretório. Default: npm. */
export function detectPackageManagerFromNames(names: ReadonlySet<string>): PackageManager {
  return detectLockfileManager(names) ?? 'npm';
}

/** Lockfile presente → gerenciador; ausente → `null` (possibilita herdar do workspace pai). */
export function detectLockfileManager(names: ReadonlySet<string>): PackageManager | null {
  for (const signal of LOCKFILE_SIGNALS) {
    if (names.has(signal.file)) return signal.manager;
  }

  return null;
}

export async function detectPackageManager(dir: string): Promise<PackageManager> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return detectPackageManagerFromNames(new Set(entries.map((entry) => entry.name)));
  } catch {
    return 'npm';
  }
}
