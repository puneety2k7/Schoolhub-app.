export const PICKLISTS_SCHEMA=`
CREATE TABLE IF NOT EXISTS picklist_definitions(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 picklist_key text NOT NULL,name text NOT NULL,description text NOT NULL DEFAULT '',
 source_type text NOT NULL CHECK(source_type IN ('AdminDefined','Workspace')),
 workspace_id text REFERENCES workspace_definitions(id) ON DELETE RESTRICT,
 value_field_key text,label_field_key text,filter_field_key text,
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(school_id,picklist_key));
CREATE TABLE IF NOT EXISTS picklist_values(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 picklist_id text NOT NULL REFERENCES picklist_definitions(id) ON DELETE CASCADE,
 value text NOT NULL,label text NOT NULL,filter_value text,sort_order integer NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(picklist_id,value));
CREATE INDEX IF NOT EXISTS picklist_definitions_scope_idx ON picklist_definitions(school_id,active,name);
CREATE INDEX IF NOT EXISTS picklist_values_scope_idx ON picklist_values(school_id,picklist_id,active,sort_order);
`;
