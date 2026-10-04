import {z} from 'zod';
import {ApiError} from '../errors/api-error.js';
// Store/calculate money in minor units; expose rupee values to the existing UI.
export function feeMinor(value:number){
 const scaled=value*100,rounded=Math.round(scaled);
 if(!Number.isFinite(value)||value<0||!Number.isSafeInteger(rounded)||Math.abs(scaled-rounded)>0.000001)throw new ApiError('VALIDATION_FAILED','Amounts must be non-negative with at most two decimal places.',422);
 return rounded;
}
const money=z.number().finite().min(0).max(1_000_000_000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.000001,'Use at most two decimal places.');
const component=z.object({component:z.string().trim().min(1).max(160),applicableAmount:money,paidAmount:money.refine(v=>v>0)}).strict();
export const feePaymentSchema=z.object({receipt:z.string().trim().max(120),date:z.string().date(),student:z.string().trim().min(1).max(120),feeStructureId:z.string().uuid().optional(),head:z.string().trim().min(1).max(160),mode:z.enum(['Cash','UPI','Bank','Card','Online']),amount:money.refine(v=>v>0),components:z.array(component).min(1).max(100)}).strict().superRefine((p,ctx)=>{
 if(new Set(p.components.map(c=>c.component.toLocaleLowerCase('en'))).size!==p.components.length)ctx.addIssue({code:'custom',path:['components'],message:'Fee components must be unique.'});
 if(p.components.reduce((sum,c)=>sum+feeMinor(c.paidAmount),0)!==feeMinor(p.amount))ctx.addIssue({code:'custom',path:['amount'],message:'Payment total must match component allocation.'});
 if(p.components.length===1&&p.head!==p.components[0].component)ctx.addIssue({code:'custom',path:['head'],message:'Fee head must match the component.'});
 if(p.components.length>1&&p.head!=='Multiple Fee Components')ctx.addIssue({code:'custom',path:['head'],message:'Use the multiple-component fee head.'});
});
export const feeStructureSchema=z.object({name:z.string().trim().min(1).max(200),academicYear:z.string().max(100),applicableClass:z.string().max(120),applicableSection:z.string().max(120),components:z.array(z.object({name:z.string().trim().min(1).max(160),amount:money}).strict()).min(1).max(100),dueDate:z.union([z.literal(''),z.string().date()]),status:z.enum(['Active','Inactive'])}).strict().superRefine((s,ctx)=>{if(new Set(s.components.map(c=>c.name.toLocaleLowerCase('en'))).size!==s.components.length)ctx.addIssue({code:'custom',path:['components'],message:'Fee components must be unique.'});});
export function feeTotals(due:number[],paid:number[]){const totalDueMinor=due.reduce((s,v)=>s+feeMinor(v),0),totalPaidMinor=paid.reduce((s,v)=>s+feeMinor(v),0);if(!Number.isSafeInteger(totalDueMinor)||!Number.isSafeInteger(totalPaidMinor))throw new ApiError('VALIDATION_FAILED','Fee total exceeds the supported range.',422);return {totalDue:totalDueMinor/100,totalPaid:totalPaidMinor/100,outstanding:Math.max(0,totalDueMinor-totalPaidMinor)/100,overpaid:Math.max(0,totalPaidMinor-totalDueMinor)/100,status:totalPaidMinor>=totalDueMinor?'Paid':totalPaidMinor>0?'Partial':'Unpaid'};}
