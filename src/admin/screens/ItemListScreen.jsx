import React from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { getAtPath, setAtPath, reorder, deepClone } from '../lib/paths.js';
import { resolveListField, defaultValueForFields } from '../lib/configPath.js';
import { itemTitle, itemImage } from '../lib/summarize.js';
import { useToast } from '../shell/Toasts.jsx';
import { Breadcrumbs } from './SectionScreen.jsx';

export function ItemListScreen({ page, section, listPath }) {
  const { store, fieldConfig } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();

  const entry = fieldConfig.get(section.file);
  const listField = entry ? resolveListField(entry.fields, listPath) : null;
  const draft = store.getDraft(section.file);
  if (!listField || !draft) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Nothing here</div>
        <div className="empty-state-description">This list no longer exists. Go back to the section.</div>
      </div>
    );
  }

  const items = getAtPath(draft, listPath) || [];
  const setItems = next => store.update(section.file, draftCopy => setAtPath(draftCopy, listPath, next));

  const addItem = () => {
    const blank = defaultValueForFields(listField.fields);
    setItems([...items, blank]);
    navigate('page', page.id, section.id, 'list', listPath, String(items.length));
  };

  return (
    <div>
      <Breadcrumbs parts={[
        { label: page.label, to: ['page', page.id] },
        { label: section.label, to: ['page', page.id, section.id] },
        { label: listField.label || listField.name },
      ]} />
      <div className="screen-header">
        <div>
          <h2 className="screen-title">{listField.label || listField.name}</h2>
          <p className="screen-subtitle">{items.length} item{items.length === 1 ? '' : 's'}. Click one to edit it.</p>
        </div>
        <div className="screen-actions">
          <button type="button" className="button button-primary" onClick={addItem}>Add item</button>
        </div>
      </div>

      {items.length ? (
        <div className="item-grid">
          {items.map((item, index) => {
            const thumb = itemImage(item);
            return (
              <div key={index} className="item-card" role="button" tabIndex={0}
                onClick={() => navigate('page', page.id, section.id, 'list', listPath, String(index))}
                onKeyDown={event => { if (event.key === 'Enter') navigate('page', page.id, section.id, 'list', listPath, String(index)); }}>
                <div className="item-card-thumb">
                  {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="item-card-thumb-empty">No image</span>}
                </div>
                <div className="item-card-body">
                  <div className="item-card-title">{itemTitle(item)}</div>
                  <div className="item-card-subtitle">Item {index + 1} of {items.length}</div>
                </div>
                <div className="item-card-flags" onClick={event => event.stopPropagation()}>
                  <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => setItems(reorder(items, index, index - 1))}>↑</button>
                  <button type="button" className="icon-button" title="Move down" disabled={index === items.length - 1} onClick={() => setItems(reorder(items, index, index + 1))}>↓</button>
                  <button type="button" className="icon-button" title="Duplicate" onClick={() => { const copy = items.slice(); copy.splice(index + 1, 0, deepClone(items[index])); setItems(copy); toast('Item duplicated.'); }}>⧉</button>
                  <button type="button" className="icon-button" title="Delete" onClick={() => {
                    if (window.confirm(`Delete “${itemTitle(item)}”? This is removed from the website on your next publish.`)) {
                      setItems(items.filter((_, i) => i !== index));
                      toast('Item deleted.');
                    }
                  }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-title">No items yet</div>
          <div className="empty-state-description">Use “Add item” to create the first one.</div>
        </div>
      )}
    </div>
  );
}
