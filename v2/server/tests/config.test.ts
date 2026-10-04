import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('V2 database safety guard', () => {
  const parts = (database: string) => ({ POSTGRES_DATABASE: database, POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p@ss/word' });
  it('accepts only the approved V2 databases', () => {
    expect(loadConfig(parts('schoolhub_v2') as any).databaseUrl).toContain('/schoolhub_v2');
    expect(loadConfig(parts('schoolhub_v2_test') as any).databaseUrl).toContain('/schoolhub_v2_test');
  });
  it('refuses the old SchoolHub database and any other name', () => {
    for (const name of ['schoolhub', 'school', 'postgres', 'schoolhub_v2_old', 'schoolhub_v20']) expect(() => loadConfig(parts(name) as any), name).toThrow(/not an approved V2 database/);
    expect(() => loadConfig({ DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/schoolhub' } as any)).toThrow(/not an approved V2 database/);
  });
  it('requires the database settings and encodes special characters in the password', () => {
    expect(() => loadConfig({} as any)).toThrow(/not configured/);
    expect(loadConfig(parts('schoolhub_v2') as any).databaseUrl).toContain('p%40ss%2Fword');
  });
  it('uses V2 ports that differ from the old application defaults (4010 / 8080)', () => {
    const config = loadConfig(parts('schoolhub_v2') as any);
    expect(config.port).toBe(4120); expect(config.port).not.toBe(4010);
  });
});
