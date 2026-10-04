import {z} from 'zod';
import type {Queryable} from '../database/types.js';
import {ApiError} from '../errors/api-error.js';
import {ensureHomeworkPicklists,readHomeworkPicklist} from './homework-picklists.js';
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal(''));
export const transportRouteSchema=z.object({
 route:z.string().trim().min(1).max(160),vehicle:z.string().max(160),driver:z.string().max(160).default(''),attendant:z.string().max(160).default(''),
 stops:z.string().max(8000),status:z.string().min(1).max(120),
 routeCode:z.string().trim().max(80).optional(),driverId:z.string().nullable().optional(),attendantId:z.string().nullable().optional(),
 startTime:time.optional(),shift:z.string().max(120).optional(),monthlyFee:z.number().min(0).max(1000000).nullable().optional(),capacity:z.number().int().min(1).max(1000).nullable().optional(),
 classIds:z.array(z.string().min(1)).max(100).optional(),sectionIds:z.array(z.string().min(1)).max(300).optional(),notes:z.string().max(8000).optional(),
 stopDetails:z.array(z.object({name:z.string().trim().min(1).max(240),pickupTime:time,dropTime:time}).strict()).max(100).optional()
}).strict();
export async function validateTransport(db:Queryable,school:string,input:any,old:any={},id?:string){
 const data={...old,...input};
 await ensureHomeworkPicklists(db,school);
 for(const [field,key] of [['vehicle','transportVehicle'],['shift','transportShift'],['status','transportStatus']]){
  if(data[field]===old[field])continue;
  const values=await readHomeworkPicklist(db,school,key);
  if(data[field]&&!values.some(x=>x.value===data[field]&&x.active))throw new ApiError('VALIDATION_FAILED','Choose an active '+field+' from Picklist Manager.',422);
 }
 if(!id||input.routeCode!==undefined){
  if(!data.routeCode||!data.vehicle||!data.startTime||!data.shift||(!data.driverId&&!old.driver))throw new ApiError('VALIDATION_FAILED','Route code, vehicle, driver, start time and shift are required.',422);
  const others=(await db.query<any>('SELECT id,data FROM transport_routes WHERE school_id=$1',[school])).rows;
  if(others.some(x=>x.id!==id&&String(x.data.routeCode||'').toLowerCase()===data.routeCode.toLowerCase()))throw new ApiError('VALIDATION_FAILED','Route code already exists, including archived routes.',422);
 }
 for(const field of ['driverId','attendantId']){
  const legacyKey=field==='driverId'?'driver':'attendant';
  if(!data[field]&&data[legacyKey]&&data[legacyKey]!==old[legacyKey])throw new ApiError('VALIDATION_FAILED','Choose a staff reference rather than typing a name.',422);
  if(data[field]){
   const staff=(await db.query<any>('SELECT name,status FROM staff WHERE school_id=$1 AND id=$2',[school,data[field]])).rows[0];
   if(!staff||(staff.status!=='Active'&&data[field]!==old[field]))throw new ApiError('VALIDATION_FAILED','Select an active staff record for '+field+'.',422);
   data[field==='driverId'?'driver':'attendant']=staff.name;
  }else if(input[field]===null&&!old[field==='driverId'?'driver':'attendant'])data[field==='driverId'?'driver':'attendant']='';
 }
 for(const [field,table] of [['classIds','classes'],['sectionIds','sections']]){
  for(const ref of data[field]||[]){
   const row=(await db.query<any>('SELECT * FROM '+table+' WHERE school_id=$1 AND id=$2',[school,ref])).rows[0];
   if(!row||(!row.active&&!(old[field]||[]).includes(ref)))throw new ApiError('VALIDATION_FAILED','Select a valid '+table+' reference.',422);
   if(field==='sectionIds'&&!(data.classIds||[]).includes(row.class_id))throw new ApiError('VALIDATION_FAILED','Select the class belonging to each section.',422);
  }
 }
 if(data.stopDetails){
  const names=data.stopDetails.map((x:any)=>x.name);
  if(new Set(names.map((x:string)=>x.toLowerCase())).size!==names.length||names.some((x:string)=>x.includes(',')))throw new ApiError('VALIDATION_FAILED','Stop names must be unique and cannot contain commas.',422);
  data.stops=names.join(', ');
 }
 if((!id||input.routeCode!==undefined)&&!data.stops.trim())throw new ApiError('VALIDATION_FAILED','Add at least one stop.',422);
 if(id&&data.capacity){const count=Number((await db.query<any>('SELECT count(*) AS n FROM transport_assignments WHERE school_id=$1 AND route_id=$2',[school,id])).rows[0].n);if(count>data.capacity)throw new ApiError('VALIDATION_FAILED','Capacity cannot be lower than assigned students.',422);}
 return data;
}
