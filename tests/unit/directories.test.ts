import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listDirectories, listDrives } from '@/lib/server/discovery/directories';
import { canonicalizePath } from '@/lib/server/discovery/paths';
import { AppError, isAppError } from '@/lib/server/errors';

describe('directories exploration', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-directories-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempBaseDir, { recursive: true, force: true });
  });

  describe('listDrives', () => {
    it('retorna pelo menos um drive válido no sistema', () => {
      const drives = listDrives();
      expect(Array.isArray(drives)).toBe(true);
      expect(drives.length).toBeGreaterThan(0);

      if (process.platform === 'win32') {
        expect(drives.some((d) => /^[a-zA-Z]:\\$/.test(d))).toBe(true);
      } else {
        expect(drives).toContain('/');
      }
    });
  });

  describe('listDirectories', () => {
    it('lista subpastas válidas e ignora arquivos e pastas proibidas/do sistema', async () => {
      // Cria estrutura de pastas
      const allowedDirA = path.join(tempBaseDir, 'alpha-project');
      const allowedDirB = path.join(tempBaseDir, 'beta-project');
      const ignoredNodeModules = path.join(tempBaseDir, 'node_modules');
      const ignoredGit = path.join(tempBaseDir, '.git');
      const ignoredNext = path.join(tempBaseDir, '.next');
      const ignoredDollar = path.join(tempBaseDir, '$recycle.bin');
      const ignoredSysDollar = path.join(tempBaseDir, '$SysReset');
      const regularFile = path.join(tempBaseDir, 'package.json');

      fs.mkdirSync(allowedDirA);
      fs.mkdirSync(allowedDirB);
      fs.mkdirSync(ignoredNodeModules);
      fs.mkdirSync(ignoredGit);
      fs.mkdirSync(ignoredNext);
      fs.mkdirSync(ignoredDollar);
      fs.mkdirSync(ignoredSysDollar);
      fs.writeFileSync(regularFile, '{}', 'utf-8');

      const result = await listDirectories(tempBaseDir);

      expect(result.currentPath).toBe(canonicalizePath(tempBaseDir));
      expect(result.parentPath).toBe(path.dirname(canonicalizePath(tempBaseDir)));
      expect(Array.isArray(result.drives)).toBe(true);

      const returnedNames = result.directories.map((d) => d.name);
      expect(returnedNames).toEqual(['alpha-project', 'beta-project']);

      // Garante que nenhum ignorado entrou
      expect(returnedNames).not.toContain('node_modules');
      expect(returnedNames).not.toContain('.git');
      expect(returnedNames).not.toContain('.next');
      expect(returnedNames).not.toContain('$recycle.bin');
      expect(returnedNames).not.toContain('$SysReset');
      expect(returnedNames).not.toContain('package.json');
    });

    it('ordena as subpastas alfabeticamente', async () => {
      fs.mkdirSync(path.join(tempBaseDir, 'zebra'));
      fs.mkdirSync(path.join(tempBaseDir, 'alpha'));
      fs.mkdirSync(path.join(tempBaseDir, 'middle'));

      const result = await listDirectories(tempBaseDir);
      const returnedNames = result.directories.map((d) => d.name);

      expect(returnedNames).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('rejeita caminho inexistente com erro notFound (404)', async () => {
      const nonExistent = path.join(tempBaseDir, 'does-not-exist-xyz');

      await expect(listDirectories(nonExistent)).rejects.toThrowError();

      try {
        await listDirectories(nonExistent);
      } catch (err) {
        expect(isAppError(err)).toBe(true);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe('NOT_FOUND');
      }
    });

    it('rejeita quando o caminho informado é um arquivo regular e não um diretório', async () => {
      const filePath = path.join(tempBaseDir, 'sample-file.txt');
      fs.writeFileSync(filePath, 'hello world', 'utf-8');

      await expect(listDirectories(filePath)).rejects.toThrowError(/não é um diretório/);

      try {
        await listDirectories(filePath);
      } catch (err) {
        expect(isAppError(err)).toBe(true);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe('NOT_FOUND');
      }
    });

    it('fornece fallback seguro para o diretório home quando nenhum caminho é especificado', async () => {
      const result = await listDirectories();

      expect(result.currentPath).toBeTruthy();
      expect(Array.isArray(result.directories)).toBe(true);
      expect(Array.isArray(result.drives)).toBe(true);
    });

    if (process.platform === 'win32') {
      it('normaliza drive letters sem barra no Windows (ex: "C:") e define parentPath null para a raiz', async () => {
        const result = await listDirectories('C:');

        expect(result.currentPath.toUpperCase()).toMatch(/^C:\\/);
        expect(result.parentPath).toBeNull();
      });

      it('define parentPath como null quando navegado para a raiz do drive', async () => {
        const result = await listDirectories('C:\\');
        expect(result.parentPath).toBeNull();
      });

      it('define parentPath corretamente para pastas filhas', async () => {
        const sub = path.join(tempBaseDir, 'nested-child');
        fs.mkdirSync(sub);

        const result = await listDirectories(sub);
        expect(result.parentPath).toBe(canonicalizePath(tempBaseDir));
      });
    }
  });
});
