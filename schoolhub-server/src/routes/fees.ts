import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Queryable} from '../database/types.js';
import type {AppConfig} from '../config/index.js';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {authenticate} from '../auth/security.js';

import {authorizeArchivedLifecycle,authorizeCreate,authorizeRecord,authorizeWorkspaceAction,resolveEffectiveGrants,type RecordSecurityContext} from '../authorization/policy-engine.js';
import {ApiError} from '../errors/api-error.js';
import {writeAudit} from '../audit/service.js';
import {feeMinor,feePaymentSchema,feeStructureSchema} from '../services/fee-values.js';
import {startWorkflow,advanceOperation} from '../services/operations-workflows.js';
import {formatWorkspaceNumber,workspaceNumberFormat} from '../services/workspace-numbering.js';
function parse<T>(schema:z.ZodType<T>,body:unknown):T{const r=schema.safeParse(body);if(!r.success)throw new ApiError('VALIDATION_FAILED','Check the fee fields and component totals.',422,{fields:r.error.issues.map(i=>i.path.join('.'))});return r.data;}
const version=z.object({version:z.number().int().positive()}).strict();
const conflict=()=>new ApiError('RECORD_VERSION_CONFLICT','The fee record changed. Refresh before saving.',409);
async function lockFees(tx:Queryable,school:string){await tx.query('INSERT INTO school_fee_counters(school_id) VALUES($1) ON CONFLICT(school_id) DO NOTHING',[school]);return (await tx.query<any>('SELECT next_number FROM school_fee_counters WHERE school_id=$1 FOR UPDATE',[school])).rows[0];}
function feeContext(p:any,resourceType:string,row:any):RecordSecurityContext{return{schoolId:p.schoolId,workspaceKey:'fees-payments',resourceType,recordId:row?.id,subjectStudentIds:row?.student_id?[String(row.student_id)]:row?.studentId?[String(row.studentId)]:[],lifecycle:row?.voided===true||row?.archived===true||row?.archived_at!=null?'Archived':String(row?.data?.status||row?.status||'Active')}}
async function scopedStudentPredicate(db:Queryable,p:any,resourceType:string,column:string){
 const grants=(await resolveEffectiveGrants(db,p,'fees-payments',resourceType)).filter(grant=>grant.action==='record.view'),values:any[]=[p.schoolId],clauses:string[]=[];
 for(const grant of grants){if(grant.scope==='ALL_WORKSPACE')clauses.push('TRUE');else if(grant.scope==='SELF'&&p.studentId){values.push(p.studentId);clauses.push(column+'=$'+values.length)}else if(grant.scope==='CHILD_PERSONAL'&&p.guardianId){values.push(p.guardianId);clauses.push('EXISTS(SELECT 1 FROM guardian_student_links gsl WHERE gsl.school_id=$1 AND gsl.guardian_id=$'+values.length+' AND gsl.student_id='+column+' AND gsl.active=true)')}}
 return{sql:clauses.length?'('+clauses.join(' OR ')+')':'FALSE',values,viewArchived:mayViewArchivedFeeAssignments(p,grants)};
}

