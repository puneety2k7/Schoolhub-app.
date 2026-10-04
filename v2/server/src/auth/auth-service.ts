import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { Database, Db } from '../db/database.js';
import { AppError, badRequest, unauthenticated } from '../http/errors.js';
import { writeAudit } from '../audit/audit.js';

export type Principal = { userId: string; schoolId: string; username: string; displayName: string; systemAdministrator: boolean };
export type Session = { token: string; csrfToken: string; expiresAt: Date };

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const PASSWORD_RULE = 'Use at least 12 characters with upper case, lower case, a number and a symbol.';
export const isStrongPassword = (password: string) => password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

export class AuthService {
  constructor(private readonly db: Database, private readonly sessionHours: number) {}

  /** First-run setup: creates the school and its first System Administrator. Allowed exactly once. */
  async setup(input: { schoolName: string; schoolSlug: string; username: string; displayName: string; password: string }) {
    if (!isStrongPassword(input.password)) throw badRequest(PASSWORD_RULE);
    const passwordHash = await hashPassword(input.password);
    return this.db.tx(async (tx) => {
      await tx.query('LOCK TABLE schools IN EXCLUSIVE MODE');
      if ((await tx.query('SELECT 1 FROM schools LIMIT 1')).rowCount) throw new AppError(409, 'SETUP_ALREADY_COMPLETED', 'Initial setup has already been completed.');
      const school = (await tx.query<{ id: string }>('INSERT INTO schools(name,slug) VALUES($1,$2) RETURNING id', [input.schoolName, input.schoolSlug])).rows[0]!;
      const user = (await tx.query<{ id: string }>(
        'INSERT INTO users(school_id,username,display_name,password_hash,system_administrator) VALUES($1,$2,$3,$4,true) RETURNING id',
        [school.id, input.username, input.displayName, passwordHash])).rows[0]!;
      await writeAudit(tx, { schoolId: school.id, actorUserId: user.id, action: 'SETUP_COMPLETED', entityType: 'School', entityId: school.id });
      return { schoolId: school.id, userId: user.id };
    });
  }

  async login(schoolSlug: string, username: string, password: string): Promise<{ principal: Principal; session: Session }> {
    const row = (await this.db.query<any>(
      `SELECT u.id,u.school_id,u.username,u.display_name,u.password_hash,u.system_administrator,u.status
         FROM users u JOIN schools s ON s.id=u.school_id WHERE s.slug=$1 AND lower(u.username)=lower($2)`, [schoolSlug, username])).rows[0];
    // Same error for unknown user and wrong password.
    const ok = row && row.status === 'Active' && (await argon2.verify(row.password_hash, password).catch(() => false));
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'The school, username or password is incorrect.');
    const session = await this.createSession(this.db, row.id);
    await writeAudit(this.db, { schoolId: row.school_id, actorUserId: row.id, action: 'LOGIN', entityType: 'User', entityId: row.id });
    return { principal: { userId: row.id, schoolId: row.school_id, username: row.username, displayName: row.display_name, systemAdministrator: row.system_administrator }, session };
  }

  private async createSession(db: Db, userId: string): Promise<Session> {
    const token = randomBytes(32).toString('base64url'), csrfToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionHours * 3600_000);
    await db.query('INSERT INTO sessions(user_id,token_hash,csrf_token,expires_at) VALUES($1,$2,$3,$4)', [userId, hashToken(token), csrfToken, expiresAt]);
    return { token, csrfToken, expiresAt };
  }

  async authenticate(token: string | undefined): Promise<{ principal: Principal; csrfToken: string }> {
    if (!token) throw unauthenticated();
    const row = (await this.db.query<any>(
      `SELECT u.id,u.school_id,u.username,u.display_name,u.system_administrator,u.status,s.csrf_token
         FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [hashToken(token)])).rows[0];
    if (!row || row.status !== 'Active') throw unauthenticated();
    return { principal: { userId: row.id, schoolId: row.school_id, username: row.username, displayName: row.display_name, systemAdministrator: row.system_administrator }, csrfToken: row.csrf_token };
  }

  async logout(token: string | undefined) {
    if (token) await this.db.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(token)]);
  }
}
