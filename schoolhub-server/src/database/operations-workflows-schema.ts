export const OPERATIONS_WORKFLOW_SCHEMA=`
CREATE TABLE IF NOT EXISTS operation_workflow_settings(
 school_id text PRIMARY KEY REFERENCES schools(id),definitions jsonb NOT NULL,policies jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS operation_workflow_instances(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),workflow_id text NOT NULL,
 subject_type text NOT NULL,subject_id text NOT NULL,data jsonb NOT NULL,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,subject_type,subject_id)
);
CREATE TABLE IF NOT EXISTS school_leave_requests(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),data jsonb NOT NULL,
 archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
