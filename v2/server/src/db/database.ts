import pg from 'pg';

pg.types.setTypeParser(20, (value) => Number(value)); // bigint → number (counts, audit ids)

export type QueryResult<T> = { rows: T[]; rowCount: number };
export interface Db {
  query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export class Database implements Db {
  private readonly pool: pg.Pool;
  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 10 });
  }
  async query<T = any>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.pool.query(text, params as any[]);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }
  /** Runs `work` in one transaction; any throw rolls back. */
  async tx<T>(work: (tx: Db) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tx: Db = {
        query: async <R = any>(text: string, params: unknown[] = []) => {
          const result = await client.query(text, params as any[]);
          return { rows: result.rows as R[], rowCount: result.rowCount ?? 0 };
        },
      };
      const value = await work(tx);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  async close() { await this.pool.end(); }
}
