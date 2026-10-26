import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb } from '@/lib/server/db';
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

  describe('setSetting / getSetting', () => {
    it('persiste chave e valor e permite sobrescrita atômica', () => {
      setSetting('custom_key', 'initial_value');
      expect(getSetting('custom_key')).toBe('initial_value');

      setSetting('custom_key', 'updated_value');
      expect(getSetting('custom_key')).toBe('updated_value');
    });
  });

  describe('saveHubSettings / getHubSettings', () => {
    it('salva e recupera projectsRoots, scanDepth e onboardingCompleted', () => {
      saveHubSettings({
        projectsRoots: ['C:\\Projetos', 'D:\\Workspace'],
        scanDepth: 2,
        onboardingCompleted: true,
      });

      const settings = getHubSettings();
      expect(settings.projectsRoots).toEqual(['C:\\Projetos', 'D:\\Workspace']);
      expect(settings.scanDepth).toBe(2);
      expect(settings.onboardingCompleted).toBe(true);
    });

    it('permite atualizar propriedades parcialmente sem sobrescrever as demais', () => {
      saveHubSettings({
        projectsRoots: ['C:\\Projetos'],
        scanDepth: 1,
        onboardingCompleted: false,
      });

      // Atualiza apenas onboardingCompleted
      saveHubSettings({
        onboardingCompleted: true,
      });

      let current = getHubSettings();
      expect(current.projectsRoots).toEqual(['C:\\Projetos']);
      expect(current.scanDepth).toBe(1);
      expect(current.onboardingCompleted).toBe(true);

      // Atualiza apenas scanDepth
      saveHubSettings({
        scanDepth: 2,
      });

      current = getHubSettings();
      expect(current.projectsRoots).toEqual(['C:\\Projetos']);
      expect(current.scanDepth).toBe(2);
      expect(current.onboardingCompleted).toBe(true);
    });

    it('trata valores aceitáveis de scanDepth (1 e 2)', () => {
      saveHubSettings({ scanDepth: 1 });
      expect(getHubSettings().scanDepth).toBe(1);

      saveHubSettings({ scanDepth: 2 });
      expect(getHubSettings().scanDepth).toBe(2);
    });
  });

  describe('resiliência a dados corrompidos ou inesperados', () => {
    it('retorna null para projectsRoots quando o JSON no banco é inválido', () => {
      setSetting('projects_roots', 'invalid-json{[');
      expect(getHubSettings().projectsRoots).toBeNull();
    });

    it('retorna null para projectsRoots quando o JSON não é um array de strings', () => {
      setSetting('projects_roots', JSON.stringify({ path: 'C:\\Projetos' }));
      expect(getHubSettings().projectsRoots).toBeNull();

      setSetting('projects_roots', JSON.stringify([123, true]));
      expect(getHubSettings().projectsRoots).toBeNull();
    });

    it('retorna null para scanDepth quando valor não é 1 ou 2', () => {
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
