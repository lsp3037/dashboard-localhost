import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { getConfig } from '@/lib/server/config';
import { migrate } from '@/lib/server/db/migrations';

export type HubDatabase = Database.Database;

interface DbGlobal {
  __hubDb?: HubDatabase;
}

/**
 * O Next recarrega módulos em dev (HMR): guardar a conexão no `globalThis`
 * evita abrir um novo handle SQLite a cada recompilação.
 */
const globalForDb = globalThis as typeof globalThis & DbGlobal;

const DATABASE_FILE_NAME = 'hub.db';

export function getDatabasePath(): string {
  return path.join(getConfig().dataDir, DATABASE_FILE_NAME);
}

function openDatabase(file: string): HubDatabase {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  migrate(db);

  return db;
}

/** Conexão única (singleton) com o SQLite do hub, já migrada. */
export function getDb(): HubDatabase {
  const cached = globalForDb.__hubDb;

  if (cached !== undefined && cached.open) {
    return cached;
  }

  const db = openDatabase(getDatabasePath());
  globalForDb.__hubDb = db;

  return db;
}

/** Fecha a conexão e limpa o singleton (usado no shutdown e em testes). */
export function closeDb(): void {
  const cached = globalForDb.__hubDb;
  if (cached === undefined) return;

  if (cached.open) cached.close();
  delete globalForDb.__hubDb;
}
