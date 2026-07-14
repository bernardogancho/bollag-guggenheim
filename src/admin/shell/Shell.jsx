import React, { useEffect } from 'react';
import { PAGES, findPage, findSection } from '../manifest.js';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { useRoute, navigate } from '../lib/router.js';
import { ToastProvider } from './Toasts.jsx';
import { Topbar } from './Topbar.jsx';
import { PageScreen } from '../screens/PageScreen.jsx';
import { SectionScreen } from '../screens/SectionScreen.jsx';

function sectionDirty(store, section) {
  if (section.joined) {
    return section.files.some(filePath => store.isDirty(filePath));
  }
  return section.keys.some(key => store.isKeyDirty(section.file, key));
}

function pageDirty(store, page) {
  return page.sections.some(section => sectionDirty(store, section));
}

function Sidebar({ route }) {
  const { user, store } = useAdmin();
  useStoreVersion(store);
  const activePage = route[0] === 'page' ? route[1] : route[0];

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div>
          <div className="sidebar-kicker">Bollag CMS</div>
          <h1 className="sidebar-title">Website</h1>
          <div className="sidebar-user">{user?.email}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {PAGES.map(page => (
          <button
            key={page.id} type="button"
            className={`sidebar-nav-item ${activePage === page.id ? 'is-active' : ''}`}
            onClick={() => navigate('page', page.id)}
          >
            <span className="sidebar-nav-label">{page.label}</span>
            <span className={`dirty-dot ${pageDirty(store, page) ? 'is-dirty' : ''}`} />
          </button>
        ))}
        <div className="sidebar-divider" />
        <button type="button" className={`sidebar-nav-item ${activePage === 'media' ? 'is-active' : ''}`} onClick={() => navigate('media')}>
          <span className="sidebar-nav-label">Media</span>
        </button>
        {user?.role === 'admin' ? (
          <button type="button" className={`sidebar-nav-item ${activePage === 'people' ? 'is-active' : ''}`} onClick={() => navigate('people')}>
            <span className="sidebar-nav-label">People</span>
          </button>
        ) : null}
      </nav>
    </aside>
  );
}

function NotFound() {
  return (
    <div className="empty-state">
      <div className="empty-state-title">Nothing here</div>
      <div className="empty-state-description">This link points at a section that no longer exists. Pick a page from the left.</div>
    </div>
  );
}

function Content({ route }) {
  useEffect(() => {
    if (route.length === 0) {
      navigate('page', 'homepage');
    }
  }, [route]);

  if (route.length === 0) {
    return null;
  }
  if (route[0] === 'media') {
    return <div className="empty-state"><div className="empty-state-title">Media library</div><div className="empty-state-description">Arrives in a later task.</div></div>;
  }
  if (route[0] === 'people') {
    return <div className="empty-state"><div className="empty-state-title">People</div><div className="empty-state-description">Arrives in a later task.</div></div>;
  }
  if (route[0] === 'page') {
    const page = findPage(route[1]);
    if (!page) {
      return <NotFound />;
    }
    if (route.length === 2) {
      return <PageScreen page={page} />;
    }
    const section = findSection(route[1], route[2]);
    if (!section) {
      return <NotFound />;
    }
    return <SectionScreen page={page} section={section} rest={route.slice(3)} />;
  }
  return <NotFound />;
}

export function Shell() {
  const route = useRoute();
  return (
    <ToastProvider>
      <div className="admin-shell">
        <Sidebar route={route} />
        <main className="workspace">
          <Topbar />
          <div className="workspace-body">
            <Content route={route} />
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
