import {describe,expect,it} from 'vitest';
import {resolveFrontendRuntime} from '../../src/services/workspace-runtime-mode.js';
import {loadConfig} from '../../src/config/index.js';
import {dashboardScoped} from '../../src/routes/workspace-layouts.js';

describe('Universal Workspace Runtime toggle',()=>{
 const students={system:true,workspaceKey:'students'},fees={system:true,workspaceKey:'fees-payments'};
 it('is OFF (legacy) for a built-in workspace that is not allow-listed',()=>{expect(resolveFrontendRuntime(fees,['students'])).toBe('legacy');expect(resolveFrontendRuntime(fees,[])).toBe('legacy')});
 it('is ON for an allow-listed built-in workspace and for "*"',()=>{expect(resolveFrontendRuntime(students,['students'])).toBe('universal');expect(resolveFrontendRuntime(fees,['*'])).toBe('universal')});
 it('lets a stored per-workspace override win over the allow-list',()=>{
  expect(resolveFrontendRuntime({...students,behaviorConfiguration:{frontendRuntime:'legacy'}},['students'])).toBe('legacy');
  expect(resolveFrontendRuntime({...fees,behaviorConfiguration:{frontendRuntime:'universal'}},[])).toBe('universal');
  expect(resolveFrontendRuntime({...fees,behaviorConfiguration:{frontendRuntime:'bogus'}},[])).toBe('legacy');
 });
 it('always uses the universal runtime for a custom workspace (it has no native screen)',()=>{expect(resolveFrontendRuntime({system:false,workspaceKey:'custom-x'},[])).toBe('universal')});
 it('defaults the deployment allow-list to the first rollout set and parses overrides',()=>{
  const base={DATABASE_URL:'postgresql://u:p@h/d'};
  expect(loadConfig(base as any).universalRuntimeWorkspaces).toEqual(['students','uniform']);
  expect(loadConfig({...base,UNIVERSAL_RUNTIME_WORKSPACES:'students, notices'} as any).universalRuntimeWorkspaces).toEqual(['students','notices']);
  expect(loadConfig({...base,UNIVERSAL_RUNTIME_WORKSPACES:''} as any).universalRuntimeWorkspaces).toEqual([]);
 });
});

describe('Dashboard VIEW scope',()=>{
 const layout={components:[{id:'c'}],actions:[{id:'a'}]};
 it('removes only dashboard components when Dashboard VIEW is missing; actions remain',()=>{
  const scoped=dashboardScoped({dashboardVisible:false,canManage:false},layout);
  expect(scoped.components).toEqual([]);expect(scoped.actions).toEqual(layout.actions);
 });
 it('keeps components for a user with Dashboard VIEW or a Workspace Manager configurator',()=>{
  expect(dashboardScoped({dashboardVisible:true,canManage:false},layout).components).toHaveLength(1);
  expect(dashboardScoped({dashboardVisible:false,canManage:true},layout).components).toHaveLength(1);
 });
});
