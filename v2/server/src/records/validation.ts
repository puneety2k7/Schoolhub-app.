import type { OperationalTabKey } from '../../../shared/src/index.js';
import type { Db } from '../db/database.js';
import { AppError } from '../http/errors.js';
import { tabFields, type FieldDefinition, type WorkspaceDefinition } from '../workspaces/definition.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (field: FieldDefinition, message: string) => new AppError(422, 'FIELD_INVALID', `${field.label}: ${message}`, { fieldKey: field.key });
const isEmpty = (value: unknown) => value === undefined || value === null || value === '';

/** Coerces and validates one value against its field definition. Returns null for an empty value. */
function coerce(field: FieldDefinition, raw: unknown): unknown {
  if (isEmpty(raw)) return null;
  switch (field.type) {
    case 'text': case 'long_text': {
      if (typeof raw !== 'string') throw invalid(field, 'must be text.');
      const text = raw.trim(), max = field.type === 'text' ? 2000 : 20000;
      if (text.length > max) throw invalid(field, `must be at most ${max} characters.`);
      return text === '' ? null : text;
    }
    case 'integer': {
      const number = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (!Number.isInteger(number)) throw invalid(field, 'must be a whole number.');
      return number;
    }
    case 'decimal': {
      const number = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (!Number.isFinite(number)) throw invalid(field, 'must be a number.');
      return number;
    }
    case 'boolean':
      if (typeof raw !== 'boolean') throw invalid(field, 'must be Yes or No.');
      return raw;
    case 'date': {
      if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw + 'T00:00:00Z')) || new Date(raw + 'T00:00:00Z').toISOString().slice(0, 10) !== raw) throw invalid(field, 'must be a valid date (YYYY-MM-DD).');
      return raw;
    }
    case 'select':
      if (typeof raw !== 'string' || !field.options.some((option) => option.value === raw)) throw invalid(field, 'must be one of the listed choices.');
      return raw;
    case 'reference':
      if (typeof raw !== 'string' || !UUID.test(raw)) throw invalid(field, 'must reference a record.');
      return raw.toLowerCase();
  }
}

export type ValidatedValues = { values: Record<string, unknown>; references: { fieldKey: string; targetId: string }[] };

/**
 * The universal field engine's server side. For `create` defaults are applied; read-only and hidden fields can never be written
 * by a user. For `update`, the existing values are the base and only supplied writable fields change.
 */
export async function validateValues(
  tx: Db, definition: WorkspaceDefinition, tab: OperationalTabKey, input: Record<string, unknown>, mode: 'create' | 'update',
  existing: Record<string, unknown>, assertReferenceAllowed: (field: FieldDefinition, targetId: string) => Promise<void>,
): Promise<ValidatedValues> {
  const fields = tabFields(definition, tab), byKey = new Map(fields.map((field) => [field.key, field]));
  for (const key of Object.keys(input)) {
    const field = byKey.get(key);
    if (!field) throw new AppError(422, 'FIELD_NOT_IN_TAB', `"${key}" is not a field of this tab.`, { fieldKey: key });
    if (field.readOnly || !field.visible) throw new AppError(422, 'FIELD_NOT_WRITABLE', `${field.label} cannot be edited.`, { fieldKey: key });
  }
  const values: Record<string, unknown> = mode === 'update' ? { ...existing } : {};
  const references: ValidatedValues['references'] = [];
  for (const field of fields) {
    const supplied = Object.prototype.hasOwnProperty.call(input, field.key);
    if (supplied) values[field.key] = coerce(field, input[field.key]);
    else if (mode === 'create' && field.defaultValue !== null && field.defaultValue !== undefined) values[field.key] = coerce(field, field.defaultValue);
    if (field.required && isEmpty(values[field.key])) throw new AppError(422, 'FIELD_REQUIRED', `${field.label} is required.`, { fieldKey: field.key });
    if (isEmpty(values[field.key])) delete values[field.key];
    if (field.type === 'reference' && !isEmpty(values[field.key])) {
      const targetId = values[field.key] as string;
      const target = await tx.query('SELECT 1 FROM records WHERE id=$1 AND school_id=$2 AND workspace_id=$3 AND tab_key=\'MAIN\' AND state=\'Active\'', [targetId, definition.schoolId, field.referenceWorkspaceId]);
      if (!target.rowCount) throw invalid(field, 'must reference an existing, active record.');
      if (supplied) await assertReferenceAllowed(field, targetId);
      references.push({ fieldKey: field.key, targetId });
    }
  }
  return { values, references };
}