const feeAssignmentId=(studentId:string,structureId:string)=>studentId+':'+structureId;
async function feeAssignmentAudit(tx:Queryable,p:any,correlationId:string,action:string,studentId:string,structureId:string){
 await writeAudit(tx,{schoolId:p.schoolId,actorUserId:p.userId,action,entityType:'Fee Assignment',entityId:feeAssignmentId(studentId,structureId),outcome:'SUCCESS',correlationId,summary:{studentId,structureId}});
}
export function mayViewArchivedFeeAssignments(p:any,grants:readonly {constraints:Readonly<Record<string,any>>}[]){return p.systemRecovery===true||grants.some(grant=>grant.constraints.viewArchived===true)}
export async function assignOrRestoreFeeAssignment(tx:Queryable,p:any,studentId:string,structureId:string,correlationId:string){
 const existing=(await tx.query<any>('SELECT student_id,archived_at FROM school_fee_assignments WHERE school_id=$1 AND student_id=$2 AND structure_id=$3 FOR UPDATE',[p.schoolId,studentId,structureId])).rows[0];
 if(existing&&!existing.archived_at)throw new ApiError('DUPLICATE_FEE_ASSIGNMENT','This fee structure is already assigned to the student.',409);
 if(existing){await restoreFeeAssignment(tx,p,studentId,structureId,correlationId);return{restored:true}}
 await authorizeCreate(tx,p,feeContext(p,'fee-assignment',{student_id:studentId}));
 await tx.query('INSERT INTO school_fee_assignments(school_id,student_id,structure_id) VALUES($1,$2,$3)',[p.schoolId,studentId,structureId]);
 await feeAssignmentAudit(tx,p,correlationId,'FEE_STRUCTURE_ASSIGNED',studentId,structureId);return{restored:false};
}
export async function archiveFeeAssignment(tx:Queryable,p:any,studentId:string,structureId:string,correlationId:string){
 const row=(await tx.query<any>('SELECT student_id,structure_id,archived_at FROM school_fee_assignments WHERE school_id=$1 AND student_id=$2 AND structure_id=$3 AND archived_at IS NULL FOR UPDATE',[p.schoolId,studentId,structureId])).rows[0];
 if(!row)throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND','This active fee assignment no longer exists.',404);
 await authorizeRecord(tx,p,'record.archive',feeContext(p,'fee-assignment',{...row,id:feeAssignmentId(studentId,structureId)}));
 const archived=(await tx.query<any>('UPDATE school_fee_assignments SET archived_at=CURRENT_TIMESTAMP WHERE school_id=$1 AND student_id=$2 AND structure_id=$3 AND archived_at IS NULL RETURNING student_id,structure_id,archived_at',[p.schoolId,studentId,structureId])).rows[0];
 if(!archived)throw new ApiError('INVALID_LIFECYCLE_TRANSITION','The fee assignment is already archived.',409);
 await feeAssignmentAudit(tx,p,correlationId,'FEE_ASSIGNMENT_ARCHIVED',studentId,structureId);return archived;
}
export async function restoreFeeAssignment(tx:Queryable,p:any,studentId:string,structureId:string,correlationId:string){
 const row=(await tx.query<any>('SELECT student_id,structure_id,archived_at FROM school_fee_assignments WHERE school_id=$1 AND student_id=$2 AND structure_id=$3 AND archived_at IS NOT NULL FOR UPDATE',[p.schoolId,studentId,structureId])).rows[0];
 if(!row)throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND','This archived fee assignment no longer exists.',404);
 await authorizeArchivedLifecycle(tx,p,'record.restore',feeContext(p,'fee-assignment',{...row,id:feeAssignmentId(studentId,structureId)}));
 const restored=(await tx.query<any>('UPDATE school_fee_assignments SET archived_at=NULL WHERE school_id=$1 AND student_id=$2 AND structure_id=$3 AND archived_at IS NOT NULL RETURNING student_id,structure_id,archived_at',[p.schoolId,studentId,structureId])).rows[0];
 if(!restored)throw new ApiError('INVALID_LIFECYCLE_TRANSITION','The fee assignment is already active.',409);
 await feeAssignmentAudit(tx,p,correlationId,'FEE_ASSIGNMENT_RESTORED',studentId,structureId);return restored;
}
export async function permanentlyDeleteFeeAssignment(tx:Queryable,p:any,studentId:string,structureId:string,correlationId:string){
 const row=(await tx.query<any>('SELECT student_id,structure_id,archived_at FROM school_fee_assignments WHERE school_id=$1 AND student_id=$2 AND structure_id=$3 AND archived_at IS NOT NULL FOR UPDATE',[p.schoolId,studentId,structureId])).rows[0];
 if(!row)throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND','An archived fee assignment is required for permanent deletion.',404);
 await authorizeArchivedLifecycle(tx,p,'record.permanent_delete',feeContext(p,'fee-assignment',{...row,id:feeAssignmentId(studentId,structureId)}));
 const dependent=(await tx.query('SELECT 1 FROM school_fee_payments WHERE school_id=$1 AND student_id=$2 AND data->>\'feeStructureId\'=$3 LIMIT 1',[p.schoolId,studentId,structureId])).rows[0];
 if(dependent)throw new ApiError('DEPENDENT_RECORDS_EXIST','The fee assignment is referenced by preserved payment history.',409);
 const deleted=await tx.query('DELETE FROM school_fee_assignments WHERE school_id=$1 AND student_id=$2 AND structure_id=$3 AND archived_at IS NOT NULL RETURNING student_id',[p.schoolId,studentId,structureId]);
 if(!deleted.rows.length)throw new ApiError('INVALID_LIFECYCLE_TRANSITION','The fee assignment is not eligible for permanent deletion.',409);
 await feeAssignmentAudit(tx,p,correlationId,'FEE_ASSIGNMENT_PERMANENTLY_DELETED',studentId,structureId);
}

