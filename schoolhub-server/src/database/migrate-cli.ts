import { loadConfig } from '../config/index.js';
import { createPostgresDatabase } from './postgres.js';
import { applyMigrations } from './migrations.js';
const db=createPostgresDatabase(loadConfig().databaseUrl);
try { console.log(await applyMigrations(db)); } finally { await db.close(); }
