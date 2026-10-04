import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4020),
  // V2 owns its own database. It must never point at an old SchoolHub database.
  DATABASE_URL: z.string().min(1).default('postgresql://schoolhub_v2:v2devpass@127.0.0.1:5432/schoolhub_v2'),
  SESSION_COOKIE: z.string().default('sh2_sid'),
  SESSION_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  ALLOWED_ORIGIN: z.string().default('http://127.0.0.1:5173'),
});
export type Config = {
  nodeEnv: 'development' | 'test' | 'production'; host: string; port: number; databaseUrl: string;
  sessionCookie: string; sessionHours: number; allowedOrigin: string;
};
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);
  if (/schoolhub(?!_v2)\b/.test(new URL(parsed.DATABASE_URL).pathname.slice(1)) ) {
    throw new Error('V2 must use a schoolhub_v2* database, never the old SchoolHub database.');
  }
  return {
    nodeEnv: parsed.NODE_ENV, host: parsed.HOST, port: parsed.PORT, databaseUrl: parsed.DATABASE_URL,
    sessionCookie: parsed.SESSION_COOKIE, sessionHours: parsed.SESSION_HOURS, allowedOrigin: parsed.ALLOWED_ORIGIN,
  };
}
