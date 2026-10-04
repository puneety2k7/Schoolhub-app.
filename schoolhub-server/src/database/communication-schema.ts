// Additive schema used by versioned migration 9.
export const COMMUNICATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS school_communications(
 id text PRIMARY KEY,
 school_id text NOT NULL REFERENCES schools(id),
 event_date text NOT NULL,
 title text NOT NULL,
 audience text NOT NULL,
 body text NOT NULL,
 status text NOT NULL CHECK(status IN ('Published','Calendar')),
 archived boolean NOT NULL DEFAULT false,
 created_by text NOT NULL REFERENCES users(id),
 source_event_id text,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS school_communications_scope_idx
 ON school_communications(school_id,archived,event_date);
CREATE TABLE IF NOT EXISTS school_calendar_events(
 school_id text NOT NULL REFERENCES schools(id),id text NOT NULL,
 data jsonb NOT NULL DEFAULT '{}',hidden boolean NOT NULL DEFAULT false,
 notice_id text REFERENCES school_communications(id),
 version integer NOT NULL DEFAULT 0,PRIMARY KEY(school_id,id)
);
`;
