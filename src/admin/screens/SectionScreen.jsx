import React from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { useToast } from '../shell/Toasts.jsx';
import { FieldRenderer } from '../fields/FieldRenderer.jsx';
import { pruneEmptyAdditions } from '../lib/prune.js';
import { ItemListScreen } from './ItemListScreen.jsx';
import { ItemEditScreen } from './ItemEditScreen.jsx';
import { WearhouseScreen } from './WearhouseScreen.jsx';

export function Breadcrumbs({ parts }) {
  return (
    <nav className="breadcrumbs">
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <span className="breadcrumbs-sep">/</span> : null}
          {part.to ? <button type="button" className="breadcrumbs-link" onClick={() => navigate(...part.to)}>{part.label}</button> : <span>{part.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function SectionScreen({ page, section, rest }) {
  const { store, fieldConfig } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();

  if (section.joined) {
    return <WearhouseScreen page={page} section={section} rest={rest} />;
  }

  // Managed-list subroutes: [.., 'list', <listPath>] and [.., 'list', <listPath>, <index>]
  if (rest[0] === 'list' && rest.length >= 2) {
    const listPath = rest[1];
    if (rest.length >= 3) {
      return <ItemEditScreen page={page} section={section} listPath={listPath} index={Number(rest[2])} />;
    }
    return <ItemListScreen page={page} section={section} listPath={listPath} />;
  }

  const entry = fieldConfig.get(section.file);
  const draft = store.getDraft(section.file);
  if (!entry || !draft) {
    return <div className="skeleton" style={{ minHeight: 220 }} />;
  }
  const fields = entry.fields.filter(field => section.keys.includes(field.name));
  const dirty = section.keys.some(key => store.isKeyDirty(section.file, key));

  return (
    <div>
      <Breadcrumbs parts={[{ label: page.label, to: ['page', page.id] }, { label: section.label }]} />
      <div className="screen-header">
        <div>
          <h2 className="screen-title">{section.label}</h2>
          <p className="screen-subtitle">{section.hint || `Part of the ${page.label} page.`}</p>
        </div>
        <div className="screen-actions">
          <a className="button button-ghost" href={page.url} target="_blank" rel="noreferrer">View page ↗</a>
          <button
            type="button" className="button button-secondary" disabled={!dirty}
            onClick={() => {
              if (window.confirm('Discard your unpublished edits to this section and restore the published version?')) {
                store.discardKeys(section.file, section.keys);
                toast('Section restored to the published version.');
              }
            }}
          >
            Discard changes
          </button>
        </div>
      </div>

      <div className="field-grid">
        {fields.map(field => (
          <FieldRenderer
            key={field.name}
            field={field}
            value={draft[field.name]}
            onChange={next => store.update(section.file, draftCopy => { draftCopy[field.name] = pruneEmptyAdditions(next, store.getRemote(section.file)?.[field.name]); })}
            pathPrefix={field.name}
            routeBase={[page.id, section.id]}
          />
        ))}
      </div>
    </div>
  );
}
