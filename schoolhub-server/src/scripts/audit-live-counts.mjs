import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const one = async sql => Number((await pool.query(sql)).rows[0].count);
try {
  const result = {
    scope: 'all schools in configured database',
    schools: await one('SELECT count(*) FROM schools'),
    workspaceDefinitions: await one('SELECT count(*) FROM workspace_definitions'),
    systemWorkspaces: await one('SELECT count(*) FROM workspace_definitions WHERE system=true'),
    customWorkspaces: await one('SELECT count(*) FROM workspace_definitions WHERE system=false'),
    activeWorkspaces: await one("SELECT count(*) FROM workspace_definitions WHERE status='Active'"),
    workspaceFields: await one('SELECT count(*) FROM workspace_fields WHERE archived=false'),
    workspaceSections: await one('SELECT count(*) FROM workspace_sections WHERE enabled=true'),
    workspaceRelationships: await one("SELECT count(*) FROM workspace_fields WHERE archived=false AND field_type='workspaceReference'"),
    layoutComponents: await one("SELECT coalesce(sum(jsonb_array_length(coalesce(layout_configuration->'components','[]'::jsonb))),0)::bigint AS count FROM workspace_definitions"),
    actionDefinitions: await one("SELECT coalesce(sum(jsonb_array_length(coalesce(layout_configuration->'actions','[]'::jsonb))),0)::bigint AS count FROM workspace_definitions"),
    mainTabAssignments: await one("SELECT count(*) FROM workspace_definitions WHERE layout_configuration->'tabContent' ? 'MAIN'"),
    grid1Assignments: await one("SELECT count(*) FROM workspace_definitions WHERE layout_configuration->'tabContent' ? 'GRID_1'"),
    grid2Assignments: await one("SELECT count(*) FROM workspace_definitions WHERE layout_configuration->'tabContent' ? 'GRID_2'"),
    grid3Assignments: await one("SELECT count(*) FROM workspace_definitions WHERE layout_configuration->'tabContent' ? 'GRID_3'"),
    navigationEntriesShown: await one("SELECT count(*) FROM workspace_definitions WHERE coalesce((navigation_configuration->>'showInMainMenu')::boolean,false)=true"),
    printConfigurations: await one("SELECT count(*) FROM workspace_definitions WHERE print_configuration <> '{}'::jsonb"),
    roles: await one('SELECT count(*) FROM access_roles'),
    groups: await one('SELECT count(*) FROM access_groups'),
    groupMemberships: await one('SELECT count(*) FROM access_group_memberships'),
    roleGroupLinks: await one('SELECT count(*) FROM access_group_roles'),
    normalizedGrants: await one('SELECT count(*) FROM access_role_grants'),
    universalPermissionSelections: await one('SELECT count(*) FROM access_role_universal_permissions'),
    workspaceVersions: await one('SELECT count(*) FROM workspace_definition_versions')
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
