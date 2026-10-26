import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, getDb } from '@/lib/server/db';
import { clearScannedProjects } from '@/lib/server/repos/projects';
import {
  getHubSettings,
  getSetting,
  onSettingsChange,
  saveHubSettings,
  setSetting,
} from '@/lib/server/repos/settings';

describe('settings repository', () => {
  let tempDir: string;
  const originalDataDir = process.env.HUB_DATA_DIR;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-settings-test-'));
    process.env.HUB_DATA_DIR = tempDir;
    closeDb();
  });

  afterEach(() => {
    closeDb();
    if (originalDataDir !== undefined) {
      process.env.HUB_DATA_DIR = originalDataDir;
    } else {
      delete process.env.HUB_DATA_DIR;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('defaults and fallback', () => {
    it('retorna null para chaves não configuradas no SQLite', () => {
      expect(getSetting('unknown_key')).toBeNull();
    });

    it('retorna estrutura com fallbacks quando nenhuma configuração existe', () => {
      const settings = getHubSettings();
      expect(settings).toEqual({
        projectsRoots: null,
        scanDepth: null,
        onboardingCompleted: false,
      });
    });
  });

  describe('CRUD de settings', () => {
    it('salva e recupera uma configuração simples', () => {
      setSetting('custom_key', 'custom_value');
      expect(getSetting('custom_key')).toBe('custom_value');
    });

    it('atualiza valor existente mantendo unicidade da chave', () => {
      setSetting('version', '1.0');
      setSetting('version', '2.0');
      expect(getSetting('version')).toBe('2.0');
    });

    it('salva e lê projetos raízes, scanDepth e onboardingCompleted', () => {
      saveHubSettings({
        projectsRoots: ['C:\\Projetos', 'D:\\Workspace'],
        scanDepth: 1,
        onboardingCompleted: true,
      });

      const settings = getHubSettings();
      expect(settings.projectsRoots).toEqual(['C:\\Projetos', 'D:\\Workspace']);
      expect(settings.scanDepth).toBe(1);
      expect(settings.onboardingCompleted).toBe(true);
    });

    it('permite atualização parcial sem afetar outras chaves', () => {
      saveHubSettings({
        projectsRoots: ['C:\\Projetos'],
        scanDepth: 2,
        onboardingCompleted: true,
      });

      saveHubSettings({ scanDepth: 1 });

      const updated = getHubSettings();
      expect(updated.projectsRoots).toEqual(['C:\\Projetos']);
      expect(updated.scanDepth).toBe(1);
      expect(updated.onboardingCompleted).toBe(true);
    });
  });

  describe('resiliência a dados corrompidos', () => {
    it('trata JSON malformado em projects_roots como null', () => {
      setSetting('projects_roots', '{invalid json');
      expect(getHubSettings().projectsRoots).toBeNull();
    });

    it('rejeita scan_depth com valores fora de 1 e 2', () => {
      setSetting('scan_depth', '3');
      expect(getHubSettings().scanDepth).toBeNull();

      setSetting('scan_depth', '0');
      expect(getHubSettings().scanDepth).toBeNull();

      setSetting('scan_depth', 'not-a-number');
      expect(getHubSettings().scanDepth).toBeNull();
    });

    it('interpreta 1 como onboardingCompleted true', () => {
      setSetting('onboarding_completed', '1');
      expect(getHubSettings().onboardingCompleted).toBe(true);

      setSetting('onboarding_completed', '0');
      expect(getHubSettings().onboardingCompleted).toBe(false);
    });
  });

  describe('clearScannedProjects', () => {
    it('remove projetos de scan e preserva projetos manuais', () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO projects (id, name, path, source, kind, created_at, updated_at)
        VALUES ('p1', 'Auto Project', '/path/auto', 'scan', 'node', ?, ?)
      `).run(now, now);

      db.prepare(`
        INSERT INTO projects (id, name, path, source, kind, created_at, updated_at)
        VALUES ('p2', 'Manual Project', '/path/manual', 'manual', 'node', ?, ?)
      `).run(now, now);

      const removed = clearScannedProjects();
      expect(removed).toBe(1);

      const rows = db.prepare('SELECT id, source FROM projects').all() as Array<{ id: string; source: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('p2');
    });
  });

  describe('onSettingsChange', () => {
    it('notifica listeners registrados ao salvar configurações', () => {
      const listener = vi.fn();
      const unsubscribe = onSettingsChange(listener);

      setSetting('foo', 'bar');
      expect(listener).toHaveBeenCalledTimes(1);

      saveHubSettings({ onboardingCompleted: true });
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      setSetting('foo', 'baz');
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
