import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
describe('Grid Add is tab-specific',()=>{
 const src=readFileSync(join(process.cwd(),'../Server_Module_Completion/workspace-actions.js'),'utf8');
 it('never resolves a MAIN/workspace-wide Add handler for a Grid tab',()=>{expect(src).toContain("if(operationKey==='add'&&tab&&tab!=='MAIN'&&tab!=='DASHBOARD')return null");expect(src).toContain("handlers.get(workspaceKey+':'+tab+':'+operationKey)")});
 it('resolves handlers using the action tab at projection and execution',()=>{expect(src).toContain('handlerFor(workspaceKey,action.operationKey,action.tab||tab)');expect(src).toContain('handlerFor(workspaceKey,action.operationKey,context.tab||action.tab)')});
});
