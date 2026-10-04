import workspaceActionFactories from '../factories/workspace-actions.json' with {type:'json'};

const registered=new Set<string>([
 ...Object.values(workspaceActionFactories).flat().map(action=>action.operationKey),
 'permanent-delete',
 'student_admission'
]);
export const REGISTERED_WORKSPACE_OPERATION_KEYS=Object.freeze([...registered].sort());
export function isRegisteredWorkspaceOperation(key:string){return registered.has(key)}
