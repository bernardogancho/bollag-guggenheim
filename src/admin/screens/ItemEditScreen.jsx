import React from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { getAtPath, setAtPath } from '../lib/paths.js';
import { resolveListField } from '../lib/configPath.js';
import { pruneEmptyAdditions } from '../lib/prune.js';
import { itemTitle } from '../lib/summarize.js';
import { FieldRenderer } from '../fields/FieldRenderer.jsx';
import { Breadcrumbs } from './SectionScreen.jsx';
import { useToast } from '../shell/Toasts.jsx';

export function ItemEditScreen({ page, section, listPath, index }) {
  const { store, fieldConfig } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();

  const entry = fieldConfig.get(section.file);
  const listField = entry ? resolveListField(entry.fields, listPath) : null;
  const draft = store.getDraft(section.file);
  const items = listField && draft ? getAtPath(draft, listPath) || [] : [];
  const item = items[index];

  if (!listField || !item) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Item not found</div>
        <div className="empty-state-description">It may have been deleted. Go back to the list.</div>
      </div>
    );
  }

  const listRoute = ['page', page.id, section.id, 'list', listPath];

  return (
    <div>
      <Breadcrumbs parts={[
        { label: page.label, to: ['page', page.id] },
        { label: section.label, to: ['page', page.id, section.id] },
        { label: listField.label || listField.name, to: listRoute },
        { label: itemTitle(item) },
      ]} />
      <div className="screen-header">
        <div>
          <h2 className="screen-title">{itemTitle(item)}</h2>
          <p className="screen-subtitle">Item {index + 1} of {items.length} in {listField.label || listField.name}.</p>
        </div>
        <div className="screen-actions">
          <button type="button" className="button button-danger" onClick={() => {
            if (window.confirm(`Delete “${itemTitle(item)}”? This is removed from the website on your next publish.`)) {
              store.update(section.file, draftCopy => setAtPath(draftCopy, listPath, items.filter((_, i) => i !== index)));
              toast('Item deleted.');
              navigate(...listRoute);
            }
          }}>Delete item</button>
        </div>
      </div>

      <div className="field-grid">
        {listField.fields.map(child => (
          <FieldRenderer
            key={child.name}
            field={child}
            value={item[child.name]}
            onChange={next => {
              const childPath = `${listPath}.${index}.${child.name}`;
              const pruned = pruneEmptyAdditions(next, getAtPath(store.getRemote(section.file), childPath));
              store.update(section.file, draftCopy => setAtPath(draftCopy, childPath, pruned));
            }}
            pathPrefix={`${listPath}.${index}.${child.name}`}
            routeBase={[page.id, section.id]}
          />
        ))}
      </div>
    </div>
  );
}
