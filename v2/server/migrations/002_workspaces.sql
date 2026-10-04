-- SchoolHub V2 — 002: Workspace → Tab → Section → Field definition model (Workspace Manager source of truth).
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id),
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9-]{1,59}$'),
  name text NOT NULL,
  plural_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  icon text NOT NULL DEFAULT 'folder',
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
  -- Field whose value labels a record when another workspace references it.
  display_field_key text,
  print_title text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, key),
  UNIQUE (school_id, id)
);

CREATE TABLE workspace_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- {"sections":[{"title":"…","fieldKeys":["a","b"]}]} — arranges existing workspace fields; defines no fields of its own.
  layout jsonb NOT NULL DEFAULT '{"sections":[]}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

-- The five-tab contract: every workspace has exactly MAIN, GRID_1, GRID_2, GRID_3 (the Dashboard is not a record tab).
CREATE TABLE workspace_tabs (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tab_key text NOT NULL CHECK (tab_key IN ('MAIN', 'GRID_1', 'GRID_2', 'GRID_3')),
  label text NOT NULL,
  form_id uuid,
  PRIMARY KEY (workspace_id, tab_key),
  FOREIGN KEY (workspace_id, form_id) REFERENCES workspace_forms (workspace_id, id)
);

CREATE TABLE workspace_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  tab_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  FOREIGN KEY (workspace_id, tab_key) REFERENCES workspace_tabs (workspace_id, tab_key) ON DELETE CASCADE,
  UNIQUE (workspace_id, id)
);

CREATE TABLE workspace_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  -- A field belongs to exactly one section; the section determines the tab.
  section_id uuid NOT NULL,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,59}$'),
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'long_text', 'integer', 'decimal', 'boolean', 'date', 'select', 'reference')),
  required boolean NOT NULL DEFAULT false,
  read_only boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  searchable boolean NOT NULL DEFAULT false,
  filterable boolean NOT NULL DEFAULT false,
  print_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  help_text text NOT NULL DEFAULT '',
  default_value jsonb,
  options jsonb NOT NULL DEFAULT '[]',
  reference_workspace_id uuid REFERENCES workspaces(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, section_id) REFERENCES workspace_sections (workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, key),
  CHECK ((field_type = 'reference') = (reference_workspace_id IS NOT NULL))
);

CREATE TABLE workspace_action_settings (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tab_key text NOT NULL CHECK (tab_key IN ('MAIN', 'GRID_1', 'GRID_2', 'GRID_3')),
  operation text NOT NULL CHECK (operation IN ('view', 'add', 'edit', 'print', 'archive', 'restore', 'permanent_delete')),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, tab_key, operation)
);

CREATE TABLE dashboard_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('metric', 'table')),
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  -- metric: {"sourceTab":"MAIN","aggregation":"count|sum|avg|min|max","fieldKey":"…"}   table: {"sourceTab":"MAIN","fieldKeys":["…"],"limit":10}
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
