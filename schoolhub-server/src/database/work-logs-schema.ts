export const WORK_LOG_SCHEMA=`
CREATE TABLE IF NOT EXISTS teacher_work_logs(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),teacher_id text NOT NULL REFERENCES staff(id),
 class_id text NOT NULL REFERENCES classes(id),section_id text NOT NULL REFERENCES sections(id),academic_year_id text NOT NULL REFERENCES academic_years(id),
 data jsonb NOT NULL,archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 created_by text NOT NULL REFERENCES users(id),updated_by text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,id)
);
CREATE TABLE IF NOT EXISTS teacher_work_log_files(
 id text PRIMARY KEY,school_id text NOT NULL,work_log_id text NOT NULL,
 name text NOT NULL,type text NOT NULL,size integer NOT NULL,content text NOT NULL,
 archived boolean NOT NULL DEFAULT false,
 FOREIGN KEY(school_id,work_log_id) REFERENCES teacher_work_logs(school_id,id)
);
CREATE INDEX IF NOT EXISTS teacher_work_logs_scope ON teacher_work_logs(school_id,teacher_id,archived);
CREATE INDEX IF NOT EXISTS teacher_work_log_files_scope ON teacher_work_log_files(school_id,work_log_id,archived);
`;
