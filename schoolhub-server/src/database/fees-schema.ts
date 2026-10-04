export const FEES_SCHEMA=`
CREATE TABLE IF NOT EXISTS school_fee_structures(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),data jsonb NOT NULL,
 archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,id)
);
CREATE TABLE IF NOT EXISTS school_fee_assignments(
 school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),
 structure_id text NOT NULL,archived_at timestamptz NULL,PRIMARY KEY(school_id,student_id,structure_id),
 FOREIGN KEY(school_id,structure_id) REFERENCES school_fee_structures(school_id,id)
);
CREATE TABLE IF NOT EXISTS school_fee_counters(
 school_id text PRIMARY KEY REFERENCES schools(id),next_number bigint NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS school_fee_payments(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),
 receipt_key text NOT NULL,data jsonb NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),
 voided boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 mutation_key text NOT NULL,request_fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,receipt_key),UNIQUE(school_id,mutation_key),UNIQUE(school_id,id)
);
CREATE TABLE IF NOT EXISTS school_fee_corrections(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),payment_id text NOT NULL,
 data jsonb NOT NULL,payment_version integer NOT NULL,version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(school_id,payment_id) REFERENCES school_fee_payments(school_id,id)
);
CREATE TABLE IF NOT EXISTS school_fee_receipt_reservations(
 school_id text NOT NULL,receipt_key text NOT NULL,payment_id text NOT NULL,
 PRIMARY KEY(school_id,receipt_key),FOREIGN KEY(school_id,payment_id) REFERENCES school_fee_payments(school_id,id)
);
`;
