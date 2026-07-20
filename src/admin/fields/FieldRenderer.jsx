import React from 'react';
import { navigate } from '../lib/router.js';
import { itemImage, itemTitle } from '../lib/summarize.js';
import { TextField, TextareaField, SelectField, BooleanField } from './basics.jsx';
import { InlineListField } from './InlineListField.jsx';
import { ImageField } from './ImageField.jsx';

// pathPrefix: dot path of this field from the FILE ROOT (e.g. 'groups' or 'brands.2.detail.gallery').
// routeBase: [pageId, sectionId] used to build managed-list routes.
export function FieldRenderer({ field, value, onChange, pathPrefix, routeBase, hidePaths }) {
  const widget = field.widget || 'string';

  if (widget === 'object') {
    // hidePaths lets a section suppress a field that its shared config includes
    // but that does nothing for this particular section (e.g. the Editorial
    // Selection eyebrow, which the homepage hides but the Company page shows).
    const children = (field.fields || []).filter(
      child => !hidePaths?.has(`${pathPrefix}.${child.name}`),
    );
    return (
      <section className="group-card">
        <h3 className="group-card-title">{field.label || field.name}</h3>
        {field.description ? <div className="field-help">{field.description}</div> : null}
        <div className="field-grid">
          {children.map(child => (
            <FieldRenderer
              key={child.name}
              field={child}
              value={value?.[child.name]}
              onChange={next => onChange({ ...(value || {}), [child.name]: next })}
              pathPrefix={`${pathPrefix}.${child.name}`}
              routeBase={routeBase}
              hidePaths={hidePaths}
            />
          ))}
        </div>
      </section>
    );
  }

  if (widget === 'list' && field.fields) {
    const items = Array.isArray(value) ? value : [];
    const thumbs = items.map(itemImage).filter(Boolean).slice(0, 5);
    return (
      <div className="field">
        <span className="field-label">{field.label || field.name}</span>
        {field.description ? <div className="field-help">{field.description}</div> : null}
        <div className="managed-list">
          <div>
            <div className="managed-list-thumbs">
              {thumbs.map(src => <img key={src} src={src} alt="" />)}
            </div>
            <div className="field-help" style={{ marginTop: thumbs.length ? 6 : 0 }}>
              {items.length ? `${items.length} item${items.length === 1 ? '' : 's'} — ${items.slice(0, 3).map(itemTitle).join(', ')}${items.length > 3 ? '…' : ''}` : 'No items yet.'}
            </div>
          </div>
          <button type="button" className="button button-secondary" onClick={() => navigate('page', routeBase[0], routeBase[1], 'list', pathPrefix)}>
            Manage items
          </button>
        </div>
      </div>
    );
  }

  if (widget === 'list') {
    return <InlineListField field={field} value={value} onChange={onChange} />;
  }

  if (widget === 'image' || widget === 'file') {
    // inheritedSrc/inheritedNote let an optional image field show the picture
    // the page actually falls back to, instead of an empty dropzone.
    return (
      <ImageField
        field={field}
        value={value}
        onChange={onChange}
        kind={widget}
        inheritedSrc={field.inheritedSrc}
        inheritedNote={field.inheritedNote}
      />
    );
  }
  if (widget === 'select') {
    return <SelectField field={field} value={value} onChange={onChange} />;
  }
  if (widget === 'text') {
    return <TextareaField field={field} value={value} onChange={onChange} />;
  }
  if (widget === 'boolean') {
    return <BooleanField field={field} value={value} onChange={onChange} />;
  }
  return <TextField field={field} value={value} onChange={onChange} />;
}
