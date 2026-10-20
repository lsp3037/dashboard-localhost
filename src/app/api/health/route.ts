import fs from 'node:fs';
import path from 'node:path';

import { getConfig } from '@/lib/server/config';
import { getDb } from '@/lib/server/db';
import { internal } from '@/lib/server/errors';
import { jsonError, jsonOk } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readHubVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed === 'object' && parsed !== null) {
      const version = (parsed as Record<string, unknown>).version;
      if (typeof version === 'string' && version.length > 0) return version;
    }
  } catch {
    // Versão é informativa: se o package.json não puder ser lido, seguimos com o fallback.
  }

  return '0.0.0';
}

const HUB_VERSION = readHubVersion();

export async function GET(): Promise<Response> {
  try {
    getDb().prepare<[], { ok: number }>('SELECT 1 AS ok').get();
  } catch (error) {
    console.error('[hub] health: banco indisponível:', error);
    return jsonError(internal('Banco de dados indisponível.'));
  }

  try {
    const config = getConfig();

    return jsonOk({
      ok: true,
      db: 'ok',
      version: HUB_VERSION,
      roots: [...config.projectsRoots],
    });
  } catch (error) {
    return jsonError(error);
  }
}
