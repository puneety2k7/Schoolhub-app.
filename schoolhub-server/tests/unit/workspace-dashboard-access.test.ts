import {describe,expect,it,vi} from 'vitest';
import {hasDashboardView} from '../../src/routes/workspace-layouts.js';
import type {Principal} from '../../src/authorization/service.js';

const principal=(systemRecovery=false):Principal=>({userId:'user',schoolId:'school',roleId:'role',roleName:systemRecovery?'System Administrator':'User',systemRecovery,teacherId:null,permissions:['workspaces:configure'],username:'user'});

describe('workspace Dashboard access',()=>{
 it('grants System Administrator automatically without stored selections',async()=>{
  const query=vi.fn();
  await expect(hasDashboardView({query} as any,principal(true),'workspace')).resolves.toBe(true);
  expect(query).not.toHaveBeenCalled();
 });
 it('requires saved Dashboard VIEW for every ordinary user, including a workspace configurator',async()=>{
  const deniedQuery=vi.fn().mockResolvedValue({rows:[]});
  await expect(hasDashboardView({query:deniedQuery} as any,principal(false),'workspace')).resolves.toBe(false);
  const sql=String(deniedQuery.mock.calls[0][0]);
  expect(sql).toContain("up.tab_key='DASHBOARD'");
  expect(sql).toContain("up.permission_key='VIEW'");
  expect(sql).not.toContain("up.tab_key IN ('MAIN'");
  const allowedQuery=vi.fn().mockResolvedValue({rows:[{allowed:1}]});
  await expect(hasDashboardView({query:allowedQuery} as any,principal(false),'workspace')).resolves.toBe(true);
 });
});
