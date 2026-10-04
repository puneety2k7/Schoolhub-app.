import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {authorizationPermissionCatalog,workspaceAuthorizationCatalog} from '../authorization/permission-catalog.js';
import {BUILT_IN_WORKSPACES} from '../services/workspace-service.js';

const root=resolve(import.meta.dirname,'../..');
const workspaces=workspaceAuthorizationCatalog();
const cell=(value:unknown)=>String(value??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
const list=(values:readonly unknown[])=>values.length?values.map(cell).join(', '):'-';

function relationship(scopes:readonly string[]){
 const labels:Record<string,string>={
  OWNED:'record owner',CREATED_BY:'record creator',SELF:'same user/student identity',DIRECT_ASSIGNED:'direct assignee',
  DIRECT_RECIPIENT:'direct recipient',GROUP:'active group membership',CLASS:'current class relationship',
  SECTION:'current section relationship',AUDIENCE:'matching configured audience',CHILD_PERSONAL:'active guardian link to subject student',
  CHILD_ASSIGNED:'active guardian link plus assignment',CHILD_RECIPIENT:'active guardian link to recipient student',
  ASSIGNED_TEACHING_CONTEXT:'active academic year/class/section/subject teacher assignment',ASSIGNED_CLASS:'active class assignment',
  ASSIGNED_SECTION:'active section assignment',ASSIGNED_STUDENT:'active teaching assignment to subject student',
  SCHOOL_PUBLISHED:'published school-wide audience',ALL_WORKSPACE:'no record relationship; explicit workspace-wide authority'
 };
 return list(scopes.map(scope=>labels[scope]||scope));
}
function evidence(workspaceKey:string){
 if(workspaceKey==='homework')return{reference:'tests/unit/authorization-qa.test.ts; tests/unit/authorization-coverage.test.ts; npm run verify:authorization-qa',status:'VERIFIED — engine tests plus authenticated Homework real-route positive, negative, and direct-ID scenarios pass'};
 if(['staff','classes','sections','subjects','academic-years'].includes(workspaceKey))return{reference:'src/repositories/core-relationship-repository.ts; src/routes/api.ts; npm run verify:authorization-qa',status:'PARTIAL — central SQL-filtered list routes pass authenticated allow/deny relationship checks; focused mutation-route verification remains'};
 if(workspaceKey==='attendance')return{reference:'src/services/academic-service.ts; src/routes/academic.ts; npm run verify:authorization-qa',status:'VERIFIED — SQL-filtered lists plus authenticated create/update and print allow/deny scenarios pass for administrator, assigned teacher, students, and guardian'};
 if(workspaceKey==='timetable')return{reference:'src/services/academic-service.ts; src/routes/academic.ts; npm run verify:authorization-qa',status:'VERIFIED — SQL-filtered timetable lists, section isolation, period references, create/update/archive, cross-section denial, and print allow/deny scenarios pass'};
 if(workspaceKey==='exams-results')return{reference:'src/services/academic-service.ts; src/routes/academic.ts; npm run verify:authorization-qa',status:'PARTIAL — SQL-filtered exam lists, report-card personal disclosure, create/update/archive, marks entry, and cross-section denial pass; publish/reopen and output route verification remains'};
 if(workspaceKey==='students')return{reference:'src/repositories/student-repository.ts; src/routes/api.ts; npm run verify:authorization-qa',status:'VERIFIED — SQL-filtered lists and authenticated relationship/direct-ID scenarios pass'};
 return{reference:'tests/unit/authorization-coverage.test.ts',status:'PENDING — manifest and permission registration only; record-scope route integration required'};
}
function expected(workspaceKey:string,positive:boolean){
 if(workspaceKey==='homework')return positive?'Assigned VIII-A Science teacher, Student A, or Parent A receives only the explicitly granted operation on Homework A.':'Teacher is denied VIII-B; Student B and Parent A are denied records without the required recipient/child relationship.';
 if(workspaceKey==='subjects')return positive?'An active group with a Subjects workspace role and matching normalized grant is allowed.':'A user without a Subjects workspace role/grant is denied.';
 if(workspaceKey==='academic-years')return positive?'An active group with an Academic Years role performs only the explicitly granted lifecycle action.':'A user cannot list or mutate years without the matching action grant.';
 return positive?'An active user with Group → Workspace Role → matching action/scope → required relationship is allowed.':'Missing action, scope, active role/group, relationship, lifecycle, or disclosure permission is denied.';
}

const permissionCatalog=authorizationPermissionCatalog();
const permissionRows=permissionCatalog.map(item=>{
 const supported=item.supportedResources.map(resource=>resource.workspaceKey+'/'+resource.resourceType).join(', ');
 return`| ${cell(item.key)} | ${cell(item.label)} | ${cell(item.description)} | ${list(item.scopes)} | ${cell(supported)} | ${list(item.specialRequirements)} |`;
});
const permissionDoc=`# SchoolHub canonical authorization catalog

Generated from \`src/authorization/policy-registry.ts\`. Do not maintain a second permission list.

- Registered action keys: **${permissionCatalog.length}**
- Authority chain: **User → Group → Workspace Role → Resource + Action + Scope → Relationship → Allow/Deny**
- Workspace manifests expose only supported action/scope combinations; administrators assign those combinations through Groups and Workspace Roles.

| Action key | Label | Description | Allowed scopes | Supported workspace/resources | Additional requirements |
|---|---|---|---|---|---|
${permissionRows.join('\n')}
`;

const matrixRows:string[]=[];
for(const [workspaceKey,resources] of Object.entries(workspaces))for(const resource of resources)for(const item of [...resource.actions,...resource.workflowPermissions]){
 const proof=evidence(workspaceKey),restrictions=[
  'same-school tenant boundary',
  item.action!=='record.create'?'record visibility required for mutation':'valid create context required',
  item.action==='record.view'?'draft/archive/delete/confidential/internal-note constraints apply':'action-specific grant required'
 ];
 matrixRows.push(`| ${cell(workspaceKey)} | ${cell(resource.resourceType)} | ${cell(item.action)} | ${list(item.scopes)} | ${cell(relationship(item.scopes))} | ${cell(restrictions.join('; '))} | ${cell(expected(workspaceKey,true))} | ${cell(expected(workspaceKey,false))} | ${cell(proof.reference)} | ${cell(proof.status)} |`);
}
const missingBuiltIns=BUILT_IN_WORKSPACES.map(workspace=>workspace.key).filter(key=>!workspaces[key]);
if(missingBuiltIns.length)throw new Error('Built-in workspaces missing from authorization catalog: '+missingBuiltIns.join(', '));
const matrixDoc=`# SchoolHub authorization workspace matrix

This matrix is generated from the central server manifest. Manifest registration defines available permissions; it never grants them. A workspace missing a manifest fails closed in enforced authorization.

## Core administration model

1. Administrators customize server-backed workspace structure within protected system-field and route-contract boundaries.
2. Administrators assign permissions only through Group → Workspace Role → normalized action/scope grants.
3. Runtime access additionally requires the matching record relationship, lifecycle and disclosure policy.
4. Adding a workspace exposes no permission and grants no access until its server manifest and positive/negative route tests are registered.

| Workspace | Resource | Action | Supported scopes | Required relationship | Relevant restrictions | Positive QA scenario | Negative QA scenario | Test reference | Status |
|---|---|---|---|---|---|---|---|---|---|
${matrixRows.join('\n')}

## Persistent QA fixture

- Seed: \`npm run seed:authorization-qa\`
- Reconcile: \`npm run seed:authorization-qa -- --reconcile\`
- Verify real routes: \`npm run verify:authorization-qa\`
- Development/test variables: \`NODE_ENV\`, \`AUTHORIZATION_QA_SEED=ALLOW\`, isolated schema-40 \`DATABASE_URL\`, and \`QA_TEST_PASSWORD\`.
- Staging additionally requires: \`AUTHORIZATION_QA_STAGING=ALLOW\`.
- Users: \`qa.admin\`, \`qa.teacher\`, \`qa.student.a\`, \`qa.student.b\`, \`qa.parent.a\`.
- Relationships: teacher is assigned only VIII-A Science; Parent A is linked only to Student A; QA School B provides tenant-isolation data.
- The seed is idempotent and reconciles deterministic \`qa-*\` records without deleting unrelated school records.
- Passwords and database URLs are never written to application logs or source control.

## Verification gate

No workspace is labelled fully verified until both allow and deny cases execute through its real authenticated server handlers against a non-production schema-40 database. Current schema-39 databases must apply the existing migration 40 before seeding.
`;

await Promise.all([
 writeFile(resolve(root,'AUTHORIZATION_PERMISSION_CATALOG.md'),permissionDoc,'utf8'),
 writeFile(resolve(root,'AUTHORIZATION_WORKSPACE_MATRIX.md'),matrixDoc,'utf8')
]);