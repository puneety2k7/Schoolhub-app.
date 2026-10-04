import { OPERATIONAL_TAB_KEYS, STANDARD_OPERATIONS, FIELD_TYPES, WORKSPACE_KEY_PATTERN, FIELD_KEY_PATTERN, type OperationalTabKey, type StandardOperation } from '../../../shared/src/index.js';
import type { Database, Db } from '../db/database.js';
import type { Principal } from '../auth/auth-service.js';
import { writeAudit } from '../audit/audit.js';
import { AppError, badRequest, conflict, notFound } from '../http/errors.js';
import { loadDefinition, allFields, tabFields, type FormLayout, type WorkspaceDefinition } from './definition.js';

const DEFAULT_TAB_LABELS: Record<OperationalTabKey, string> = { MAIN: 'Main', GRID_1: 'Grid 1', GRID_2: 'Grid 2', GRID_3: 'Grid 3' };

export type WorkspaceInput = { key: string; name: string; pluralName: string; description?: string; category?: string; icon?: string };
export type FieldInput = {
  sectionId: string; key: string; label: string; type: (typeof FIELD_TYPES)[number]; required?: boolean; readOnly?: boolean; visible?: boolean;
  searchable?: boolean; filterable?: boolean; printVisible?: boolean; sortOrder?: number; helpText?: string; defaultValue?: unknown;
  options?: { value: string; label: string }[]; referenceWorkspaceId?: string | null;
};
export type FieldPatch = Partial<Omit<FieldInput, 'key' | 'type' | 'sectionId'>> & { sectionId?: string };

/**
 * Workspace Manager: the only place workspaces, tabs, sections, fields, forms, standard actions and dashboard components are
 * defined. The runtime renders from exactly this configuration — there is no per-workspace code.
 */
export class WorkspaceManager {
  constructor(private readonly db: Database) {}

  private audit(tx: Db, p: Principal, action: string, workspaceId: string, entityId: string, summary: Record<string, unknown> = {}) {
    return writeAudit(tx, { schoolId: p.schoolId, actorUserId: p.userId, action, entityType: 'Workspace Definition', entityId, workspaceId, summary });
  }
  private async touch(tx: Db, workspaceId: string) { await tx.query('UPDATE workspaces SET version=version+1, updated_at=now() WHERE id=$1', [workspaceId]); }
  private async requireWorkspace(tx: Db, p: Principal, id: string): Promise<WorkspaceDefinition> {
    const definition = await loadDefinition(tx, p.schoolId, { id });
    if (!definition) throw notFound('Workspace');
    return definition;
  }

  async list(p: Principal) {
    return (await this.db.query<any>(
      `SELECT id,key,name,plural_name AS "pluralName",description,category,icon,status,version FROM workspaces WHERE school_id=$1 ORDER BY name`, [p.schoolId])).rows;
  }
  get(p: Principal, id: string) { return this.requireWorkspace(this.db, p, id); }

