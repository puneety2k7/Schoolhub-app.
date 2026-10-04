/**
 * Universal Workspace Runtime toggle (frontend ownership only).
 *
 * The runtime mode decides which frontend owns an operational workspace: the legacy/native screens
 * or the Universal Workspace Runtime. It never changes authorization: the universal permission
 * model is always enforced by the backend regardless of the mode.
 *
 * Resolution order for a workspace:
 *  1. A custom workspace (system=false) has no native screen, so it is always 'universal'.
 *  2. An explicit per-workspace override stored in behavior_configuration.frontendRuntime.
 *  3. The deployment allow-list (UNIVERSAL_RUNTIME_WORKSPACES; '*' = every workspace).
 *  4. Otherwise 'legacy'.
 */
export type FrontendRuntime='universal'|'legacy';

export function resolveFrontendRuntime(
 definition:{system:boolean;workspaceKey:string;behaviorConfiguration?:unknown},
 allowList:readonly string[]=[]
):FrontendRuntime{
 if(definition.system===false)return 'universal';
 const override=(definition.behaviorConfiguration as {frontendRuntime?:unknown}|null|undefined)?.frontendRuntime;
 if(override==='universal'||override==='legacy')return override;
 return allowList.includes('*')||allowList.includes(definition.workspaceKey)?'universal':'legacy';
}
