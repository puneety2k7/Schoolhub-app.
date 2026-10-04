import {describe,expect,it} from 'vitest';
import {authorizeCreate,authorizeRecord,authorizeWorkspaceAction} from '../../src/authorization/policy-engine.js';
import {authorizationPermissionCatalog,workspaceAuthorizationCatalog} from '../../src/authorization/permission-catalog.js';
import {registerTestWorkspaceManifest,scopesForAction,validateGrantDefinition,workspaceManifest} from '../../src/authorization/policy-registry.js';
import {assertAuthorizationQaSeedEnvironment} from '../../src/scripts/seed-authorization-qa.js';
import {BUILT_IN_WORKSPACES} from '../../src/services/workspace-service.js';
import {defaultWorkspaceLayout,projectLayout} from '../../src/services/workspace-layout.js';
import type {Principal} from '../../src/authorization/service.js';

type Grant={groupId:string;roleId:string;workspaceKey:string;resourceType:string;action:string;scope:string;constraints?:Record<string,unknown>;active?:boolean};
type State={
 memberships:Array<{userId:string;groupId:string;active?:boolean}>;
 groups?:Array<{id:string;active?:boolean}>;
 roles?:Array<{id:string;active?:boolean}>;
 grants:Grant[];
 universal?:Array<{groupId:string;roleId:string;tabKey:string;permissionKey:string}>;
 assignments:Array<{teacherId:string;academicYearId:string;classId:string;sectionId:string|null;subjectId:string|null;active?:boolean}>;
 students:Array<{studentId:string;classId:string;sectionId:string|null}>;
 children:Array<{guardianId:string;studentId:string;classId:string;sectionId:string|null;active?:boolean}>;
};
function database(state:State){
 return{query:async(sql:string,values:unknown[]=[])=>{
  if(sql.includes('FROM workspace_definitions'))return{rows:[{id:'workspace-'+values[1]}]};
  if(sql.includes('JOIN access_role_grants')){
   const [,userId,,resourceType]=values;
   const groups=new Set(state.memberships.filter(x=>x.userId===userId&&x.active!==false&&(state.groups?.find(g=>g.id===x.groupId)?.active!==false)).map(x=>x.groupId));
   return{rows:state.grants.filter(x=>groups.has(x.groupId)&&x.resourceType===resourceType&&x.active!==false&&(state.roles?.find(role=>role.id===x.roleId)?.active!==false)).map(x=>({groupId:x.groupId,groupName:x.groupId,roleId:x.roleId,roleName:x.roleId,resourceType:x.resourceType,action:x.action,scope:x.scope,constraints:x.constraints||{}}))};
  }
  if(sql.includes('JOIN access_role_universal_permissions')){
   const [,userId]=values,groups=new Set(state.memberships.filter(x=>x.userId===userId&&x.active!==false&&(state.groups?.find(g=>g.id===x.groupId)?.active!==false)).map(x=>x.groupId));
   return{rows:(state.universal||[]).filter(x=>groups.has(x.groupId)&&(state.roles?.find(role=>role.id===x.roleId)?.active!==false)).map(x=>({...x,groupName:x.groupId,roleName:x.roleId}))};
  }
  if(sql.includes('SELECT gm.group_id AS id'))return{rows:state.memberships.filter(x=>x.userId===values[1]&&x.active!==false&&(state.groups?.find(g=>g.id===x.groupId)?.active!==false)).map(x=>({id:x.groupId}))};
  if(sql.includes('FROM teacher_assignments'))return{rows:state.assignments.filter(x=>x.teacherId===values[1]&&x.active!==false).map(x=>({academicYearId:x.academicYearId,classId:x.classId,sectionId:x.sectionId,subjectId:x.subjectId}))};
  if(sql.includes('FROM students WHERE'))return{rows:state.students.filter(x=>x.studentId===values[1]).map(x=>({classId:x.classId,sectionId:x.sectionId}))};
  if(sql.includes('FROM guardian_student_links'))return{rows:state.children.filter(x=>x.guardianId===values[1]&&x.active!==false).map(x=>({id:x.studentId,classId:x.classId,sectionId:x.sectionId}))};
  return{rows:[]};
 }} as any;
}
const actor=(id:string,links:Partial<Principal>={}):Principal=>({userId:id,schoolId:'qa-school-a',roleId:'identity',roleName:'QA identity',teacherId:null,studentId:null,guardianId:null,permissions:[],username:id,...links});
const homework=(id:string,sectionId:string,studentId:string,ownerUserId='qa-user-teacher')=>({schoolId:'qa-school-a',workspaceKey:'homework',resourceType:'homework',recordId:id,ownerUserId,createdByUserId:ownerUserId,recipientStudentIds:[studentId],audienceType:'SECTION',academicYearId:'qa-year-current',classId:'qa-class-viii',sectionId,subjectId:'qa-subject-science',lifecycle:'Published',published:true} as const);
const baseState=():State=>({
 memberships:[
  {userId:'qa-user-teacher',groupId:'qa-group-teachers'},
  {userId:'qa-user-student-a',groupId:'qa-group-students'},
  {userId:'qa-user-student-b',groupId:'qa-group-students'},
  {userId:'qa-user-parent-a',groupId:'qa-group-parents'}
 ],
 groups:[{id:'qa-group-teachers'},{id:'qa-group-students'},{id:'qa-group-parents'}],
 roles:[{id:'qa-role-homework-teacher'},{id:'qa-role-homework-student'},{id:'qa-role-homework-parent'}],
 universal:[],
 grants:[
  {groupId:'qa-group-teachers',roleId:'qa-role-homework-teacher',workspaceKey:'homework',resourceType:'homework',action:'record.view',scope:'ASSIGNED_TEACHING_CONTEXT'},
  {groupId:'qa-group-teachers',roleId:'qa-role-homework-teacher',workspaceKey:'homework',resourceType:'homework',action:'record.create',scope:'ASSIGNED_TEACHING_CONTEXT'},
  {groupId:'qa-group-students',roleId:'qa-role-homework-student',workspaceKey:'homework',resourceType:'homework',action:'record.view',scope:'DIRECT_RECIPIENT'},
  {groupId:'qa-group-parents',roleId:'qa-role-homework-parent',workspaceKey:'homework',resourceType:'homework',action:'record.view',scope:'CHILD_RECIPIENT'}
 ],
 assignments:[{teacherId:'qa-teacher-science',academicYearId:'qa-year-current',classId:'qa-class-viii',sectionId:'qa-section-viii-a',subjectId:'qa-subject-science'}],
 students:[
  {studentId:'qa-student-a',classId:'qa-class-viii',sectionId:'qa-section-viii-a'},
  {studentId:'qa-student-b',classId:'qa-class-viii',sectionId:'qa-section-viii-b'}
 ],
 children:[{guardianId:'qa-parent-a',studentId:'qa-student-a',classId:'qa-class-viii',sectionId:'qa-section-viii-a'}]
});

