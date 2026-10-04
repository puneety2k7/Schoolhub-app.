export type QueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount: number | null };
export interface Queryable { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>>; }
export interface Database extends Queryable {
  transaction<T>(work: (db: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
