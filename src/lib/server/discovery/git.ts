import 'server-only';

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface GitInfo {
  readonly branch: string | null;
  readonly headAt: string | null;
}

export const EMPTY_GIT_INFO: GitInfo = { branch: null, headAt: null };

const GIT_TIMEOUT_MS = 2_000;
const GIT_MAX_BUFFER = 64 * 1024;

/** Executa git sem shell, com timeout curto; qualquer falha vira `null` (git é dado acessório). */
function runGit(dir: string, args: readonly string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-C', dir, ...args],
      {
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: GIT_MAX_BUFFER,
        shell: false,
        windowsHide: true,
        encoding: 'utf8',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
      },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }

        const value = stdout.trim();
        resolve(value.length > 0 ? value : null);
      },
    );
  });
}

/** `.git` pode ser diretório (repo normal) ou arquivo (worktree/submodule). */
export async function hasGitRepository(dir: string): Promise<boolean> {
  try {
    await fs.stat(path.join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}

/** Branch atual + data do último commit. Ausência de repo ou erro → `null`, nunca lança. */
export async function readGitInfo(dir: string): Promise<GitInfo> {
  if (!(await hasGitRepository(dir))) return EMPTY_GIT_INFO;

  const branch = await runGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const headAt = await runGit(dir, ['log', '-1', '--format=%cI']);

  return { branch, headAt };
}
