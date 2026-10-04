import {
  OPERATIONAL_TAB_KEYS, STANDARD_OPERATIONS, FIELD_TYPES, type OperationalTabKey, type StandardOperation, type FieldType, type FieldOption,
} from '../../../shared/src/index.js';
import type { Db } from '../db/database.js';

/** The complete, unfiltered definition of one workspace (Workspace → Tab → Section → Field). Authorization is applied by callers. */
export type FieldDefinition = {
  id: string; key: string; label: string; type: FieldType; required: boolean; readOnly: boolean; visible: boolean;
  searchable: boolean; filterable: boolean; printVisible: boolean; sortOrder: number; helpText: string;
  defaultValue: unknown; options: FieldOption[]; referenceWorkspaceId: string | null; sectionId: string; tabKey: OperationalTabKey;
};
export type SectionDefinition = { id: string; tabKey: OperationalTabKey; name: string; description: string; sortOrder: number; fields: FieldDefinition[] };
export type FormLayout = { sections: { title: string; fieldKeys: string[] }[] };
export type FormDefinition = { id: string; name: string; layout: FormLayout };
export type TabDefinition = { key: OperationalTabKey; label: string; formId: string | null; sections: SectionDefinition[] };
export type ActionSetting = { tabKey: OperationalTabKey; operation: StandardOperation; enabled: boolean; sortOrder: number };
export type DashboardComponentDefinition = {
  id: string; type: 'metric' | 'table'; title: string; sortOrder: number;
  config: { sourceTab?: OperationalTabKey; aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'; fieldKey?: string; fieldKeys?: string[]; limit?: number };
};
export type WorkspaceDefinition = {
  id: string; schoolId: string; key: string; name: string; pluralName: string; description: string; category: string; icon: string;
  status: 'Active' | 'Archived'; displayFieldKey: string | null; printTitle: string; version: number;
  tabs: TabDefinition[]; forms: FormDefinition[]; actions: ActionSetting[]; components: DashboardComponentDefinition[];
};

export async function loadDefinition(db: Db, schoolId: string, where: { id?: string; key?: string }): Promise<WorkspaceDefinition | null> {
  const workspace = (await db.query<any>(
    `SELECT * FROM workspaces WHERE school_id=$1 AND ${where.id ? 'id=$2' : 'key=$2'}`, [schoolId, where.id ?? where.key])).rows[0];
  if (!workspace) return null;
  const id: string = workspace.id;
  // Sequential: `db` may be a single transaction client, which cannot run queries concurrently.
  const tabs = await db.query<any>('SELECT * FROM workspace_tabs WHERE workspace_id=$1', [id]);
  const sections = await db.query<any>('SELECT * FROM workspace_sections WHERE workspace_id=$1 ORDER BY sort_order, name', [id]);
  const fields = await db.query<any>('SELECT * FROM workspace_fields WHERE workspace_id=$1 ORDER BY sort_order, label', [id]);
  const forms = await db.query<any>('SELECT * FROM workspace_forms WHERE workspace_id=$1 ORDER BY name', [id]);
  const actions = await db.query<any>('SELECT * FROM workspace_action_settings WHERE workspace_id=$1 ORDER BY tab_key, sort_order', [id]);
  const components = await db.query<any>('SELECT * FROM dashboard_components WHERE workspace_id=$1 ORDER BY sort_order, created_at', [id]);
  const sectionTab = new Map<string, OperationalTabKey>(sections.rows.map((row) => [row.id, row.tab_key]));
  const fieldsBySection = new Map<string, FieldDefinition[]>();
  for (const row of fields.rows) {
    const field: FieldDefinition = {
      id: row.id, key: row.key, label: row.label, type: row.field_type, required: row.required, readOnly: row.read_only, visible: row.visible,
      searchable: row.searchable, filterable: row.filterable, printVisible: row.print_visible, sortOrder: row.sort_order, helpText: row.help_text,
      defaultValue: row.default_value, options: row.options ?? [], referenceWorkspaceId: row.reference_workspace_id, sectionId: row.section_id,
      tabKey: sectionTab.get(row.section_id)!,
    };
    fieldsBySection.set(row.section_id, [...(fieldsBySection.get(row.section_id) ?? []), field]);
  }
  const tabDefs: TabDefinition[] = OPERATIONAL_TAB_KEYS.map((tabKey) => {
    const tab = tabs.rows.find((row) => row.tab_key === tabKey);
    return {
      key: tabKey, label: tab?.label ?? tabKey, formId: tab?.form_id ?? null,
      sections: sections.rows.filter((row) => row.tab_key === tabKey).map((row): SectionDefinition => ({
        id: row.id, tabKey, name: row.name, description: row.description, sortOrder: row.sort_order, fields: fieldsBySection.get(row.id) ?? [],
      })),
    };
  });
  return {
    id, schoolId, key: workspace.key, name: workspace.name, pluralName: workspace.plural_name, description: workspace.description,
    category: workspace.category, icon: workspace.icon, status: workspace.status, displayFieldKey: workspace.display_field_key,
    printTitle: workspace.print_title, version: workspace.version, tabs: tabDefs,
    forms: forms.rows.map((row) => ({ id: row.id, name: row.name, layout: row.layout })),
    actions: actions.rows.map((row) => ({ tabKey: row.tab_key, operation: row.operation, enabled: row.enabled, sortOrder: row.sort_order })),
    components: components.rows.map((row) => ({ id: row.id, type: row.type, title: row.title, sortOrder: row.sort_order, config: row.config })),
  };
}

export const tabFields = (definition: WorkspaceDefinition, tab: OperationalTabKey): FieldDefinition[] =>
  definition.tabs.find((candidate) => candidate.key === tab)!.sections.flatMap((section) => section.fields);

export const allFields = (definition: WorkspaceDefinition): FieldDefinition[] => definition.tabs.flatMap((tab) => tab.sections.flatMap((section) => section.fields));

/** Label of a record when another workspace references it. */
export function recordLabel(definition: WorkspaceDefinition, values: Record<string, unknown>): string {
  const preferred = definition.displayFieldKey ? allFields(definition).find((field) => field.key === definition.displayFieldKey) : undefined;
  const candidate = preferred ?? allFields(definition).find((field) => field.type === 'text' || field.type === 'select');
  const value = candidate ? values[candidate.key] : undefined;
  return value === undefined || value === null || value === '' ? '(unnamed record)' : String(value);
}

export { FIELD_TYPES, STANDARD_OPERATIONS };
