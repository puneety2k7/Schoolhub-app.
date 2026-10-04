export const SCHOOL_CONTENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS school_content_records(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),
 kind text NOT NULL CHECK(kind IN ('documents','rules')),
 record_key text NOT NULL,data jsonb NOT NULL,
 archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,kind,record_key)
);
CREATE INDEX IF NOT EXISTS school_content_scope_idx ON school_content_records(school_id,kind,archived);
`;