export async function registerFeeRoutes(app:FastifyInstance,db:Database,config:AppConfig){
 const auth=(write=false)=>async(req:FastifyRequest)=>authenticate(req,db,config,write);
 const audit=(tx:Queryable,req:FastifyRequest,action:string,id:string)=>writeAudit(tx,{schoolId:req.principal!.schoolId,actorUserId:req.principal!.userId,action,entityType:'Fees',entityId:id,outcome:'SUCCESS',correlationId:req.correlationId});
 app.post('/api/v1/fees/payments/:id/corrections',{preHandler:auth(true)},async(req,reply)=>{
  const p=req.principal!;const paymentId=String((req.params as any).id),input=parse(z.object({payment:feePaymentSchema,version:z.number().int().positive(),reason:z.string().trim().min(1).max(10000)}).strict(),req.body);
  const result=await db.transaction(async tx=>{
   await lockFees(tx,p.schoolId);const payment=(await tx.query<any>('SELECT id,student_id,data,version FROM school_fee_payments WHERE school_id=$1 AND id=$2 AND voided=false FOR UPDATE',[p.schoolId,paymentId])).rows[0];if(!payment||payment.version!==input.version)throw conflict();await authorizeRecord(tx,p,'record.view',feeContext(p,'fee-payment',payment));await authorizeCreate(tx,p,feeContext(p,'fee-correction',{student_id:payment.student_id,status:'Pending'}));
   if(input.payment.student!==payment.data.student||!input.payment.receipt)throw new ApiError('VALIDATION_FAILED','Corrections must retain the student and specify a receipt number.',422);
   const id=randomUUID(),data={id,feeRecordId:paymentId,originalSnapshot:payment.data,requestedChanges:input.payment,reason:input.reason,status:'Pending',createdBy:p.username,createdDate:new Date().toISOString().slice(0,10),decisionNote:''};
   await tx.query('INSERT INTO school_fee_corrections(id,school_id,payment_id,data,payment_version) VALUES($1,$2,$3,$4,$5)',[id,p.schoolId,paymentId,JSON.stringify(data),payment.version]);
   const instance=await startWorkflow(tx,p,'fees',id,'Fee correction — '+payment.data.receipt,{feeAmount:input.payment.amount});await audit(tx,req,'FEE_CORRECTION_REQUESTED',id);return {request:{...data,version:1},instance};
  });return reply.code(201).send({data:result});
 });
 app.post('/api/v1/fees/corrections/:id/decision',{preHandler:auth(true)},async req=>{
  const p=req.principal!;const id=String((req.params as any).id),input=parse(z.object({version:z.number().int().positive(),decision:z.enum(['Approved','Rejected']),note:z.string().max(10000)}).strict(),req.body);
  return {data:await db.transaction(async tx=>{
   await lockFees(tx,p.schoolId);const row=(await tx.query<any>('SELECT c.data,c.version,c.payment_id,c.payment_version,p.student_id FROM school_fee_corrections c JOIN school_fee_payments p ON p.id=c.payment_id AND p.school_id=c.school_id WHERE c.school_id=$1 AND c.id=$2 FOR UPDATE OF c',[p.schoolId,id])).rows[0];if(!row||row.version!==input.version||row.data.status!=='Pending')throw conflict();const correctionContext=feeContext(p,'fee-correction',{id,student_id:row.student_id,status:row.data.status});if(input.decision==='Approved')await authorizeRecord(tx,p,'workflow.approve',correctionContext);else await authorizeRecord(tx,p,'workflow.reject',correctionContext);
   const result=await advanceOperation(tx,p,'fees',id,input.decision,input.note);
   if(result.rejected){row.data.status='Rejected';row.data.decisionNote=input.note;}
   else if(result.final){
    const payment=(await tx.query<any>('SELECT data,version,voided FROM school_fee_payments WHERE school_id=$1 AND id=$2 FOR UPDATE',[p.schoolId,row.payment_id])).rows[0];
    if(!payment||payment.voided||payment.version!==row.payment_version){row.data.status='Stale';row.data.decisionNote='The original payment changed; submit a new correction.';}
    else{
     const next=row.data.requestedChanges,key=next.receipt.toLowerCase(),reserved=(await tx.query<any>('SELECT payment_id FROM school_fee_receipt_reservations WHERE school_id=$1 AND receipt_key=$2',[p.schoolId,key])).rows[0];
     const current=(await tx.query<any>('SELECT id FROM school_fee_payments WHERE school_id=$1 AND receipt_key=$2 UNION SELECT payment_id AS id FROM school_fee_receipt_reservations WHERE school_id=$1 AND receipt_key=$2',[p.schoolId,key])).rows[0];
     if((reserved&&reserved.payment_id!==row.payment_id)||(current&&current.id!==row.payment_id))throw new ApiError('VALIDATION_FAILED','This receipt number has already been used.',422);
     await tx.query('INSERT INTO school_fee_receipt_reservations(school_id,receipt_key,payment_id) VALUES($1,$2,$3) ON CONFLICT(school_id,receipt_key) DO NOTHING',[p.schoolId,payment.data.receipt.toLowerCase(),row.payment_id]);
     await tx.query('INSERT INTO school_fee_receipt_reservations(school_id,receipt_key,payment_id) VALUES($1,$2,$3) ON CONFLICT(school_id,receipt_key) DO NOTHING',[p.schoolId,key,row.payment_id]);
     await tx.query('UPDATE school_fee_payments SET data=$1,receipt_key=$2,amount_minor=$3,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$4 AND id=$5',[JSON.stringify(next),key,feeMinor(next.amount),p.schoolId,row.payment_id]);row.data.status='Applied';
    }
   }
   await tx.query('UPDATE school_fee_corrections SET data=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$2 AND id=$3',[JSON.stringify(row.data),p.schoolId,id]);await audit(tx,req,'FEE_CORRECTION_STEP_DECIDED',id);return {...row.data,version:row.version+1};
  })};
 });
 app.get('/api/v1/fees',{preHandler:auth()},async req=>{
  const p=req.principal!;await authorizeWorkspaceAction(db,p,'fees-payments','fee-payment','record.view');
  const paymentScope=await scopedStudentPredicate(db,p,'fee-payment','fp.student_id'),studentScope=await scopedStudentPredicate(db,p,'fee-payment','s.id'),assignmentScope=await scopedStudentPredicate(db,p,'fee-assignment','a.student_id');
  const payments=(await db.query<any>('SELECT fp.id,fp.student_id,fp.data,fp.version FROM school_fee_payments fp WHERE fp.school_id=$1 AND fp.voided=false AND '+paymentScope.sql+' ORDER BY fp.created_at DESC,fp.id',paymentScope.values)).rows;
  const structureGrants=(await resolveEffectiveGrants(db,p,'fees-payments','fee-structure')).filter(grant=>grant.action==='record.view');
  const structures=structureGrants.length?(await db.query<any>('SELECT id,data,version FROM school_fee_structures WHERE school_id=$1 AND archived=false ORDER BY created_at,id',[p.schoolId])).rows:[];
  const students=(await db.query('SELECT s.id,s.admission_number AS admission,s.name,s.status,c.name AS class,se.name AS section FROM students s JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id LEFT JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id WHERE s.school_id=$1 AND '+studentScope.sql+' ORDER BY s.name',studentScope.values)).rows;
  const assignments=(await db.query('SELECT a.student_id AS "studentId",a.structure_id AS "feeStructureId",a.archived_at AS "archivedAt",s.admission_number AS student FROM school_fee_assignments a JOIN students s ON s.id=a.student_id AND s.school_id=a.school_id WHERE a.school_id=$1 AND '+(assignmentScope.viewArchived?'TRUE':'a.archived_at IS NULL')+' AND '+assignmentScope.sql+' ORDER BY a.archived_at NULLS FIRST,s.admission_number,a.structure_id',assignmentScope.values)).rows;
  const masters=structureGrants.length?{academicYears:(await db.query('SELECT id,name,active FROM academic_years WHERE school_id=$1 ORDER BY active DESC,name',[p.schoolId])).rows,classes:(await db.query('SELECT id,name,active FROM classes WHERE school_id=$1 ORDER BY name',[p.schoolId])).rows,sections:(await db.query('SELECT id,class_id AS "classId",name,active FROM sections WHERE school_id=$1 ORDER BY name',[p.schoolId])).rows}:{academicYears:[],classes:[],sections:[]};
  const correctionGrants=(await resolveEffectiveGrants(db,p,'fees-payments','fee-correction')).filter(grant=>grant.action==='record.view');
  const corrections=correctionGrants.length?(await db.query<any>('SELECT id,data,version FROM school_fee_corrections WHERE school_id=$1 ORDER BY created_at DESC,id',[p.schoolId])).rows:[];
  return {data:{payments:payments.map(r=>({...r.data,id:r.id,version:r.version})),structures:structures.map(r=>({...r.data,id:r.id,version:r.version})),students,assignments:assignments.map((r:any)=>({...r,id:r.studentId+':'+r.feeStructureId})),corrections:corrections.map(r=>({...r.data,id:r.id,version:r.version})),masters}};
 });
 app.post('/api/v1/fees/assignments',{preHandler:auth(true)},async(req,reply)=>{
  const p=req.principal!;const input=parse(z.object({student:z.string().trim().min(1).max(80),feeStructureId:z.string().min(1).max(120)}).strict(),req.body);
  const result=await db.transaction(async tx=>{
   const student=(await tx.query<any>("SELECT id FROM students WHERE school_id=$1 AND admission_number=$2 AND status='Active'",[p.schoolId,input.student])).rows[0];if(!student)throw new ApiError('VALIDATION_FAILED','Select an active student belonging to this school.',422);
   const structure=(await tx.query<any>("SELECT id FROM school_fee_structures WHERE school_id=$1 AND id=$2 AND archived=false AND COALESCE(data->>'status','Active')='Active'",[p.schoolId,input.feeStructureId])).rows[0];if(!structure)throw new ApiError('VALIDATION_FAILED','Select an active fee structure.',422);
   const assignment=await assignOrRestoreFeeAssignment(tx,p,student.id,input.feeStructureId,req.correlationId);
   return {id:student.id+':'+input.feeStructureId,studentId:student.id,student:input.student,feeStructureId:input.feeStructureId,...assignment};
  });return reply.code(201).send({data:result});
 });
 app.post('/api/v1/fees/assignments/remove',{preHandler:auth(true)},async req=>{
  const p=req.principal!;const input=parse(z.object({student:z.string().trim().min(1).max(80),feeStructureId:z.string().min(1).max(120)}).strict(),req.body);
  await db.transaction(async tx=>{const student=(await tx.query<any>('SELECT id FROM students WHERE school_id=$1 AND admission_number=$2',[p.schoolId,input.student])).rows[0];if(!student)throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND','This fee assignment no longer exists.',404);await archiveFeeAssignment(tx,p,student.id,input.feeStructureId,req.correlationId)});return {data:{archived:true}};
 });
 app.post('/api/v1/fees/assignments/restore',{preHandler:auth(true)},async req=>{
  const p=req.principal!,input=parse(z.object({student:z.string().trim().min(1).max(80),feeStructureId:z.string().min(1).max(120)}).strict(),req.body);
  const row=await db.transaction(async tx=>{const student=(await tx.query<any>('SELECT id FROM students WHERE school_id=$1 AND admission_number=$2',[p.schoolId,input.student])).rows[0];if(!student)throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND','This fee assignment no longer exists.',404);return restoreFeeAssignment(tx,p,student.id,input.feeStructureId,req.correlationId)});return{data:{restored:true,assignment:row}};
 });
 app.delete('/api/v1/fees/assignments/permanent-delete',{preHandler:auth(true)},async req=>{
  const p=req.principal!,input=parse(z.object({student:z.string().trim().min(1).max(80),feeStructureId:z.string().min(1).max(120),confirmation:z.literal('DELETE')}).strict(),req.body);
  await db.transaction(async tx=>{const student=(await tx.query<any>('SELECT id FROM students WHERE school_id=$1 AND admission_number=$2',[p.schoolId,input.student])).rows[0];if(!student)throw new ApiError('FEE_ASSIGNMENT_NOT_FOUND','This fee assignment no longer exists.',404);await permanentlyDeleteFeeAssignment(tx,p,student.id,input.feeStructureId,req.correlationId)});return{data:{deleted:true}};
 });
 app.post('/api/v1/fees/payments',{preHandler:auth(true)},async(req,reply)=>{
  const p=req.principal!;const input=parse(z.object({payment:feePaymentSchema,mutationKey:z.string().uuid()}).strict(),req.body);
  const fingerprint=createHash('sha256').update(JSON.stringify(input.payment)).digest('hex');
  const result=await db.transaction(async tx=>{
   const counter=await lockFees(tx,p.schoolId);
   const student=(await tx.query<any>("SELECT id,class_id,section_id FROM students WHERE school_id=$1 AND admission_number=$2 AND status='Active'",[p.schoolId,input.payment.student])).rows[0];if(!student)throw new ApiError('VALIDATION_FAILED','Select an active student belonging to this school.',422);await authorizeCreate(tx,p,feeContext(p,'fee-payment',{student_id:student.id}));
   const prior=(await tx.query<any>('SELECT id,data,version,request_fingerprint FROM school_fee_payments WHERE school_id=$1 AND mutation_key=$2',[p.schoolId,input.mutationKey])).rows[0];if(prior){if(prior.request_fingerprint!==fingerprint)throw conflict();return {...prior.data,id:prior.id,version:prior.version};}
   const structure=(await tx.query<any>("SELECT fs.data FROM school_fee_structures fs WHERE fs.school_id=$1 AND fs.id=$2 AND fs.archived=false AND COALESCE(fs.data->>'status','Active')='Active' AND (EXISTS(SELECT 1 FROM school_fee_assignments a WHERE a.school_id=fs.school_id AND a.student_id=$3 AND a.structure_id=fs.id AND a.archived_at IS NULL) OR ((fs.data->>'applicableClass')=(SELECT name FROM classes WHERE school_id=$1 AND id=$4) AND (COALESCE(fs.data->>'applicableSection','')='' OR (fs.data->>'applicableSection')=(SELECT name FROM sections WHERE school_id=$1 AND id=$5))))",[p.schoolId,input.payment.feeStructureId,student.id,student.class_id,student.section_id])).rows[0];
   if(!structure)throw new ApiError('VALIDATION_FAILED','Select an active fee structure applicable to this student.',422);
   const allowed=new Map<string,number>((structure.data.components||[]).map((c:any)=>[String(c.name).toLocaleLowerCase('en'),Number(c.amount)]));
   for(const c of input.payment.components){const componentAmount=allowed.get(c.component.toLocaleLowerCase('en'));if(componentAmount===undefined)throw new ApiError('VALIDATION_FAILED','Fee components must come from the selected fee structure.',422);c.applicableAmount=componentAmount;}
   let receipt=input.payment.receipt;
   if(!receipt){const school=(await tx.query<any>('SELECT settings FROM schools WHERE id=$1',[p.schoolId])).rows[0],legacyPrefix=String(school.settings?.receiptPrefix||'REC').slice(0,20),format=await workspaceNumberFormat(tx,p.schoolId,'fees-payments',legacyPrefix+'{000}');let number=BigInt(counter.next_number);do{receipt=formatWorkspaceNumber(format,number++);}while((await tx.query('SELECT id FROM school_fee_payments WHERE school_id=$1 AND receipt_key=$2 UNION SELECT payment_id AS id FROM school_fee_receipt_reservations WHERE school_id=$1 AND receipt_key=$2',[p.schoolId,receipt.toLowerCase()])).rows.length);await tx.query('UPDATE school_fee_counters SET next_number=$1 WHERE school_id=$2',[number.toString(),p.schoolId]);}
   if((await tx.query('SELECT id FROM school_fee_payments WHERE school_id=$1 AND receipt_key=$2 UNION SELECT payment_id AS id FROM school_fee_receipt_reservations WHERE school_id=$1 AND receipt_key=$2',[p.schoolId,receipt.toLowerCase()])).rows.length)throw new ApiError('VALIDATION_FAILED','This receipt number has already been used.',422);
   const id=randomUUID(),data={...input.payment,receipt};await tx.query('INSERT INTO school_fee_payments(id,school_id,student_id,receipt_key,data,amount_minor,mutation_key,request_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,p.schoolId,student.id,receipt.toLowerCase(),JSON.stringify(data),feeMinor(data.amount),input.mutationKey,fingerprint]);await audit(tx,req,'FEE_PAYMENT_CREATED',id);return {...data,id,version:1};
  });return reply.code(201).send({data:result});
 });
 app.post('/api/v1/fees/payments/:id/remove',{preHandler:auth(true)},async req=>{const p=req.principal!;const id=String((req.params as any).id),input=parse(version,req.body);await db.transaction(async tx=>{await lockFees(tx,p.schoolId);const current=(await tx.query<any>('SELECT id,student_id,voided FROM school_fee_payments WHERE school_id=$1 AND id=$2 FOR UPDATE',[p.schoolId,id])).rows[0];if(!current||current.voided)throw conflict();await authorizeRecord(tx,p,'record.archive',feeContext(p,'fee-payment',current));const r=await tx.query('UPDATE school_fee_payments SET voided=true,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$1 AND id=$2 AND version=$3 AND voided=false RETURNING id',[p.schoolId,id,input.version]);if(!r.rows.length)throw conflict();await audit(tx,req,'FEE_PAYMENT_VOIDED',id);});return {data:{removed:true}};});
 app.post('/api/v1/fees/structures',{preHandler:auth(true)},async(req,reply)=>{const p=req.principal!;await authorizeCreate(db,p,feeContext(p,'fee-structure',{}));const input=parse(feeStructureSchema,req.body),id=randomUUID(),data={...input,totalAmount:input.components.reduce((s,c)=>s+feeMinor(c.amount),0)/100};await db.transaction(async tx=>{await tx.query('INSERT INTO school_fee_structures(id,school_id,data) VALUES($1,$2,$3)',[id,p.schoolId,JSON.stringify(data)]);await audit(tx,req,'FEE_STRUCTURE_CREATED',id);});return reply.code(201).send({data:{...data,id,version:1}});});
 app.patch('/api/v1/fees/structures/:id',{preHandler:auth(true)},async req=>{
  const p=req.principal!;const id=String((req.params as any).id),input=parse(z.object({structure:feeStructureSchema,version:z.number().int().positive()}).strict(),req.body),data={...input.structure,totalAmount:input.structure.components.reduce((sum,c)=>sum+feeMinor(c.amount),0)/100};await authorizeRecord(db,p,'record.update',feeContext(p,'fee-structure',{id}));
  await db.transaction(async tx=>{const row=await tx.query('UPDATE school_fee_structures SET data=$1,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$2 AND id=$3 AND version=$4 AND archived=false RETURNING id',[JSON.stringify(data),p.schoolId,id,input.version]);if(!row.rows.length)throw conflict();await audit(tx,req,'FEE_STRUCTURE_UPDATED',id);});return {data:{saved:true}};
 });
 app.post('/api/v1/fees/structures/:id/remove',{preHandler:auth(true)},async req=>{
  const p=req.principal!;const id=String((req.params as any).id),input=parse(version,req.body);await authorizeRecord(db,p,'record.archive',feeContext(p,'fee-structure',{id}));
  await db.transaction(async tx=>{const row=await tx.query('UPDATE school_fee_structures SET archived=true,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE school_id=$1 AND id=$2 AND version=$3 AND archived=false RETURNING id',[p.schoolId,id,input.version]);if(!row.rows.length)throw conflict();await tx.query('UPDATE school_fee_assignments SET archived_at=CURRENT_TIMESTAMP WHERE school_id=$1 AND structure_id=$2 AND archived_at IS NULL',[p.schoolId,id]);await audit(tx,req,'FEE_STRUCTURE_ARCHIVED',id);});return {data:{removed:true}};
 });
}
