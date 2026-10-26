import 'server-only';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { canonicalizePath } from '@/lib/server/discovery/paths';
import { notFound } from '@/lib/server/errors';

export interface DirectoryEntry {
  name: string;
  path: string;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  directories: DirectoryEntry[];
  drives: string[];
}

const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '$recycle.bin',
  'system volume information',
  'recovery',
  'appdata',
]);

/**
 * Lista drives disponíveis no sistema.
 * No Windows, checa unidades de A: até Z:. No Linux/macOS, retorna ['/'].
 */
export function listDrives(): string[] {
  if (process.platform === 'win32') {
    const drives: string[] = [];
    for (let code = 65; code <= 90; code++) {
      const drive = `${String.fromCharCode(code)}:\\`;
      try {
        if (fs.existsSync(drive)) {
          drives.push(drive);
        }
      } catch {
        // Ignora unidades sem mídia ou inacessíveis
      }
    }
    return drives;
  }

  return ['/'];
}

/**
 * Normaliza caminhos de raiz no Windows como "C:" para "C:\".
 */
function normalizeDriveLetter(rawPath: string): string {
  if (process.platform === 'win32' && /^[a-zA-Z]:$/.test(rawPath)) {
    return `${rawPath}\\`;
  }
  return rawPath;
}

/**
 * Determina se o caminho informado é uma raiz de sistema de arquivos (ex: "C:\" ou "/").
 */
function isFileSystemRoot(targetPath: string): boolean {
  return path.dirname(targetPath) === targetPath;
}

/**
 * Lista o conteúdo de um diretório de forma segura para o explorador de pastas.
 * Se nenhum caminho for fornecido, inicia no os.homedir() (ou no primeiro drive disponível).
 */
export async function listDirectories(targetPath?: string | null): Promise<DirectoryListing> {
  const drives = listDrives();

  let resolvedPath: string;

  if (!targetPath || targetPath.trim().length === 0) {
    const home = os.homedir();
    const firstDrive = drives[0];
    if (home && fs.existsSync(home)) {
      resolvedPath = path.resolve(home);
    } else if (firstDrive) {
      resolvedPath = path.resolve(firstDrive);
    } else {
      resolvedPath = path.resolve(process.cwd());
    }
  } else {
    const normalized = normalizeDriveLetter(targetPath.trim());
    resolvedPath = path.resolve(normalized);
  }

  if (!fs.existsSync(resolvedPath)) {
    throw notFound(`Diretório não encontrado: ${resolvedPath}`, { path: resolvedPath });
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolvedPath);
  } catch {
    throw notFound(`Não foi possível acessar o diretório: ${resolvedPath}`, { path: resolvedPath });
  }

  if (!stat.isDirectory()) {
    throw notFound(`O caminho informado não é um diretório: ${resolvedPath}`, { path: resolvedPath });
  }

  const canonical = canonicalizePath(resolvedPath);
  const isRoot = isFileSystemRoot(canonical);
  const parentPath = isRoot ? null : path.dirname(canonical);

  const directories: DirectoryEntry[] = [];

  try {
    const entries = fs.readdirSync(canonical, { withFileTypes: true });

    for (const entry of entries) {
      const lower = entry.name.toLowerCase();

      if (IGNORED_NAMES.has(lower)) continue;
      if (entry.name.startsWith('$')) continue;

      let isDir = false;
      if (entry.isDirectory()) {
        isDir = true;
      } else if (entry.isSymbolicLink()) {
        try {
          const itemStat = fs.statSync(path.join(canonical, entry.name));
          isDir = itemStat.isDirectory();
        } catch {
          isDir = false;
        }
      }

      if (isDir) {
        directories.push({
          name: entry.name,
          path: path.join(canonical, entry.name),
        });
      }
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'EACCES' && code !== 'EPERM') {
      throw err;
    }
  }

  directories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return {
    currentPath: canonical,
    parentPath,
    directories,
    drives,
  };
}
