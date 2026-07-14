import React from 'react';

export function FieldShell({ field, children }) {
  return (
    <div className="field">
      <span className="field-label">{field.label || field.name}</span>
      {field.description ? <div className="field-help">{field.description}</div> : null}
      {children}
    </div>
  );
}

export function TextField({ field, value, onChange }) {
  const isNumber = field.widget === 'number';
  return (
    <FieldShell field={field}>
      <input
        className="input" type={isNumber ? 'number' : 'text'} value={value ?? ''}
        onChange={event => onChange(isNumber ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)}
      />
    </FieldShell>
  );
}

export function TextareaField({ field, value, onChange }) {
  return (
    <FieldShell field={field}>
      <textarea className="textarea" rows={4} value={value || ''} onChange={event => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function SelectField({ field, value, onChange }) {
  const options = (field.options || []).map(option => (typeof option === 'object' && option !== null ? option : { label: String(option), value: option }));
  // An unset value renders an explicit "Choose…" placeholder instead of
  // silently displaying the first option (which would differ from the draft).
  return (
    <FieldShell field={field}>
      <select className="select" value={value ?? ''} onChange={event => onChange(event.target.value)}>
        {value === undefined || value === null || value === '' ? <option value="" disabled hidden>Choose…</option> : null}
        {options.map(option => (
          <option key={String(option.value)} value={option.value}>{option.label ?? option.value}</option>
        ))}
      </select>
    </FieldShell>
  );
}

export function BooleanField({ field, value, onChange }) {
  return (
    <label className="field field-check">
      <input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} />
      <span>
        <span className="field-label">{field.label || field.name}</span>
        {field.description ? <span className="field-help">{field.description}</span> : null}
      </span>
    </label>
  );
}
