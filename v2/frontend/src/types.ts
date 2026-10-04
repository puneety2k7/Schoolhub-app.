import type { FieldType, FieldOption, OperationalTabKey, RecordState, StandardOperation } from '@shared/index';

export type Field = {
  id: string; key: string; label: string; type: FieldType; required: boolean; readOnly: boolean; visible: boolean; searchable: boolean;
  filterable: boolean; printVisible: boolean; helpText: string; defaultValue: unknown; options: FieldOption[]; referenceWorkspaceId: string | null; tabKey: OperationalTabKey;
};
export type Section = { id: string; name: string; description: string; fields: Field[] };
export type FormDef = { id: string; name: string; layout: { sections: { title: string; fieldKeys: string[] }[] } };
export type RuntimeTab = {
  key: OperationalTabKey; label: string; visible: boolean; sections: Section[]; form: FormDef | null;
  permissions: { view: boolean; add: boolean; edit: boolean; delete: boolean; print: boolean };
  actions: { operation: StandardOperation; label: string }[];
};
export type Runtime = {
  workspace: { id: string; key: string; name: string; pluralName: string; description: string; category: string; icon: string; displayFieldKey: string | null; printTitle: string };
  administrator: boolean; dashboard: { visible: boolean }; special: Record<string, boolean>; tabs: RuntimeTab[];
};
export type RecordItem = { id: string; tabKey: OperationalTabKey; state: RecordState; version: number; values: Record<string, unknown>; ownerUserId: string; createdAt: string; updatedAt: string };
export type NavItem = { id: string; key: string; name: string; pluralName: string; category: string; icon: string };
