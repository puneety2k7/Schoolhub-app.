export const FIELD_TYPES = ['text', 'long_text', 'integer', 'decimal', 'boolean', 'date', 'select', 'reference'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const FIELD_TYPE_LABELS: Readonly<Record<FieldType, string>> = {
  text: 'Text', long_text: 'Long text', integer: 'Whole number', decimal: 'Decimal number', boolean: 'Yes / No', date: 'Date', select: 'Choice list', reference: 'Reference to another workspace record',
};
export type FieldOption = { value: string; label: string };
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,59}$/;
export const WORKSPACE_KEY_PATTERN = /^[a-z][a-z0-9-]{1,59}$/;
