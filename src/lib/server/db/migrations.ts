import 'server-only';

import type { HubDatabase } from '@/lib/server/db/driver';

interface Migration {
  readonly version: number;
  /** Statements aplicados em ordem, dentro de uma transação. */
  readonly statements: readonly string[];
}

const V1_SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  path             TEXT NOT NULL,
  parent_id        TEXT REFERENCES projects(id) ON DELETE SET NULL,
  source           TEXT NOT NULL DEFAULT 'scan'
                     CHECK (source IN ('scan','manual')),
  kind             TEXT NOT NULL DEFAULT 'node'
                     CHECK (kind IN ('node','non-node')),
  hidden           INTEGER NOT NULL DEFAULT 0,
  missing          INTEGER NOT NULL DEFAULT 0,
  stack            TEXT NOT NULL DEFAULT '[]',
  package_manager  TEXT
                     CHECK (package_manager IN ('npm','pnpm','yarn','bun') OR package_manager IS NULL),
  scripts          TEXT NOT NULL DEFAULT '[]',
  default_script   TEXT,
  preferred_port   INTEGER,
  git_branch       TEXT,
  git_head_at      TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_scanned_at  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_path ON projects(path);

CREATE TABLE IF NOT EXISTS process_runs (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script           TEXT NOT NULL,
  command          TEXT NOT NULL,
  pid              INTEGER,
  pid_started_at   TEXT,
  port             INTEGER,
  status           TEXT NOT NULL
                     CHECK (status IN ('starting','running','stopping','stopped','crashed','failed')),
  exit_code        INTEGER,
  error_code       TEXT,
  error_message    TEXT,
  log_path         TEXT,
  started_at       TEXT NOT NULL,
  ended_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_project ON process_runs(project_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_one_active
  ON process_runs(project_id) WHERE ended_at IS NULL;
`;

/**
 * v2: identidade do projeto passa a ser o nome da pasta; `package.json.name` vira
 * metadado separado (`package_name`), exibido como informação secundária.
 */
const V2_ADD_PACKAGE_NAME = `
ALTER TABLE projects ADD COLUMN package_name TEXT;
`;

/**
 * v3: configurações persistidas do hub (raízes customizadas, scan depth, status de onboarding).
 */
const V3_HUB_SETTINGS = `
CREATE TABLE IF NOT EXISTS hub_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [V1_SCHEMA],
  },
  {
    version: 2,
    statements: [V2_ADD_PACKAGE_NAME],
  },
  {
    version: 3,
    statements: [V3_HUB_SETTINGS],
  },
];

const LATEST_VERSION = MIGRATIONS.reduce((highest, migration) => Math.max(highest, migration.version), 0);

/** Versão de schema esperada pelo código atual. */
export const SCHEMA_VERSION = LATEST_VERSION;

function readUserVersion(db: HubDatabase): number {
  const value = db.pragma('user_version', { simple: true });
  return typeof value === 'number' ? value : 0;
}

/**
 * Aplica as migrações pendentes em ordem, cada uma em sua própria transação.
 * Idempotente: uma segunda chamada não reaplica nada (`PRAGMA user_version`).
 */
export function migrate(db: HubDatabase): number {
  let current = readUserVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;

    db.transaction(() => {
      for (const statement of migration.statements) {
        db.exec(statement);
      }

      // `PRAGMA` não aceita parâmetro vinculado; o valor vem de constante numérica nossa.
      db.pragma(`user_version = ${String(migration.version)}`);
    })();

    current = migration.version;
  }

  return current;
}
