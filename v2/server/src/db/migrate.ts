import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from './database.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from source (src/db) and from the build output (dist/server/src/db).
export const MIGRATIONS_DIR = [path.resolve(here, '../../migrations'), path.resolve(here, '../../../../migrations')].find((candidate) => existsSync(candidate)) ?? path.resolve(here, '../../migrations');

/** Applies migrations/NNN_name.sql in order. Forward-only; applied files are never re-run. */
export async function migrate(db: Database): Promise<string[]> {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
  const applied: string[] = [];
  for (const file of files) {
    const done = await db.query('SELECT 1 FROM schema_migrations WHERE version=$1', [file]);
    if (done.rowCount) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.tx(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
    });
    applied.push(file);
  }
  return applied;
}

/** Test helper: wipes a *_test database and re-applies every migration. Refuses any other database. */
export async function resetTestDatabase(db: Database, databaseUrl: string): Promise<void> {
  if (!/_test$/.test(new URL(databaseUrl).pathname.slice(1))) throw new Error('Refusing to reset a database that is not a *_test database.');
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db);
}
