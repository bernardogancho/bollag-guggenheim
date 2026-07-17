import React, { useEffect } from 'react';
import { PAGES, findPage, findSection } from '../manifest.js';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { useRoute, navigate } from '../lib/router.js';
import { ToastProvider } from './Toasts.jsx';
import { Topbar } from './Topbar.jsx';
import { PageScreen } from '../screens/PageScreen.jsx';
import { SectionScreen } from '../screens/SectionScreen.jsx';
import { MediaScreen } from '../screens/MediaScreen.jsx';
import { PeopleScreen } from '../screens/PeopleScreen.jsx';

function sectionDirty(store, section) {
  if (section.joined) {
    return section.files.some(filePath => store.isDirty(filePath));
  }
  return section.keys.some(key => store.isKeyDirty(section.file, key));
}

function pageDirty(store, page) {
  return page.sections.some(section => sectionDirty(store, section));
}

// A page's row, plus — only when it's the active page — an indented,
// clickable sub-list of its sections with the current one highlighted.
// This is the "where am I" fix: the hierarchy (page → its sections) and the
// current location are both visible in the same glance, instead of a flat
// list of page names with no sense of what's inside the open page.
function PageNavItem({ page, activePage, activeSection, store }) {
  const isActivePage = activePage === page.id;
  return (
    <div className="sidebar-nav-group">
      <button
        type="button"
        className={`sidebar-nav-item ${isActivePage ? 'is-active' : ''}`}
        onClick={() => navigate('page', page.id)}
      >
        <span className="sidebar-nav-label">{page.label}</span>
        <span className={`dirty-dot ${pageDirty(store, page) ? 'is-dirty' : ''}`} />
      </button>
      {isActivePage ? (
        <ul className="sidebar-subnav">
          {page.sections.map(section => (
            <li key={section.id}>
              <button
                type="button"
                className={`sidebar-subnav-item ${activeSection === section.id ? 'is-active' : ''}`}
                onClick={() => navigate('page', page.id, section.id)}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Sidebar({ route }) {
  const { user, store } = useAdmin();
  useStoreVersion(store);
  const activePage = route[0] === 'page' ? route[1] : route[0];
  // Route shape is ['page', pageId, sectionId, ...rest] — the section id sits
  // at index 2 regardless of how deep a sub-route goes (list/item editors),
  // so this stays correct while editing an item inside a section too.
  const activeSection = route[0] === 'page' ? route[2] : null;

  const pagesGroup = PAGES.filter(page => page.group === 'pages');
  const siteGroup = PAGES.filter(page => page.group === 'site');

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
        <div className="sidebar-group-heading">Pages</div>
        {pagesGroup.map(page => (
          <PageNavItem key={page.id} page={page} activePage={activePage} activeSection={activeSection} store={store} />
        ))}

        <div className="sidebar-group-heading">Site-wide</div>
        {siteGroup.map(page => (
          <PageNavItem key={page.id} page={page} activePage={activePage} activeSection={activeSection} store={store} />
        ))}

        <div className="sidebar-group-heading">Library</div>
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
      <div className="empty-state-description">This link points at a page or section that no longer exists. Pick a page from the left.</div>
    </div>
  );
}

function Content({ route }) {
  const { user } = useAdmin();
  useEffect(() => {
    if (route.length === 0) {
      navigate('page', 'homepage');
    }
  }, [route]);

  if (route.length === 0) {
    return null;
  }
  if (route[0] === 'media') {
    return <MediaScreen />;
  }
  if (route[0] === 'people') {
    return user?.role === 'admin' ? <PeopleScreen /> : <NotFound />;
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
