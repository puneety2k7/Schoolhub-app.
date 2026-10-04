import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({audits:[] as any[],authorizeRecord:vi.fn(),authorizeArchivedLifecycle:vi.fn(),authorizeCreate:vi.fn()}));
vi.mock('../../src/audit/service.js',()=>({writeAudit:vi.fn(async(_db:any,input:any)=>{mocks.audits.push(input)})}));
vi.mock('../../src/authorization/policy-engine.js',()=>({
 authorizeRecord:mocks.authorizeRecord,authorizeArchivedLifecycle:mocks.authorizeArchivedLifecycle,authorizeCreate:mocks.authorizeCreate,
 authorizeWorkspaceAction:vi.fn(),resolveEffectiveGrants:vi.fn()
}));
import {ApiError} from '../../src/errors/api-error.js';
import {archiveFeeAssignment,assignOrRestoreFeeAssignment,mayViewArchivedFeeAssignments,permanentlyDeleteFeeAssignment,restoreFeeAssignment} from '../../src/routes/fees.js';

type Assignment={student_id:string;structure_id:string;archived_at:string|null};
function store(archived=false,payments:any[]=[]){
 let assignment:Assignment|undefined={student_id:'student',structure_id:'structure',archived_at:archived?'2026-10-01T00:00:00.000Z':null},insertCount=0;
 const db:any={query:async(sql:string,values:any[]=[])=>{
  if(sql.includes('SELECT student_id,archived_at FROM school_fee_assignments'))return{rows:assignment?[assignment]:[],rowCount:assignment?1:0};
  if(sql.includes('SELECT student_id,structure_id,archived_at FROM school_fee_assignments')){
   const wantsArchived=sql.includes('archived_at IS NOT NULL'),wantsActive=sql.includes('archived_at IS NULL');
   const match=assignment&&((wantsArchived&&assignment.archived_at)||(wantsActive&&!assignment.archived_at));
   return{rows:match?[assignment]:[],rowCount:match?1:0};
  }
  if(sql.startsWith('UPDATE school_fee_assignments SET archived_at=CURRENT_TIMESTAMP')){if(!assignment||assignment.archived_at)return{rows:[],rowCount:0};assignment={...assignment,archived_at:'2026-10-04T00:00:00.000Z'};return{rows:[assignment],rowCount:1}}
  if(sql.startsWith('UPDATE school_fee_assignments SET archived_at=NULL')){if(!assignment||!assignment.archived_at)return{rows:[],rowCount:0};assignment={...assignment,archived_at:null};return{rows:[assignment],rowCount:1}}
  if(sql.startsWith('INSERT INTO school_fee_assignments')){insertCount++;assignment={student_id:String(values[1]),structure_id:String(values[2]),archived_at:null};return{rows:[],rowCount:1}}
  if(sql.startsWith('SELECT 1 FROM school_fee_payments'))return{rows:payments.filter(row=>row.studentId===values[1]&&row.feeStructureId===values[2]).slice(0,1),rowCount:null};
  if(sql.startsWith('DELETE FROM school_fee_assignments')){if(!assignment||!assignment.archived_at)return{rows:[],rowCount:0};assignment=undefined;return{rows:[{student_id:'student'}],rowCount:1}}
  throw new Error('Unexpected SQL: '+sql);
 }};
 return{db,get assignment(){return assignment},get insertCount(){return insertCount},payments};
}
const principal=(extra:any={})=>({schoolId:'school',userId:'user',systemRecovery:false,...extra});
beforeEach(()=>{mocks.audits.length=0;mocks.authorizeRecord.mockReset().mockResolvedValue({allowed:true});mocks.authorizeCreate.mockReset().mockResolvedValue({allowed:true});mocks.authorizeArchivedLifecycle.mockReset().mockImplementation(async(_db:any,p:any,action:string)=>{if(action==='record.restore'&&!p.restore)throw new ApiError('AUTHORIZATION_DENIED','Denied',403);if(action==='record.permanent_delete'&&!p.permanentDelete)throw new ApiError('AUTHORIZATION_DENIED','Denied',403);return{allowed:true}})});

describe('fee assignment universal archive lifecycle',()=>{
 it('archives an active assignment without deleting its row and writes an audit event',async()=>{
  const state=store();await archiveFeeAssignment(state.db,principal(),'student','structure','corr');
  expect(state.assignment?.archived_at).toBeTruthy();expect(mocks.audits.at(-1)?.action).toBe('FEE_ASSIGNMENT_ARCHIVED');
 });
 it('hides archived assignments by default and exposes them only with archived-view authority',()=>{
  expect(mayViewArchivedFeeAssignments(principal(),[{constraints:{}}])).toBe(false);
  expect(mayViewArchivedFeeAssignments(principal(),[{constraints:{viewArchived:true}}])).toBe(true);
  expect(mayViewArchivedFeeAssignments(principal({systemRecovery:true}),[])).toBe(true);
 });
 it('restores the same archived row without requiring EDIT',async()=>{
  const state=store(true);const identity=state.assignment&&[state.assignment.student_id,state.assignment.structure_id];
  await restoreFeeAssignment(state.db,principal({restore:true}),'student','structure','corr');
  expect(state.assignment&&[state.assignment.student_id,state.assignment.structure_id]).toEqual(identity);expect(state.assignment?.archived_at).toBeNull();expect(state.insertCount).toBe(0);
  expect(mocks.authorizeArchivedLifecycle).toHaveBeenCalledWith(state.db,expect.anything(),'record.restore',expect.objectContaining({lifecycle:'Archived'}));
 });
 it('reassignment restores the existing archived row instead of inserting a duplicate',async()=>{
  const state=store(true);await assignOrRestoreFeeAssignment(state.db,principal({restore:true}),'student','structure','corr');
  expect(state.assignment?.archived_at).toBeNull();expect(state.insertCount).toBe(0);
 });
 it('denies permanent deletion without the complete lifecycle permission decision',async()=>{
  const state=store(true);await expect(permanentlyDeleteFeeAssignment(state.db,principal(),'student','structure','corr')).rejects.toMatchObject({code:'AUTHORIZATION_DENIED'});
  expect(state.assignment).toBeDefined();
 });
 it('rejects permanent deletion when preserved payment history depends on the assignment',async()=>{
  const payment={id:'payment',studentId:'student',feeStructureId:'structure',amount:4500},state=store(true,[payment]),snapshot=JSON.stringify(state.payments);
  await expect(permanentlyDeleteFeeAssignment(state.db,principal({permanentDelete:true}),'student','structure','corr')).rejects.toMatchObject({code:'DEPENDENT_RECORDS_EXIST'});
  expect(state.assignment).toBeDefined();expect(JSON.stringify(state.payments)).toBe(snapshot);expect(mocks.audits).toHaveLength(0);
 });
 it('permanently deletes an eligible archived assignment, audits it, and leaves unrelated payment data unchanged',async()=>{
  const payment={id:'other-payment',studentId:'other',feeStructureId:'other',amount:900},state=store(true,[payment]),snapshot=JSON.stringify(state.payments);
  await permanentlyDeleteFeeAssignment(state.db,principal({permanentDelete:true}),'student','structure','corr');
  expect(state.assignment).toBeUndefined();expect(mocks.audits.at(-1)?.action).toBe('FEE_ASSIGNMENT_PERMANENTLY_DELETED');expect(JSON.stringify(state.payments)).toBe(snapshot);
 });
});
