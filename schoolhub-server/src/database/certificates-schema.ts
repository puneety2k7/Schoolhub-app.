export const CERTIFICATES_SCHEMA=`
CREATE TABLE IF NOT EXISTS school_certificate_requests(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),
 data jsonb NOT NULL,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,id)
);
CREATE TABLE IF NOT EXISTS school_certificate_counters(
 school_id text NOT NULL REFERENCES schools(id),certificate_type text NOT NULL,next_number bigint NOT NULL DEFAULT 1,
 PRIMARY KEY(school_id,certificate_type)
);
CREATE TABLE IF NOT EXISTS school_certificates(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),request_id text NOT NULL,student_id text NOT NULL REFERENCES students(id),
 certificate_number text NOT NULL,data jsonb NOT NULL,reprint_count integer NOT NULL DEFAULT 0,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,id),UNIQUE(school_id,request_id),UNIQUE(school_id,certificate_number),
 FOREIGN KEY(school_id,request_id) REFERENCES school_certificate_requests(school_id,id)
);
CREATE INDEX IF NOT EXISTS certificate_requests_school_status_idx ON school_certificate_requests(school_id,((data->>'status')),created_at DESC);
CREATE INDEX IF NOT EXISTS certificates_school_student_idx ON school_certificates(school_id,student_id,created_at DESC);
`;
