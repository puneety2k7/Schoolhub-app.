import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4120),
  // V2 owns its own database. Either DATABASE_URL or the POSTGRES_* parts; the database name is checked against an allow-list.
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default('127.0.0.1'),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  POSTGRES_DATABASE: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  SESSION_COOKIE: z.string().default('sh2_sid'),
  SESSION_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  ALLOWED_ORIGIN: z.string().default('http://127.0.0.1:5180'),
});
export type Config = {
  nodeEnv: 'development' | 'test' | 'production'; host: string; port: number; databaseUrl: string;
  sessionCookie: string; sessionHours: number; allowedOrigin: string;
};
/** The only databases V2 may ever connect to. Anything else (including any old SchoolHub database) is refused. */
export const APPROVED_V2_DATABASES = ['schoolhub_v2', 'schoolhub_v2_test'] as const;

export function resolveDatabaseUrl(env: Record<string, string | undefined>): string {
  const parsed = schema.parse(env);
  if (parsed.DATABASE_URL) return parsed.DATABASE_URL;
  if (!parsed.POSTGRES_DATABASE || !parsed.POSTGRES_USER || parsed.POSTGRES_PASSWORD === undefined) {
    throw new Error('Database is not configured: set POSTGRES_DATABASE, POSTGRES_USER and POSTGRES_PASSWORD (see v2.config.env.example).');
  }
  return `postgresql://${encodeURIComponent(parsed.POSTGRES_USER)}:${encodeURIComponent(parsed.POSTGRES_PASSWORD)}@${parsed.POSTGRES_HOST}:${parsed.POSTGRES_PORT}/${encodeURIComponent(parsed.POSTGRES_DATABASE)}`;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env), databaseUrl = resolveDatabaseUrl(env);
  const database = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (!(APPROVED_V2_DATABASES as readonly string[]).includes(database)) {
    throw new Error(`Refusing to start: "${database}" is not an approved V2 database. V2 may only use: ${APPROVED_V2_DATABASES.join(', ')}.`);
  }
  return {
    nodeEnv: parsed.NODE_ENV, host: parsed.HOST, port: parsed.PORT, databaseUrl,
    sessionCookie: parsed.SESSION_COOKIE, sessionHours: parsed.SESSION_HOURS, allowedOrigin: parsed.ALLOWED_ORIGIN,
  };
}
