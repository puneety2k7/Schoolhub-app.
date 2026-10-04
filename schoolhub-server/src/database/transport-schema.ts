export const TRANSPORT_SCHEMA=`
CREATE TABLE IF NOT EXISTS transport_routes(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),data jsonb NOT NULL,
 archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,id)
);
CREATE TABLE IF NOT EXISTS transport_assignments(
 school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),
 route_id text, pickup_stop text NOT NULL DEFAULT '',drop_stop text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(school_id,student_id),FOREIGN KEY(school_id,route_id) REFERENCES transport_routes(school_id,id)
);
CREATE INDEX IF NOT EXISTS transport_routes_scope ON transport_routes(school_id,archived);
CREATE INDEX IF NOT EXISTS transport_assignments_route ON transport_assignments(school_id,route_id);
`;