describe('authorization QA environment',()=>{
 it('blocks production and requires explicit seed confirmation plus a password',()=>{
  expect(()=>assertAuthorizationQaSeedEnvironment({NODE_ENV:'production',DATABASE_URL:'postgresql://example'})).toThrow(/blocked in production/);
  expect(()=>assertAuthorizationQaSeedEnvironment({NODE_ENV:'test',DATABASE_URL:'postgresql://example'})).toThrow(/AUTHORIZATION_QA_SEED/);
  expect(()=>assertAuthorizationQaSeedEnvironment({NODE_ENV:'test',DATABASE_URL:'postgresql://example',AUTHORIZATION_QA_SEED:'ALLOW'})).toThrow(/QA_TEST_PASSWORD/);
  expect(()=>assertAuthorizationQaSeedEnvironment({NODE_ENV:'',DATABASE_URL:'postgresql://example',AUTHORIZATION_QA_SEED:'ALLOW',QA_TEST_PASSWORD:'ValidPass!234'})).toThrow(/NODE_ENV/);
  expect(()=>assertAuthorizationQaSeedEnvironment({NODE_ENV:'staging',DATABASE_URL:'postgresql://example',AUTHORIZATION_QA_SEED:'ALLOW',QA_TEST_PASSWORD:'ValidPass!234'})).toThrow(/AUTHORIZATION_QA_STAGING/);
 });
 it('publishes only manifest-supported action and scope combinations',()=>{
  const catalog=workspaceAuthorizationCatalog(),homeworkPolicy=workspaceManifest('homework').find(x=>x.resourceType==='homework')!;
  expect(catalog.subjects[0].resourceType).toBe('subject');
  expect(catalog.users[0].resourceType).toBe('user');
  expect(BUILT_IN_WORKSPACES.map(workspace=>workspace.key).filter(key=>!catalog[key])).toEqual([]);
  expect(catalog.homework.some(x=>x.resourceType==='homework-submission')).toBe(false);
  expect(scopesForAction(homeworkPolicy,'record.create')).toEqual(['ASSIGNED_TEACHING_CONTEXT','ALL_WORKSPACE']);
  expect(scopesForAction(homeworkPolicy,'record.acknowledge')).toEqual(['DIRECT_RECIPIENT','CHILD_RECIPIENT']);
  expect(validateGrantDefinition('homework','homework','record.create','SECTION')).toBe(false);
  expect(validateGrantDefinition('homework','homework','record.create','ASSIGNED_TEACHING_CONTEXT')).toBe(true);
  for(const [workspaceKey,resources] of Object.entries(catalog))for(const resource of resources)for(const item of resource.actions){expect(item.scopes.length,workspaceKey+'/'+resource.resourceType+'/'+item.action).toBeGreaterThan(0);for(const scope of item.scopes)expect(validateGrantDefinition(workspaceKey,resource.resourceType,item.action,scope)).toBe(true)}
 });
 it('exposes a canonical catalog and keeps special controls subordinate to view scopes',()=>{
  const catalog=authorizationPermissionCatalog(),view=catalog.find(x=>x.key==='record.view')!,confidential=view.specialRequirements.join(' ');
  expect(view.label).toBe('View Records');expect(view.supportedResources.length).toBeGreaterThan(5);expect(confidential).toContain('Lifecycle');
  expect(catalog.some(x=>x.key==='submission.create')).toBe(false);
 });
 it('allows assigned teacher and denies unassigned section creation',async()=>{
  const state=baseState(),db=database(state),teacher=actor('qa-user-teacher',{teacherId:'qa-teacher-science'});
  await expect(authorizeCreate(db,teacher,homework('qa-homework-a','qa-section-viii-a','qa-student-a'))).resolves.toBeTruthy();
  await expect(authorizeCreate(db,teacher,homework('qa-homework-b','qa-section-viii-b','qa-student-b'))).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
 });
 it('keeps student and parent disclosure bound to the actual recipient relationship',async()=>{
  const state=baseState(),db=database(state),a=homework('qa-homework-a','qa-section-viii-a','qa-student-a'),b=homework('qa-homework-b','qa-section-viii-b','qa-student-b');
  await expect(authorizeRecord(db,actor('qa-user-student-a',{studentId:'qa-student-a'}),'record.view',a)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,actor('qa-user-student-a',{studentId:'qa-student-a'}),'record.view',b)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,actor('qa-user-parent-a',{guardianId:'qa-parent-a'}),'record.view',a)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,actor('qa-user-parent-a',{guardianId:'qa-parent-a'}),'record.view',b)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,actor('qa-user-student-b',{studentId:'qa-student-b'}),'record.view',a)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
 });
 it('responds immediately to grant, role, group, membership, and assignment changes',async()=>{
  const state=baseState(),db=database(state),teacher=actor('qa-user-teacher',{teacherId:'qa-teacher-science'}),context=homework('new','qa-section-viii-a','qa-student-a');
  await expect(authorizeCreate(db,teacher,context)).resolves.toBeTruthy();
  state.roles!.find(x=>x.id==='qa-role-homework-teacher')!.active=false;
  await expect(authorizeCreate(db,teacher,context)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.roles!.find(x=>x.id==='qa-role-homework-teacher')!.active=true;
  state.groups!.find(x=>x.id==='qa-group-teachers')!.active=false;
  await expect(authorizeCreate(db,teacher,context)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.groups!.find(x=>x.id==='qa-group-teachers')!.active=true;
  state.grants=state.grants.filter(x=>x.action!=='record.create');
  await expect(authorizeCreate(db,teacher,context)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.memberships.push({userId:'qa-user-teacher',groupId:'qa-group-second'});
  state.groups!.push({id:'qa-group-second'});state.roles!.push({id:'qa-role-second'});
  state.grants.push({groupId:'qa-group-second',roleId:'qa-role-second',workspaceKey:'homework',resourceType:'homework',action:'record.create',scope:'ASSIGNED_TEACHING_CONTEXT'});
  await expect(authorizeCreate(db,teacher,context)).resolves.toBeTruthy();
  state.memberships.find(x=>x.groupId==='qa-group-teachers')!.active=false;
  await expect(authorizeCreate(db,teacher,context)).resolves.toBeTruthy();
  state.memberships=state.memberships.filter(x=>x.groupId!=='qa-group-second');
  await expect(authorizeCreate(db,teacher,context)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.memberships.push({userId:'qa-user-teacher',groupId:'qa-group-second'});
  state.assignments[0].active=false;
  await expect(authorizeCreate(db,teacher,context)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
 });
 it('keeps action scopes independent and isolates tenants',async()=>{
  const state=baseState(),user=actor('qa-user-teacher',{teacherId:'qa-teacher-science'});state.grants=[
   {groupId:'qa-group-teachers',roleId:'split',workspaceKey:'homework',resourceType:'homework',action:'record.view',scope:'ALL_WORKSPACE'},
   {groupId:'qa-group-teachers',roleId:'split',workspaceKey:'homework',resourceType:'homework',action:'record.update',scope:'OWNED'}
  ];const db=database(state),own=homework('own','qa-section-viii-a','qa-student-a','qa-user-teacher'),other=homework('other','qa-section-viii-b','qa-student-b','someone-else');
  await expect(authorizeRecord(db,user,'record.view',other)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,user,'record.update',own)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,user,'record.update',other)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,user,'record.view',{...other,schoolId:'qa-school-b'})).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
 });
 it('revokes relationship scopes after guardian-link or enrollment changes',async()=>{
  const state=baseState(),db=database(state),parent=actor('qa-user-parent-a',{guardianId:'qa-parent-a'}),student=actor('qa-user-student-a',{studentId:'qa-student-a'});
  state.grants.push({groupId:'qa-group-parents',roleId:'qa-fees-parent',workspaceKey:'fees-payments',resourceType:'fee-payment',action:'record.view',scope:'CHILD_PERSONAL'});
  state.grants.push({groupId:'qa-group-students',roleId:'qa-attendance-student',workspaceKey:'attendance',resourceType:'attendance-entry',action:'record.view',scope:'SECTION'});
  const invoice={schoolId:'qa-school-a',workspaceKey:'fees-payments',resourceType:'fee-payment',recordId:'invoice-a',subjectStudentIds:['qa-student-a'],lifecycle:'Active'} as const;
  const attendance={schoolId:'qa-school-a',workspaceKey:'attendance',resourceType:'attendance-entry',recordId:'attendance-a',subjectStudentIds:['qa-student-a'],audienceType:'SECTION',classId:'qa-class-viii',sectionId:'qa-section-viii-a',lifecycle:'Published'} as const;
  await expect(authorizeRecord(db,parent,'record.view',invoice)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,student,'record.view',attendance)).resolves.toBeTruthy();
  state.children[0].active=false;state.students[0].sectionId='qa-section-viii-b';
  await expect(authorizeRecord(db,parent,'record.view',invoice)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,student,'record.view',attendance)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
 });
 it('keeps shared records separate from personal and confidential records',async()=>{
  const state=baseState(),db=database(state),studentA=actor('qa-user-student-a',{studentId:'qa-student-a'}),parentA=actor('qa-user-parent-a',{guardianId:'qa-parent-a'}),teacher=actor('qa-user-teacher',{teacherId:'qa-teacher-science'});
  state.grants.push(
   {groupId:'qa-group-students',roleId:'qa-results-student',workspaceKey:'exams-results',resourceType:'mark',action:'record.view',scope:'SELF'},
   {groupId:'qa-group-parents',roleId:'qa-attendance-parent',workspaceKey:'attendance',resourceType:'attendance-entry',action:'record.view',scope:'CHILD_PERSONAL'},
   {groupId:'qa-group-parents',roleId:'qa-fees-parent',workspaceKey:'fees-payments',resourceType:'fee-payment',action:'record.view',scope:'CHILD_PERSONAL'}
  );
  const studentBMark={schoolId:'qa-school-a',workspaceKey:'exams-results',resourceType:'mark',recordId:'mark-b',subjectStudentIds:['qa-student-b'],lifecycle:'Published'} as const;
  const studentBAttendance={schoolId:'qa-school-a',workspaceKey:'attendance',resourceType:'attendance-entry',recordId:'attendance-b',subjectStudentIds:['qa-student-b'],lifecycle:'Published'} as const;
  const studentBFee={schoolId:'qa-school-a',workspaceKey:'fees-payments',resourceType:'fee-payment',recordId:'fee-b',subjectStudentIds:['qa-student-b'],lifecycle:'Published'} as const;
  const confidentialA={schoolId:'qa-school-a',workspaceKey:'fees-payments',resourceType:'fee-payment',recordId:'fee-a-private',subjectStudentIds:['qa-student-a'],lifecycle:'Published',sensitivity:'Confidential'} as const;
  await expect(authorizeRecord(db,studentA,'record.view',studentBMark)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,parentA,'record.view',studentBAttendance)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,parentA,'record.view',studentBFee)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,teacher,'record.view',studentBFee)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,parentA,'record.view',confidentialA)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.grants.find(x=>x.roleId==='qa-fees-parent')!.constraints={viewConfidential:true};
  await expect(authorizeRecord(db,parentA,'record.view',confidentialA)).resolves.toBeTruthy();
 });
 it('does not borrow record visibility for attachments, downloads, print, or export',async()=>{
  const state=baseState(),db=database(state),teacher=actor('qa-user-teacher',{teacherId:'qa-teacher-science'}),record=homework('qa-homework-a','qa-section-viii-a','qa-student-a');
  state.grants=state.grants.filter(x=>x.groupId!=='qa-group-teachers');
  state.grants.push({groupId:'qa-group-teachers',roleId:'qa-role-independent',workspaceKey:'homework',resourceType:'homework',action:'record.view',scope:'ALL_WORKSPACE'});
  await expect(authorizeRecord(db,teacher,'record.view',record)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,teacher,'attachment.view',record)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,teacher,'attachment.download',record)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,teacher,'record.print',record)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeRecord(db,teacher,'record.export',record)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.grants.push({groupId:'qa-group-teachers',roleId:'qa-role-independent',workspaceKey:'homework',resourceType:'homework',action:'attachment.view',scope:'ALL_WORKSPACE'});
  await expect(authorizeRecord(db,teacher,'attachment.view',record)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,teacher,'attachment.download',record)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
 }); it('does not grant Subject workspace access without a Subject role grant',async()=>{
  const state=baseState(),db=database(state),teacher=actor('qa-user-teacher',{teacherId:'qa-teacher-science'}),subject={schoolId:'qa-school-a',workspaceKey:'subjects',resourceType:'subject',recordId:'qa-subject-science',lifecycle:'Active'} as const;
  await expect(authorizeRecord(db,teacher,'record.view',subject)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeCreate(db,teacher,subject)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.grants.push(
   {groupId:'qa-group-teachers',roleId:'qa-subject-manager',workspaceKey:'subjects',resourceType:'subject',action:'record.view',scope:'ALL_WORKSPACE'},
   {groupId:'qa-group-teachers',roleId:'qa-subject-manager',workspaceKey:'subjects',resourceType:'subject',action:'record.create',scope:'ALL_WORKSPACE'},
   {groupId:'qa-group-teachers',roleId:'qa-subject-manager',workspaceKey:'subjects',resourceType:'subject',action:'record.update',scope:'ALL_WORKSPACE'}
  );
  await expect(authorizeRecord(db,teacher,'record.view',subject)).resolves.toBeTruthy();
  await expect(authorizeCreate(db,teacher,subject)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,teacher,'record.update',subject)).resolves.toBeTruthy();
 });
 it('uses only Academic Year workspace grants for list and lifecycle actions',async()=>{
  const state=baseState(),db=database(state),teacher=actor('qa-user-teacher'),year={schoolId:'qa-school-a',workspaceKey:'academic-years',resourceType:'academic-year',recordId:'qa-year-current',lifecycle:'Active'} as const;
  await expect(authorizeWorkspaceAction(db,teacher,'academic-years','academic-year','record.view')).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeCreate(db,teacher,year)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.grants.push(...['record.view','record.create','record.update','record.archive'].map(action=>({groupId:'qa-group-teachers',roleId:'qa-academic-year-manager',workspaceKey:'academic-years',resourceType:'academic-year',action,scope:'ALL_WORKSPACE'})));
  await expect(authorizeWorkspaceAction(db,teacher,'academic-years','academic-year','record.view')).resolves.toBeTruthy();
  await expect(authorizeCreate(db,teacher,year)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,teacher,'record.update',year)).resolves.toBeTruthy();
  await expect(authorizeRecord(db,teacher,'record.archive',year)).resolves.toBeTruthy();
 });
 it('gives role and group names zero security meaning',async()=>{
  const state=baseState(),db=database(state),context=homework('name-test','qa-section-viii-a','qa-student-a');
  state.grants=[];
  for(const roleName of ['Teacher','Parent','Admin','QA Arbitrary Role 1'])await expect(authorizeCreate(db,actor('qa-user-teacher',{roleName,teacherId:'qa-teacher-science'}),context)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.groups=[{id:'Teachers'},{id:'Random Group 42'}];state.memberships=[{userId:'qa-user-teacher',groupId:'Random Group 42'}];state.roles=[{id:'QA Whatever Name'}];
  state.grants=[{groupId:'Random Group 42',roleId:'QA Whatever Name',workspaceKey:'homework',resourceType:'homework',action:'record.create',scope:'ASSIGNED_TEACHING_CONTEXT'}];
  await expect(authorizeCreate(db,actor('qa-user-teacher',{roleName:'QA Arbitrary Role 1',teacherId:'qa-teacher-science'}),context)).resolves.toBeTruthy();
  await expect(authorizeCreate(db,actor('qa-user-teacher',{roleName:'Completely Different Name',teacherId:'qa-teacher-science'}),context)).resolves.toBeTruthy();
  state.memberships=[{userId:'qa-user-teacher',groupId:'Teachers'}];
  await expect(authorizeCreate(db,actor('qa-user-teacher',{roleName:'Teacher',teacherId:'qa-teacher-science'}),context)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  await expect(authorizeCreate(db,actor('qa-user-admin',{roleName:'System Administrator'}),context)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
 });
 it('discovers a future workspace without auto-granting access and rejects missing manifests',async()=>{
  const unregister=registerTestWorkspaceManifest('test-future-workspace',[{resourceType:'future-record',actions:['record.view','record.create','record.update','record.archive','record.print','attachment.view','attachment.download','attachment.upload','attachment.delete'],scopes:['OWNED','ALL_WORKSPACE'],actionScopes:{'record.view':['OWNED','ALL_WORKSPACE'],'record.create':['OWNED'],'record.update':['OWNED'],'record.archive':['OWNED'],'record.print':['OWNED'],'attachment.view':['OWNED'],'attachment.download':['OWNED'],'attachment.upload':['OWNED'],'attachment.delete':['OWNED']}}]);
  try{
   expect(workspaceAuthorizationCatalog()['test-future-workspace']).toEqual([expect.objectContaining({resourceType:'future-record',features:['records','printing','attachments'],workflowPermissions:[]})]);
   expect(validateGrantDefinition('test-future-workspace','future-record','record.create','OWNED')).toBe(true);
   expect(validateGrantDefinition('test-future-workspace','future-record','record.create','ALL_WORKSPACE')).toBe(false);
   expect(validateGrantDefinition('missing-workspace','future-record','record.view','OWNED')).toBe(false);
   const state=baseState(),db=database(state),user=actor('qa-user-teacher'),record={schoolId:'qa-school-a',workspaceKey:'test-future-workspace',resourceType:'future-record',recordId:'future-1',ownerUserId:'qa-user-teacher',lifecycle:'Active'} as const;
   await expect(authorizeCreate(db,user,record)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
   state.grants.push({groupId:'qa-group-teachers',roleId:'arbitrary-existing-role',workspaceKey:'test-future-workspace',resourceType:'future-record',action:'record.create',scope:'OWNED'});
   await expect(authorizeCreate(db,user,record)).resolves.toBeTruthy();
   state.grants=[];
   await expect(authorizeCreate(db,user,record)).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  }finally{unregister()}
 }); it('keeps the System Administrator recovery authority across every registered workspace, including Subjects',async()=>{
  const db=database(baseState()),admin=actor('qa-user-admin',{roleName:'Any recovery label',systemRecovery:true});
  for(const [workspaceKey,resources] of Object.entries(workspaceAuthorizationCatalog()))for(const resource of resources)for(const item of resource.actions){
   await expect(authorizeWorkspaceAction(db,admin,workspaceKey,resource.resourceType,item.action)).resolves.toMatchObject({reason:'SYSTEM_RECOVERY_AUTHORITY'});
  }
 });
 it('keeps one standard action unavailable and denies its backend call until a Group workspace role receives the tab permission',async()=>{
  const state=baseState();state.grants=state.grants.filter(grant=>grant.action!=='record.create');const db=database(state),teacher=actor('qa-user-teacher'),layout=defaultWorkspaceLayout(),none={visibleTabKeys:[],addableTabKeys:[],editableTabKeys:[],deletableTabKeys:[],printableTabKeys:[],specialPermissionKeys:[]};
  expect(projectLayout(layout,[],['MAIN'],'User',none,'None').actions.some(action=>action.actionKey==='add')).toBe(false);
  await expect(authorizeWorkspaceAction(db,teacher,'homework','homework','record.create','MAIN')).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  state.universal!.push(
   {groupId:'qa-group-teachers',roleId:'qa-role-homework-teacher',tabKey:'MAIN',permissionKey:'VIEW'},
   {groupId:'qa-group-teachers',roleId:'qa-role-homework-teacher',tabKey:'MAIN',permissionKey:'ADD'}
  );
  const granted={...none,visibleTabKeys:['MAIN'],addableTabKeys:['MAIN']};
  expect(projectLayout(layout,[],['MAIN'],'User',granted,'None').actions.some(action=>action.actionKey==='add')).toBe(true);
  await expect(authorizeWorkspaceAction(db,teacher,'homework','homework','record.create','MAIN')).resolves.toBeTruthy();
 });

});
