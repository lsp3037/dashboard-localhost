import 'server-only';

import { closeDb, getDatabasePath, getDb } from '@/lib/server/db/driver';
import { migrate, SCHEMA_VERSION } from '@/lib/server/db/migrations';

export { closeDb, getDatabasePath, getDb, migrate, SCHEMA_VERSION };
export type { HubDatabase } from '@/lib/server/db/driver';
