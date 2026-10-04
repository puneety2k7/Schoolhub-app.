-- SchoolHub V2 — 003: User → Group → Role → Workspace permissions. No direct user grants exist in this schema.
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX groups_school_name_uq ON groups (school_id, lower(name));

CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- A role belongs to one workspace and holds up to the 41 universal selections.
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roles_workspace_name_uq ON roles (workspace_id, lower(name));

CREATE TABLE group_roles (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, role_id)
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tab_key text NOT NULL,
  permission_key text NOT NULL,
  PRIMARY KEY (role_id, tab_key, permission_key),
  CHECK (
    (tab_key = 'DASHBOARD' AND permission_key = 'VIEW')
    OR (tab_key IN ('MAIN', 'GRID_1', 'GRID_2', 'GRID_3') AND permission_key IN ('VIEW', 'ADD', 'EDIT', 'DELETE', 'PRINT'))
    OR (tab_key = 'SPECIAL' AND permission_key IN (
      'WORKSPACE_ADMINISTRATOR', 'IMPORT_RECORDS', 'VIEW_CHANGE_LOG', 'VIEW_ARCHIVED_RECORDS', 'RESTORE_ARCHIVED_RECORDS',
      'PERMANENT_DELETE', 'VIEW_RECORDS_OWNED_BY_OTHERS', 'VIEW_ASSIGNED_RECORDS', 'ASSIGN_RECORDS', 'CHANGE_RECORD_OWNER',
      'PUBLISH', 'UNPUBLISH', 'ACKNOWLEDGE', 'SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'CANCEL', 'OVERRIDE_RECORD_LOCKS'))
  )
);