  async create(p: Principal, input: WorkspaceInput): Promise<WorkspaceDefinition> {
    if (!WORKSPACE_KEY_PATTERN.test(input.key)) throw badRequest('Workspace key: lower-case letters, digits and hyphens, starting with a letter.');
    return this.db.tx(async (tx) => {
      if ((await tx.query('SELECT 1 FROM workspaces WHERE school_id=$1 AND key=$2', [p.schoolId, input.key])).rowCount) throw conflict('DUPLICATE_WORKSPACE', 'A workspace with this key already exists.');
      const id = (await tx.query<{ id: string }>(
        'INSERT INTO workspaces(school_id,key,name,plural_name,description,category,icon) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [p.schoolId, input.key, input.name, input.pluralName, input.description ?? '', input.category ?? 'General', input.icon ?? 'folder'])).rows[0]!.id;
      // The universal contract: five tabs (Dashboard + MAIN + GRID_1..3) and the seven standard actions on every record tab.
      for (const tab of OPERATIONAL_TAB_KEYS) {
        await tx.query('INSERT INTO workspace_tabs(workspace_id,tab_key,label) VALUES($1,$2,$3)', [id, tab, DEFAULT_TAB_LABELS[tab]]);
        for (const [index, operation] of STANDARD_OPERATIONS.entries()) await tx.query('INSERT INTO workspace_action_settings(workspace_id,tab_key,operation,sort_order) VALUES($1,$2,$3,$4)', [id, tab, operation, index]);
      }
      await this.audit(tx, p, 'WORKSPACE_CREATED', id, id, { key: input.key });
      return (await loadDefinition(tx, p.schoolId, { id }))!;
    });
  }

  async update(p: Principal, id: string, patch: Partial<{ name: string; pluralName: string; description: string; category: string; icon: string; status: 'Active' | 'Archived'; displayFieldKey: string | null; printTitle: string }>) {
    return this.db.tx(async (tx) => {
      const definition = await this.requireWorkspace(tx, p, id);
      if (patch.displayFieldKey && !allFields(definition).some((field) => field.key === patch.displayFieldKey)) throw badRequest('The display field does not exist in this workspace.');
      const map: Record<string, string> = { name: 'name', pluralName: 'plural_name', description: 'description', category: 'category', icon: 'icon', status: 'status', displayFieldKey: 'display_field_key', printTitle: 'print_title' };
      const sets: string[] = [], values: unknown[] = [];
      for (const [key, column] of Object.entries(map)) if (key in patch) { values.push((patch as Record<string, unknown>)[key]); sets.push(`${column}=$${values.length}`); }
      if (!sets.length) return definition;
      values.push(id);
      await tx.query(`UPDATE workspaces SET ${sets.join(',')}, version=version+1, updated_at=now() WHERE id=$${values.length}`, values);
      await this.audit(tx, p, 'WORKSPACE_UPDATED', id, id, { fields: Object.keys(patch) });
      return (await loadDefinition(tx, p.schoolId, { id }))!;
    });
  }

  /** Tab label and the Form assigned to the tab (null clears it). */
  async updateTab(p: Principal, workspaceId: string, tab: OperationalTabKey, patch: { label?: string; formId?: string | null }) {
    return this.db.tx(async (tx) => {
      const definition = await this.requireWorkspace(tx, p, workspaceId);
      if (patch.formId) {
        const form = definition.forms.find((candidate) => candidate.id === patch.formId);
        if (!form) throw badRequest('The Form does not belong to this workspace.');
        this.assertFormFitsTab(definition, tab, form.layout);
      }
      if (patch.label !== undefined) await tx.query('UPDATE workspace_tabs SET label=$1 WHERE workspace_id=$2 AND tab_key=$3', [patch.label, workspaceId, tab]);
      if (patch.formId !== undefined) await tx.query('UPDATE workspace_tabs SET form_id=$1 WHERE workspace_id=$2 AND tab_key=$3', [patch.formId, workspaceId, tab]);
      await this.touch(tx, workspaceId);
      await this.audit(tx, p, 'TAB_UPDATED', workspaceId, tab, patch);
      return (await loadDefinition(tx, p.schoolId, { id: workspaceId }))!;
    });
  }

  async createSection(p: Principal, workspaceId: string, input: { tabKey: OperationalTabKey; name: string; description?: string; sortOrder?: number }) {
    return this.db.tx(async (tx) => {
      await this.requireWorkspace(tx, p, workspaceId);
      const row = (await tx.query<{ id: string }>('INSERT INTO workspace_sections(workspace_id,tab_key,name,description,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [workspaceId, input.tabKey, input.name, input.description ?? '', input.sortOrder ?? 0])).rows[0]!;
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'SECTION_CREATED', workspaceId, row.id, { tab: input.tabKey, name: input.name });
      return row.id;
    });
  }
  async updateSection(p: Principal, workspaceId: string, sectionId: string, patch: { name?: string; description?: string; sortOrder?: number }) {
    return this.db.tx(async (tx) => {
      const result = await tx.query('UPDATE workspace_sections SET name=COALESCE($1,name), description=COALESCE($2,description), sort_order=COALESCE($3,sort_order) WHERE id=$4 AND workspace_id=$5',
        [patch.name ?? null, patch.description ?? null, patch.sortOrder ?? null, sectionId, workspaceId]);
      if (!result.rowCount) throw notFound('Section');
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'SECTION_UPDATED', workspaceId, sectionId, patch);
    });
  }
  async deleteSection(p: Principal, workspaceId: string, sectionId: string) {
    return this.db.tx(async (tx) => {
      if ((await tx.query('SELECT 1 FROM workspace_fields WHERE section_id=$1 LIMIT 1', [sectionId])).rowCount) throw conflict('SECTION_NOT_EMPTY', 'Move or delete the section\'s fields first.');
      const result = await tx.query('DELETE FROM workspace_sections WHERE id=$1 AND workspace_id=$2', [sectionId, workspaceId]);
      if (!result.rowCount) throw notFound('Section');
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'SECTION_DELETED', workspaceId, sectionId);
    });
  }

  private validateField(definition: WorkspaceDefinition, input: Pick<FieldInput, 'type' | 'options' | 'referenceWorkspaceId'>) {
    if (input.type === 'select' && !(input.options?.length)) throw badRequest('A choice list needs at least one option.');
    if (input.type === 'reference' && !input.referenceWorkspaceId) throw badRequest('A reference field needs a target workspace.');
    if (input.type !== 'reference' && input.referenceWorkspaceId) throw badRequest('Only a reference field has a target workspace.');
    void definition;
  }

  async createField(p: Principal, workspaceId: string, input: FieldInput) {
    if (!FIELD_KEY_PATTERN.test(input.key)) throw badRequest('Field key: lower-case letters, digits and underscores, starting with a letter.');
    return this.db.tx(async (tx) => {
      const definition = await this.requireWorkspace(tx, p, workspaceId);
      this.validateField(definition, input);
      if (!definition.tabs.some((tab) => tab.sections.some((section) => section.id === input.sectionId))) throw badRequest('The section does not belong to this workspace.');
      if (allFields(definition).some((field) => field.key === input.key)) throw conflict('DUPLICATE_FIELD', 'A field with this key already exists in the workspace.');
      if (input.referenceWorkspaceId) {
        const target = await tx.query('SELECT 1 FROM workspaces WHERE id=$1 AND school_id=$2', [input.referenceWorkspaceId, p.schoolId]);
        if (!target.rowCount) throw badRequest('The referenced workspace does not exist.');
      }
      const row = (await tx.query<{ id: string }>(
        `INSERT INTO workspace_fields(workspace_id,section_id,key,label,field_type,required,read_only,visible,searchable,filterable,print_visible,sort_order,help_text,default_value,options,reference_workspace_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [workspaceId, input.sectionId, input.key, input.label, input.type, input.required ?? false, input.readOnly ?? false, input.visible ?? true, input.searchable ?? false,
          input.filterable ?? false, input.printVisible ?? true, input.sortOrder ?? 0, input.helpText ?? '', input.defaultValue === undefined ? null : JSON.stringify(input.defaultValue),
          JSON.stringify(input.options ?? []), input.referenceWorkspaceId ?? null])).rows[0]!;
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'FIELD_CREATED', workspaceId, row.id, { key: input.key, type: input.type });
      return row.id;
    });
  }

  async updateField(p: Principal, workspaceId: string, fieldId: string, patch: FieldPatch) {
    return this.db.tx(async (tx) => {
      const definition = await this.requireWorkspace(tx, p, workspaceId);
      const field = allFields(definition).find((candidate) => candidate.id === fieldId);
      if (!field) throw notFound('Field');
      if (patch.options && field.type !== 'select') throw badRequest('Only a choice-list field has options.');
      if (patch.sectionId && !definition.tabs.some((tab) => tab.sections.some((section) => section.id === patch.sectionId))) throw badRequest('The section does not belong to this workspace.');
      if (patch.sectionId) {
        const used = definition.forms.some((form) => form.layout.sections.some((section) => section.fieldKeys.includes(field.key)));
        if (used) throw conflict('FIELD_IN_FORM', 'Remove the field from its Forms before moving it to another section.');
      }
      const columns: Record<string, string> = { label: 'label', required: 'required', readOnly: 'read_only', visible: 'visible', searchable: 'searchable', filterable: 'filterable', printVisible: 'print_visible', sortOrder: 'sort_order', helpText: 'help_text', sectionId: 'section_id' };
      const sets: string[] = [], values: unknown[] = [];
      for (const [key, column] of Object.entries(columns)) if (key in patch) { values.push((patch as Record<string, unknown>)[key]); sets.push(`${column}=$${values.length}`); }
      if ('defaultValue' in patch) { values.push(patch.defaultValue === undefined || patch.defaultValue === null ? null : JSON.stringify(patch.defaultValue)); sets.push(`default_value=$${values.length}`); }
      if (patch.options) { values.push(JSON.stringify(patch.options)); sets.push(`options=$${values.length}`); }
      if (!sets.length) return;
      values.push(fieldId);
      await tx.query(`UPDATE workspace_fields SET ${sets.join(',')} WHERE id=$${values.length}`, values);
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'FIELD_UPDATED', workspaceId, fieldId, { fields: Object.keys(patch) });
    });
  }

  async deleteField(p: Principal, workspaceId: string, fieldId: string) {
    return this.db.tx(async (tx) => {
      const definition = await this.requireWorkspace(tx, p, workspaceId);
      const field = allFields(definition).find((candidate) => candidate.id === fieldId);
      if (!field) throw notFound('Field');
      const used = await tx.query(`SELECT 1 FROM records WHERE workspace_id=$1 AND field_values ? $2 AND field_values->>$2 IS NOT NULL LIMIT 1`, [workspaceId, field.key]);
      if (used.rowCount) throw conflict('FIELD_HAS_DATA', 'Records hold values for this field. Hide the field instead of deleting it.');
      if (definition.forms.some((form) => form.layout.sections.some((section) => section.fieldKeys.includes(field.key)))) throw conflict('FIELD_IN_FORM', 'Remove the field from its Forms first.');
      await tx.query('DELETE FROM workspace_fields WHERE id=$1', [fieldId]);
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'FIELD_DELETED', workspaceId, fieldId, { key: field.key });
    });
  }

  private assertFormFitsTab(definition: WorkspaceDefinition, tab: OperationalTabKey, layout: FormLayout) {
    const allowed = new Set(tabFields(definition, tab).map((field) => field.key));
    for (const section of layout.sections) for (const key of section.fieldKeys) if (!allowed.has(key)) throw badRequest(`Field "${key}" does not belong to ${tab}, so this Form cannot be assigned to it.`);
  }
  private async validateLayout(tx: Db, p: Principal, workspaceId: string, layout: FormLayout) {
    const definition = await this.requireWorkspace(tx, p, workspaceId), known = new Set(allFields(definition).map((field) => field.key));
    for (const section of layout.sections) for (const key of section.fieldKeys) if (!known.has(key)) throw badRequest(`Unknown field "${key}" in the Form.`);
  }
  async createForm(p: Principal, workspaceId: string, input: { name: string; layout: FormLayout }) {
    return this.db.tx(async (tx) => {
      await this.validateLayout(tx, p, workspaceId, input.layout);
      const row = (await tx.query<{ id: string }>('INSERT INTO workspace_forms(workspace_id,name,layout) VALUES($1,$2,$3) RETURNING id', [workspaceId, input.name, JSON.stringify(input.layout)])).rows[0]!;
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'FORM_CREATED', workspaceId, row.id, { name: input.name });
      return row.id;
    });
  }
  async updateForm(p: Principal, workspaceId: string, formId: string, patch: { name?: string; layout?: FormLayout }) {
    return this.db.tx(async (tx) => {
      const definition = await this.requireWorkspace(tx, p, workspaceId);
      const form = definition.forms.find((candidate) => candidate.id === formId);
      if (!form) throw notFound('Form');
      if (patch.layout) {
        const known = new Set(allFields(definition).map((field) => field.key));
        for (const section of patch.layout.sections) for (const key of section.fieldKeys) if (!known.has(key)) throw badRequest(`Unknown field "${key}" in the Form.`);
        for (const tab of definition.tabs.filter((candidate) => candidate.formId === formId)) this.assertFormFitsTab(definition, tab.key, patch.layout);
      }
      await tx.query('UPDATE workspace_forms SET name=COALESCE($1,name), layout=COALESCE($2,layout), updated_at=now() WHERE id=$3', [patch.name ?? null, patch.layout ? JSON.stringify(patch.layout) : null, formId]);
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'FORM_UPDATED', workspaceId, formId);
    });
  }
  async deleteForm(p: Principal, workspaceId: string, formId: string) {
    return this.db.tx(async (tx) => {
      const definition = await this.requireWorkspace(tx, p, workspaceId);
      if (definition.tabs.some((tab) => tab.formId === formId)) throw conflict('FORM_ASSIGNED', 'Unassign the Form from its tab first.');
      const result = await tx.query('DELETE FROM workspace_forms WHERE id=$1 AND workspace_id=$2', [formId, workspaceId]);
      if (!result.rowCount) throw notFound('Form');
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'FORM_DELETED', workspaceId, formId);
    });
  }

  /** Standard actions are configured (enabled/order) here; their meaning and permissions are universal and not configurable. */
  async setAction(p: Principal, workspaceId: string, tab: OperationalTabKey, operation: StandardOperation, patch: { enabled?: boolean; sortOrder?: number }) {
    return this.db.tx(async (tx) => {
      const result = await tx.query('UPDATE workspace_action_settings SET enabled=COALESCE($1,enabled), sort_order=COALESCE($2,sort_order) WHERE workspace_id=$3 AND tab_key=$4 AND operation=$5',
        [patch.enabled ?? null, patch.sortOrder ?? null, workspaceId, tab, operation]);
      if (!result.rowCount) throw notFound('Action');
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'ACTION_CONFIGURED', workspaceId, `${tab}:${operation}`, patch);
    });
  }

  private async validateComponent(tx: Db, p: Principal, workspaceId: string, type: string, config: any) {
    const definition = await this.requireWorkspace(tx, p, workspaceId);
    if (!config?.sourceTab || !(OPERATIONAL_TAB_KEYS as readonly string[]).includes(config.sourceTab)) throw badRequest('Choose the source tab.');
    const fields = tabFields(definition, config.sourceTab), byKey = new Map(fields.map((field) => [field.key, field]));
    if (type === 'metric') {
      const aggregation = config.aggregation ?? 'count';
      if (!['count', 'sum', 'avg', 'min', 'max'].includes(aggregation)) throw badRequest('Unknown aggregation.');
      if (aggregation !== 'count') {
        const field = byKey.get(config.fieldKey);
        if (!field || !['integer', 'decimal'].includes(field.type)) throw badRequest('Choose a numeric field from the source tab.');
      }
    } else {
      const keys: string[] = config.fieldKeys ?? [];
      if (!keys.length || keys.some((key) => !byKey.has(key))) throw badRequest('Choose fields from the source tab.');
    }
  }
  async createComponent(p: Principal, workspaceId: string, input: { type: 'metric' | 'table'; title: string; sortOrder?: number; config: Record<string, unknown> }) {
    return this.db.tx(async (tx) => {
      await this.validateComponent(tx, p, workspaceId, input.type, input.config);
      const row = (await tx.query<{ id: string }>('INSERT INTO dashboard_components(workspace_id,type,title,sort_order,config) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [workspaceId, input.type, input.title, input.sortOrder ?? 0, JSON.stringify(input.config)])).rows[0]!;
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'DASHBOARD_COMPONENT_CREATED', workspaceId, row.id, { type: input.type });
      return row.id;
    });
  }
  async updateComponent(p: Principal, workspaceId: string, componentId: string, patch: { title?: string; sortOrder?: number; config?: Record<string, unknown> }) {
    return this.db.tx(async (tx) => {
      const current = (await tx.query<any>('SELECT type FROM dashboard_components WHERE id=$1 AND workspace_id=$2', [componentId, workspaceId])).rows[0];
      if (!current) throw notFound('Dashboard component');
      if (patch.config) await this.validateComponent(tx, p, workspaceId, current.type, patch.config);
      await tx.query('UPDATE dashboard_components SET title=COALESCE($1,title), sort_order=COALESCE($2,sort_order), config=COALESCE($3,config) WHERE id=$4',
        [patch.title ?? null, patch.sortOrder ?? null, patch.config ? JSON.stringify(patch.config) : null, componentId]);
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'DASHBOARD_COMPONENT_UPDATED', workspaceId, componentId);
    });
  }
  async deleteComponent(p: Principal, workspaceId: string, componentId: string) {
    return this.db.tx(async (tx) => {
      const result = await tx.query('DELETE FROM dashboard_components WHERE id=$1 AND workspace_id=$2', [componentId, workspaceId]);
      if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'Dashboard component not found.');
      await this.touch(tx, workspaceId); await this.audit(tx, p, 'DASHBOARD_COMPONENT_DELETED', workspaceId, componentId);
    });
  }
}
