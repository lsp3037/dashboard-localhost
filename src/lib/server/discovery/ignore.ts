import 'server-only';

/**
 * Diretórios que nunca contêm um projeto gerenciável (dependências, artefatos de build, caches).
 * Comparação em minúsculas: o scan roda no Windows, onde nomes de pasta são case-insensitive.
 */
export const SKIP_DIRS: readonly string[] = [
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
  '.cache',
  'venv',
  '.venv',
  'target',
];

const SKIP_DIR_SET: ReadonlySet<string> = new Set(SKIP_DIRS);

/** Dotdirs (`.git`, `.agents`, `.data`, …) nunca são projetos. */
export function isDotDir(name: string): boolean {
  return name.startsWith('.') && name.length > 1;
}

export function isSkippedDirName(name: string): boolean {
  if (isDotDir(name)) return true;
  return SKIP_DIR_SET.has(name.toLowerCase());
}

export interface DirectoryEntryLike {
  readonly name: string;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

/**
 * Regra única de descida do scan: ignorar arquivos, dotdirs, diretórios da skip list
 * e symlinks/junctions (evita ciclos e fuga da raiz).
 */
export function shouldSkipEntry(entry: DirectoryEntryLike): boolean {
  if (entry.isSymbolicLink()) return true;
  if (!entry.isDirectory()) return true;
  return isSkippedDirName(entry.name);
}
