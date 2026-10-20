import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { getConfig } from '@/lib/server/config';
import { pathNotAllowed } from '@/lib/server/errors';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Allowlist de raízes (C1): qualquer caminho aceito pela API precisa estar dentro
 * de uma raiz configurada, comparando caminhos canônicos e case-insensitive no Windows.
 */

/** `..` explícito no input é rejeitado antes de qualquer resolução. */
export function containsTraversal(raw: string): boolean {
  return raw.split(/[\\/]+/).some((segment) => segment === '..');
}

/** Resolve para caminho absoluto e, quando existe, aplica `realpathSync.native` (expande junction/symlink). */
export function canonicalizePath(target: string): string {
  const resolved = path.resolve(target);

  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

/** Chave de comparação: no Windows o filesystem é case-insensitive. */
export function comparisonKey(target: string): string {
  return IS_WINDOWS ? target.toLowerCase() : target;
}

export function isSamePath(a: string, b: string): boolean {
  return comparisonKey(path.resolve(a)) === comparisonKey(path.resolve(b));
}

/** Raízes configuradas, canônicas. */
export function getAllowedRoots(): string[] {
  return getConfig().projectsRoots.map((root) => canonicalizePath(root));
}

/**
 * `target` está dentro (ou é igual a) `root`?
 * Rejeita resultados absolutos e qualquer caminho que escape via `..`.
 */
export function isInsideRoot(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));

  if (relative === '') return true;
  if (path.isAbsolute(relative)) return false;

  const [firstSegment] = relative.split(path.sep);
  return firstSegment !== '..';
}

export function isInsideRoots(target: string, roots: readonly string[] = getAllowedRoots()): boolean {
  if (roots.length === 0) return false;
  return roots.some((root) => isInsideRoot(root, target));
}

/**
 * Valida e normaliza um caminho vindo do cliente.
 * Ordem: não vazio → absoluto → sem `..` → realpath → dentro da allowlist.
 */
export function resolveAllowedPath(requested: string, roots: readonly string[] = getAllowedRoots()): string {
  const trimmed = requested.trim();

  if (trimmed.length === 0) {
    throw pathNotAllowed('Caminho vazio.', { path: requested });
  }

  if (!path.isAbsolute(trimmed)) {
    throw pathNotAllowed(`O caminho precisa ser absoluto: ${trimmed}`, { path: requested });
  }

  if (containsTraversal(trimmed)) {
    throw pathNotAllowed(`O caminho não pode conter navegação relativa: ${trimmed}`, { path: requested });
  }

  const absolute = canonicalizePath(trimmed);

  if (!isInsideRoots(absolute, roots)) {
    throw pathNotAllowed(`Caminho fora das raízes permitidas: ${trimmed}`, {
      path: requested,
      roots: [...roots],
    });
  }

  return absolute;
}

/** Variante não-throwing usada pelo scan: caminho inválido simplesmente não entra na varredura. */
export function tryResolveAllowedPath(requested: string, roots: readonly string[] = getAllowedRoots()): string | null {
  try {
    return resolveAllowedPath(requested, roots);
  } catch {
    return null;
  }
}
