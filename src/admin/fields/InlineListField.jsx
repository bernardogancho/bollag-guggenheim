import React from 'react';
import { reorder } from '../lib/paths.js';
import { FieldShell } from './basics.jsx';

export function InlineListField({ field, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const isTextarea = field?.field?.widget === 'text';
  const setItem = (index, next) => {
    const copy = items.slice();
    copy[index] = next;
    onChange(copy);
  };

  return (
    <FieldShell field={field}>
      <div className="inline-list">
        {items.map((item, index) => (
          <div className="inline-list-row" key={index}>
            {isTextarea ? (
              <textarea className="textarea" rows={3} value={item ?? ''} onChange={event => setItem(index, event.target.value)} />
            ) : (
              <input className="input" value={item ?? ''} onChange={event => setItem(index, event.target.value)} />
            )}
            <div className="inline-list-actions">
              <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => onChange(reorder(items, index, index - 1))}>↑</button>
              <button type="button" className="icon-button" title="Move down" disabled={index === items.length - 1} onClick={() => onChange(reorder(items, index, index + 1))}>↓</button>
              <button type="button" className="icon-button" title="Remove" onClick={() => onChange(items.filter((_, i) => i !== index))}>✕</button>
            </div>
          </div>
        ))}
        <button type="button" className="button button-secondary" onClick={() => onChange([...items, ''])}>Add line</button>
      </div>
    </FieldShell>
  );
}
