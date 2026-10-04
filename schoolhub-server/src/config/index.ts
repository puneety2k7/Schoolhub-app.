import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4010),
  DATABASE_URL: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('schoolhub_sid'),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(10080).default(480),
  ALLOWED_ORIGINS: z.string().default('http://127.0.0.1:8080'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_DIRECTORY: z.string().min(1).max(240).default('logs'),
  LOG_TO_FILE: z.enum(['true', 'false']).default('false'),
  LOG_MAX_SIZE_MB: z.coerce.number().int().min(1).max(1024).default(20),
  LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PORTAL_ROLLOUT_MODE: z.enum(['Off','ReadOnly','Pilot']).default('ReadOnly')
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production'; host: string; port: number;
  databaseUrl: string; cookieName: string; sessionTtlMinutes: number;
  allowedOrigins: string[]; trustProxy: boolean; logLevel: string;
  logDirectory: string; logToFile: boolean; logMaxSizeMb: number; logRetentionDays: number; portalRolloutMode?: 'Off'|'ReadOnly'|'Pilot';
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error('Invalid server configuration: ' + parsed.error.issues.map(i => i.path.join('.') + ' ' + i.message).join('; '));
  const v = parsed.data;
  if (v.NODE_ENV === 'production' && !v.DATABASE_URL.startsWith('postgresql://')) throw new Error('Production DATABASE_URL must use PostgreSQL.');
  return { nodeEnv:v.NODE_ENV, host:v.HOST, port:v.PORT, databaseUrl:v.DATABASE_URL, cookieName:v.SESSION_COOKIE_NAME,
    sessionTtlMinutes:v.SESSION_TTL_MINUTES, allowedOrigins:v.ALLOWED_ORIGINS.split(',').map(x=>x.trim()).filter(Boolean),
    trustProxy:v.TRUST_PROXY==='true', logLevel:v.LOG_LEVEL, logDirectory:v.LOG_DIRECTORY,
    logToFile:v.LOG_TO_FILE==='true', logMaxSizeMb:v.LOG_MAX_SIZE_MB, logRetentionDays:v.LOG_RETENTION_DAYS, portalRolloutMode:v.PORTAL_ROLLOUT_MODE };
}
