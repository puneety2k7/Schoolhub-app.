import pg from 'pg';
import type { Database, Queryable, QueryResult } from './types.js';

export function createPostgresDatabase(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, statement_timeout: 15_000 });
  return {
    query: <T = Record<string, unknown>>(text: string, values?: unknown[]) => pool.query(text, values) as unknown as Promise<QueryResult<T>>,
    async transaction<T>(work: (db: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result = await work(client as Queryable); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end()
  };
}
