import React from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { ChangesTray } from './ChangesTray.jsx';
import { Search } from './Search.jsx';

export function Topbar() {
  const { store, signOut } = useAdmin();
  useStoreVersion(store);
  const dirtyCount = store.dirtyPaths().length;

  return (
    <header className="topbar">
      <div className="topbar-left"><Search /></div>
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
