import { isValidSelection, type PermissionSelection } from '../../../shared/src/index.js';
import type { Database } from '../db/database.js';
import { hashPassword, isStrongPassword, PASSWORD_RULE, type Principal } from '../auth/auth-service.js';
import { writeAudit } from '../audit/audit.js';
import { badRequest, conflict, notFound } from '../http/errors.js';

/** Users, Groups, Roles. Operational permissions exist ONLY as role selections reached through groups. */
export class AccessService {
  constructor(private readonly db: Database) {}
  private audit(p: Principal, action: string, entityType: string, entityId: string, summary: Record<string, unknown> = {}) {
    return writeAudit(this.db, { schoolId: p.schoolId, actorUserId: p.userId, action, entityType, entityId, summary });
  }
  async overview(p: Principal) {
    const q = (sql: string) => this.db.query<any>(sql, [p.schoolId]).then((r) => r.rows);
    const [users, groups, roles, members, groupRoles, perms] = await Promise.all([
      q('SELECT id,username,display_name AS "displayName",system_administrator AS "systemAdministrator",status FROM users WHERE school_id=$1 ORDER BY username'),
      q('SELECT id,name,description FROM groups WHERE school_id=$1 ORDER BY name'),
      q('SELECT r.id,r.name,r.description,r.workspace_id AS "workspaceId" FROM roles r WHERE r.school_id=$1 ORDER BY r.name'),
      q('SELECT gm.group_id AS "groupId",gm.user_id AS "userId" FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE g.school_id=$1'),
      q('SELECT gr.group_id AS "groupId",gr.role_id AS "roleId" FROM group_roles gr JOIN groups g ON g.id=gr.group_id WHERE g.school_id=$1'),
      q('SELECT rp.role_id AS "roleId",rp.tab_key AS "tabKey",rp.permission_key AS "permissionKey" FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.school_id=$1'),
    ]);
    return { users, groups, members, groupRoles, roles: roles.map((role) => ({ ...role, selections: perms.filter((row) => row.roleId === role.id).map((row) => ({ tabKey: row.tabKey, permissionKey: row.permissionKey })) })) };
  }
  async createUser(p: Principal, input: { username: string; displayName: string; password: string }) {
    if (!isStrongPassword(input.password)) throw badRequest(PASSWORD_RULE);
    const hash = await hashPassword(input.password);
    try {
      const id = (await this.db.query<{ id: string }>('INSERT INTO users(school_id,username,display_name,password_hash) VALUES($1,$2,$3,$4) RETURNING id', [p.schoolId, input.username, input.displayName, hash])).rows[0]!.id;
      await this.audit(p, 'USER_CREATED', 'User', id); return id;
    } catch (error: any) { if (error.code === '23505') throw conflict('DUPLICATE_USER', 'That username is already in use.'); throw error; }
  }
  async createGroup(p: Principal, input: { name: string; description?: string }) {
    try {
      const id = (await this.db.query<{ id: string }>('INSERT INTO groups(school_id,name,description) VALUES($1,$2,$3) RETURNING id', [p.schoolId, input.name, input.description ?? ''])).rows[0]!.id;
      await this.audit(p, 'GROUP_CREATED', 'Group', id); return id;
    } catch (error: any) { if (error.code === '23505') throw conflict('DUPLICATE_GROUP', 'A group with that name exists.'); throw error; }
  }
  async setGroupMembers(p: Principal, groupId: string, userIds: string[]) {
    await this.db.tx(async (tx) => {
      if (!(await tx.query('SELECT 1 FROM groups WHERE id=$1 AND school_id=$2', [groupId, p.schoolId])).rowCount) throw notFound('Group');
      await tx.query('DELETE FROM group_members WHERE group_id=$1', [groupId]);
      for (const userId of userIds) await tx.query('INSERT INTO group_members(group_id,user_id) SELECT $1,id FROM users WHERE id=$2 AND school_id=$3', [groupId, userId, p.schoolId]);
      await writeAudit(tx, { schoolId: p.schoolId, actorUserId: p.userId, action: 'GROUP_MEMBERS_SET', entityType: 'Group', entityId: groupId, summary: { count: userIds.length } });
    });
  }
  async setGroupRoles(p: Principal, groupId: string, roleIds: string[]) {
    await this.db.tx(async (tx) => {
      if (!(await tx.query('SELECT 1 FROM groups WHERE id=$1 AND school_id=$2', [groupId, p.schoolId])).rowCount) throw notFound('Group');
      await tx.query('DELETE FROM group_roles WHERE group_id=$1', [groupId]);
      for (const roleId of roleIds) await tx.query('INSERT INTO group_roles(group_id,role_id) SELECT $1,id FROM roles WHERE id=$2 AND school_id=$3', [groupId, roleId, p.schoolId]);
      await writeAudit(tx, { schoolId: p.schoolId, actorUserId: p.userId, action: 'GROUP_ROLES_SET', entityType: 'Group', entityId: groupId, summary: { count: roleIds.length } });
    });
  }
  /** Creates a workspace role holding the given selections (at most the 41 universal ones). */
  async createRole(p: Principal, input: { workspaceId: string; name: string; description?: string; selections: PermissionSelection[] }) {
    for (const selection of input.selections) if (!isValidSelection(selection)) throw badRequest(`Invalid permission selection ${selection.tabKey}|${selection.permissionKey}.`);
    return this.db.tx(async (tx) => {
      if (!(await tx.query('SELECT 1 FROM workspaces WHERE id=$1 AND school_id=$2', [input.workspaceId, p.schoolId])).rowCount) throw notFound('Workspace');
      let id: string;
      try { id = (await tx.query<{ id: string }>('INSERT INTO roles(school_id,workspace_id,name,description) VALUES($1,$2,$3,$4) RETURNING id', [p.schoolId, input.workspaceId, input.name, input.description ?? ''])).rows[0]!.id; }
      catch (error: any) { if (error.code === '23505') throw conflict('DUPLICATE_ROLE', 'A role with that name exists for this workspace.'); throw error; }
      await this.writeSelections(tx, id, input.selections);
      await writeAudit(tx, { schoolId: p.schoolId, actorUserId: p.userId, action: 'ROLE_CREATED', entityType: 'Role', entityId: id, workspaceId: input.workspaceId, summary: { selections: input.selections.length } });
      return id;
    });
  }
  async setRoleSelections(p: Principal, roleId: string, selections: PermissionSelection[]) {
    for (const selection of selections) if (!isValidSelection(selection)) throw badRequest(`Invalid permission selection ${selection.tabKey}|${selection.permissionKey}.`);
    await this.db.tx(async (tx) => {
      if (!(await tx.query('SELECT 1 FROM roles WHERE id=$1 AND school_id=$2', [roleId, p.schoolId])).rowCount) throw notFound('Role');
      await tx.query('DELETE FROM role_permissions WHERE role_id=$1', [roleId]);
      await this.writeSelections(tx, roleId, selections);
      await writeAudit(tx, { schoolId: p.schoolId, actorUserId: p.userId, action: 'ROLE_PERMISSIONS_SET', entityType: 'Role', entityId: roleId, summary: { selections: selections.length } });
    });
  }
  private async writeSelections(tx: { query: Database['query'] }, roleId: string, selections: PermissionSelection[]) {
    for (const selection of selections) await tx.query('INSERT INTO role_permissions(role_id,tab_key,permission_key) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [roleId, selection.tabKey, selection.permissionKey]);
  }
}
