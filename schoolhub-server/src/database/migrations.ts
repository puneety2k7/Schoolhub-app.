import type { Database, Queryable } from './types.js';
import { COMMUNICATION_SCHEMA } from './communication-schema.js';
import { SCHOOL_CONTENT_SCHEMA } from './school-content-schema.js';
import { RESOURCE_CATALOG_SCHEMA } from '../routes/resource-catalogs.js';
import { TRANSPORT_SCHEMA } from './transport-schema.js';
import { WORK_LOG_SCHEMA } from './work-logs-schema.js';
import { OPERATIONS_WORKFLOW_SCHEMA } from './operations-workflows-schema.js';
import { FEES_SCHEMA } from './fees-schema.js';
import { CERTIFICATES_SCHEMA } from './certificates-schema.js';
import { PICKLISTS_SCHEMA } from './picklists-schema.js';

export const DATABASE_SCHEMA_VERSION = 50;
export const migrations = [
  { version: 1, name: 'core_identity', sql: `
CREATE TABLE IF NOT EXISTS migration_history(version integer PRIMARY KEY,name text NOT NULL,applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS schools(id text PRIMARY KEY,name text NOT NULL,slug text NOT NULL UNIQUE,settings jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS roles(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(school_id,name));
CREATE TABLE IF NOT EXISTS role_permissions(role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,permission text NOT NULL,PRIMARY KEY(role_id,permission));
CREATE TABLE IF NOT EXISTS staff(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),employee_number text,name text NOT NULL,status text NOT NULL DEFAULT 'Active',created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,UNIQUE(school_id,employee_number));
CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),role_id text NOT NULL REFERENCES roles(id),teacher_id text REFERENCES staff(id),username text NOT NULL,password_hash text NOT NULL,must_change_password boolean NOT NULL DEFAULT false,status text NOT NULL DEFAULT 'Active',created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1);
CREATE UNIQUE INDEX IF NOT EXISTS users_school_username_uq ON users(school_id,lower(username));
CREATE TABLE IF NOT EXISTS academic_years(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,start_date date,end_date date,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,UNIQUE(school_id,name));
CREATE TABLE IF NOT EXISTS classes(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,UNIQUE(school_id,name));
CREATE TABLE IF NOT EXISTS sections(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),class_id text NOT NULL REFERENCES classes(id),name text NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,UNIQUE(school_id,class_id,name));
CREATE TABLE IF NOT EXISTS subjects(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,UNIQUE(school_id,name));
CREATE TABLE IF NOT EXISTS teacher_assignments(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),teacher_id text NOT NULL REFERENCES staff(id),academic_year_id text NOT NULL REFERENCES academic_years(id),class_id text NOT NULL REFERENCES classes(id),section_id text REFERENCES sections(id),subject_id text REFERENCES subjects(id),assignment_type text NOT NULL,valid_from date,valid_until date,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,CHECK(valid_until IS NULL OR valid_from IS NULL OR valid_until>=valid_from));
CREATE TABLE IF NOT EXISTS students(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),admission_number text NOT NULL,name text NOT NULL,class_id text NOT NULL REFERENCES classes(id),section_id text REFERENCES sections(id),academic_year_id text REFERENCES academic_years(id),status text NOT NULL DEFAULT 'Active',father_name text,email text,phone text,address text,date_of_birth date,extra jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,UNIQUE(school_id,admission_number));
CREATE TABLE IF NOT EXISTS sessions(id_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,school_id text NOT NULL REFERENCES schools(id),csrf_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at timestamptz NOT NULL,last_seen_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,user_agent text,ip_address text);
CREATE TABLE IF NOT EXISTS audit_events(id text PRIMARY KEY,school_id text,actor_user_id text,action text NOT NULL,entity_type text,entity_id text,occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,outcome text NOT NULL,reason_code text,correlation_id text NOT NULL,summary jsonb NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS import_jobs(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),backup_hash text NOT NULL,status text NOT NULL,counts jsonb NOT NULL DEFAULT '{}',created_by text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at timestamptz,UNIQUE(school_id,backup_hash));
`},
  { version: 2, name: 'authorization_indexes', sql: `
CREATE INDEX IF NOT EXISTS students_school_class_section_idx ON students(school_id,class_id,section_id,status);
CREATE INDEX IF NOT EXISTS students_school_name_idx ON students(school_id,name);
CREATE INDEX IF NOT EXISTS assignments_scope_idx ON teacher_assignments(school_id,teacher_id,academic_year_id,class_id,section_id,active);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS audit_school_time_idx ON audit_events(school_id,occurred_at);
`},
  { version: 3, name: 'password_invitations_and_assignment_integrity', sql: `
CREATE TABLE IF NOT EXISTS password_invitations(id_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,school_id text NOT NULL REFERENCES schools(id),expires_at timestamptz NOT NULL,used_at timestamptz,created_by text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS password_invitations_expiry_idx ON password_invitations(expires_at) WHERE used_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS assignments_active_unique_idx ON teacher_assignments(school_id,teacher_id,academic_year_id,class_id,COALESCE(section_id,''),COALESCE(subject_id,''),assignment_type) WHERE active=true;
`},
  { version: 4, name: 'authoritative_core_relationships', sql: `
ALTER TABLE staff ADD COLUMN IF NOT EXISTS role_name text NOT NULL DEFAULT 'Teacher';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS subject_snapshot text;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code text;
CREATE INDEX IF NOT EXISTS staff_school_status_idx ON staff(school_id,status,name);
CREATE INDEX IF NOT EXISTS classes_school_active_idx ON classes(school_id,active,name);
CREATE INDEX IF NOT EXISTS sections_school_class_order_idx ON sections(school_id,class_id,active,sort_order);
CREATE INDEX IF NOT EXISTS subjects_school_active_idx ON subjects(school_id,active,name);
CREATE INDEX IF NOT EXISTS academic_years_school_active_idx ON academic_years(school_id,active,name);
CREATE INDEX IF NOT EXISTS assignments_school_active_dates_idx ON teacher_assignments(school_id,active,valid_from,valid_until);
`},
  { version: 5, name: 'secure_role_portals', sql: `
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id text REFERENCES students(id);
CREATE INDEX IF NOT EXISTS users_school_student_idx ON users(school_id,student_id);

CREATE TABLE IF NOT EXISTS guardian_profiles(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,email text,phone text,
 status text NOT NULL DEFAULT 'Active',created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS user_guardian_links(
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,guardian_id text NOT NULL REFERENCES guardian_profiles(id),
 school_id text NOT NULL REFERENCES schools(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS guardian_student_links(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),guardian_id text NOT NULL REFERENCES guardian_profiles(id),
 student_id text NOT NULL REFERENCES students(id),relationship text NOT NULL DEFAULT 'Guardian',active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(school_id,guardian_id,student_id));

CREATE TABLE IF NOT EXISTS attendance_records(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),
 attendance_date date NOT NULL,period text NOT NULL DEFAULT 'Full Day',status text NOT NULL,remark text,
 recorded_by text REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,
 UNIQUE(school_id,student_id,attendance_date,period));
CREATE TABLE IF NOT EXISTS homework_records(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),academic_year_id text REFERENCES academic_years(id),
 class_id text NOT NULL REFERENCES classes(id),section_id text REFERENCES sections(id),subject_id text REFERENCES subjects(id),
 teacher_id text REFERENCES staff(id),title text NOT NULL,instructions text NOT NULL DEFAULT '',assigned_date date NOT NULL,
 due_date date,status text NOT NULL DEFAULT 'Published',created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS exam_records(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),academic_year_id text REFERENCES academic_years(id),
 class_id text NOT NULL REFERENCES classes(id),section_id text REFERENCES sections(id),subject_id text REFERENCES subjects(id),
 name text NOT NULL,max_marks numeric(10,2) NOT NULL,published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS mark_records(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),exam_id text NOT NULL REFERENCES exam_records(id),
 student_id text NOT NULL REFERENCES students(id),marks numeric(10,2),absent boolean NOT NULL DEFAULT false,
 recorded_by text REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,
 UNIQUE(school_id,exam_id,student_id));
CREATE TABLE IF NOT EXISTS fee_summaries(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),
 academic_year_id text REFERENCES academic_years(id),total_due numeric(12,2) NOT NULL DEFAULT 0,
 total_paid numeric(12,2) NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'Unpaid',
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,
 UNIQUE(school_id,student_id,academic_year_id));

CREATE INDEX IF NOT EXISTS guardian_links_school_student_idx ON guardian_student_links(school_id,student_id,active);
CREATE INDEX IF NOT EXISTS attendance_portal_idx ON attendance_records(school_id,student_id,attendance_date);
CREATE INDEX IF NOT EXISTS homework_portal_idx ON homework_records(school_id,class_id,section_id,academic_year_id,status,due_date);
CREATE INDEX IF NOT EXISTS exams_portal_idx ON exam_records(school_id,class_id,section_id,academic_year_id,published);
CREATE INDEX IF NOT EXISTS marks_portal_idx ON mark_records(school_id,student_id,exam_id);
CREATE INDEX IF NOT EXISTS fees_portal_idx ON fee_summaries(school_id,student_id,academic_year_id);
`},
  { version: 6, name: 'production_authority_foundation', sql: `
ALTER TABLE roles ADD COLUMN IF NOT EXISTS system boolean NOT NULL DEFAULT false;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS active_academic_year_id text REFERENCES academic_years(id);
UPDATE roles SET system=true WHERE name='Super Admin';
CREATE INDEX IF NOT EXISTS roles_school_active_idx ON roles(school_id,active,name);
CREATE INDEX IF NOT EXISTS users_school_status_idx ON users(school_id,status,username);
CREATE INDEX IF NOT EXISTS guardians_school_status_idx ON guardian_profiles(school_id,status,name);
`}
,
  { version: 7, name: 'production_academic_operations', sql: `
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE homework_records ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE homework_records ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
ALTER TABLE homework_records ADD COLUMN IF NOT EXISTS attachment_metadata jsonb NOT NULL DEFAULT '[]';
ALTER TABLE exam_records ADD COLUMN IF NOT EXISTS exam_date date;
ALTER TABLE exam_records ADD COLUMN IF NOT EXISTS passing_marks numeric(10,2);
ALTER TABLE exam_records ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'Draft';
ALTER TABLE exam_records ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE exam_records ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE mark_records ADD COLUMN IF NOT EXISTS correction_reason text;
CREATE TABLE IF NOT EXISTS timetable_entries(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),academic_year_id text NOT NULL REFERENCES academic_years(id),
 class_id text NOT NULL REFERENCES classes(id),section_id text REFERENCES sections(id),subject_id text REFERENCES subjects(id),
 teacher_id text REFERENCES staff(id),day_of_week text NOT NULL,period_key text NOT NULL,room text,start_time time,end_time time,
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1);
CREATE UNIQUE INDEX IF NOT EXISTS timetable_slot_uq ON timetable_entries(school_id,academic_year_id,class_id,COALESCE(section_id,''),day_of_week,period_key) WHERE active=true;
CREATE INDEX IF NOT EXISTS timetable_teacher_conflict_idx ON timetable_entries(school_id,academic_year_id,teacher_id,day_of_week,period_key,active);
CREATE INDEX IF NOT EXISTS timetable_room_conflict_idx ON timetable_entries(school_id,academic_year_id,room,day_of_week,period_key,active);
CREATE TABLE IF NOT EXISTS report_card_snapshots(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),
 academic_year_id text NOT NULL REFERENCES academic_years(id),snapshot jsonb NOT NULL,published_by text NOT NULL REFERENCES users(id),
 published_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,
 UNIQUE(school_id,student_id,academic_year_id));
CREATE TABLE IF NOT EXISTS student_academic_history(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),
 academic_year_id text NOT NULL REFERENCES academic_years(id),class_id text NOT NULL REFERENCES classes(id),
 section_id text REFERENCES sections(id),outcome text NOT NULL,destination_academic_year_id text REFERENCES academic_years(id),
 destination_class_id text REFERENCES classes(id),destination_section_id text REFERENCES sections(id),
 snapshot jsonb NOT NULL DEFAULT '{}',promotion_job_id text,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,student_id,academic_year_id));
CREATE TABLE IF NOT EXISTS promotion_jobs(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),operation_key text NOT NULL,preview_hash text NOT NULL,
 source_academic_year_id text NOT NULL REFERENCES academic_years(id),destination_academic_year_id text NOT NULL REFERENCES academic_years(id),
 status text NOT NULL,summary jsonb NOT NULL DEFAULT '{}',created_by text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at timestamptz,
 UNIQUE(school_id,operation_key));
CREATE INDEX IF NOT EXISTS attendance_scope_idx ON attendance_records(school_id,attendance_date,period,student_id);
CREATE INDEX IF NOT EXISTS homework_scope_idx ON homework_records(school_id,academic_year_id,class_id,section_id,status,assigned_date);
CREATE INDEX IF NOT EXISTS exams_scope_idx ON exam_records(school_id,academic_year_id,class_id,section_id,state,exam_date);
CREATE INDEX IF NOT EXISTS report_cards_student_year_idx ON report_card_snapshots(school_id,student_id,academic_year_id);
CREATE INDEX IF NOT EXISTS academic_history_student_year_idx ON student_academic_history(school_id,student_id,academic_year_id);
`},
  { version: 8, name: 'workspace_metadata_foundation', sql: `
CREATE TABLE IF NOT EXISTS workspace_definitions(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),workspace_key text NOT NULL,name text NOT NULL,
 plural_name text NOT NULL,description text NOT NULL DEFAULT '',category text NOT NULL DEFAULT 'Administration',icon text,
 workspace_type text NOT NULL,status text NOT NULL DEFAULT 'Draft',system boolean NOT NULL DEFAULT false,
 factory_version integer NOT NULL DEFAULT 0,definition_version integer NOT NULL DEFAULT 1,
 created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1,
 UNIQUE(school_id,workspace_key),CHECK(workspace_type IN ('BuiltIn','Custom')),CHECK(status IN ('Draft','Active','Archived')));
CREATE TABLE IF NOT EXISTS workspace_sections(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),workspace_id text NOT NULL REFERENCES workspace_definitions(id),
 section_key text NOT NULL,name text NOT NULL,description text NOT NULL DEFAULT '',sort_order integer NOT NULL DEFAULT 0,
 enabled boolean NOT NULL DEFAULT true,screen_visible boolean NOT NULL DEFAULT true,print_visible boolean NOT NULL DEFAULT true,
 layout_columns integer NOT NULL DEFAULT 2,system boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version integer NOT NULL DEFAULT 1,UNIQUE(workspace_id,section_key),CHECK(layout_columns BETWEEN 1 AND 3));
CREATE TABLE IF NOT EXISTS workspace_fields(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),workspace_id text NOT NULL REFERENCES workspace_definitions(id),
 section_id text REFERENCES workspace_sections(id),field_key text NOT NULL,label text NOT NULL,description text NOT NULL DEFAULT '',
 field_type text NOT NULL,required boolean NOT NULL DEFAULT false,default_value jsonb,help_text text NOT NULL DEFAULT '',
 placeholder text NOT NULL DEFAULT '',width text NOT NULL DEFAULT 'full',sort_order integer NOT NULL DEFAULT 0,
 screen_visible boolean NOT NULL DEFAULT true,preview_visible boolean NOT NULL DEFAULT false,print_visible boolean NOT NULL DEFAULT true,
 searchable boolean NOT NULL DEFAULT false,filterable boolean NOT NULL DEFAULT false,archived boolean NOT NULL DEFAULT false,
 system boolean NOT NULL DEFAULT false,protected_properties jsonb NOT NULL DEFAULT '[]',configuration jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version integer NOT NULL DEFAULT 1,UNIQUE(workspace_id,field_key),CHECK(width IN ('full','half','third','twoThirds')));
CREATE TABLE IF NOT EXISTS workspace_field_options(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),field_id text NOT NULL REFERENCES workspace_fields(id),
 value text NOT NULL,label text NOT NULL,sort_order integer NOT NULL DEFAULT 0,active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,UNIQUE(field_id,value));
CREATE TABLE IF NOT EXISTS workspace_definition_versions(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),workspace_id text NOT NULL REFERENCES workspace_definitions(id),
 workspace_version integer NOT NULL,definition_snapshot jsonb NOT NULL,change_reason text NOT NULL,
 created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,workspace_version));
CREATE TABLE IF NOT EXISTS workspace_permission_catalog(
 workspace_id text NOT NULL REFERENCES workspace_definitions(id),permission text NOT NULL,description text NOT NULL,
 system boolean NOT NULL DEFAULT false,PRIMARY KEY(workspace_id,permission));
CREATE INDEX IF NOT EXISTS workspace_definitions_school_status_idx ON workspace_definitions(school_id,status,name);
CREATE INDEX IF NOT EXISTS workspace_sections_scope_idx ON workspace_sections(school_id,workspace_id,sort_order);
CREATE INDEX IF NOT EXISTS workspace_fields_scope_idx ON workspace_fields(school_id,workspace_id,section_id,sort_order,archived);
CREATE INDEX IF NOT EXISTS workspace_versions_scope_idx ON workspace_definition_versions(school_id,workspace_id,workspace_version DESC);
`}
, {version:9,name:'school_communications',sql:COMMUNICATION_SCHEMA}
, {version:10,name:'school_content',sql:SCHOOL_CONTENT_SCHEMA}
, {version:11,name:'resource_catalogs',sql:RESOURCE_CATALOG_SCHEMA}
, {version:12,name:'transport_operations',sql:TRANSPORT_SCHEMA}
, {version:13,name:'teacher_work_logs',sql:WORK_LOG_SCHEMA}
, {version:14,name:'operation_workflows_and_leave',sql:OPERATIONS_WORKFLOW_SCHEMA}
, {version:15,name:'fees_operations',sql:FEES_SCHEMA}
, {version:16,name:'certificate_issuance',sql:CERTIFICATES_SCHEMA}
, {version:17,name:'workspace_manager_phase2',sql:`
ALTER TABLE workspace_sections ADD COLUMN IF NOT EXISTS layout_configuration jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS workspace_section_role_visibility(
 school_id text NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES workspace_definitions(id) ON DELETE CASCADE,
 section_id text NOT NULL REFERENCES workspace_sections(id) ON DELETE CASCADE,
 role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
 screen_visible boolean NOT NULL DEFAULT true,
 edit_visible boolean NOT NULL DEFAULT true,
 print_visible boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(section_id,role_id));
CREATE INDEX IF NOT EXISTS workspace_section_role_scope_idx ON workspace_section_role_visibility(school_id,workspace_id,role_id);
`}
, {version:18,name:'picklist_manager',sql:PICKLISTS_SCHEMA}
, {version:19,name:'workspace_print_configuration',sql:`
ALTER TABLE workspace_definitions ADD COLUMN IF NOT EXISTS print_configuration jsonb NOT NULL DEFAULT '{}';
`}
, {version:20,name:'workspace_general_configuration',sql:`
ALTER TABLE workspace_definitions ADD COLUMN IF NOT EXISTS record_number_configuration jsonb NOT NULL DEFAULT '{}';
ALTER TABLE workspace_definitions ADD COLUMN IF NOT EXISTS navigation_configuration jsonb NOT NULL DEFAULT '{}';
ALTER TABLE workspace_definitions ADD COLUMN IF NOT EXISTS behavior_configuration jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS workspace_number_sequences(
 school_id text NOT NULL REFERENCES schools(id),workspace_key text NOT NULL,next_number bigint NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(school_id,workspace_key));
`}
, {version:21,name:'staff_profiles_and_workspace_images',sql:`
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}';
`}
, {version:22,name:'attendance_workflow_ui',sql:`
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS arrival_time time;
`}
, {version:23,name:'timetable_period_structure',sql:`
ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS notes text;
CREATE TABLE IF NOT EXISTS school_periods(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,period_type text NOT NULL,
 start_time time NOT NULL,end_time time NOT NULL,duration_minutes integer NOT NULL,sort_order integer NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,version integer NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS school_periods_order_idx ON school_periods(school_id,active,sort_order,name);
`}
, {version:24,name:'homework_files_acknowledgements',sql:`
ALTER TABLE homework_records ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id);
CREATE TABLE IF NOT EXISTS homework_files(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),homework_id text NOT NULL REFERENCES homework_records(id),
 name text NOT NULL,type text NOT NULL,size integer NOT NULL,content text NOT NULL,archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS homework_acknowledgements(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),homework_id text NOT NULL REFERENCES homework_records(id),
 student_id text NOT NULL REFERENCES students(id),status_code text NOT NULL,acknowledged_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at timestamptz,student_note text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version integer NOT NULL DEFAULT 1,UNIQUE(school_id,homework_id,student_id));
CREATE INDEX IF NOT EXISTS homework_files_scope_idx ON homework_files(school_id,homework_id,archived);
CREATE INDEX IF NOT EXISTS homework_ack_scope_idx ON homework_acknowledgements(school_id,homework_id,student_id);
`}
, {version:25,name:'work_log_timetable_context',sql:`
ALTER TABLE teacher_work_logs ADD COLUMN IF NOT EXISTS subject_id text REFERENCES subjects(id);
ALTER TABLE teacher_work_logs ADD COLUMN IF NOT EXISTS scheduled_teacher_id text REFERENCES staff(id);
ALTER TABLE teacher_work_logs ADD COLUMN IF NOT EXISTS timetable_entry_id text REFERENCES timetable_entries(id);
ALTER TABLE teacher_work_logs ADD COLUMN IF NOT EXISTS period_key text;
ALTER TABLE teacher_work_logs ADD COLUMN IF NOT EXISTS log_date date;
ALTER TABLE teacher_work_logs ADD COLUMN IF NOT EXISTS is_substitute boolean NOT NULL DEFAULT false;
ALTER TABLE teacher_work_logs ADD COLUMN IF NOT EXISTS substitution_reason text;
ALTER TABLE teacher_work_logs ADD COLUMN IF NOT EXISTS log_status text NOT NULL DEFAULT 'Saved';
CREATE INDEX IF NOT EXISTS work_log_schedule_idx ON teacher_work_logs(school_id,log_date,period_key,teacher_id,archived);
`}
, {version:26,name:'exam_workspace_evaluations',sql:`
CREATE TABLE IF NOT EXISTS exam_report_configuration(school_id text PRIMARY KEY REFERENCES schools(id),configuration jsonb NOT NULL,version integer NOT NULL DEFAULT 1,updated_by text REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS co_scholastic_evaluations(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),student_id text NOT NULL REFERENCES students(id),academic_year_id text NOT NULL REFERENCES academic_years(id),skill_id text NOT NULL,skill_name text NOT NULL,rating text NOT NULL,version integer NOT NULL DEFAULT 1,updated_by text REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(school_id,student_id,academic_year_id,skill_id));
ALTER TABLE exam_records ADD COLUMN IF NOT EXISTS archived_from_state text;
`}
, {version:27,name:'notice_and_class_optional_fields',sql:`
ALTER TABLE classes ADD COLUMN IF NOT EXISTS room text NOT NULL DEFAULT '';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_group text NOT NULL DEFAULT '';
ALTER TABLE school_communications ADD COLUMN IF NOT EXISTS expiry_date text;
ALTER TABLE school_communications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT '';
ALTER TABLE school_communications ADD COLUMN IF NOT EXISTS publication_state text NOT NULL DEFAULT 'Published' CHECK(publication_state IN ('Draft','Published'));
CREATE TABLE IF NOT EXISTS notice_files(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),notice_id text NOT NULL REFERENCES school_communications(id),
 name text NOT NULL,type text NOT NULL,size integer NOT NULL,content text NOT NULL,
 archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS notice_files_scope_idx ON notice_files(school_id,notice_id,archived);
INSERT INTO picklist_values(id,school_id,picklist_id,value,label,sort_order)
 SELECT d.id||'-Draft',d.school_id,d.id,'Draft','Draft',0 FROM picklist_definitions d
 LEFT JOIN picklist_values v ON v.picklist_id=d.id AND v.value='Draft'
 WHERE d.picklist_key='noticeStatus' AND v.id IS NULL;
`}
, {version:28,name:'leave_request_attachments',sql:`
CREATE TABLE IF NOT EXISTS leave_files(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),leave_id text NOT NULL REFERENCES school_leave_requests(id),
 name text NOT NULL,type text NOT NULL,size integer NOT NULL,content text NOT NULL,
 archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS leave_files_scope_idx ON leave_files(school_id,leave_id,archived);
`}
, {version:29,name:'calendar_workspace_files',sql:`
CREATE TABLE IF NOT EXISTS calendar_files(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),event_id text NOT NULL,
 name text NOT NULL,type text NOT NULL,size integer NOT NULL,content text NOT NULL,
 archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(school_id,event_id) REFERENCES school_calendar_events(school_id,id));
CREATE INDEX IF NOT EXISTS calendar_files_scope_idx ON calendar_files(school_id,event_id,archived);
`}
, {version:30,name:'document_workspace_files',sql:`
CREATE TABLE IF NOT EXISTS document_files(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),document_id text NOT NULL REFERENCES school_content_records(id),
 name text NOT NULL,type text NOT NULL,size integer NOT NULL,content text NOT NULL,
 archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS document_files_scope_idx ON document_files(school_id,document_id,archived);
`}
, {version:31,name:'picklist_colors_and_system_protection',sql:`
ALTER TABLE picklist_values ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'gray';
ALTER TABLE picklist_definitions ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
UPDATE picklist_values SET color='green' WHERE lower(value) IN ('present','active','approved','published','completed','saved');
UPDATE picklist_values SET color='red' WHERE lower(value) IN ('absent','rejected','cancelled','need_help','holiday');
UPDATE picklist_values SET color='amber' WHERE lower(value) IN ('late','pending','draft','in_progress');
UPDATE picklist_values SET color='purple' WHERE lower(value) IN ('exam','examination');
UPDATE picklist_values SET color='teal' WHERE lower(value) IN ('meeting','activity','sports');
UPDATE picklist_definitions SET is_system=true WHERE source_type='AdminDefined' AND picklist_key IN ('attendanceStatus','studentStatus','leaveStatus','homeworkStatus','homeworkAcknowledgementStatus','calendarStatus','documentStatus','noticeStatus','classStatus','workLogStatus');
`}
, {version:32,name:'exam_logistics',sql:`
CREATE TABLE IF NOT EXISTS exam_logistics_configuration(
 school_id text PRIMARY KEY REFERENCES schools(id),configuration jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,
 updated_by text REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS exam_logistics_rooms(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,code text NOT NULL,building text NOT NULL DEFAULT '',
 room_rows integer NOT NULL,room_columns integer NOT NULL,capacity integer NOT NULL,active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,code));
CREATE TABLE IF NOT EXISTS exam_logistics_sessions(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),exam_id text NOT NULL REFERENCES exam_records(id),room_id text NOT NULL REFERENCES exam_logistics_rooms(id),
 session_date date NOT NULL,starts_at text NOT NULL,ends_at text NOT NULL,state text NOT NULL DEFAULT 'Draft',version integer NOT NULL DEFAULT 1,
 created_by text REFERENCES users(id),updated_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,exam_id));
CREATE TABLE IF NOT EXISTS exam_logistics_seats(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),session_id text NOT NULL REFERENCES exam_logistics_sessions(id),student_id text NOT NULL REFERENCES students(id),
 seat_number text NOT NULL,row_label text NOT NULL,column_number integer NOT NULL,version integer NOT NULL DEFAULT 1,
 UNIQUE(school_id,session_id,student_id),UNIQUE(school_id,session_id,seat_number));
CREATE TABLE IF NOT EXISTS exam_logistics_invigilators(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),session_id text NOT NULL REFERENCES exam_logistics_sessions(id),staff_id text NOT NULL REFERENCES staff(id),
 role text NOT NULL DEFAULT 'Invigilator',version integer NOT NULL DEFAULT 1,UNIQUE(school_id,session_id,staff_id));
CREATE INDEX IF NOT EXISTS exam_logistics_session_time_idx ON exam_logistics_sessions(school_id,session_date,starts_at,ends_at,state);
CREATE INDEX IF NOT EXISTS exam_logistics_seat_student_idx ON exam_logistics_seats(school_id,student_id,session_id);
CREATE INDEX IF NOT EXISTS exam_logistics_invigilator_idx ON exam_logistics_invigilators(school_id,staff_id,session_id);
`}
, {version:33,name:'communication_delivery',sql:`
CREATE TABLE IF NOT EXISTS communication_delivery_configuration(
 school_id text PRIMARY KEY REFERENCES schools(id),configuration jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,
 updated_by text REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS communication_templates(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,subject text NOT NULL,body text NOT NULL,audience text NOT NULL,
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,created_by text REFERENCES users(id),updated_by text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(school_id,name));
CREATE TABLE IF NOT EXISTS communication_campaigns(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),template_id text REFERENCES communication_templates(id),notice_id text REFERENCES school_communications(id),
 title text NOT NULL,body text NOT NULL,audience text NOT NULL,channels jsonb NOT NULL DEFAULT '[]',scheduled_at timestamptz,dispatched_at timestamptz,
 status text NOT NULL DEFAULT 'Draft',requires_acknowledgement boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 created_by text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS communication_deliveries(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),campaign_id text NOT NULL REFERENCES communication_campaigns(id),user_id text NOT NULL REFERENCES users(id),
 channel text NOT NULL,status text NOT NULL,destination_snapshot text NOT NULL DEFAULT '',attempts integer NOT NULL DEFAULT 0,error_code text,provider_message_id text,
 delivered_at timestamptz,read_at timestamptz,acknowledged_at timestamptz,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(school_id,campaign_id,user_id,channel));
CREATE INDEX IF NOT EXISTS communication_campaign_due_idx ON communication_campaigns(school_id,status,scheduled_at);
CREATE INDEX IF NOT EXISTS communication_delivery_user_idx ON communication_deliveries(school_id,user_id,channel,status,created_at);
CREATE INDEX IF NOT EXISTS communication_delivery_campaign_idx ON communication_deliveries(school_id,campaign_id,status);
`}
, {version:34,name:'assets_and_digital_id_cards',sql:`
CREATE TABLE IF NOT EXISTS specialist_operations_configuration(
 school_id text PRIMARY KEY REFERENCES schools(id),configuration jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,
 updated_by text REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS asset_categories(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,code text NOT NULL,active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,code));
CREATE TABLE IF NOT EXISTS school_assets(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),asset_number text NOT NULL,name text NOT NULL,category_id text NOT NULL REFERENCES asset_categories(id),
 serial_number text,acquired_on date,purchase_cost_minor bigint NOT NULL DEFAULT 0,condition text NOT NULL DEFAULT 'Good',status text NOT NULL DEFAULT 'Available',
 location text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 created_by text REFERENCES users(id),updated_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,asset_number));
CREATE TABLE IF NOT EXISTS asset_assignments(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),asset_id text NOT NULL REFERENCES school_assets(id),holder_type text NOT NULL,
 student_id text REFERENCES students(id),staff_id text REFERENCES staff(id),assigned_on date NOT NULL,due_on date,returned_on date,
 condition_out text NOT NULL,condition_in text,notes text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,created_by text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS asset_maintenance_records(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),asset_id text NOT NULL REFERENCES school_assets(id),opened_on date NOT NULL,
 completed_on date,vendor text NOT NULL DEFAULT '',cost_minor bigint NOT NULL DEFAULT 0,description text NOT NULL,status text NOT NULL DEFAULT 'Open',
 version integer NOT NULL DEFAULT 1,created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS id_card_templates(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,holder_type text NOT NULL,design jsonb NOT NULL DEFAULT '{}',
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,created_by text REFERENCES users(id),updated_by text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(school_id,name,holder_type));
CREATE TABLE IF NOT EXISTS id_card_issues(
 id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),holder_type text NOT NULL,student_id text REFERENCES students(id),staff_id text REFERENCES staff(id),
 template_id text NOT NULL REFERENCES id_card_templates(id),card_number text NOT NULL,issued_on date NOT NULL,expires_on date,status text NOT NULL DEFAULT 'Active',
 replacement_for_id text REFERENCES id_card_issues(id),holder_snapshot jsonb NOT NULL DEFAULT '{}',verification_token_hash text NOT NULL,
 version integer NOT NULL DEFAULT 1,issued_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,card_number),UNIQUE(verification_token_hash));
CREATE TABLE IF NOT EXISTS id_card_number_counters(
 school_id text PRIMARY KEY REFERENCES schools(id),next_number bigint NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS school_assets_scope_idx ON school_assets(school_id,archived,status,category_id);
CREATE INDEX IF NOT EXISTS asset_assignments_scope_idx ON asset_assignments(school_id,asset_id,returned_on);
CREATE INDEX IF NOT EXISTS asset_maintenance_scope_idx ON asset_maintenance_records(school_id,asset_id,status);
CREATE INDEX IF NOT EXISTS id_card_holder_idx ON id_card_issues(school_id,holder_type,student_id,staff_id,status);
`}
, {version:35,name:'centralized_record_access_foundation',sql:`
CREATE TABLE IF NOT EXISTS access_control_settings(school_id text PRIMARY KEY REFERENCES schools(id),mode text NOT NULL DEFAULT 'Off',previous_mode text,version integer NOT NULL DEFAULT 1,updated_by text REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,CHECK(mode IN ('Off','Preview','Audit','Enforced','Rollback')));
CREATE TABLE IF NOT EXISTS access_groups(id text PRIMARY KEY,school_id text NOT NULL REFERENCES schools(id),name text NOT NULL,description text NOT NULL DEFAULT '',group_kind text NOT NULL DEFAULT 'Custom',managed_scope_type text,managed_scope_id text,system boolean NOT NULL DEFAULT false,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,CHECK(group_kind IN ('Custom','Teachers','Students','Parents','Staff','Finance','Class','Section','Migration','Administration')),CHECK(managed_scope_type IS NULL OR managed_scope_type IN ('Class','Section','Student','Parent','Teacher','Staff')));
CREATE UNIQUE INDEX IF NOT EXISTS access_groups_school_name_uq ON access_groups(school_id,lower(name));
CREATE INDEX IF NOT EXISTS access_groups_scope_idx ON access_groups(school_id,managed_scope_type,managed_scope_id,active);
CREATE TABLE IF NOT EXISTS access_group_memberships(school_id text NOT NULL REFERENCES schools(id),group_id text NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(group_id,user_id));
CREATE INDEX IF NOT EXISTS access_memberships_user_idx ON access_group_memberships(school_id,user_id,group_id);
CREATE TABLE IF NOT EXISTS access_group_workspace_roles(school_id text NOT NULL REFERENCES schools(id),group_id text NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,workspace_id text NOT NULL REFERENCES workspace_definitions(id) ON DELETE CASCADE,role_key text NOT NULL,created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(group_id,workspace_id,role_key),CHECK(role_key IN ('View Records','Add Records','Edit Records','Delete Records','View Attachments','Add Attachments','View Change Log','Run Imports','Setup Administration','View Own Records','View Assigned Records','View Group Records','View Class Records','View Section Records','View Audience Records','View All Workspace Records')));
CREATE INDEX IF NOT EXISTS access_workspace_roles_lookup_idx ON access_group_workspace_roles(school_id,workspace_id,role_key,group_id);
CREATE TABLE IF NOT EXISTS record_access_controls(school_id text NOT NULL REFERENCES schools(id),workspace_id text NOT NULL REFERENCES workspace_definitions(id) ON DELETE CASCADE,record_id text NOT NULL,owner_user_id text REFERENCES users(id),assigned_user_id text REFERENCES users(id),audience_type text NOT NULL,class_id text REFERENCES classes(id),section_id text REFERENCES sections(id),archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(school_id,workspace_id,record_id),CHECK(audience_type IN ('Private','Selected groups','Selected individuals','Class','Section','Entire workspace','Global')));
CREATE INDEX IF NOT EXISTS record_access_scope_idx ON record_access_controls(school_id,workspace_id,audience_type,class_id,section_id,archived);
CREATE TABLE IF NOT EXISTS record_audience_groups(school_id text NOT NULL REFERENCES schools(id),workspace_id text NOT NULL,record_id text NOT NULL,group_id text NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,PRIMARY KEY(school_id,workspace_id,record_id,group_id),FOREIGN KEY(school_id,workspace_id,record_id) REFERENCES record_access_controls(school_id,workspace_id,record_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS record_audience_users(school_id text NOT NULL REFERENCES schools(id),workspace_id text NOT NULL,record_id text NOT NULL,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(school_id,workspace_id,record_id,user_id),FOREIGN KEY(school_id,workspace_id,record_id) REFERENCES record_access_controls(school_id,workspace_id,record_id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS record_audience_users_lookup_idx ON record_audience_users(school_id,user_id,workspace_id,record_id);
`}, {version:36,name:'global_setup_administration',sql:`
CREATE TABLE IF NOT EXISTS access_group_global_roles(
 school_id text NOT NULL REFERENCES schools(id),group_id text NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
 role_key text NOT NULL,created_by text REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(group_id,role_key),CHECK(role_key IN ('Setup Administration')));
CREATE INDEX IF NOT EXISTS access_global_roles_lookup_idx ON access_group_global_roles(school_id,role_key,group_id);
INSERT INTO access_group_global_roles(school_id,group_id,role_key,created_by)
SELECT g.school_id,g.id,'Setup Administration',NULL
FROM access_groups g JOIN roles r ON g.id=('legacy-' || r.id) AND r.school_id=g.school_id
WHERE r.name='Super Admin'
ON CONFLICT(group_id,role_key) DO NOTHING;
`}, {version:37,name:'standardized_access_roles_and_group_roles',sql:`
ALTER TABLE access_groups ADD COLUMN IF NOT EXISTS default_workspace_id text REFERENCES workspace_definitions(id);
CREATE TABLE IF NOT EXISTS access_roles(
 id text PRIMARY KEY,
 school_id text NOT NULL REFERENCES schools(id),
 name text NOT NULL,
 description text NOT NULL DEFAULT '',
 workspace_id text NOT NULL REFERENCES workspace_definitions(id),
 status text NOT NULL DEFAULT 'Active',
 system boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1,
 created_by text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(status IN ('Active','Inactive','Archived')));
CREATE UNIQUE INDEX IF NOT EXISTS access_roles_school_name_uq ON access_roles(school_id,lower(name));
CREATE INDEX IF NOT EXISTS access_roles_workspace_idx ON access_roles(school_id,workspace_id,status);
CREATE TABLE IF NOT EXISTS access_role_permissions(
 school_id text NOT NULL REFERENCES schools(id),
 role_id text NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
 permission_key text NOT NULL,
 created_by text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(role_id,permission_key),
 CHECK(permission_key IN ('View Records','Add Records','Edit Records','Delete Records','Permanent Delete Records','View Attachments','Add Attachments','View Change Log','Run Imports','View Own Records','View Assigned Records','View Group Records','View Class Records','View Section Records','View Audience Records','View All Workspace Records')));
CREATE TABLE IF NOT EXISTS access_group_roles(
 school_id text NOT NULL REFERENCES schools(id),
 group_id text NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
 role_id text NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
 created_by text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(group_id,role_id));
CREATE INDEX IF NOT EXISTS access_group_roles_role_idx ON access_group_roles(school_id,role_id,group_id);
`}, {version:38,name:'user_profiles_and_print_records_permission',sql:`
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE access_role_permissions DROP CONSTRAINT IF EXISTS access_role_permissions_permission_key_check;
ALTER TABLE access_role_permissions ADD CONSTRAINT access_role_permissions_permission_key_check CHECK(permission_key IN ('View Records','Add Records','Edit Records','Delete Records','Permanent Delete Records','Print Records','View Attachments','Add Attachments','View Change Log','Run Imports','View Own Records','View Assigned Records','View Group Records','View Class Records','View Section Records','View Audience Records','View All Workspace Records'));
`}, {version:39,name:'system_administrator_only_workspace_bypass',sql:`
UPDATE roles r SET name='System Administrator',system=true,active=true
WHERE r.name='Super Admin'
AND NOT EXISTS(SELECT 1 FROM roles x WHERE x.school_id=r.school_id AND x.name='System Administrator');
UPDATE access_groups SET name='Migrated: System Administrator',description='Protected setup group for the System Administrator.'
WHERE name='Migrated: Super Admin'
AND NOT EXISTS(SELECT 1 FROM access_groups x WHERE x.school_id=access_groups.school_id AND x.name='Migrated: System Administrator');
`}, {version:40,name:'normalized_authorization_grants',sql:`
CREATE TABLE IF NOT EXISTS access_role_grants(
 school_id text NOT NULL REFERENCES schools(id),
 role_id text NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
 resource_type text NOT NULL,
 action_key text NOT NULL,
 scope_key text NOT NULL,
 constraints jsonb NOT NULL DEFAULT '{}',
 grant_source text NOT NULL DEFAULT 'Explicit',
 created_by text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(role_id,resource_type,action_key,scope_key),
 CHECK(scope_key IN ('OWNED','CREATED_BY','SELF','DIRECT_ASSIGNED','DIRECT_RECIPIENT','GROUP','CLASS','SECTION','AUDIENCE','CHILD_PERSONAL','CHILD_ASSIGNED','CHILD_RECIPIENT','ASSIGNED_TEACHING_CONTEXT','ASSIGNED_CLASS','ASSIGNED_SECTION','ASSIGNED_STUDENT','CASE_ASSIGNED','DEPARTMENT','CLUB','HOUSE','ROUTE','HOSTEL','SCHOOL_PUBLISHED','ALL_WORKSPACE')),
 CHECK(grant_source IN ('Explicit','Reviewed legacy migration','System template'))
);
CREATE INDEX IF NOT EXISTS access_role_grants_lookup_idx ON access_role_grants(school_id,role_id,resource_type,action_key,scope_key);
ALTER TABLE access_control_settings ADD COLUMN IF NOT EXISTS authorization_version bigint NOT NULL DEFAULT 1;
`}, {version:41,name:'universal_workspace_tabs_and_permissions',sql:`
ALTER TABLE workspace_definitions ADD COLUMN IF NOT EXISTS tab_configuration jsonb NOT NULL DEFAULT '{"MAIN":"Main Tab","GRID_1":"Grid Tab 1","GRID_2":"Grid Tab 2","GRID_3":"Grid Tab 3"}';
ALTER TABLE workspace_sections ADD COLUMN IF NOT EXISTS tab_key text NOT NULL DEFAULT 'MAIN';
ALTER TABLE workspace_sections DROP CONSTRAINT IF EXISTS workspace_sections_tab_key_check;
ALTER TABLE workspace_sections ADD CONSTRAINT workspace_sections_tab_key_check CHECK(tab_key IN ('MAIN','GRID_1','GRID_2','GRID_3'));
ALTER TABLE workspace_fields ADD COLUMN IF NOT EXISTS tab_key text NOT NULL DEFAULT 'MAIN';
ALTER TABLE workspace_fields DROP CONSTRAINT IF EXISTS workspace_fields_tab_key_check;
ALTER TABLE workspace_fields ADD CONSTRAINT workspace_fields_tab_key_check CHECK(tab_key IN ('MAIN','GRID_1','GRID_2','GRID_3'));
UPDATE workspace_definitions SET tab_configuration='{"MAIN":"Assessments","GRID_1":"Marks Entry","GRID_2":"Report Cards","GRID_3":"Co-scholastic"}'::jsonb WHERE workspace_key='exams-results';
UPDATE workspace_sections SET tab_key=CASE section_key WHEN 'result_details' THEN 'GRID_1' WHEN 'co_scholastic_details' THEN 'GRID_3' ELSE 'MAIN' END WHERE workspace_id IN (SELECT id FROM workspace_definitions WHERE workspace_key='exams-results');
UPDATE workspace_fields f SET tab_key=s.tab_key FROM workspace_sections s WHERE f.section_id=s.id AND f.workspace_id=s.workspace_id;
CREATE TABLE IF NOT EXISTS access_role_universal_permissions(
 school_id text NOT NULL REFERENCES schools(id),
 role_id text NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
 tab_key text NOT NULL,
 permission_key text NOT NULL,
 created_by text REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(role_id,tab_key,permission_key),
 CHECK(tab_key IN ('MAIN','GRID_1','GRID_2','GRID_3','SPECIAL'))
);
CREATE INDEX IF NOT EXISTS access_role_universal_permissions_lookup_idx ON access_role_universal_permissions(school_id,role_id,tab_key,permission_key);
ALTER TABLE access_control_settings ADD COLUMN IF NOT EXISTS universal_workspace_permissions_enabled boolean NOT NULL DEFAULT true;
`}, {version:42,name:'universal_workspace_grid_records',sql:`
CREATE TABLE IF NOT EXISTS workspace_grid_records(
 id text PRIMARY KEY,
 school_id text NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES workspace_definitions(id) ON DELETE CASCADE,
 tab_key text NOT NULL CHECK(tab_key IN ('GRID_1','GRID_2','GRID_3')),
 field_values jsonb NOT NULL DEFAULT '{}',
 owner_user_id text NOT NULL REFERENCES users(id),
 assigned_user_ids jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Archived')),
 created_by text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS workspace_grid_records_list_idx ON workspace_grid_records(school_id,workspace_id,tab_key,status,created_at);
CREATE INDEX IF NOT EXISTS workspace_grid_records_owner_idx ON workspace_grid_records(school_id,owner_user_id);
`}
 ,{version:43,name:'universal_workspace_layouts',sql:`
ALTER TABLE workspace_definitions ADD COLUMN IF NOT EXISTS layout_configuration jsonb NOT NULL DEFAULT '{}';
`}
 ,{version:44,name:'universal_workspace_tab_content',sql:`
UPDATE workspace_definitions AS workspace
SET layout_configuration=jsonb_set(
 '{"schemaVersion":1,"enabled":true,"dashboardSource":"fieldComponents","density":"comfortable","components":[]}'::jsonb || COALESCE(workspace.layout_configuration,'{}'::jsonb),
 '{tabContent}',
 '{"MAIN":{"mode":"fields"},"GRID_1":{"mode":"form","templateId":"form_admission","templateName":"Admission Form","templateVersion":1,"operationKey":"student_admission"},"GRID_2":{"mode":"fields"},"GRID_3":{"mode":"fields"}}'::jsonb,
 true
)
WHERE workspace.workspace_key='students'
 AND NOT (COALESCE(workspace.layout_configuration,'{}'::jsonb) ? 'tabContent')
 AND NOT EXISTS(SELECT 1 FROM workspace_sections section WHERE section.workspace_id=workspace.id AND section.tab_key='GRID_1')
 AND NOT EXISTS(SELECT 1 FROM workspace_fields field WHERE field.workspace_id=workspace.id AND field.tab_key='GRID_1');
`}
 ,{version:45,name:'students_admission_form_grid_2',sql:`
UPDATE workspace_definitions AS workspace
SET layout_configuration=jsonb_set(
 jsonb_set(workspace.layout_configuration,'{tabContent,GRID_1}','{"mode":"fields"}'::jsonb,true),
 '{tabContent,GRID_2}',
 '{"mode":"form","templateId":"form_admission","templateName":"Admission Form","templateVersion":1,"operationKey":"student_admission"}'::jsonb,
 true
)
WHERE workspace.workspace_key='students'
 AND workspace.layout_configuration #>> '{tabContent,GRID_1,templateId}'='form_admission'
 AND workspace.layout_configuration #>> '{tabContent,GRID_1,operationKey}'='student_admission'
 AND COALESCE(workspace.layout_configuration #>> '{tabContent,GRID_2,mode}','fields')='fields'
 AND NOT EXISTS(SELECT 1 FROM workspace_sections section WHERE section.workspace_id=workspace.id AND section.tab_key='GRID_2')
 AND NOT EXISTS(SELECT 1 FROM workspace_fields field WHERE field.workspace_id=workspace.id AND field.tab_key='GRID_2');
`}
 ,{version:46,name:'operational_workspace_dashboard_view',sql:`
ALTER TABLE access_role_universal_permissions DROP CONSTRAINT IF EXISTS access_role_universal_permissions_tab_key_check;
ALTER TABLE access_role_universal_permissions ADD CONSTRAINT access_role_universal_permissions_tab_key_check CHECK(tab_key IN ('DASHBOARD','MAIN','GRID_1','GRID_2','GRID_3','SPECIAL'));
INSERT INTO access_role_universal_permissions(school_id,role_id,tab_key,permission_key,created_by)
SELECT DISTINCT role.school_id,role.id,'DASHBOARD','VIEW',role.created_by
FROM access_roles role
JOIN workspace_definitions workspace ON workspace.id=role.workspace_id AND workspace.school_id=role.school_id
WHERE role.status='Active'
 AND (workspace.system=false OR workspace.workspace_key=ANY(ARRAY['students','staff','classes','attendance','timetable','homework','teacher-work-log','exams-results','fees-payments','leave-requests','notices','calendar-holidays','documents','certificates','uniform','curriculum','rules-regulations','transport','assets','idcards']::text[]))
 AND EXISTS(SELECT 1 FROM access_group_roles group_role JOIN access_groups access_group ON access_group.id=group_role.group_id AND access_group.school_id=group_role.school_id AND access_group.active=true WHERE group_role.school_id=role.school_id AND group_role.role_id=role.id)
 AND (
  EXISTS(SELECT 1 FROM access_role_universal_permissions permission WHERE permission.school_id=role.school_id AND permission.role_id=role.id AND permission.tab_key IN ('MAIN','GRID_1','GRID_2','GRID_3') AND permission.permission_key='VIEW')
  OR (
   EXISTS(
    SELECT 1 FROM access_group_roles setup_group_role
    JOIN access_group_memberships setup_membership ON setup_membership.group_id=setup_group_role.group_id AND setup_membership.school_id=setup_group_role.school_id
    JOIN users setup_user ON setup_user.id=setup_membership.user_id AND setup_user.school_id=setup_membership.school_id AND setup_user.status='Active'
    JOIN roles setup_account_role ON setup_account_role.id=setup_user.role_id AND setup_account_role.school_id=setup_user.school_id AND setup_account_role.system=false
    WHERE setup_group_role.school_id=role.school_id AND setup_group_role.role_id=role.id
     AND EXISTS(SELECT 1 FROM access_group_memberships authority_membership JOIN access_groups authority_group ON authority_group.id=authority_membership.group_id AND authority_group.school_id=authority_membership.school_id AND authority_group.active=true JOIN access_group_global_roles authority ON authority.group_id=authority_group.id AND authority.school_id=authority_group.school_id AND authority.role_key='Setup Administration' WHERE authority_membership.school_id=setup_user.school_id AND authority_membership.user_id=setup_user.id)
   )
   AND NOT EXISTS(
    SELECT 1 FROM access_group_roles affected_group_role
    JOIN access_groups affected_group ON affected_group.id=affected_group_role.group_id AND affected_group.school_id=affected_group_role.school_id AND affected_group.active=true
    JOIN access_group_memberships affected_membership ON affected_membership.group_id=affected_group.id AND affected_membership.school_id=affected_group.school_id
    JOIN users affected_user ON affected_user.id=affected_membership.user_id AND affected_user.school_id=affected_membership.school_id AND affected_user.status='Active'
    JOIN roles affected_account_role ON affected_account_role.id=affected_user.role_id AND affected_account_role.school_id=affected_user.school_id
    WHERE affected_group_role.school_id=role.school_id AND affected_group_role.role_id=role.id AND affected_account_role.system=false
     AND NOT EXISTS(SELECT 1 FROM access_group_memberships authority_membership JOIN access_groups authority_group ON authority_group.id=authority_membership.group_id AND authority_group.school_id=authority_membership.school_id AND authority_group.active=true JOIN access_group_global_roles authority ON authority.group_id=authority_group.id AND authority.school_id=authority_group.school_id AND authority.role_key='Setup Administration' WHERE authority_membership.school_id=affected_user.school_id AND authority_membership.user_id=affected_user.id)
   )
  )
 )
ON CONFLICT(role_id,tab_key,permission_key) DO NOTHING;
`}
 ,{version:47,name:'fee_assignment_archive_lifecycle',sql:`
ALTER TABLE school_fee_assignments ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
`}
 ,{version:48,name:'universal_workspace_main_records',sql:`
ALTER TABLE workspace_grid_records DROP CONSTRAINT IF EXISTS workspace_grid_records_tab_key_check;
ALTER TABLE workspace_grid_records ADD CONSTRAINT workspace_grid_records_tab_key_check CHECK(tab_key IN ('MAIN','GRID_1','GRID_2','GRID_3'));
`}
 ,{version:49,name:'operational_grid_dummy_verification_fields',sql:`
WITH operational AS (
 SELECT id,school_id
 FROM workspace_definitions
 WHERE system=false OR workspace_key=ANY(ARRAY['students','staff','classes','attendance','timetable','homework','teacher-work-log','exams-results','fees-payments','leave-requests','notices','calendar-holidays','documents','certificates','uniform','curriculum','rules-regulations','transport','assets','idcards']::text[])
), grid_tabs(tab_key,section_key,section_name) AS (
 VALUES
  ('GRID_1','dummy_grid_1_section','Grid 1 Verification'),
  ('GRID_2','dummy_grid_2_section','Grid 2 Verification'),
  ('GRID_3','dummy_grid_3_section','Grid 3 Verification')
)
INSERT INTO workspace_sections(id,school_id,workspace_id,tab_key,section_key,name,description,sort_order,enabled,screen_visible,print_visible,layout_columns,layout_configuration,system)
SELECT 'dummy-section-'||md5(o.school_id||':'||o.id||':'||g.tab_key),o.school_id,o.id,g.tab_key,g.section_key,g.section_name,'Temporary Workspace Manager grid verification fields.',9900,true,true,false,1,'{}'::jsonb,false
FROM operational o CROSS JOIN grid_tabs g
WHERE NOT EXISTS(SELECT 1 FROM workspace_fields f WHERE f.workspace_id=o.id AND f.field_key=replace(lower(g.tab_key),'grid_','dummy_grid_'))
 AND NOT EXISTS(SELECT 1 FROM workspace_sections s WHERE s.workspace_id=o.id AND s.section_key=g.section_key);

WITH operational AS (
 SELECT id,school_id
 FROM workspace_definitions
 WHERE system=false OR workspace_key=ANY(ARRAY['students','staff','classes','attendance','timetable','homework','teacher-work-log','exams-results','fees-payments','leave-requests','notices','calendar-holidays','documents','certificates','uniform','curriculum','rules-regulations','transport','assets','idcards']::text[])
), grid_tabs(tab_key,section_key,field_key) AS (
 VALUES
  ('GRID_1','dummy_grid_1_section','dummy_grid_1'),
  ('GRID_2','dummy_grid_2_section','dummy_grid_2'),
  ('GRID_3','dummy_grid_3_section','dummy_grid_3')
), inserted AS (
 INSERT INTO workspace_fields(id,school_id,workspace_id,section_id,tab_key,field_key,label,description,field_type,required,width,sort_order,screen_visible,preview_visible,print_visible,searchable,filterable,system,configuration)
 SELECT 'dummy-field-'||md5(o.school_id||':'||o.id||':'||g.tab_key),o.school_id,o.id,s.id,g.tab_key,g.field_key,'Dummy Field','Temporary field for Workspace Manager grid mapping verification.','text',false,'full',9900,true,false,false,false,false,false,'{}'::jsonb
 FROM operational o CROSS JOIN grid_tabs g
 JOIN workspace_sections s ON s.workspace_id=o.id AND s.school_id=o.school_id AND s.section_key=g.section_key AND s.tab_key=g.tab_key
 WHERE NOT EXISTS(SELECT 1 FROM workspace_fields f WHERE f.workspace_id=o.id AND f.field_key=g.field_key)
 RETURNING workspace_id
)
UPDATE workspace_definitions w
SET version=version+1,definition_version=definition_version+1,updated_at=CURRENT_TIMESTAMP
WHERE w.id IN (SELECT DISTINCT workspace_id FROM inserted);
`}
 ,{version:50,name:'operational_grid_dummy_fields_all_statuses',sql:`
WITH operational AS (
 SELECT id,school_id
 FROM workspace_definitions
 WHERE system=false OR workspace_key=ANY(ARRAY['students','staff','classes','attendance','timetable','homework','teacher-work-log','exams-results','fees-payments','leave-requests','notices','calendar-holidays','documents','certificates','uniform','curriculum','rules-regulations','transport','assets','idcards']::text[])
), grid_tabs(tab_key,section_key,section_name,field_key) AS (
 VALUES
  ('GRID_1','dummy_grid_1_section','Grid 1 Verification','dummy_grid_1'),
  ('GRID_2','dummy_grid_2_section','Grid 2 Verification','dummy_grid_2'),
  ('GRID_3','dummy_grid_3_section','Grid 3 Verification','dummy_grid_3')
)
INSERT INTO workspace_sections(id,school_id,workspace_id,tab_key,section_key,name,description,sort_order,enabled,screen_visible,print_visible,layout_columns,layout_configuration,system)
SELECT 'dummy-section-'||md5(o.school_id||':'||o.id||':'||g.tab_key),o.school_id,o.id,g.tab_key,g.section_key,g.section_name,'Temporary Workspace Manager grid verification fields.',9900,true,true,false,1,'{}'::jsonb,false
FROM operational o CROSS JOIN grid_tabs g
WHERE NOT EXISTS(SELECT 1 FROM workspace_fields f WHERE f.workspace_id=o.id AND f.field_key=g.field_key)
 AND NOT EXISTS(SELECT 1 FROM workspace_sections s WHERE s.workspace_id=o.id AND s.section_key=g.section_key);

WITH operational AS (
 SELECT id,school_id
 FROM workspace_definitions
 WHERE system=false OR workspace_key=ANY(ARRAY['students','staff','classes','attendance','timetable','homework','teacher-work-log','exams-results','fees-payments','leave-requests','notices','calendar-holidays','documents','certificates','uniform','curriculum','rules-regulations','transport','assets','idcards']::text[])
), grid_tabs(tab_key,section_key,field_key) AS (
 VALUES
  ('GRID_1','dummy_grid_1_section','dummy_grid_1'),
  ('GRID_2','dummy_grid_2_section','dummy_grid_2'),
  ('GRID_3','dummy_grid_3_section','dummy_grid_3')
), inserted AS (
 INSERT INTO workspace_fields(id,school_id,workspace_id,section_id,tab_key,field_key,label,description,field_type,required,width,sort_order,screen_visible,preview_visible,print_visible,searchable,filterable,system,configuration)
 SELECT 'dummy-field-'||md5(o.school_id||':'||o.id||':'||g.tab_key),o.school_id,o.id,s.id,g.tab_key,g.field_key,'Dummy Field','Temporary field for Workspace Manager grid mapping verification.','text',false,'full',9900,true,false,false,false,false,false,'{}'::jsonb
 FROM operational o CROSS JOIN grid_tabs g
 JOIN workspace_sections s ON s.workspace_id=o.id AND s.school_id=o.school_id AND s.section_key=g.section_key AND s.tab_key=g.tab_key
 WHERE NOT EXISTS(SELECT 1 FROM workspace_fields f WHERE f.workspace_id=o.id AND f.field_key=g.field_key)
 RETURNING workspace_id
)
UPDATE workspace_definitions w
SET version=version+1,definition_version=definition_version+1,updated_at=CURRENT_TIMESTAMP
WHERE w.id IN (SELECT DISTINCT workspace_id FROM inserted);
`}


] as const;

export async function applyMigrations(db: Database) {
  await db.query('CREATE TABLE IF NOT EXISTS migration_history(version integer PRIMARY KEY,name text NOT NULL,applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const applied: number[] = [];
  for (const m of migrations) {
    const found = await db.query<{version:number}>('SELECT version FROM migration_history WHERE version=$1',[m.version]);
    if (found.rows.length) continue;
    await db.transaction(async (tx: Queryable) => { await tx.query(m.sql); await tx.query('INSERT INTO migration_history(version,name) VALUES($1,$2)',[m.version,m.name]); });
    applied.push(m.version);
  }
  return { schemaVersion:DATABASE_SCHEMA_VERSION, applied };
}


