import {createPostgresDatabase} from '../database/postgres.js';
import {loadConfig} from '../config/index.js';
import {validateWorkspaceConformance} from '../services/workspace-conformance.js';
const config=loadConfig(),db=createPostgresDatabase(config.databaseUrl);
try{
 const workspaces=(await db.query<any>("SELECT id,school_id AS \"schoolId\",workspace_key AS \"workspaceKey\",system,tab_configuration AS \"tabConfiguration\",layout_configuration AS \"layoutConfiguration\" FROM workspace_definitions WHERE status<>'Archived' ORDER BY school_id,workspace_key")).rows;
 const sections=(await db.query<any>('SELECT id,workspace_id AS "workspaceId",section_key AS "sectionKey",tab_key AS "tabKey" FROM workspace_sections')).rows;
 const fields=(await db.query<any>(`SELECT f.workspace_id AS "workspaceId",f.section_id AS "sectionId",f.field_key AS "fieldKey",f.field_type AS "fieldType",f.tab_key AS "tabKey",f.configuration,EXISTS(SELECT 1 FROM workspace_field_options option WHERE option.field_id=f.id AND option.active=true) AS "hasOptions" FROM workspace_fields f WHERE f.archived=false`)).rows;
 const result=validateWorkspaceConformance(workspaces.map(workspace=>({...workspace,sections:sections.filter(section=>section.workspaceId===workspace.id),fields:fields.filter(field=>field.workspaceId===workspace.id)})));
 console.log(JSON.stringify(result,null,2));if(result.issues.some(issue=>issue.severity==='FAIL'))process.exitCode=1;
}finally{await db.close()}
