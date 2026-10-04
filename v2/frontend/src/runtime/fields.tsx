import type { Field, Section, FormDef } from '../types';

export type Values = Record<string, unknown>;
export type RefOptions = Record<string, { id: string; label: string }[]>;

export function displayValue(field: Field, value: unknown, refLabels: Record<string, string> = {}): string {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'select') return field.options.find((option) => option.value === value)?.label ?? String(value);
  if (field.type === 'reference') return refLabels[String(value)] ?? '(record)';
  return String(value);
}

/** One universal input renderer for every field type. */
export function FieldInput({ field, value, onChange, refOptions }: { field: Field; value: unknown; onChange: (value: unknown) => void; refOptions: RefOptions }) {
  const id = `f_${field.key}`;
  const common = { id, required: field.required, 'aria-label': field.label };
  let control;
  switch (field.type) {
    case 'long_text': control = <textarea {...common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />; break;
    case 'integer': case 'decimal': control = <input {...common} type="number" step={field.type === 'integer' ? 1 : 'any'} value={value === null || value === undefined ? '' : String(value)} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />; break;
    case 'boolean': control = <label className="check"><input id={id} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /> Yes</label>; break;
    case 'date': control = <input {...common} type="date" value={String(value ?? '')} onChange={(event) => onChange(event.target.value || null)} />; break;
    case 'select': control = <select {...common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value || null)}><option value="">Select…</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>; break;
    case 'reference': control = <select {...common} value={String(value ?? '')} onChange={(event) => onChange(event.target.value || null)}><option value="">Select…</option>{(refOptions[field.key] ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>; break;
    default: control = <input {...common} type="text" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />;
  }
  return <div className="field"><label htmlFor={id}>{field.label}{field.required ? ' *' : ''}</label>{control}{field.helpText && <div className="muted small">{field.helpText}</div>}</div>;
}

/** Arranges a tab's fields: by the assigned Form's layout when there is one, otherwise by the configured sections. */
export function arrange(sections: Section[], form: FormDef | null): { title: string; fields: Field[] }[] {
  const all = sections.flatMap((section) => section.fields), byKey = new Map(all.map((field) => [field.key, field]));
  if (!form) return sections.map((section) => ({ title: section.name, fields: section.fields })).filter((group) => group.fields.length);
  return form.layout.sections.map((section) => ({ title: section.title, fields: section.fieldKeys.map((key) => byKey.get(key)).filter((field): field is Field => !!field) })).filter((group) => group.fields.length);
}
