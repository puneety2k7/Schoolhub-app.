-- SchoolHub V2 — 004: the universal record model and validated references.
CREATE TABLE records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id),
  workspace_id uuid NOT NULL,
  tab_key text NOT NULL,
  state text NOT NULL DEFAULT 'Active' CHECK (state IN ('Active', 'Archived')),
  field_values jsonb NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  owner_user_id uuid NOT NULL REFERENCES users(id),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid REFERENCES users(id),
  archived_at timestamptz,
  FOREIGN KEY (workspace_id, tab_key) REFERENCES workspace_tabs (workspace_id, tab_key),
  CHECK ((state = 'Archived') = (archived_at IS NOT NULL))
);
CREATE INDEX records_list_idx ON records (workspace_id, tab_key, state, created_at DESC);
CREATE INDEX records_owner_idx ON records (owner_user_id);

-- Relationship integrity: a reference field value is a real record. RESTRICT keeps a referenced record from being physically deleted.
CREATE TABLE record_references (
  source_record_id uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  target_record_id uuid NOT NULL REFERENCES records(id) ON DELETE RESTRICT,
  PRIMARY KEY (source_record_id, field_key, target_record_id)
);
CREATE INDEX record_references_target_idx ON record_references (target_record_id);
