-- SchoolHub V2 — 001: tenants, users, sessions, audit.
CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id),
  username text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  -- System Administrator authority comes from this flag, never from stored permission rows.
  system_administrator boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_school_username_uq ON users (school_id, lower(username));
CREATE UNIQUE INDEX users_id_school_uq ON users (id, school_id);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  workspace_id uuid,
  tab_key text,
  outcome text NOT NULL DEFAULT 'SUCCESS',
  summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_school_time_idx ON audit_events (school_id, created_at DESC);
CREATE INDEX audit_entity_idx ON audit_events (entity_type, entity_id);
