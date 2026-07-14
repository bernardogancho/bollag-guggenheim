import React from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { ChangesTray } from './ChangesTray.jsx';

export function Topbar() {
  const { store, signOut } = useAdmin();
  useStoreVersion(store);
  const dirtyCount = store.dirtyPaths().length;

  return (
    <header className="topbar">
      <div className="topbar-left" id="topbar-search-slot" />
      <div className="topbar-right">
        <span className={`badge ${dirtyCount ? 'badge-warning' : 'badge-neutral'}`}>
          {dirtyCount ? `Saved — not published yet` : 'All changes published'}
        </span>
        <ChangesTray />
        <button type="button" className="button button-ghost" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}
