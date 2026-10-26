import 'server-only';

import { getDb } from '@/lib/server/db';

export interface HubSettings {
  projectsRoots: string[] | null;
  scanDepth: number | null;
  onboardingCompleted: boolean;
}

type SettingsChangeListener = () => void;
const changeListeners = new Set<SettingsChangeListener>();

/**
 * Registra um callback invocado sempre que `saveHubSettings` ou `setSetting` altera configurações.
 * Retorna função para desregistrar o listener.
 */
export function onSettingsChange(listener: SettingsChangeListener): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

function notifyChange(): void {
  for (const listener of changeListeners) {
    try {
      listener();
    } catch {
      // Ignora falhas em listeners para garantir integridade do fluxo
    }
  }
}

/**
 * Lê o valor bruto de uma configuração na tabela `hub_settings`.
 * Retorna `null` se a chave não existir.
 */
export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare<[string], { value: string }>('SELECT value FROM hub_settings WHERE key = ?').get(key);
  return row?.value ?? null;
}

/**
 * Insere ou atualiza uma configuração na tabela `hub_settings`.
 */
export function setSetting(key: string, value: string, notify = true): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO hub_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, now);

  if (notify) {
    notifyChange();
  }
}

/**
 * Retorna as configurações centrais do hub de forma estruturada.
 */
export function getHubSettings(): HubSettings {
  const rawRoots = getSetting('projects_roots');
  let projectsRoots: string[] | null = null;

  if (rawRoots !== null) {
    try {
      const parsed = JSON.parse(rawRoots);
      if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
        projectsRoots = parsed;
      }
    } catch {
      projectsRoots = null;
    }
  }

  const rawDepth = getSetting('scan_depth');
  let scanDepth: number | null = null;
  if (rawDepth !== null) {
    const parsed = parseInt(rawDepth, 10);
    if (parsed === 1 || parsed === 2) {
      scanDepth = parsed;
    }
  }

  const rawOnboarding = getSetting('onboarding_completed');
  const onboardingCompleted = rawOnboarding === 'true' || rawOnboarding === '1';

  return {
    projectsRoots,
    scanDepth,
    onboardingCompleted,
  };
}

/**
 * Salva as configurações centrais do hub dentro de uma transação SQLite atômica.
 */
export function saveHubSettings(settings: {
  projectsRoots?: string[];
  scanDepth?: number;
  onboardingCompleted?: boolean;
}): void {
  const db = getDb();

  db.transaction(() => {
    if (settings.projectsRoots !== undefined) {
      setSetting('projects_roots', JSON.stringify(settings.projectsRoots), false);
    }
    if (settings.scanDepth !== undefined) {
      setSetting('scan_depth', String(settings.scanDepth), false);
    }
    if (settings.onboardingCompleted !== undefined) {
      setSetting('onboarding_completed', settings.onboardingCompleted ? 'true' : 'false', false);
    }
  })();

  notifyChange();
}
