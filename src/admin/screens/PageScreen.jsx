import React from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { summarize } from '../lib/summarize.js';

export function PageScreen({ page }) {
  const { store } = useAdmin();
  useStoreVersion(store);

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">{page.label}</h2>
          <p className="screen-subtitle">The sections below appear on the page in this order.</p>
        </div>
        <div className="screen-actions">
          <a className="button button-secondary" href={page.url} target="_blank" rel="noreferrer">View page ↗</a>
        </div>
      </div>

      <div className="section-rows">
        {page.sections.map(section => {
          const dirty = section.joined
            ? section.files.some(filePath => store.isDirty(filePath))
            : section.keys.some(key => store.isKeyDirty(section.file, key));
          const preview = section.joined
            ? `${(store.getDraft(section.files[0])?.rosterSection?.items || []).length} brands`
            : summarize(store.getDraft(section.file)?.[section.keys[0]]);
          return (
            <button key={section.id} type="button" className="section-row" onClick={() => navigate('page', page.id, section.id)}>
              <span className="section-row-main">
                <span className="section-row-title">
                  {section.label}
                  <span className={`dirty-dot ${dirty ? 'is-dirty' : ''}`} />
                </span>
                <span className="section-row-summary">{section.hint || preview}</span>
              </span>
              <span className="section-row-meta">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
