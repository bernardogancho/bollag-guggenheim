# CMS v2 Phase 1 — Site-Mirror Admin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the `/admin` CMS front end into a site-mirror admin: navigation by website page, de-nested master-detail editors, media library, changes tray with validation, toasts/guards/search, and admin bundle cache-busting — with zero backend, auth, or content-model changes.

**Architecture:** The 2,292-line `src/admin/app.jsx` monolith is replaced by ~20 focused modules under `src/admin/`. A new `manifest.js` maps the website's pages → sections onto the existing `config.yml` field definitions and the 22 JSON files in `src/_data/cms/` (unchanged). Drafts stay in localStorage; publishing still POSTs whole files to `/api/publish`. A tiny hash router; no new runtime deps except `vitest` (dev).

**Tech Stack:** React 19 (already a dep), esbuild bundling (existing scripts), Eleventy 3 (site + new media-index emitter), Supabase JS (existing auth), `yaml` (existing dep), vitest (new devDep, logic tests only).

**Spec:** `docs/superpowers/specs/2026-07-14-cms-v2-site-mirror-admin-design.md`

**Ground rules for every task:**
- Work on branch `cms-v2` (created in Task 0). NEVER push to `main` during this plan; the live CMS commits content to `main` continuously.
- Backend (`api/**`) and auth are untouchable. Content JSON shape is untouchable (except the Task 8 legacy deletion).
- After each task: `npm run build` must pass (Eleventy + esbuild + Tailwind) and `npm test` must pass.
- Commit at the end of every task with the given message.

**Current-state facts you need (verified):**
- Entry today: `src/admin/app.jsx` (self-mounts React on `#admin-root`), bundled by `npm run build:admin` → `_site/admin/app.js` (+`app.css` from its `import './admin.css'`).
- `src/admin/index.html` is processed by Eleventy (njk template engine for `.html`) → `_site/admin/index.html`.
- `src/admin/config.yml` (Decap-style) holds all field definitions: 8 collections, 22 `file:` entries. Served at `/admin/config.yml` (passthrough). The admin fetches and parses it with `yaml` at runtime.
- Content served to admin at `/cms-data/**` (passthrough of `src/_data/cms`).
- API: `/api/me` (session→role), `/api/admin/users` (People CRUD), `/api/publish`, `/api/upload`, `/api/revert`, `/api/deploys`. All take `Authorization: Bearer <supabase access token>`.
- Existing draft mechanism: localStorage keys `bg-cms-draft:<file-path>`; publish sends `{message, files:[{path, content}]}`.
- Top-level keys per JSON file (exact, verified):
  - `site.json`: `nav,footer` · `company.json`: `hero,intro,history,distribution` · `contact.json`: `hero,officeSection,office,wearhousePartner,form,cta` · `stores.json`: `hero,heroStats,networkSection,groups,online` · `agenda.json`: `hero,calendarSection,cta,months`
  - `home/`: `hero.json→hero`, `intro.json→intro`, `brandsWall.json→brandsWall`, `wearhouseWall.json→wearhouseWall`, `selectionSection.json→selection`
  - `brandsPage/`: `hero.json→hero`, `portfolio.json→portfolioSection`, `detail.json→detailPage`, `brands.json→brands`
  - `wearhousePage/`: `hero.json→hero`, `overview.json→overview`, `roster.json→rosterSection`, `showroom.json→showroomSection`, `cta.json→cta`, `detail.json→detailPage`, `contact.json→contact`, `brands.json→brands`
- Legacy dead data (verified unreferenced anywhere): `src/_data/cms/home/selectionCards/` (20 files), `src/_data/cms/wearhousePage/showroomGalleryItems/` (15 files).
- `src/admin/admin.css` defines the design system (Google-style tokens). Existing classes to reuse: `.admin-shell .sidebar .workspace .card .button .button-primary/-secondary/-ghost/-danger .icon-button .input .textarea .select .field .field-label .field-help .badge .badge-*/ .empty-state .status-* .spinner .hidden-input .asset-dropzone .asset-card .asset-card-actions .asset-path-toggle .drag-handle .publish-modal* .access-* .file-row .collection-* .sidebar-nav-item .workspace-header .workspace-title .workspace-note`.

---

## Chunk 1: Foundations — tooling and core logic

### Task 0: Branch + vitest tooling

**Files:**
- Modify: `package.json` (add devDep + test script)
- Create: `vitest.config.js`
- Create: `src/admin/lib/__tests__/setup.js`

- [ ] **Step 1: Create the working branch**

```bash
cd /Users/bernardo/Desktop/bg
git checkout main && git pull --rebase origin main
git checkout -b cms-v2
```

- [ ] **Step 2: Install vitest and add scripts**

```bash
npm install -D vitest
```

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest config and localStorage stub**

`vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/admin/**/__tests__/**/*.test.js'],
    setupFiles: ['src/admin/lib/__tests__/setup.js'],
    passWithNoTests: true,
  },
});
```

`src/admin/lib/__tests__/setup.js` (localStorage stub so store tests run in node):

```js
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    clear: () => map.clear(),
  };
}
```

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: "No test files found" with exit code 0 (`passWithNoTests: true` is already in the config from Step 3).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/admin/lib/__tests__/setup.js
git commit -m "chore(cms-v2): add vitest tooling and cms-v2 branch scaffolding"
```

### Task 1: `lib/paths.js` — JSON path utilities

**Files:**
- Create: `src/admin/lib/paths.js`
- Test: `src/admin/lib/__tests__/paths.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { deepClone, getAtPath, setAtPath, reorder } from '../paths.js';

describe('paths', () => {
  it('deepClone produces an independent copy', () => {
    const a = { x: { y: [1, 2] } };
    const b = deepClone(a);
    b.x.y.push(3);
    expect(a.x.y).toEqual([1, 2]);
  });

  it('getAtPath resolves dotted paths with numeric indexes', () => {
    const obj = { groups: [{ stores: [{ name: 'Zurich' }] }] };
    expect(getAtPath(obj, 'groups.0.stores.0.name')).toBe('Zurich');
    expect(getAtPath(obj, 'groups.9.stores')).toBeUndefined();
    expect(getAtPath(obj, '')).toBe(obj);
  });

  it('setAtPath mutates the target at a dotted path', () => {
    const obj = { a: [{ b: 1 }] };
    setAtPath(obj, 'a.0.b', 2);
    expect(obj.a[0].b).toBe(2);
  });

  it('setAtPath creates missing intermediate objects', () => {
    const obj = {};
    setAtPath(obj, 'a.b', 5);
    expect(obj.a.b).toBe(5);
  });

  it('setAtPath creates arrays for numeric next segments', () => {
    const obj = {};
    setAtPath(obj, 'a.0.b', 2);
    expect(Array.isArray(obj.a)).toBe(true);
    expect(obj.a[0].b).toBe(2);
  });

  it('reorder moves an item and returns a new array', () => {
    const list = ['a', 'b', 'c'];
    expect(reorder(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — cannot resolve `../paths.js`.

- [ ] **Step 3: Implement `src/admin/lib/paths.js`**

```js
export function deepClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function getAtPath(obj, path) {
  if (!path) {
    return obj;
  }
  let current = obj;
  for (const key of String(path).split('.')) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

export function setAtPath(obj, path, value) {
  const keys = String(path).split('.');
  const last = keys.pop();
  let current = obj;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (current[key] === null || current[key] === undefined || typeof current[key] !== 'object') {
      // A missing intermediate's type is chosen by the NEXT segment (the one that
      // will index into it): numeric next segment → array, otherwise object.
      const nextKey = i + 1 < keys.length ? keys[i + 1] : last;
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key];
  }
  current[last] = value;
}

export function reorder(list, fromIndex, toIndex) {
  const next = list.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/admin/lib/paths.js src/admin/lib/__tests__/paths.test.js
git commit -m "feat(cms-v2): add JSON path utilities"
```

### Task 2: `manifest.js` — the site-mirror map (single most load-bearing file)

**Files:**
- Create: `src/admin/manifest.js`
- Test: `src/admin/__tests__/manifest.test.js`

A **section** is `{ id, label, hint, file, keys }` where `file` is the repo path of the JSON file and `keys` is the array of top-level keys the section edits. Sections appear in the order they appear on the real page. The special Wearhouse joined section carries `joined: true` and `files: [rosterFile, brandsFile]` instead of `file`/`keys`.

- [ ] **Step 1: Write failing tests** (`src/admin/__tests__/manifest.test.js`)

```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parse as parseYAML } from 'yaml';
import { PAGES, allSections, findSection, sectionsForFile, ALL_FILES } from '../manifest.js';

const config = parseYAML(fs.readFileSync('src/admin/config.yml', 'utf8'));
const configFiles = config.collections.flatMap(c => c.files.map(f => f.file));

describe('manifest integrity', () => {
  // Note: several sections share one file (e.g. company.json powers 4 sections),
  // so coverage is asserted on UNIQUE files, and sections sharing a file must
  // edit disjoint top-level keys.
  it('covers every config.yml file, with disjoint keys per shared file', () => {
    const covered = [];
    for (const section of allSections()) {
      if (section.joined) {
        covered.push(...section.files);
      } else {
        covered.push(section.file);
      }
    }
    expect([...new Set(covered)].sort()).toEqual([...new Set(configFiles)].sort());

    const keysByFile = new Map();
    for (const section of allSections()) {
      if (section.joined) {
        continue;
      }
      const seen = keysByFile.get(section.file) || new Set();
      for (const key of section.keys) {
        expect(seen.has(key), `${section.file} key "${key}" is claimed by two sections`).toBe(false);
        seen.add(key);
      }
      keysByFile.set(section.file, seen);
    }
  });

  it('every section key exists in the actual JSON data', () => {
    for (const section of allSections()) {
      if (section.joined) {
        continue;
      }
      const data = JSON.parse(fs.readFileSync(section.file, 'utf8'));
      for (const key of section.keys) {
        expect(data, `${section.file} missing key ${key}`).toHaveProperty(key);
      }
    }
  });

  it('every section id is unique within its page and every page id unique', () => {
    const pageIds = PAGES.map(p => p.id);
    expect(new Set(pageIds).size).toBe(pageIds.length);
    for (const page of PAGES) {
      const ids = page.sections.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('lookup helpers work', () => {
    expect(findSection('homepage', 'hero').label).toBe('Hero banner');
    expect(sectionsForFile('src/_data/cms/site.json').length).toBe(2);
    expect(ALL_FILES).toContain('src/_data/cms/agenda.json');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (no manifest.js).

- [ ] **Step 3: Implement `src/admin/manifest.js`** (complete file)

```js
// The site-mirror map: what editors see. Pages appear in website-nav order;
// each page's sections appear in on-page order with editor-facing names.
// `file` + `keys` address the existing JSON content; field definitions still
// come from config.yml. The Wearhouse brand roster spans two files and is
// handled by the wearhouse adapter.

const CMS = 'src/_data/cms';

export const PAGES = [
  {
    id: 'homepage', label: 'Homepage', url: '/',
    sections: [
      { id: 'hero', label: 'Hero banner', hint: 'Opening video, title and subline', file: `${CMS}/home/hero.json`, keys: ['hero'] },
      { id: 'intro', label: 'Introduction', hint: 'Eyebrow, title, summary and image', file: `${CMS}/home/intro.json`, keys: ['intro'] },
      { id: 'bollag-portfolio', label: 'Bollag portfolio', hint: 'Brand logo wall', file: `${CMS}/home/brandsWall.json`, keys: ['brandsWall'] },
      { id: 'wearhouse-portfolio', label: 'Wearhouse portfolio', hint: 'Wearhouse brand wall', file: `${CMS}/home/wearhouseWall.json`, keys: ['wearhouseWall'] },
      { id: 'editorial-selection', label: 'Editorial selection', hint: 'Curated image mosaic', file: `${CMS}/home/selectionSection.json`, keys: ['selection'] },
    ],
  },
  {
    id: 'company', label: 'Company', url: '/company/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/company.json`, keys: ['hero'] },
      { id: 'intro', label: 'Introduction', file: `${CMS}/company.json`, keys: ['intro'] },
      { id: 'history', label: 'History', file: `${CMS}/company.json`, keys: ['history'] },
      { id: 'distribution', label: 'Distribution', file: `${CMS}/company.json`, keys: ['distribution'] },
    ],
  },
  {
    id: 'brands', label: 'Brands', url: '/brands/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/brandsPage/hero.json`, keys: ['hero'] },
      { id: 'portfolio-heading', label: 'Portfolio heading', file: `${CMS}/brandsPage/portfolio.json`, keys: ['portfolioSection'] },
      { id: 'all-brands', label: 'All brands', hint: 'Every Bollag brand and its page', file: `${CMS}/brandsPage/brands.json`, keys: ['brands'] },
      { id: 'page-settings', label: 'Brand page settings', hint: 'Shared texts on brand detail pages', file: `${CMS}/brandsPage/detail.json`, keys: ['detailPage'] },
    ],
  },
  {
    id: 'wearhouse', label: 'The Wearhouse', url: '/wearhouse/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/wearhousePage/hero.json`, keys: ['hero'] },
      { id: 'overview', label: 'Overview', file: `${CMS}/wearhousePage/overview.json`, keys: ['overview'] },
      {
        id: 'wearhouse-brands', label: 'Wearhouse brands', hint: 'Roster cards and brand detail pages',
        joined: true,
        files: [`${CMS}/wearhousePage/roster.json`, `${CMS}/wearhousePage/brands.json`],
      },
      { id: 'showroom', label: 'Showroom', file: `${CMS}/wearhousePage/showroom.json`, keys: ['showroomSection'] },
      { id: 'cta', label: 'Call to action', file: `${CMS}/wearhousePage/cta.json`, keys: ['cta'] },
      { id: 'page-settings', label: 'Brand page settings', file: `${CMS}/wearhousePage/detail.json`, keys: ['detailPage'] },
      { id: 'contact', label: 'Contact block', file: `${CMS}/wearhousePage/contact.json`, keys: ['contact'] },
    ],
  },
  {
    id: 'stores', label: 'Stores', url: '/stores/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/stores.json`, keys: ['hero', 'heroStats'] },
      { id: 'network', label: 'Network introduction', file: `${CMS}/stores.json`, keys: ['networkSection'] },
      { id: 'store-list', label: 'Stores', hint: 'Store groups and their stores', file: `${CMS}/stores.json`, keys: ['groups'] },
      { id: 'online', label: 'Online shop', file: `${CMS}/stores.json`, keys: ['online'] },
    ],
  },
  {
    id: 'agenda', label: 'Agenda', url: '/agenda/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/agenda.json`, keys: ['hero'] },
      { id: 'calendar', label: 'Calendar introduction', file: `${CMS}/agenda.json`, keys: ['calendarSection'] },
      { id: 'months', label: 'Events by month', file: `${CMS}/agenda.json`, keys: ['months'] },
      { id: 'cta', label: 'Call to action', file: `${CMS}/agenda.json`, keys: ['cta'] },
    ],
  },
  {
    id: 'contact', label: 'Contact', url: '/contact/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/contact.json`, keys: ['hero'] },
      { id: 'offices-intro', label: 'Offices introduction', file: `${CMS}/contact.json`, keys: ['officeSection'] },
      { id: 'bollag-office', label: 'Bollag office', file: `${CMS}/contact.json`, keys: ['office'] },
      { id: 'wearhouse-partner', label: 'Wearhouse contact', file: `${CMS}/contact.json`, keys: ['wearhousePartner'] },
      { id: 'form', label: 'Contact form texts', file: `${CMS}/contact.json`, keys: ['form'] },
      { id: 'cta', label: 'Call to action', file: `${CMS}/contact.json`, keys: ['cta'] },
    ],
  },
  {
    id: 'site', label: 'Header & Footer', url: '/',
    sections: [
      { id: 'navigation', label: 'Navigation menu', file: `${CMS}/site.json`, keys: ['nav'] },
      { id: 'footer', label: 'Footer', file: `${CMS}/site.json`, keys: ['footer'] },
    ],
  },
];

export function allSections() {
  return PAGES.flatMap(page => page.sections.map(section => ({ ...section, pageId: page.id, pageLabel: page.label })));
}

export function findPage(pageId) {
  return PAGES.find(page => page.id === pageId) || null;
}

export function findSection(pageId, sectionId) {
  return findPage(pageId)?.sections.find(section => section.id === sectionId) || null;
}

export function sectionsForFile(filePath) {
  return allSections().filter(section => (section.joined ? section.files.includes(filePath) : section.file === filePath));
}

export const ALL_FILES = [...new Set(allSections().flatMap(section => (section.joined ? section.files : [section.file])))];
```

- [ ] **Step 4: Run tests** — `npm test` → PASS. (If the coverage test fails, first check the manifest against the "top-level keys per JSON file" table in the plan header — a typo in a `file` path or `keys` entry is the usual cause.)

- [ ] **Step 5: Commit**

```bash
git add src/admin/manifest.js src/admin/__tests__/manifest.test.js
git commit -m "feat(cms-v2): add site-mirror manifest with integrity tests"
```

### Task 3: `lib/store.js` — drafts, dirty state, autosave

**Files:**
- Create: `src/admin/lib/store.js`
- Test: `src/admin/lib/__tests__/store.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, DRAFT_PREFIX } from '../store.js';

const FILE = 'src/_data/cms/company.json';
const remote = () => ({ hero: { title: 'Old' }, intro: { text: 'Hi' } });

describe('store', () => {
  beforeEach(() => localStorage.clear());

  it('loads remote as draft when no local draft exists', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    expect(store.getDraft(FILE)).toEqual(remote());
    expect(store.isDirty(FILE)).toBe(false);
  });

  it('restores a persisted local draft over remote', () => {
    localStorage.setItem(DRAFT_PREFIX + FILE, JSON.stringify({ hero: { title: 'Draft' }, intro: { text: 'Hi' } }));
    const store = createStore();
    store.loadFile(FILE, remote());
    expect(store.getDraft(FILE).hero.title).toBe('Draft');
    expect(store.isDirty(FILE)).toBe(true);
  });

  it('falls back to remote when the persisted draft is corrupted JSON', () => {
    localStorage.setItem(DRAFT_PREFIX + FILE, '{not valid json');
    const store = createStore();
    store.loadFile(FILE, remote());
    expect(store.getDraft(FILE)).toEqual(remote());
    expect(store.isDirty(FILE)).toBe(false);
  });

  it('update mutates a clone, persists, and marks dirty (per top-level key too)', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; });
    expect(store.isDirty(FILE)).toBe(true);
    expect(store.isKeyDirty(FILE, 'hero')).toBe(true);
    expect(store.isKeyDirty(FILE, 'intro')).toBe(false);
    expect(JSON.parse(localStorage.getItem(DRAFT_PREFIX + FILE)).hero.title).toBe('New');
  });

  it('reverting an edit back to remote clears dirty and localStorage', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; });
    store.update(FILE, draft => { draft.hero.title = 'Old'; });
    expect(store.isDirty(FILE)).toBe(false);
    expect(localStorage.getItem(DRAFT_PREFIX + FILE)).toBeNull();
  });

  it('discardKeys restores only the given keys', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; draft.intro.text = 'Changed'; });
    store.discardKeys(FILE, ['hero']);
    expect(store.getDraft(FILE).hero.title).toBe('Old');
    expect(store.getDraft(FILE).intro.text).toBe('Changed');
    expect(store.isDirty(FILE)).toBe(true);
  });

  it('markPublishedContent makes the sent snapshot the new remote and clears storage', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; });
    const files = [{ path: FILE, content: `${JSON.stringify(store.getDraft(FILE), null, 2)}\n` }];
    store.markPublishedContent(files);
    expect(store.isDirty(FILE)).toBe(false);
    expect(store.getRemote(FILE).hero.title).toBe('New');
    expect(localStorage.getItem(DRAFT_PREFIX + FILE)).toBeNull();
  });

  it('markPublishedContent keeps an edit made during the publish flight dirty and persisted', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'A'; });
    const snapshot = [{ path: FILE, content: `${JSON.stringify(store.getDraft(FILE), null, 2)}\n` }];
    store.update(FILE, draft => { draft.hero.title = 'B'; }); // mid-flight edit
    store.markPublishedContent(snapshot);
    expect(store.getRemote(FILE).hero.title).toBe('A'); // what was actually published
    expect(store.isDirty(FILE)).toBe(true); // edit B survives as an unpublished change
    expect(JSON.parse(localStorage.getItem(DRAFT_PREFIX + FILE)).hero.title).toBe('B');
  });

  it('markPublishedContent ignores paths that are not loaded', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    expect(() => store.markPublishedContent([{ path: 'src/_data/cms/nope.json', content: '{}' }])).not.toThrow();
    expect(store.isDirty(FILE)).toBe(false);
  });

  it('notifies subscribers on change', () => {
    const store = createStore();
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; });
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `src/admin/lib/store.js`**

```js
import { deepClone } from './paths.js';

export const DRAFT_PREFIX = 'bg-cms-draft:';

// One store instance holds every content file: { remote, draft }.
// Drafts persist to localStorage while they differ from remote; UI subscribes
// via subscribe/getVersion (React: useSyncExternalStore).
export function createStore() {
  const files = new Map();
  const listeners = new Set();
  let version = 0;

  const emit = () => {
    version += 1;
    for (const listener of listeners) {
      listener();
    }
  };

  // Equality is JSON.stringify-based; mutations must preserve key order
  // (clone-then-mutate does). Do not rebuild objects with reordered keys.
  // localStorage failures (quota, private browsing) are swallowed so they can
  // never prevent emit() from running — drafts then live only in memory.
  const persist = filePath => {
    const entry = files.get(filePath);
    try {
      if (JSON.stringify(entry.draft) !== JSON.stringify(entry.remote)) {
        localStorage.setItem(DRAFT_PREFIX + filePath, JSON.stringify(entry.draft));
      } else {
        localStorage.removeItem(DRAFT_PREFIX + filePath);
      }
    } catch {
      // Storage unavailable — continue with in-memory draft only.
    }
  };

  const store = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,

    loadFile(filePath, remote) {
      let draft = null;
      try {
        const raw = localStorage.getItem(DRAFT_PREFIX + filePath);
        if (raw) {
          draft = JSON.parse(raw);
        }
      } catch {
        draft = null;
      }
      files.set(filePath, { remote: deepClone(remote), draft: draft || deepClone(remote) });
      emit();
    },

    has: filePath => files.has(filePath),
    allPaths: () => [...files.keys()],
    getDraft: filePath => files.get(filePath)?.draft,
    getRemote: filePath => files.get(filePath)?.remote,

    update(filePath, mutate) {
      const entry = files.get(filePath);
      if (!entry) {
        return;
      }
      const next = deepClone(entry.draft);
      mutate(next);
      entry.draft = next;
      persist(filePath);
      emit();
    },

    // Dirty checks share the JSON.stringify key-order-sensitive invariant
    // documented on persist() above.
    isDirty(filePath) {
      const entry = files.get(filePath);
      return Boolean(entry) && JSON.stringify(entry.draft) !== JSON.stringify(entry.remote);
    },

    isKeyDirty(filePath, key) {
      const entry = files.get(filePath);
      return Boolean(entry) && JSON.stringify(entry.draft?.[key]) !== JSON.stringify(entry.remote?.[key]);
    },

    dirtyPaths() {
      return [...files.keys()].filter(filePath => store.isDirty(filePath));
    },

    discardFile(filePath) {
      const entry = files.get(filePath);
      if (!entry) {
        return;
      }
      entry.draft = deepClone(entry.remote);
      try {
        localStorage.removeItem(DRAFT_PREFIX + filePath);
      } catch {
        // Storage unavailable — in-memory state is already reset.
      }
      emit();
    },

    discardKeys(filePath, keys) {
      store.update(filePath, draft => {
        const entry = files.get(filePath);
        for (const key of keys) {
          draft[key] = deepClone(entry.remote[key]);
        }
      });
    },

    // Snapshot-based publish accounting: entries are the EXACT {path, content}
    // payloads sent to /api/publish. The published content — not the current
    // draft — becomes the new remote, so an edit made while the publish
    // request was in flight stays dirty (an unpublished change) instead of
    // being silently marked clean.
    markPublishedContent(entries) {
      for (const { path, content } of entries) {
        const entry = files.get(path);
        if (!entry) {
          continue;
        }
        entry.remote = JSON.parse(content);
        persist(path); // draft equals new remote → clears storage; still different → stays dirty
      }
      emit();
    },
  };

  return store;
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/lib/store.js src/admin/lib/__tests__/store.test.js
git commit -m "feat(cms-v2): add drafts store with autosave and key-level dirty tracking"
```

### Task 4: `lib/validate.js` — publish validation

Validates **dirty files only** (never blocks on pre-existing content). Two rule classes: required fields (Decap semantics: required unless `required: false`) and link/path shape checks.

**Files:**
- Create: `src/admin/lib/validate.js`
- Test: `src/admin/lib/__tests__/validate.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { validateValue } from '../validate.js';

const fields = [
  { label: 'Title', name: 'title', widget: 'string' },
  { label: 'Note', name: 'note', widget: 'string', required: false },
  { label: 'Link', name: 'href', widget: 'string' },
  { label: 'Image', name: 'image', widget: 'image' },
  {
    label: 'Items', name: 'items', widget: 'list',
    fields: [{ label: 'Name', name: 'name', widget: 'string' }],
  },
];

describe('validateValue', () => {
  it('passes a fully valid object', () => {
    const value = { title: 'Hi', note: '', href: '/brands/', image: '/assets/media/a.jpg', items: [{ name: 'X' }] };
    expect(validateValue(fields, value, 'Section')).toEqual([]);
  });

  it('flags required empty strings but not optional ones', () => {
    const issues = validateValue(fields, { title: '', note: '', href: '/x', image: '/assets/a.jpg', items: [] }, 'Section');
    expect(issues).toHaveLength(1);
    expect(issues[0].label).toContain('Title');
  });

  it('flags malformed links (href-ish names must be URL, mailto, tel or site path)', () => {
    const issues = validateValue(fields, { title: 'T', href: 'www.example.com', image: '/assets/a.jpg', items: [] }, 'Section');
    expect(issues.some(issue => issue.label.includes('Link'))).toBe(true);
  });

  it('flags image paths that are neither /-rooted nor http', () => {
    const issues = validateValue(fields, { title: 'T', href: '/ok', image: 'foo.jpg', items: [] }, 'Section');
    expect(issues.some(issue => issue.label.includes('Image'))).toBe(true);
  });

  it('recurses into list items with item position in the label', () => {
    const issues = validateValue(fields, { title: 'T', href: '/ok', image: '/assets/a.jpg', items: [{ name: '' }] }, 'Section');
    expect(issues).toHaveLength(1);
    expect(issues[0].label).toContain('Items');
    expect(issues[0].label).toContain('#1');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `src/admin/lib/validate.js`**

```js
// Publish validation. Called with the config.yml field definitions and the
// draft value they describe. Returns [{ label, message }] — plain language,
// no dev words. Only dirty files are ever validated (callers enforce this).

const LINK_NAME = /(href|Href)$|^url$/;
const LINK_SHAPE = /^(https?:\/\/|mailto:|tel:|\/)/;

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

export function validateValue(fields, value, crumb) {
  const issues = [];
  for (const field of fields || []) {
    const fieldValue = value?.[field.name];
    const label = `${crumb} → ${field.label || field.name}`;
    const widget = field.widget || 'string';

    if (widget === 'object') {
      issues.push(...validateValue(field.fields || [], fieldValue || {}, label));
      continue;
    }

    if (widget === 'list') {
      const items = Array.isArray(fieldValue) ? fieldValue : [];
      items.forEach((item, index) => {
        if (field.fields) {
          issues.push(...validateValue(field.fields, item || {}, `${label} #${index + 1}`));
        } else if (field.field && field.field.required !== false && isEmpty(item)) {
          issues.push({ label: `${label} #${index + 1}`, message: 'This entry is empty.' });
        }
      });
      continue;
    }

    const required = field.required !== false;
    if (required && ['string', 'text', 'image', 'file', 'select'].includes(widget) && isEmpty(fieldValue)) {
      issues.push({ label, message: 'This field is empty and the website expects it.' });
      continue;
    }

    if (!isEmpty(fieldValue) && widget === 'string' && LINK_NAME.test(field.name) && !LINK_SHAPE.test(String(fieldValue))) {
      issues.push({ label, message: 'Links must start with https://, mailto:, tel: or / for a page on this site.' });
    }

    if (!isEmpty(fieldValue) && (widget === 'image' || widget === 'file') && !LINK_SHAPE.test(String(fieldValue))) {
      issues.push({ label, message: 'This should be an uploaded file path (starting with /) or a full https:// link.' });
    }
  }
  return issues;
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/lib/validate.js src/admin/lib/__tests__/validate.test.js
git commit -m "feat(cms-v2): add plain-language publish validation"
```

**End of Chunk 1.**

---

## Chunk 2: Foundations — adapters, loaders, build tooling, cleanup

### Task 5: `adapters/wearhouse.js` — slug join/split

Roster items live in `wearhousePage/roster.json` at `rosterSection.items[]` (fields: `name, slug, segment, pageHref, logoSrc, hoverImage`). Brand entries live in `wearhousePage/brands.json` at `brands[]`. **Canonical brand-entry shape (verified against all 16 real records):** `{ name, slug, rosterCard{…}, detail{ summary, intro, focus, atmosphere, categories } }` — `focus`, `atmosphere` and `categories` are nested INSIDE `detail`. Beware: `config.yml` currently declares them top-level on the list item, which contradicts every real record; the site templates read the nested values (`src/_data/wearhouse.js` spreads `...detail` last, so nested wins). Step 3b below fixes `config.yml` to match the data. The two lists must stay in sync by `slug`.

**Files:**
- Create: `src/admin/adapters/wearhouse.js`
- Test: `src/admin/adapters/__tests__/wearhouse.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { joinWearhouse, splitWearhouse, blankRosterItem, blankBrandEntry } from '../wearhouse.js';

const roster = [
  { name: 'Circolo 1901', slug: 'circolo-1901', segment: 'Menswear' },
  { name: 'Only Roster', slug: 'only-roster', segment: 'X' },
];
const brands = [
  { name: 'Circolo 1901', slug: 'circolo-1901', detail: { summary: 'S' } },
  { name: 'Only Brand', slug: 'only-brand', detail: { summary: 'B' } },
];

describe('wearhouse adapter', () => {
  it('joins by slug in roster order, appending brand-only records', () => {
    const { records } = joinWearhouse(roster, brands);
    expect(records.map(record => record.slug)).toEqual(['circolo-1901', 'only-roster', 'only-brand']);
    expect(records[0].roster.segment).toBe('Menswear');
    expect(records[0].brand.detail.summary).toBe('S');
  });

  it('marks incomplete records', () => {
    const { records } = joinWearhouse(roster, brands);
    expect(records[0].missing).toBeNull();
    expect(records[1].missing).toBe('brand');
    expect(records[2].missing).toBe('roster');
  });

  it('splits back into the two arrays, skipping missing halves', () => {
    const { records } = joinWearhouse(roster, brands);
    const { rosterItems, brandEntries } = splitWearhouse(records);
    expect(rosterItems.map(item => item.slug)).toEqual(['circolo-1901', 'only-roster']);
    expect(brandEntries.map(entry => entry.slug)).toEqual(['circolo-1901', 'only-brand']);
  });

  it('round-trips without data loss', () => {
    const { records } = joinWearhouse(roster, brands);
    const { rosterItems, brandEntries } = splitWearhouse(records);
    expect(rosterItems[0]).toEqual(roster[0]);
    expect(brandEntries[0]).toEqual(brands[0]);
    expect(rosterItems[1]).toEqual(roster[1]); // roster-only entry survives split intact
    expect(brandEntries[1]).toEqual(brands[1]); // brand-only entry survives split intact
    expect(rosterItems).toEqual(roster);
    expect(brandEntries).toEqual(brands);
  });

  it('marks duplicate roster slugs and never emits their brand entry twice', () => {
    const dupRoster = [...roster, { name: 'Circolo Again', slug: 'circolo-1901', segment: 'Dup' }];
    const { records } = joinWearhouse(dupRoster, brands);
    const dupRecord = records.find(record => record.duplicate);
    expect(dupRecord.slug).toBe('circolo-1901');
    expect(dupRecord.brand).toBeNull();
    expect(dupRecord.missing).toBe('brand');
    expect(dupRecord.duplicate).toBe(true);
    const { rosterItems, brandEntries } = splitWearhouse(records);
    expect(rosterItems).toHaveLength(3); // roster rows are all kept for the editor to fix
    expect(brandEntries.filter(entry => entry.slug === 'circolo-1901')).toHaveLength(1);
  });

  it('blank factories carry the slug and name over', () => {
    expect(blankRosterItem({ slug: 's', name: 'N' }).slug).toBe('s');
    expect(blankBrandEntry({ slug: 's', name: 'N' }).name).toBe('N');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `src/admin/adapters/wearhouse.js`**

```js
// The Wearhouse brand data is split across two parallel lists synced by slug:
// roster.json → rosterSection.items[] (card on the Wearhouse page) and
// brands.json → brands[] (detail page). This adapter joins them into one
// record per slug for editing, and splits them back for publishing.

export function joinWearhouse(rosterItems, brandEntries) {
  const bySlug = new Map((brandEntries || []).map(entry => [entry.slug, entry]));
  const seen = new Set();
  const records = [];

  for (const item of rosterItems || []) {
    if (seen.has(item.slug)) {
      // Duplicate roster slug: never attach the same brand entry object to a
      // second record, or a split would re-emit that brand twice into
      // brands.json. `duplicate` documents why the brand half is missing;
      // the UI renders a warning badge from `missing`.
      records.push({
        slug: item.slug,
        name: item.name || item.slug,
        roster: item,
        brand: null,
        missing: 'brand',
        duplicate: true,
      });
      continue;
    }
    const brand = bySlug.get(item.slug) || null;
    seen.add(item.slug);
    records.push({
      slug: item.slug,
      name: item.name || brand?.name || item.slug,
      roster: item,
      brand,
      missing: brand ? null : 'brand',
    });
  }

  for (const entry of brandEntries || []) {
    if (!seen.has(entry.slug)) {
      seen.add(entry.slug);
      records.push({ slug: entry.slug, name: entry.name || entry.slug, roster: null, brand: entry, missing: 'roster' });
    }
  }

  return { records };
}

export function splitWearhouse(records) {
  // Dedupe brand entries by slug (first occurrence wins) so a brand entry
  // can never be emitted twice into brands.json regardless of the input.
  const emitted = new Set();
  const brandEntries = [];
  for (const record of records) {
    if (record.brand && !emitted.has(record.brand.slug)) {
      emitted.add(record.brand.slug);
      brandEntries.push(record.brand);
    }
  }
  return {
    rosterItems: records.filter(record => record.roster).map(record => record.roster),
    brandEntries,
  };
}

export function blankRosterItem({ slug = '', name = '' } = {}) {
  return { name, slug, segment: '', pageHref: slug ? `/wearhouse/${slug}/` : '', logoSrc: '', hoverImage: '' };
}

export function blankBrandEntry({ slug = '', name = '' } = {}) {
  // Matches the canonical shape of every existing record in brands.json:
  // focus/atmosphere/categories live inside `detail`.
  return {
    name,
    slug,
    rosterCard: { segment: '', websiteHref: '', logoSrc: '', hoverImage: '', detailImage: '', logoLines: [] },
    detail: { summary: '', intro: '', focus: '', atmosphere: '', categories: [] },
  };
}
```

- [ ] **Step 3b: Align `config.yml` with the canonical data shape.** In `src/admin/config.yml`, inside the `wearhouse_page` collection → `wearhouse_page_brands` file entry → `brands` list fields, MOVE the three field definitions for `focus`, `atmosphere`, and `categories` from the list-item level INTO the `detail` object's `fields` array (after `intro`), keeping their definitions identical:

```yaml
              - label: Brand Detail Div
                name: detail
                widget: object
                fields:
                  - { label: Summary, name: summary, widget: text }
                  - { label: Intro, name: intro, widget: text }
                  - { label: Focus, name: focus, widget: text }
                  - { label: Atmosphere, name: atmosphere, widget: string }
                  - { label: Categories, name: categories, widget: list, field: { label: Category, name: category, widget: string } }
```

(Delete the three now-duplicated top-level entries.) This makes the editor read/write the values the website actually renders. No data migration needed — the data is already in this shape.

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/adapters/wearhouse.js src/admin/adapters/__tests__/wearhouse.test.js src/admin/config.yml
git commit -m "feat(cms-v2): wearhouse slug adapter; align config.yml with real brand-entry shape"
```

### Task 6: `lib/api.js` + `lib/content.js` — server and content access

**Files:**
- Create: `src/admin/lib/api.js`
- Create: `src/admin/lib/content.js`
- Test: `src/admin/lib/__tests__/api.test.js`
- Test: `src/admin/lib/__tests__/content.test.js`

- [ ] **Step 1: Write failing tests** (error surfacing is the risky part)

```js
import { describe, it, expect, vi } from 'vitest';
import { createApi } from '../api.js';

function mockFetch(status, body) {
  return vi.fn(async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) }));
}

describe('createApi', () => {
  it('sends bearer token and parses JSON', async () => {
    const fetcher = mockFetch(200, { ok: true, user: { role: 'admin' } });
    const api = createApi(() => 'tok', fetcher);
    const result = await api.me();
    expect(result.user.role).toBe('admin');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('throws the server error message on failure', async () => {
    const api = createApi(() => 'tok', mockFetch(403, { error: 'No access.' }));
    await expect(api.me()).rejects.toThrow('No access.');
  });

  it('surfaces a non-JSON error body as the message', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
    const api = createApi(() => 'tok', fetcher);
    await expect(api.me()).rejects.toThrow('boom');
  });

  it('falls back to a status message when the error body is empty', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 500, text: async () => '' }));
    const api = createApi(() => 'tok', fetcher);
    await expect(api.me()).rejects.toThrow(/500/);
  });

  it('sanitizes an HTML error page instead of leaking it into the message', async () => {
    const html = '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>';
    const fetcher = vi.fn(async () => ({ ok: false, status: 502, text: async () => html }));
    const api = createApi(() => 'tok', fetcher);
    await expect(api.me()).rejects.toThrow(/502/);
    await expect(api.me()).rejects.not.toThrow(/<!DOCTYPE/);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL.

- [ ] **Step 3: Implement `src/admin/lib/api.js`**

```js
// All server calls in one place. Every endpoint already exists — this file
// only wraps them with auth and error handling. Backend must not change.
export function createApi(getToken, fetcher = (...args) => fetch(...args)) {
  // Network-level rejections (fetcher throwing) intentionally propagate to callers.
  async function request(method, url, body) {
    const response = await fetcher(url, {
      method,
      headers: {
        Authorization: `Bearer ${getToken() || ''}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      // HTML error pages must never leak into toasts — sanitize any raw non-JSON body.
      const message = payload.error || payload.message
        || (raw && raw.trim().startsWith('<')
          ? `The server returned an error (${response.status}).`
          : (raw || `The server returned an error (${response.status}).`).slice(0, 200));
      throw new Error(message);
    }
    return payload;
  }

  return {
    me: () => request('GET', '/api/me'),
    listUsers: () => request('GET', '/api/admin/users'),
    addUser: user => request('POST', '/api/admin/users', user),
    updateUser: patch => request('PATCH', '/api/admin/users', patch),
    removeUser: id => request('DELETE', '/api/admin/users', { id }),
    publish: (files, message) => request('POST', '/api/publish', { message, files }),
    upload: payload => request('POST', '/api/upload', payload),
    deploys: (limit = 6) => request('GET', `/api/deploys?limit=${limit}`),
    revert: sha => request('POST', '/api/revert', { sha }),
  };
}
```

- [ ] **Step 4: Implement `src/admin/lib/content.js`**

```js
import { parse as parseYAML } from 'yaml';

// Loads the field definitions (config.yml) and content files the admin edits.

export async function loadFieldConfig() {
  const response = await fetch('/admin/config.yml');
  if (!response.ok) {
    throw new Error(`Could not load the editor configuration (${response.status}).`);
  }
  const config = parseYAML(await response.text());
  const byFile = new Map();
  for (const collection of config.collections || []) {
    for (const entry of collection.files || []) {
      byFile.set(entry.file, entry);
    }
  }
  return byFile; // file path -> { name, label, file, fields }
}

export async function loadContentFile(filePath) {
  const relative = filePath.replace(/^src\/_data\/cms\//, '');
  const response = await fetch(`/cms-data/${relative}`);
  if (!response.ok) {
    throw new Error(`Could not load ${relative} (${response.status}).`);
  }
  return response.json();
}

export async function loadMediaIndex() {
  try {
    const response = await fetch('/admin/media-index.json');
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null; // media library degrades; picker still allows upload + manual path
  }
}
```

- [ ] **Step 4b: Add `src/admin/lib/__tests__/content.test.js`** (mocked global fetch; restored after each test)

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadFieldConfig, loadContentFile, loadMediaIndex } from '../content.js';

const CONFIG_YAML = `
collections:
  - name: homepage
    files:
      - name: home_hero
        label: Hero
        file: src/_data/cms/home/hero.json
        fields:
          - { label: Title, name: title, widget: string }
`;

function stubFetch(impl) {
  const fetcher = vi.fn(impl);
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadFieldConfig', () => {
  it('throws with the status in the message on a non-ok response', async () => {
    stubFetch(async () => ({ ok: false, status: 404 }));
    await expect(loadFieldConfig()).rejects.toThrow(/404/);
  });

  it('returns a Map keyed by file path with a fields array', async () => {
    stubFetch(async () => ({ ok: true, text: async () => CONFIG_YAML }));
    const byFile = await loadFieldConfig();
    expect(byFile).toBeInstanceOf(Map);
    const entry = byFile.get('src/_data/cms/home/hero.json');
    expect(entry.name).toBe('home_hero');
    expect(Array.isArray(entry.fields)).toBe(true);
    expect(entry.fields[0].name).toBe('title');
  });
});

describe('loadContentFile', () => {
  it('strips the src/_data/cms/ prefix when fetching', async () => {
    const fetcher = stubFetch(async () => ({ ok: true, json: async () => ({ hero: {} }) }));
    const data = await loadContentFile('src/_data/cms/home/hero.json');
    expect(fetcher.mock.calls[0][0]).toBe('/cms-data/home/hero.json');
    expect(data).toEqual({ hero: {} });
  });

  it('throws on a non-ok response', async () => {
    stubFetch(async () => ({ ok: false, status: 500 }));
    await expect(loadContentFile('src/_data/cms/home/hero.json')).rejects.toThrow(/500/);
  });
});

describe('loadMediaIndex', () => {
  it('returns null on a non-ok response', async () => {
    stubFetch(async () => ({ ok: false, status: 404 }));
    await expect(loadMediaIndex()).resolves.toBeNull();
  });

  it('returns null when the fetch itself rejects', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    await expect(loadMediaIndex()).resolves.toBeNull();
  });
});
```

- [ ] **Step 5: Run tests** — `npm test` → PASS. Then commit:

```bash
git add src/admin/lib/api.js src/admin/lib/content.js src/admin/lib/__tests__/api.test.js src/admin/lib/__tests__/content.test.js
git commit -m "feat(cms-v2): add api client and content loaders"
```

### Task 7: Media index emitter + admin cache-busting

**Files:**
- Create: `src/media-index.11ty.js`
- Create: `src/_data/buildHash.js`
- Modify: `src/admin/index.html`
- Modify: `package.json` (entry rename)
- Create: `src/admin/main.jsx` (placeholder bootstrap)

- [ ] **Step 1: Create `src/media-index.11ty.js`**

```js
const fs = require('fs');
const path = require('path');

// Emits /admin/media-index.json at build time: every file under
// src/assets/media, for the admin's media library. Video files (mp4/webm)
// are included DELIBERATELY — hero sections use video, picked via the
// same picker with kind="file".
module.exports = class MediaIndex {
  data() {
    return { permalink: '/admin/media-index.json', eleventyExcludeFromCollections: true };
  }

  render() {
    const root = path.join('src', 'assets', 'media');
    const files = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(avif|gif|jpe?g|png|svg|webp|mp4|webm)$/i.test(entry.name)) {
          files.push({
            path: `/${path.relative('src', full).split(path.sep).join('/')}`,
            name: entry.name,
            size: fs.statSync(full).size,
          });
        }
      }
    };
    // If the media directory is missing, emit an empty index instead of
    // throwing — this template must never kill the whole Eleventy build
    // (matches loadMediaIndex's degrade-gracefully posture in the admin).
    if (fs.existsSync(root)) {
      walk(root);
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return JSON.stringify({ generatedAt: new Date().toISOString(), files });
  }
};
```

- [ ] **Step 2: Create `src/_data/buildHash.js`**

```js
// Changes every build; used to cache-bust the admin bundle URL so deploys
// are visible without a hard refresh.
module.exports = () => Date.now().toString(36);
```

- [ ] **Step 3: Update `src/admin/index.html`** (full new content)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bollag-Guggenheim CMS</title>
    <link rel="stylesheet" href="/admin/app.css?v={{ buildHash }}">
  </head>
  <body>
    <div id="admin-root"></div>
    <script type="module" src="/admin/app.js?v={{ buildHash }}"></script>
  </body>
</html>
```

- [ ] **Step 4: Create placeholder `src/admin/main.jsx` and switch the build entry**

`src/admin/main.jsx` (placeholder until Chunk 2 — keeps the old app working):

```js
import './app.jsx';
```

In `package.json`, change both admin scripts to the new entry:

```json
"dev:admin": "esbuild src/admin/main.jsx --bundle --format=esm --platform=browser --target=es2020 --outfile=_site/admin/app.js --watch",
"build:admin": "esbuild src/admin/main.jsx --bundle --format=esm --platform=browser --target=es2020 --outfile=_site/admin/app.js",
```

- [ ] **Step 5: Verify build output**

```bash
npm run build
node -e "const i=require('./_site/admin/media-index.json'); console.log('media files:', i.files.length); if(!i.files.length) process.exit(1)"
grep -o 'app.js?v=[a-z0-9]*' _site/admin/index.html
```

Expected: media file count > 400; a versioned `app.js?v=…` reference.

- [ ] **Step 6: Commit**

```bash
git add src/media-index.11ty.js src/_data/buildHash.js src/admin/index.html src/admin/main.jsx package.json
git commit -m "feat(cms-v2): media index emitter, admin cache-busting, main.jsx entry"
```

### Task 8: Legacy content cleanup

**Files:**
- Delete: `src/_data/cms/home/selectionCards/` (20 files), `src/_data/cms/wearhousePage/showroomGalleryItems/` (15 files)

- [ ] **Step 1: Re-verify nothing references them** (must print "clean")

```bash
grep -rl "selectionCards\|showroomGalleryItems" src --include='*.js' --include='*.njk' --include='*.yml' --include='*.json' | grep -v "src/_data/cms/home/selectionCards\|src/_data/cms/wearhousePage/showroomGalleryItems" || echo clean
```

- [ ] **Step 2: Delete and verify the site builds identically**

```bash
npm run build:site && find _site -name '*.html' | sort > /tmp/pages-before.txt
git rm -r -q src/_data/cms/home/selectionCards src/_data/cms/wearhousePage/showroomGalleryItems
npm run build:site && find _site -name '*.html' | sort > /tmp/pages-after.txt
diff /tmp/pages-before.txt /tmp/pages-after.txt && echo "identical page set"
```

Expected: Eleventy build green both times; `diff` prints nothing and "identical page set" is echoed.

- [ ] **Step 3: Run all tests** — `npm test` → PASS (manifest integrity unaffected — legacy files were never in config.yml).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(cms-v2): delete unused legacy selectionCards and showroomGalleryItems data"
```

**End of Chunk 2.** At this point: all logic modules exist and are tested; the old admin still runs unchanged via the `main.jsx` placeholder; media index and cache-busting are live in the build.

---

## Chunk 3: Shell and auth bootstrap

All components use existing `admin.css` classes plus the new classes added in Task 11. React 19; no new runtime deps.

### Task 9: Real `main.jsx` bootstrap + context + Login/Boot screens

**Files:**
- Modify: `src/admin/main.jsx` (replace the placeholder entirely)
- Create: `src/admin/lib/context.js`
- Create: `src/admin/screens/LoginScreen.jsx`

From this task on, the old `src/admin/app.jsx` is dead code (deleted in Task 19). It stays in the tree as reference for extraction.

- [ ] **Step 1: Create `src/admin/lib/context.js`**

```js
import { createContext, useContext, useSyncExternalStore } from 'react';

export const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

// Re-render subscriber for the drafts store.
export function useStoreVersion(store) {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}
```

- [ ] **Step 2: Create `src/admin/screens/LoginScreen.jsx`**

```jsx
import React from 'react';

export function LoginScreen({ email, password, onEmail, onPassword, onSubmit, pending, note, tone }) {
  return (
    <div className="auth-shell">
      <section className="card auth-card">
        <div className="auth-kicker">Admin access</div>
        <h1 className="auth-title">Bollag CMS</h1>
        <p className="auth-copy">Sign in with your email and password to edit the website.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Email address</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={event => onEmail(event.target.value)} placeholder="you@company.com" required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={event => onPassword(event.target.value)} placeholder="Your password" required />
          </label>
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={`status-line ${note ? `status-${tone || 'neutral'}` : ''}`}>
          {note || 'Forgot your password? Ask an admin to reset it for you.'}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/admin/main.jsx`** (complete file)

```jsx
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './admin.css';
import { AdminContext } from './lib/context.js';
import { createApi } from './lib/api.js';
import { createStore } from './lib/store.js';
import { loadFieldConfig, loadContentFile, loadMediaIndex } from './lib/content.js';
import { ALL_FILES } from './manifest.js';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { Shell } from './shell/Shell.jsx';

const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

let accessToken = '';
const api = createApi(() => accessToken);
const store = createStore();

function BootScreen() {
  return (
    <div className="auth-shell">
      <section className="card auth-card">
        <div className="auth-kicker">Bollag CMS</div>
        <h1 className="auth-title">Loading…</h1>
        <p className="auth-copy">Preparing the editor and loading the current website content.</p>
      </section>
    </div>
  );
}

function LoadErrorScreen({ message, onRetry }) {
  return (
    <div className="auth-shell">
      <section className="card auth-card">
        <div className="auth-kicker">Bollag CMS</div>
        <h1 className="auth-title">Could not load the website content</h1>
        <p className="auth-copy">{message}</p>
        <button type="button" className="button button-primary" onClick={onRetry}>Try again</button>
      </section>
    </div>
  );
}

function AdminRoot() {
  const [mode, setMode] = useState('boot');
  const [user, setUser] = useState(null);
  const [fieldConfig, setFieldConfig] = useState(null);
  const [mediaIndex, setMediaIndex] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [note, setNote] = useState({ text: '', tone: '' });
  const [loadError, setLoadError] = useState('');

  async function loadWorkspace() {
    const [config, media] = await Promise.all([loadFieldConfig(), loadMediaIndex()]);
    await Promise.all(ALL_FILES.map(async filePath => store.loadFile(filePath, await loadContentFile(filePath))));
    setFieldConfig(config);
    setMediaIndex(media);
    setMode('app');
  }

  // Workspace load failures are usually transient (a blip on one of the 22
  // content fetches); keep the session and offer a retry instead of signing
  // the user out.
  async function enterWorkspace() {
    try {
      await loadWorkspace();
    } catch (error) {
      setLoadError(error.message || 'Something went wrong while loading the content.');
      setMode('error');
    }
  }

  async function tryEnter(session) {
    accessToken = session.access_token;
    // Auth gate first, in its own try/catch: only a rejected account is
    // signed out. Load failures after this point never revoke the session.
    try {
      const { user: me } = await api.me(); // throws if the account has no CMS role
      setUser(me);
    } catch (error) {
      await supabase.auth.signOut();
      accessToken = '';
      setUser(null);
      setMode('login');
      setNote({ text: error.message || 'That account does not have CMS access.', tone: 'error' });
      return;
    }
    await enterWorkspace();
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void tryEnter(data.session);
      } else {
        setMode('login');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep the bearer token fresh: Supabase rotates it (~hourly) and emits
      // TOKEN_REFRESHED; without this, publishes in long sessions would 401.
      if (session) {
        accessToken = session.access_token;
      }
      if (event === 'SIGNED_OUT') {
        accessToken = '';
        setUser(null);
        setMode('login');
        // Note: do NOT clear the auth note here — tryEnter() sets an
        // explanatory error right before signing a rejected account out, and
        // this callback can fire after it.
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmitLogin = async event => {
    event.preventDefault();
    setLoginPending(true);
    setNote({ text: 'Signing in…', tone: '' });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        throw error;
      }
      setPassword('');
      await tryEnter(data.session);
    } catch (error) {
      setNote({ text: error.message || 'Could not sign in. Check your email and password.', tone: 'error' });
    } finally {
      setLoginPending(false);
    }
  };

  if (mode === 'boot') {
    return <BootScreen />;
  }
  if (mode === 'error') {
    return (
      <LoadErrorScreen
        message={loadError}
        onRetry={() => {
          setMode('boot');
          void enterWorkspace();
        }}
      />
    );
  }
  if (mode === 'login') {
    return (
      <LoginScreen
        email={email} password={password} onEmail={setEmail} onPassword={setPassword}
        onSubmit={onSubmitLogin} pending={loginPending} note={note.text} tone={note.tone}
      />
    );
  }
  return (
    <AdminContext.Provider value={{ user, api, store, fieldConfig, mediaIndex, setMediaIndex, signOut: () => supabase.auth.signOut() }}>
      <Shell />
    </AdminContext.Provider>
  );
}

const mount = document.getElementById('admin-root');
if (mount) {
  createRoot(mount).render(<AdminRoot />);
}
```

- [ ] **Step 4: Create a minimal `src/admin/shell/Shell.jsx` so the build compiles** (replaced in Task 10)

```jsx
import React from 'react';

export function Shell() {
  return <div className="admin-shell" />;
}
```

- [ ] **Step 5: Verify** — `npm run build` green; `npm test` green.

- [ ] **Step 6: Commit**

```bash
git add src/admin/main.jsx src/admin/lib/context.js src/admin/screens/LoginScreen.jsx src/admin/shell/Shell.jsx
git commit -m "feat(cms-v2): real bootstrap with auth, context, and login screen"
```

### Task 10: Router, toasts, and the full Shell (sidebar + topbar)

**Files:**
- Create: `src/admin/lib/router.js`
- Create: `src/admin/shell/Toasts.jsx`
- Create: `src/admin/shell/Topbar.jsx`
- Create: `src/admin/screens/PageScreen.jsx` (stub — real version in Task 12)
- Create: `src/admin/screens/SectionScreen.jsx` (stub — real version in Task 12)
- Modify: `src/admin/shell/Shell.jsx` (replace entirely)

- [ ] **Step 1: Create `src/admin/lib/router.js`**

```js
import { useEffect, useState } from 'react';

// Hash routes (all parts URI-encoded):
//   #/page/<pageId>
//   #/page/<pageId>/<sectionId>
//   #/page/<pageId>/<sectionId>/list/<listPath>            (managed item list)
//   #/page/<pageId>/<sectionId>/list/<listPath>/<index>    (item editor)
//   #/page/wearhouse/wearhouse-brands/<recordIndex>         (joined item editor)
//   #/media   #/people
export function parseRoute() {
  // A malformed hash (e.g. a stray "%" makes decodeURIComponent throw) must
  // not crash the SPA — there is no error boundary above the router. Fall
  // back to [] so the shell's homepage redirect takes over.
  try {
    return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return [];
  }
}

export function navigate(...parts) {
  window.location.hash = '/' + parts.map(encodeURIComponent).join('/');
}

export function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
```

- [ ] **Step 2: Create `src/admin/shell/Toasts.jsx`**

```jsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const timers = useRef(new Set());

  const push = useCallback((message, tone = 'neutral') => {
    const id = nextId.current++;
    setToasts(current => [...current, { id, message, tone }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts(current => current.filter(toast => toast.id !== id));
    }, 4200);
    timers.current.add(timer);
  }, []);

  // Clear pending dismiss timers on unmount so none outlive the provider.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>{toast.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 3: Create screen stubs so this chunk compiles** (real implementations land in Task 12):

`src/admin/screens/PageScreen.jsx`:

```jsx
import React from 'react';
export function PageScreen() { return null; }
```

`src/admin/screens/SectionScreen.jsx`:

```jsx
import React from 'react';
export function SectionScreen() { return null; }
```

- [ ] **Step 3b: Replace `src/admin/shell/Shell.jsx`** (complete file)

```jsx
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
      <div className="empty-state-description">This link points at a page or section that no longer exists. Pick a page from the left.</div>
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
```

- [ ] **Step 4: Create `src/admin/shell/Topbar.jsx`** (saved chip + sign out; search and changes tray attach here in later tasks)

```jsx
import React from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';

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
        <div id="topbar-tray-slot" />
        <button type="button" className="button button-ghost" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Verify** — `npm run build` green. Local check: `npm run dev:static`, open `http://localhost:8080/admin/` → login screen renders (auth gate; full walkthrough happens in Task 21 with the temporary localhost bypass).

- [ ] **Step 6: Commit**

```bash
git add src/admin/lib/router.js src/admin/shell/Toasts.jsx src/admin/shell/Shell.jsx src/admin/shell/Topbar.jsx src/admin/screens/PageScreen.jsx src/admin/screens/SectionScreen.jsx
git commit -m "feat(cms-v2): hash router, toasts, sidebar/topbar shell"
```

### Task 11: CSS additions (complete block)

**Files:**
- Modify: `src/admin/admin.css` (append the block below at the end of the file, verbatim; also remove the old `.field-grid` rule)

- [ ] **Step 1: Append to `src/admin/admin.css`**

```css
/* ===== CMS v2 additions ===== */

.workspace-body { padding: 16px 20px 40px; min-width: 0; }

.topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 20px; border-bottom: 1px solid var(--line); background: var(--panel);
  position: sticky; top: 0; z-index: 20;
}
.topbar-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.topbar-right { display: flex; align-items: center; gap: 10px; }

.sidebar-divider { height: 1px; background: var(--line); margin: 10px 0; }

.breadcrumbs { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); margin-bottom: 10px; flex-wrap: wrap; }
.breadcrumbs-link { appearance: none; border: 0; background: transparent; padding: 0; font: inherit; font-size: 13px; color: var(--accent); cursor: pointer; }
.breadcrumbs-link:hover { text-decoration: underline; }
.breadcrumbs-sep { color: var(--line-strong); }

.screen-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
.screen-title { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.01em; }
.screen-subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.screen-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.section-rows { display: grid; gap: 8px; }
.section-row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  width: 100%; text-align: left; padding: 14px 16px; cursor: pointer;
  border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel);
  box-shadow: var(--shadow-1); transition: border-color 120ms ease, box-shadow 120ms ease;
}
.section-row:hover { border-color: var(--accent); box-shadow: var(--shadow-2); }
.section-row-main { min-width: 0; }
.section-row-title { font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; }
.section-row-summary { color: var(--muted); font-size: 13px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60ch; }
.section-row-meta { display: flex; align-items: center; gap: 10px; color: var(--muted); flex: none; }

.group-card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); padding: 16px; box-shadow: var(--shadow-1); }
.group-card + .group-card { margin-top: 12px; }
.group-card-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
.field-grid { display: grid; gap: 14px; }
@media (min-width: 1100px) { .field-grid.two-col { grid-template-columns: 1fr 1fr; } .field-grid.two-col > .field-span { grid-column: 1 / -1; } }

.inline-list { display: grid; gap: 6px; }
.inline-list-row { display: flex; align-items: center; gap: 6px; }
.inline-list-row .input { flex: 1; }
.inline-list-actions { display: flex; gap: 2px; flex: none; }

.item-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
.item-card {
  display: flex; flex-direction: column; gap: 0; text-align: left; cursor: pointer; overflow: hidden;
  border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel);
  box-shadow: var(--shadow-1); transition: border-color 120ms ease, box-shadow 120ms ease; padding: 0;
}
.item-card:hover { border-color: var(--accent); box-shadow: var(--shadow-2); }
.item-card-thumb { height: 120px; background: var(--panel-soft); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.item-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.item-card-thumb-empty { color: var(--line-strong); font-size: 12px; }
.item-card-body { padding: 10px 12px; }
.item-card-title { font-weight: 600; font-size: 14px; }
.item-card-subtitle { color: var(--muted); font-size: 12px; margin-top: 2px; }
.item-card-flags { padding: 0 12px 10px; display: flex; gap: 6px; flex-wrap: wrap; }

.managed-list { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-soft); padding: 12px 14px; }
.managed-list-thumbs { display: flex; }
.managed-list-thumbs img { width: 34px; height: 34px; object-fit: cover; border-radius: 6px; border: 2px solid var(--panel); margin-left: -8px; }
.managed-list-thumbs img:first-child { margin-left: 0; }

.toast-stack { position: fixed; right: 18px; bottom: 18px; display: grid; gap: 8px; z-index: 120; }
.toast { padding: 11px 16px; border-radius: var(--radius-sm); background: #202124; color: #fff; font-size: 13px; box-shadow: var(--shadow-2); animation: toast-in 160ms ease; max-width: 380px; }
.toast-success { background: #188038; }
.toast-error { background: var(--danger); }
@keyframes toast-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.tray-backdrop { position: fixed; inset: 0; background: rgba(32, 33, 36, 0.4); z-index: 90; }
.tray-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(460px, 92vw); background: var(--panel); z-index: 100; box-shadow: var(--shadow-3); display: flex; flex-direction: column; }
.tray-head { padding: 16px 18px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.tray-title { margin: 0; font-size: 17px; font-weight: 600; }
.tray-body { flex: 1; overflow-y: auto; padding: 14px 18px; display: grid; gap: 10px; align-content: start; }
.tray-foot { padding: 14px 18px; border-top: 1px solid var(--line); display: grid; gap: 10px; }
.tray-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px; }
.tray-row-title { font-weight: 600; font-size: 13px; }
.tray-row-sub { color: var(--muted); font-size: 12px; margin-top: 2px; }

.picker-backdrop { position: fixed; inset: 0; background: rgba(32, 33, 36, 0.45); z-index: 110; display: flex; align-items: center; justify-content: center; padding: 24px; }
.picker-modal { width: min(920px, 100%); max-height: 84vh; background: var(--panel); border-radius: var(--radius); box-shadow: var(--shadow-3); display: flex; flex-direction: column; overflow: hidden; }
.picker-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.picker-head .input { flex: 1; }
.picker-grid { flex: 1; overflow-y: auto; padding: 14px 16px; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); align-content: start; }
.picker-cell { border: 2px solid transparent; border-radius: var(--radius-sm); overflow: hidden; cursor: pointer; background: var(--panel-soft); padding: 0; text-align: left; }
.picker-cell:hover { border-color: var(--accent); }
.picker-cell img { width: 100%; height: 96px; object-fit: cover; display: block; }
.picker-cell-name { font-size: 11px; color: var(--muted); padding: 6px 8px; word-break: break-all; }
.picker-foot { padding: 12px 16px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 10px; align-items: center; }

.media-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; }
.media-toolbar .input { max-width: 360px; }

.skeleton { background: linear-gradient(90deg, var(--panel-soft) 25%, #e8eaed 37%, var(--panel-soft) 63%); background-size: 400% 100%; animation: skeleton 1.2s ease infinite; border-radius: var(--radius-sm); min-height: 48px; }
@keyframes skeleton { from { background-position: 100% 50%; } to { background-position: 0 50%; } }

.search-wrap { position: relative; max-width: 420px; flex: 1; }
.search-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-2); z-index: 60; max-height: 340px; overflow-y: auto; }
.search-hit { display: block; width: 100%; text-align: left; padding: 10px 12px; cursor: pointer; border: 0; background: transparent; }
.search-hit:hover { background: var(--accent-soft); }
.search-hit-title { font-weight: 600; font-size: 13px; }
.search-hit-sub { color: var(--muted); font-size: 12px; }

.issue-list { border: 1px solid rgba(217, 48, 37, 0.4); background: rgba(217, 48, 37, 0.05); border-radius: var(--radius); padding: 12px 14px; display: grid; gap: 6px; }
.issue-row { font-size: 13px; }
.issue-row strong { color: var(--danger); }
```

- [ ] **Step 1b: Remove the old `.field-grid` rule** — delete the legacy `.field-grid { display: grid; gap: 10px; }` rule near the `.field-body`/`.panel-label` definitions. It was used only by the dead `app.jsx` and would otherwise be shadowed by the new block's `.field-grid` (gap: 14px), leaving one definition in the file.

Note (added with Task 18's drag-and-drop): the pre-existing `.asset-dropzone` section (next to `.asset-dropzone:hover`) also gains `.asset-dropzone > * { pointer-events: none; }` so the dropzone's child spans cannot steal dragenter/dragleave and flicker the `is-dragover` state.

- [ ] **Step 2: Verify** — `npm run build` green (CSS bundles through the esbuild import).

- [ ] **Step 3: Commit**

```bash
git add src/admin/admin.css
git commit -m "feat(cms-v2): design-system additions for shell, cards, tray, picker, toasts"
```

**End of Chunk 3.**

---

## Chunk 4: Section editing and media fields

### Task 12: Summaries + PageScreen + SectionScreen + basic fields

**Files:**
- Create: `src/admin/lib/summarize.js`
- Test: `src/admin/lib/__tests__/summarize.test.js`
- Create: `src/admin/screens/PageScreen.jsx`
- Create: `src/admin/screens/SectionScreen.jsx`
- Create: `src/admin/fields/FieldRenderer.jsx`
- Create: `src/admin/fields/basics.jsx`
- Create: `src/admin/fields/InlineListField.jsx`

- [ ] **Step 1: Write failing summarize tests**

```js
import { describe, it, expect } from 'vitest';
import { summarize, itemTitle, itemImage } from '../summarize.js';

describe('summarize', () => {
  it('previews scalars and counts arrays', () => {
    expect(summarize({ title: 'Hello', items: [1, 2, 3] })).toBe('Title: Hello · Items: 3 items');
  });
  it('handles empty values', () => {
    expect(summarize({})).toBe('Empty');
    expect(summarize('Plain')).toBe('Plain');
  });
  it('itemTitle prefers name-like keys then first non-empty string', () => {
    expect(itemTitle({ name: 'Closed' })).toBe('Closed');
    expect(itemTitle({ brand: 'Duno' })).toBe('Duno');
    expect(itemTitle({ month: 'July' })).toBe('July');
    expect(itemTitle({ dateLabel: '12–14 July' })).toBe('12–14 July');
    expect(itemTitle({ note: '' , other: 42 })).toBe('Untitled');
  });
  it('itemImage returns the first image-looking string value', () => {
    expect(itemImage({ logoImage: '/assets/media/a.svg', name: 'X' })).toBe('/assets/media/a.svg');
    expect(itemImage({ card: { heroImage: '/assets/media/b.jpg' } })).toBe('/assets/media/b.jpg');
    expect(itemImage({ name: 'X' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/admin/lib/summarize.js`

```js
const TITLE_KEYS = ['name', 'brand', 'title', 'label', 'month', 'dateLabel'];
const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

function labelize(key) {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function summarize(value) {
  if (value === null || value === undefined || value === '') {
    return 'Empty';
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  const parts = [];
  for (const [key, entryValue] of Object.entries(value)) {
    if (entryValue === null || entryValue === undefined || entryValue === '') {
      continue;
    }
    parts.push(`${labelize(key)}: ${Array.isArray(entryValue) ? `${entryValue.length} items` : typeof entryValue === 'object' ? '…' : String(entryValue)}`);
    if (parts.length === 2) {
      break;
    }
  }
  return parts.join(' · ') || 'Empty';
}

export function itemTitle(item) {
  if (!item || typeof item !== 'object') {
    return String(item ?? 'Untitled') || 'Untitled';
  }
  for (const key of TITLE_KEYS) {
    if (typeof item[key] === 'string' && item[key].trim()) {
      return item[key];
    }
  }
  for (const value of Object.values(item)) {
    if (typeof value === 'string' && value.trim() && !IMAGE_SHAPE.test(value)) {
      return value;
    }
  }
  return 'Untitled';
}

export function itemImage(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  for (const value of Object.values(item)) {
    if (typeof value === 'string' && IMAGE_SHAPE.test(value)) {
      return value;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = itemImage(value);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}
```

Run `npm test` → PASS.

- [ ] **Step 3: Create `src/admin/fields/basics.jsx`**

```jsx
import React from 'react';

export function FieldShell({ field, children }) {
  return (
    <div className="field">
      <span className="field-label">{field.label || field.name}</span>
      {field.description ? <div className="field-help">{field.description}</div> : null}
      {children}
    </div>
  );
}

export function TextField({ field, value, onChange }) {
  const isNumber = field.widget === 'number';
  return (
    <FieldShell field={field}>
      <input
        className="input" type={isNumber ? 'number' : 'text'} value={value ?? ''}
        onChange={event => onChange(isNumber ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)}
      />
    </FieldShell>
  );
}

export function TextareaField({ field, value, onChange }) {
  return (
    <FieldShell field={field}>
      <textarea className="textarea" rows={4} value={value || ''} onChange={event => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function SelectField({ field, value, onChange }) {
  const options = (field.options || []).map(option => (typeof option === 'object' && option !== null ? option : { label: String(option), value: option }));
  // An unset value renders an explicit "Choose…" placeholder instead of
  // silently displaying the first option (which would differ from the draft).
  return (
    <FieldShell field={field}>
      <select className="select" value={value ?? ''} onChange={event => onChange(event.target.value)}>
        {value === undefined || value === null || value === '' ? <option value="" disabled hidden>Choose…</option> : null}
        {options.map(option => (
          <option key={String(option.value)} value={option.value}>{option.label ?? option.value}</option>
        ))}
      </select>
    </FieldShell>
  );
}

export function BooleanField({ field, value, onChange }) {
  return (
    <label className="field field-check">
      <input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} />
      <span>
        <span className="field-label">{field.label || field.name}</span>
        {field.description ? <span className="field-help">{field.description}</span> : null}
      </span>
    </label>
  );
}
```

- [ ] **Step 4: Create `src/admin/fields/InlineListField.jsx`** (scalar lists: address lines, stats, categories)

```jsx
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
```

- [ ] **Step 5: Create `src/admin/fields/FieldRenderer.jsx`** (dispatch; object-lists render a ManagedList link — never accordions)

```jsx
import React from 'react';
import { navigate } from '../lib/router.js';
import { itemImage, itemTitle } from '../lib/summarize.js';
import { TextField, TextareaField, SelectField, BooleanField } from './basics.jsx';
import { InlineListField } from './InlineListField.jsx';
import { ImageField } from './ImageField.jsx';

// pathPrefix: dot path of this field from the FILE ROOT (e.g. 'groups' or 'brands.2.detail.gallery').
// routeBase: [pageId, sectionId] used to build managed-list routes.
export function FieldRenderer({ field, value, onChange, pathPrefix, routeBase }) {
  const widget = field.widget || 'string';

  if (widget === 'object') {
    return (
      <section className="group-card">
        <h3 className="group-card-title">{field.label || field.name}</h3>
        {field.description ? <div className="field-help">{field.description}</div> : null}
        <div className="field-grid">
          {(field.fields || []).map(child => (
            <FieldRenderer
              key={child.name}
              field={child}
              value={value?.[child.name]}
              onChange={next => onChange({ ...(value || {}), [child.name]: next })}
              pathPrefix={`${pathPrefix}.${child.name}`}
              routeBase={routeBase}
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
    return <ImageField field={field} value={value} onChange={onChange} kind={widget} />;
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
```

- [ ] **Step 6: Replace the Task 10 stub `src/admin/screens/PageScreen.jsx`** (complete file)

```jsx
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
```

- [ ] **Step 7: Replace the Task 10 stub `src/admin/screens/SectionScreen.jsx`** (complete file)

```jsx
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
```

Note: `../lib/prune.js` (imported above) is created in Chunk 5 Task 15, which also ships the deferred fix that adds this `pruneEmptyAdditions` call. Until Task 15 lands, treat this Task 12 code block as its post-Task-15 final form (documented here so this task's file doesn't need a second edit) rather than something to implement standalone at this point.

- [ ] **Step 8: Temporary stubs so the build compiles** (replaced in Chunk 5): create `src/admin/screens/ItemListScreen.jsx`, `src/admin/screens/ItemEditScreen.jsx`, `src/admin/screens/WearhouseScreen.jsx`, each as:

```jsx
import React from 'react';
export function ItemListScreen() { return null; }
```

(one export per file, matching the names above), and `src/admin/fields/ImageField.jsx` as:

```jsx
import React from 'react';
import { FieldShell, TextField } from './basics.jsx';
export function ImageField({ field, value, onChange }) {
  return <TextField field={field} value={value} onChange={onChange} />;
}
```

- [ ] **Step 9: Verify** — `npm test` PASS; `npm run build` green.

- [ ] **Step 10: Commit**

```bash
git add src/admin/lib/summarize.js src/admin/lib/__tests__/summarize.test.js src/admin/screens src/admin/fields
git commit -m "feat(cms-v2): page and section screens with flat field rendering"
```

### Task 13: ImageField + MediaPicker (real implementations)

**Files:**
- Modify: `src/admin/fields/ImageField.jsx` (replace stub entirely)
- Create: `src/admin/fields/MediaPicker.jsx`

- [ ] **Step 1: Create `src/admin/fields/MediaPicker.jsx`**

```jsx
import React, { useMemo, useRef, useState } from 'react';
import { useAdmin } from '../lib/context.js';
import { useToast } from '../shell/Toasts.jsx';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

// Vercel serverless functions reject request bodies over ~4.5 MB and base64
// encoding adds ~33%, so the practical raw-file ceiling is ~3 MB.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export function MediaPicker({ kind, onSelect, onClose }) {
  const { api, mediaIndex, setMediaIndex } = useAdmin();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const files = useMemo(() => {
    const all = mediaIndex?.files || [];
    const typed = kind === 'image' ? all.filter(file => IMAGE_SHAPE.test(file.path)) : all.filter(file => !IMAGE_SHAPE.test(file.path));
    const needle = query.trim().toLowerCase();
    return needle ? typed.filter(file => file.path.toLowerCase().includes(needle)) : typed;
  }, [mediaIndex, kind, query]);

  const handleUpload = async event => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast('Files must be smaller than 3 MB. Compress it and try again.', 'error');
      event.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const data = await readFileAsDataUrl(file);
      const result = await api.upload({ name: file.name, type: file.type, data });
      setMediaIndex(current => ({
        ...(current || { files: [] }),
        files: [{ path: result.publicPath, name: file.name, size: file.size }, ...(current?.files || [])],
      }));
      toast('Uploaded. It appears on the website after your next publish.', 'success');
      onSelect(result.publicPath);
    } catch (error) {
      toast(error.message || 'Could not upload the file.', 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker-modal" onClick={event => event.stopPropagation()}>
        <div className="picker-head">
          <input className="input" placeholder="Search files by name" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
          <button type="button" className="button button-primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload new'}
          </button>
          <input ref={fileInput} type="file" className="hidden-input" accept={kind === 'image' ? 'image/*' : 'video/*'} onChange={handleUpload} />
        </div>
        <div className="picker-grid">
          {files.length ? files.map(file => (
            <button key={file.path} type="button" className="picker-cell" onClick={() => onSelect(file.path)}>
              {IMAGE_SHAPE.test(file.path) ? <img src={file.path} alt="" loading="lazy" /> : <div className="item-card-thumb"><span className="item-card-thumb-empty">{file.path.split('.').pop().toUpperCase()}</span></div>}
              <div className="picker-cell-name">{file.name || file.path.split('/').pop()}</div>
            </button>
          )) : (
            <div className="empty-state">
              <div className="empty-state-title">{mediaIndex ? 'No matching files' : 'Media list unavailable'}</div>
              <div className="empty-state-description">{mediaIndex ? 'Try another search, or upload a new file.' : 'You can still upload a new file.'}</div>
            </div>
          )}
        </div>
        <div className="picker-foot">
          <span className="field-help">{files.length} file{files.length === 1 ? '' : 's'}</span>
          <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/admin/fields/ImageField.jsx`**

```jsx
import React, { useState } from 'react';
import { FieldShell } from './basics.jsx';
import { MediaPicker } from './MediaPicker.jsx';

const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

export function ImageField({ field, value, onChange, kind = 'image' }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPath, setShowPath] = useState(false);
  const current = String(value || '');
  const hasPreview = current && IMAGE_SHAPE.test(current);

  return (
    <FieldShell field={field}>
      {current ? (
        <div className="asset-card">
          {hasPreview ? <img className="asset-card-image" src={current} alt="" /> : <a className="asset-card-file" href={current} target="_blank" rel="noreferrer">{current}</a>}
          <div className="asset-card-actions">
            <button type="button" className="button button-secondary" onClick={() => setPickerOpen(true)}>Replace</button>
            <button type="button" className="button button-ghost" onClick={() => onChange('')}>Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="asset-dropzone" onClick={() => setPickerOpen(true)}>
          <span className="asset-dropzone-title">{kind === 'image' ? 'Choose an image' : 'Choose a file'}</span>
          <span className="asset-dropzone-hint">Pick from the media library or upload new</span>
        </button>
      )}

      <button type="button" className="asset-path-toggle" onClick={() => setShowPath(open => !open)}>
        {showPath ? 'Hide file path' : 'Edit file path manually'}
      </button>
      {showPath ? <input className="input" value={current} onChange={event => onChange(event.target.value)} placeholder="/assets/media/example.jpg" /> : null}

      {pickerOpen ? (
        <MediaPicker kind={kind} onClose={() => setPickerOpen(false)} onSelect={path => { onChange(path); setPickerOpen(false); }} />
      ) : null}
    </FieldShell>
  );
}
```

- [ ] **Step 3: Verify** — `npm test` PASS; `npm run build` green.

- [ ] **Step 4: Commit**

```bash
git add src/admin/fields/ImageField.jsx src/admin/fields/MediaPicker.jsx
git commit -m "feat(cms-v2): media picker and picker-first image field"
```

**End of Chunk 4.** The admin now boots, authenticates, navigates by page, and edits flat sections with picker-based media — managed lists, wearhouse, tray, media screen, people and search arrive in Chunk 5.

---

## Chunk 5: Managed item lists and the Wearhouse joined editor

### Task 14: Config-path helpers + defaults (pure logic, TDD)

**Files:**
- Create: `src/admin/lib/configPath.js`
- Test: `src/admin/lib/__tests__/configPath.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { resolveListField, defaultValueForFields } from '../configPath.js';

const entryFields = [
  {
    name: 'groups', label: 'Store Groups', widget: 'list',
    fields: [
      { name: 'title', label: 'Title', widget: 'string' },
      {
        name: 'stores', label: 'Stores', widget: 'list',
        fields: [
          { name: 'name', label: 'Name', widget: 'string' },
          { name: 'image', label: 'Image', widget: 'image' },
        ],
      },
    ],
  },
];

describe('resolveListField', () => {
  it('resolves a root list', () => {
    expect(resolveListField(entryFields, 'groups').label).toBe('Store Groups');
  });
  it('resolves a nested list across a numeric index', () => {
    expect(resolveListField(entryFields, 'groups.2.stores').label).toBe('Stores');
  });
  it('returns null for non-list or unknown paths', () => {
    expect(resolveListField(entryFields, 'groups.2.title')).toBeNull();
    expect(resolveListField(entryFields, 'nope')).toBeNull();
  });
});

describe('defaultValueForFields', () => {
  it('builds a blank item from field defs', () => {
    const fields = [
      { name: 'name', widget: 'string' },
      { name: 'image', widget: 'image' },
      { name: 'tags', widget: 'list', field: { name: 'tag', widget: 'string' } },
      { name: 'card', widget: 'object', fields: [{ name: 'title', widget: 'string' }] },
      { name: 'size', widget: 'select', options: ['standard', 'wide'] },
      { name: 'active', widget: 'boolean' },
    ];
    expect(defaultValueForFields(fields)).toEqual({
      name: '', image: '', tags: [], card: { title: '' }, size: 'standard', active: false,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/admin/lib/configPath.js`

```js
// Walks config.yml field definitions along a dot path with numeric indexes
// (e.g. 'groups.0.stores') and returns the list field definition at the end,
// or null if the path does not land on a list-of-objects field.
export function resolveListField(fields, listPath) {
  let currentFields = fields;
  let currentField = null;
  for (const segment of String(listPath).split('.')) {
    if (/^\d+$/.test(segment)) {
      if (!currentField || currentField.widget !== 'list' || !currentField.fields) {
        return null;
      }
      currentFields = currentField.fields;
      currentField = null;
      continue;
    }
    currentField = (currentFields || []).find(field => field.name === segment) || null;
    if (!currentField) {
      return null;
    }
    currentFields = currentField.fields || null;
  }
  return currentField && currentField.widget === 'list' && currentField.fields ? currentField : null;
}

export function defaultValueForFields(fields) {
  const value = {};
  for (const field of fields || []) {
    value[field.name] = defaultValueForField(field);
  }
  return value;
}

export function defaultValueForField(field) {
  const widget = field.widget || 'string';
  if (widget === 'object') {
    return defaultValueForFields(field.fields);
  }
  if (widget === 'list') {
    return [];
  }
  if (widget === 'select') {
    const first = Array.isArray(field.options) && field.options.length ? field.options[0] : '';
    return typeof first === 'object' && first !== null ? first.value ?? '' : first;
  }
  if (widget === 'boolean') {
    return false;
  }
  if (widget === 'number') {
    return 0;
  }
  return '';
}
```

- [ ] **Step 3: Run tests** — `npm test` → PASS. Commit:

```bash
git add src/admin/lib/configPath.js src/admin/lib/__tests__/configPath.test.js
git commit -m "feat(cms-v2): config-path resolution and blank-item defaults"
```

### Task 15: ItemListScreen + ItemEditScreen (replace stubs) + prune-on-write (TDD)

**Files:**
- Modify: `src/admin/screens/ItemListScreen.jsx` (replace entirely)
- Modify: `src/admin/screens/ItemEditScreen.jsx` (replace entirely)
- Create: `src/admin/lib/prune.js`
- Test: `src/admin/lib/__tests__/prune.test.js`

**Why `prune.js` is needed:** `config.yml` defines optional keys that many real records omit — verified live examples: `brands[i].logoImage`, `brands[i].detail.gallery[i].source`, `detailGallery[i].source` in `src/_data/cms/brandsPage/brands.json`; `rosterCard.detailImage` in `src/_data/cms/wearhousePage/brands.json`. `FieldRenderer`'s spread-based `onChange` composition (see Task 12) writes such a key with `''` the moment a user's cursor touches that field — and because `store.isKeyDirty`/`isDirty` compare with `JSON.stringify`, `''` is never equal to "key absent". A section touched this way stays permanently dirty even after the user clears the field back to nothing. `pruneEmptyAdditions` drops exactly those touched-into-existence `''` keys (object keys only — array slots are never dropped, so indices never shift) before the value reaches the store.

- [ ] **Step 1: Write failing `prune.js` tests**

```js
import { describe, it, expect } from 'vitest';
import { pruneEmptyAdditions } from '../prune.js';

describe('pruneEmptyAdditions', () => {
  it('drops a top-level "" key that is absent on remote', () => {
    const next = { title: 'Hello', subtitle: '' };
    const remote = { title: 'Hello' };
    expect(pruneEmptyAdditions(next, remote)).toEqual({ title: 'Hello' });
  });

  it('keeps "" when the remote already has that key (a real clearing)', () => {
    const next = { title: 'Hello', subtitle: '' };
    const remote = { title: 'Hello', subtitle: 'Old subtitle' };
    expect(pruneEmptyAdditions(next, remote)).toEqual({ title: 'Hello', subtitle: '' });
  });

  it('drops nested empty additions, mirroring brands.json logoImage', () => {
    const next = { name: 'Closed', slug: 'closed', logoImage: '', card: { eyebrow: 'x' } };
    const remote = { name: 'Closed', slug: 'closed', card: { eyebrow: 'x' } };
    expect(pruneEmptyAdditions(next, remote)).toEqual({ name: 'Closed', slug: 'closed', card: { eyebrow: 'x' } });
  });

  it('drops "" keys touched into existence on a new array item, but keeps the array slot', () => {
    const next = [{ image: '/a.jpg', note: 'A' }, { image: '', note: '' }];
    const remote = [{ image: '/a.jpg', note: 'A' }];
    // The new item's slot is kept (array length unchanged) but its
    // touched-into-existence '' keys are pruned, leaving an empty object.
    expect(pruneEmptyAdditions(next, remote)).toEqual([{ image: '/a.jpg', note: 'A' }, {}]);
  });

  it('keeps a real value alongside a pruned "" key on a new array item', () => {
    const next = [{ image: '/a.jpg', note: 'A' }, { image: '/b.jpg', note: '' }];
    const remote = [{ image: '/a.jpg', note: 'A' }];
    expect(pruneEmptyAdditions(next, remote)).toEqual([{ image: '/a.jpg', note: 'A' }, { image: '/b.jpg' }]);
  });

  it('keeps an array slot that is itself "" (a scalar list entry)', () => {
    const next = ['a', '', 'c'];
    const remote = ['a', 'b', 'c'];
    expect(pruneEmptyAdditions(next, remote)).toEqual(['a', '', 'c']);
  });

  it('preserves key order of kept keys', () => {
    const next = { a: '1', b: '', c: '3' };
    const remote = { a: '0', c: '2' };
    const result = pruneEmptyAdditions(next, remote);
    expect(Object.keys(result)).toEqual(['a', 'c']);
    expect(result).toEqual({ a: '1', c: '3' });
  });

  it('drops a top-level "" when remote is entirely undefined', () => {
    expect(pruneEmptyAdditions('', undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/admin/lib/prune.js`

```js
// Drops keys an editor "touched into existence" but left empty, so a draft
// that is semantically identical to the published content compares clean
// under the store's JSON.stringify dirty check. Rules:
// - a scalar '' whose counterpart is absent in remote → dropped (object keys only)
// - array SLOTS are never dropped (indices must not shift); pruning recurses
//   into array items' object keys instead
// - everything else is kept verbatim; key order of kept keys is preserved
const SKIP = Symbol('skip');

function pruneValue(next, remote) {
  if (next === '' && remote === undefined) {
    return SKIP;
  }
  if (Array.isArray(next)) {
    return next.map((item, index) => {
      const pruned = pruneValue(item, Array.isArray(remote) ? remote[index] : undefined);
      return pruned === SKIP ? item : pruned;
    });
  }
  if (next && typeof next === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(next)) {
      const pruned = pruneValue(value, remote && typeof remote === 'object' && !Array.isArray(remote) ? remote[key] : undefined);
      if (pruned !== SKIP) {
        result[key] = pruned;
      }
    }
    return result;
  }
  return next;
}

export function pruneEmptyAdditions(next, remote) {
  const pruned = pruneValue(next, remote);
  return pruned === SKIP ? undefined : pruned;
}
```

- [ ] **Step 3: Run tests** — `npm test` → PASS (this also makes the Task 12 `SectionScreen.jsx` code block's `pruneEmptyAdditions` import resolve).

- [ ] **Step 4: Replace `src/admin/screens/ItemListScreen.jsx`**

```jsx
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
```

- [ ] **Step 5: Replace `src/admin/screens/ItemEditScreen.jsx`**

```jsx
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
```

Nested galleries work automatically: a `list` field inside an item renders as a Managed-items block whose route is `list/<listPath>.<index>.<childName>`.

Note: `WearhouseScreen.jsx` (Task 16) deliberately does **not** call `pruneEmptyAdditions` — its `__wearhouse.<slug>.roster.<field>` / `__wearhouse.<slug>.brand.<field>` paths are synthetic (joined-record) paths, not real file paths, so there is no single `getRemote(...)?.[path]` counterpart to prune against; that's out of scope for this fix.

- [ ] **Step 6: Verify** — `npm test` PASS (expect 8 new `prune.test.js` cases plus the existing suite); `npm run build` green.

- [ ] **Step 7: Commit**

```bash
git add src/admin/screens/ItemListScreen.jsx src/admin/screens/ItemEditScreen.jsx src/admin/screens/SectionScreen.jsx src/admin/lib/prune.js src/admin/lib/__tests__/prune.test.js
git commit -m "feat(cms-v2): master-detail item lists and item editor

Includes prune.js: drops draft keys an editor touched into existence
but left empty (vs. absent in remote), so touching an optional field
back to blank doesn't leave a section permanently dirty. Wired at the
SectionScreen and ItemEditScreen field onChange boundaries."
```

(`src/admin/screens/SectionScreen.jsx` is included here because its Task 12 code block already reflects the post-prune final form — see the note after that block — so the diff for this fix lands in this commit rather than amending Task 12's.)

### Task 16: Wearhouse joined editor (replace stub)

**Files:**
- Modify: `src/admin/screens/WearhouseScreen.jsx` (replace entirely)

Uses the manifest joined section: `files[0]` = roster.json (`rosterSection.items`), `files[1]` = brands.json (`brands`). Field definitions come from config.yml for both files; roster item fields are at the `rosterSection` object's `items` list; brand entry fields are the `brands` list.

- [ ] **Step 1: Replace `src/admin/screens/WearhouseScreen.jsx`** (complete file)

```jsx
import React, { useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { resolveListField } from '../lib/configPath.js';
import { joinWearhouse, splitWearhouse, blankRosterItem, blankBrandEntry } from '../adapters/wearhouse.js';
import { reorder } from '../lib/paths.js';
import { pruneEmptyAdditions } from '../lib/prune.js';
import { FieldRenderer } from '../fields/FieldRenderer.jsx';
import { Breadcrumbs } from './SectionScreen.jsx';
import { useToast } from '../shell/Toasts.jsx';

const slugify = value => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function WearhouseScreen({ page, section, rest }) {
  const { store, fieldConfig } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();
  const [newName, setNewName] = useState('');

  const [rosterFile, brandsFile] = section.files;
  const rosterDraft = store.getDraft(rosterFile);
  const brandsDraft = store.getDraft(brandsFile);
  const rosterEntry = fieldConfig.get(rosterFile);
  const brandsEntry = fieldConfig.get(brandsFile);
  if (!rosterDraft || !brandsDraft || !rosterEntry || !brandsEntry) {
    return <div className="skeleton" style={{ minHeight: 220 }} />;
  }

  const rosterItemFields = resolveListField(rosterEntry.fields, 'rosterSection.items')?.fields || [];
  const brandEntryFields = resolveListField(brandsEntry.fields, 'brands')?.fields || [];
  const { records } = joinWearhouse(rosterDraft.rosterSection.items || [], brandsDraft.brands || []);

  const writeRecords = nextRecords => {
    const { rosterItems, brandEntries } = splitWearhouse(nextRecords);
    store.update(rosterFile, draft => { draft.rosterSection.items = rosterItems; });
    store.update(brandsFile, draft => { draft.brands = brandEntries; });
  };

  // Records are identified by index, never by slug: joinWearhouse deliberately
  // preserves duplicate-slug records (marked so an editor can fix them), so a
  // slug does not uniquely name a record.
  const updateRecord = (idx, patch) => {
    const next = { ...patch };
    // Prune touched-into-existence '' keys from a patched half against its
    // remote counterpart, matched by the record's CURRENT (pre-patch) slug —
    // the halves live in two files where slug is the join key. New or renamed
    // records have no remote match and pass through unpruned.
    if (next.roster) {
      const remoteItem = (store.getRemote(rosterFile)?.rosterSection?.items || []).find(item => item.slug === records[idx].slug);
      next.roster = remoteItem ? pruneEmptyAdditions(next.roster, remoteItem) : next.roster;
    }
    if (next.brand) {
      const remoteEntry = (store.getRemote(brandsFile)?.brands || []).find(entry => entry.slug === records[idx].slug);
      next.brand = remoteEntry ? pruneEmptyAdditions(next.brand, remoteEntry) : next.brand;
    }
    writeRecords(records.map((record, i) => (i === idx ? { ...record, ...next } : record)));
  };

  // ---------- item mode ----------
  if (rest.length) {
    const idx = Number(rest[0]);
    const record = Number.isInteger(idx) ? records[idx] : undefined;
    if (!record) {
      return (
        <div className="empty-state">
          <div className="empty-state-title">Brand not found</div>
          <div className="empty-state-description">It may have been deleted or renamed.</div>
        </div>
      );
    }
    return (
      <div>
        <Breadcrumbs parts={[
          { label: page.label, to: ['page', page.id] },
          { label: section.label, to: ['page', page.id, section.id] },
          { label: record.name },
        ]} />
        <div className="screen-header">
          <div>
            <h2 className="screen-title">{record.name}</h2>
            <p className="screen-subtitle">One brand — its card on the Wearhouse page and its own detail page, kept in sync.</p>
          </div>
          <div className="screen-actions">
            {record.brand ? <a className="button button-ghost" href={`/wearhouse/${record.slug}/`} target="_blank" rel="noreferrer">View page ↗</a> : null}
            <button type="button" className="button button-danger" onClick={() => {
              if (window.confirm(`Delete “${record.name}” from the Wearhouse (card and detail page)?`)) {
                writeRecords(records.filter((_, i) => i !== idx));
                toast('Brand deleted.');
                navigate('page', page.id, section.id);
              }
            }}>Delete brand</button>
          </div>
        </div>

        <section className="group-card">
          <h3 className="group-card-title">Name & web address</h3>
          <div className="field-grid two-col">
            <label className="field">
              <span className="field-label">Brand name</span>
              <input className="input" value={record.name} onChange={event => {
                const name = event.target.value;
                updateRecord(idx, {
                  name,
                  roster: record.roster ? { ...record.roster, name } : record.roster,
                  brand: record.brand ? { ...record.brand, name } : record.brand,
                });
              }} />
            </label>
            <div className="field">
              <span className="field-label">Web address</span>
              <div className="field-help">/wearhouse/{record.slug}/ — renaming changes the page's link.</div>
              <button type="button" className="button button-secondary" onClick={() => {
                const input = window.prompt('New web address (lowercase, words joined by hyphens):', record.slug);
                if (input === null) {
                  return;
                }
                const nextSlug = slugify(input);
                if (!nextSlug) {
                  toast('That address is not valid.', 'error');
                  return;
                }
                if (nextSlug !== record.slug && records.some(candidate => candidate.slug === nextSlug)) {
                  toast('That address is already used by another brand.', 'error');
                  return;
                }
                writeRecords(records.map((candidate, i) => (i === idx ? {
                  ...candidate,
                  slug: nextSlug,
                  roster: candidate.roster ? { ...candidate.roster, slug: nextSlug, pageHref: `/wearhouse/${nextSlug}/` } : candidate.roster,
                  brand: candidate.brand ? { ...candidate.brand, slug: nextSlug } : candidate.brand,
                } : candidate)));
                toast('Address renamed.');
              }}>Rename address</button>
            </div>
          </div>
        </section>

        <section className="group-card">
          <h3 className="group-card-title">Card on the Wearhouse page</h3>
          {record.roster ? (
            <div className="field-grid">
              {rosterItemFields.filter(field => !['name', 'slug'].includes(field.name)).map(field => (
                <FieldRenderer key={field.name} field={field} value={record.roster[field.name]}
                  onChange={next => updateRecord(idx, { roster: { ...record.roster, [field.name]: next } })}
                  pathPrefix={`__wearhouse.${idx}.roster.${field.name}`} routeBase={[page.id, section.id]} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">No card yet</div>
              <div className="empty-state-description">This brand has a detail page but no card on the Wearhouse page.</div>
              <button type="button" className="button button-secondary" onClick={() => updateRecord(idx, { roster: blankRosterItem(record), missing: null })}>Create the card</button>
            </div>
          )}
        </section>

        <section className="group-card">
          <h3 className="group-card-title">Brand detail page</h3>
          {record.brand ? (
            <div className="field-grid">
              {brandEntryFields.filter(field => !['name', 'slug'].includes(field.name)).map(field => (
                <FieldRenderer key={field.name} field={field} value={record.brand[field.name]}
                  onChange={next => updateRecord(idx, { brand: { ...record.brand, [field.name]: next } })}
                  pathPrefix={`__wearhouse.${idx}.brand.${field.name}`} routeBase={[page.id, section.id]} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">No detail page yet</div>
              <div className="empty-state-description">This brand has a card but no detail page of its own.</div>
              <button type="button" className="button button-secondary" onClick={() => updateRecord(idx, { brand: blankBrandEntry(record), missing: null })}>Create the detail page</button>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---------- list mode ----------
  const headingFields = (rosterEntry.fields.find(field => field.name === 'rosterSection')?.fields || [])
    .filter(field => field.name !== 'items');

  const addBrand = () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    const nextSlug = slugify(name);
    if (!nextSlug) {
      toast('Use letters or numbers in the brand name.', 'error');
      return;
    }
    if (records.some(record => record.slug === nextSlug)) {
      toast('A brand with that name already exists.', 'error');
      return;
    }
    writeRecords([...records, { slug: nextSlug, name, roster: blankRosterItem({ slug: nextSlug, name }), brand: blankBrandEntry({ slug: nextSlug, name }), missing: null }]);
    setNewName('');
    // The new record has a roster half, so after the split/re-join it sits at
    // the end of the roster-ordered records, BEFORE any brand-only orphans.
    navigate('page', page.id, section.id, String(records.filter(record => record.roster).length));
  };

  return (
    <div>
      <Breadcrumbs parts={[{ label: page.label, to: ['page', page.id] }, { label: section.label }]} />
      <div className="screen-header">
        <div>
          <h2 className="screen-title">{section.label}</h2>
          <p className="screen-subtitle">Each brand has a card on the Wearhouse page and its own detail page — edited together here.</p>
        </div>
        <div className="screen-actions">
          <input className="input" placeholder="New brand name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addBrand(); }} />
          <button type="button" className="button button-primary" onClick={addBrand} disabled={!newName.trim()}>Add brand</button>
        </div>
      </div>

      <section className="group-card">
        <h3 className="group-card-title">Section heading</h3>
        <div className="field-grid two-col">
          {headingFields.map(field => (
            <FieldRenderer key={field.name} field={field} value={rosterDraft.rosterSection[field.name]}
              onChange={next => store.update(rosterFile, draft => { draft.rosterSection[field.name] = next; })}
              pathPrefix={`rosterSection.${field.name}`} routeBase={[page.id, section.id]} />
          ))}
        </div>
      </section>

      <div className="item-grid" style={{ marginTop: 12 }}>
        {records.map((record, index) => {
          const thumb = record.roster?.hoverImage || record.roster?.logoSrc || record.brand?.rosterCard?.detailImage || null;
          return (
            <div key={index} className="item-card" role="button" tabIndex={0}
              onClick={() => navigate('page', page.id, section.id, String(index))}
              onKeyDown={event => { if (event.key === 'Enter') navigate('page', page.id, section.id, String(index)); }}>
              <div className="item-card-thumb">
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="item-card-thumb-empty">No image</span>}
              </div>
              <div className="item-card-body">
                <div className="item-card-title">{record.name}</div>
                <div className="item-card-subtitle">{record.roster?.segment || record.brand?.rosterCard?.segment || '—'}</div>
              </div>
              <div className="item-card-flags" onClick={event => event.stopPropagation()}>
                {record.missing === 'brand' ? <span className="badge badge-warning">Missing detail page</span> : null}
                {record.missing === 'roster' ? <span className="badge badge-warning">Missing card</span> : null}
                <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => writeRecords(reorder(records, index, index - 1))}>↑</button>
                <button type="button" className="icon-button" title="Move down" disabled={index === records.length - 1} onClick={() => writeRecords(reorder(records, index, index + 1))}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Note on `headingFields`: it is the `rosterSection` object's child fields minus `items` — the eyebrow/title texts shown above the brand grid.

- [ ] **Step 2: Verify** — `npm test` PASS; `npm run build` green.

- [ ] **Step 3: Commit**

```bash
git add src/admin/screens/WearhouseScreen.jsx
git commit -m "feat(cms-v2): wearhouse joined brand editor with sync warnings"
```

**End of Chunk 5.**

---

## Chunk 6: Changes tray, publish, media screen, people, search

### Task 17: Changes tray + publish dialog + validation + unload guard

**Files:**
- Create: `src/admin/shell/ChangesTray.jsx`
- Modify: `src/admin/shell/Topbar.jsx` (mount the tray)

- [ ] **Step 1: Create `src/admin/shell/ChangesTray.jsx`** (complete file)

```jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { allSections, sectionsForFile } from '../manifest.js';
import { navigate } from '../lib/router.js';
import { validateValue } from '../lib/validate.js';
import { useToast } from './Toasts.jsx';

const timeAgo = iso => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

function sectionIsDirty(store, section) {
  if (section.joined) {
    return section.files.some(filePath => store.isDirty(filePath));
  }
  return section.keys.some(key => store.isKeyDirty(section.file, key));
}

export function ChangesTray() {
  const { store, fieldConfig, api } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [publishPending, setPublishPending] = useState(false);
  const [deploys, setDeploys] = useState(null);
  const [revertPending, setRevertPending] = useState(false);

  const dirtyPaths = store.dirtyPaths();
  const rows = useMemo(() => allSections().filter(section => sectionIsDirty(store, section)), [store.getVersion()]);

  // Warn when leaving mid-publish or with unpublished changes.
  useEffect(() => {
    const handler = event => {
      if (publishPending || store.dirtyPaths().length) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [publishPending]);

  useEffect(() => {
    if (open) {
      api.deploys(3).then(payload => setDeploys(payload.deploys || [])).catch(() => setDeploys([]));
    }
  }, [open]);

  // Validate only what changed: for each dirty file, only its dirty top-level
  // keys. Issue crumbs use manifest page/section labels (editor language),
  // never config.yml's internal labels. (Inline in-form flags are deliberately
  // de-scoped for Phase 1 — the tray list is the single validation surface.)
  const issues = useMemo(() => {
    const found = [];
    for (const filePath of dirtyPaths) {
      const entry = fieldConfig.get(filePath);
      if (!entry) {
        continue;
      }
      for (const field of entry.fields) {
        if (!store.isKeyDirty(filePath, field.name)) {
          continue;
        }
        const owner = allSections().find(section => !section.joined && section.file === filePath && section.keys.includes(field.name))
          || sectionsForFile(filePath)[0];
        const crumb = owner ? `${owner.pageLabel} — ${owner.label}` : entry.label || filePath;
        found.push(...validateValue([field], store.getDraft(filePath), crumb));
      }
    }
    return found;
  }, [store.getVersion()]);

  const discardRow = section => {
    const message = section.joined
      ? `Discard unpublished changes to “${section.label}”? This restores both Wearhouse files to the published version.`
      : `Discard unpublished changes to “${section.label}”?`;
    if (!window.confirm(message)) {
      return;
    }
    if (section.joined) {
      section.files.forEach(filePath => store.discardFile(filePath));
    } else {
      store.discardKeys(section.file, section.keys);
    }
    toast('Changes discarded.');
  };

  const publish = async () => {
    setPublishPending(true);
    try {
      // Snapshot the payload ONCE and account against that exact snapshot:
      // an edit made while the request is in flight must stay dirty rather
      // than being silently marked clean by a re-read of the current drafts.
      const paths = store.dirtyPaths();
      const files = paths.map(path => ({ path, content: `${JSON.stringify(store.getDraft(path), null, 2)}\n` }));
      const result = await api.publish(files, `Update CMS content (${paths.length} file${paths.length === 1 ? '' : 's'})`);
      store.markPublishedContent(files);
      setConfirming(false);
      setOpen(false);
      toast(
        result.deployTriggered === false
          ? 'Published. The site did not redeploy automatically — it may need a manual deploy.'
          : 'Published. The website updates in about a minute.',
        'success',
      );
    } catch (error) {
      toast(error.message || 'Could not publish.', 'error');
    } finally {
      setPublishPending(false);
    }
  };

  const revertLatest = async () => {
    const latest = deploys?.[0];
    if (!latest || !window.confirm(`Undo the last publish (${latest.message})? This creates a new rollback publish.`)) {
      return;
    }
    setRevertPending(true);
    try {
      await api.revert(latest.sha);
      // Do NOT reload content from /cms-data here: the currently deployed
      // build still serves the just-undone content until the rollback deploy
      // finishes (~1–2 min). Reloading now would silently re-arm the undone
      // changes as a clean baseline. The editor reloads the admin instead.
      toast('Last publish undone. Reload the admin in about a minute to see the restored content.', 'success');
      setOpen(false);
    } catch (error) {
      toast(error.message || 'Could not undo the last publish.', 'error');
    } finally {
      setRevertPending(false);
    }
  };

  return (
    <>
      <button type="button" className={`button ${rows.length ? 'button-primary' : 'button-secondary'}`} onClick={() => setOpen(true)}>
        Changes{rows.length ? ` (${rows.length})` : ''}
      </button>

      {open ? (
        <>
          <div className="tray-backdrop" onClick={() => setOpen(false)} />
          <aside className="tray-panel">
            <div className="tray-head">
              <h3 className="tray-title">Unpublished changes</h3>
              <button type="button" className="button button-ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="tray-body">
              {rows.length ? rows.map(section => (
                <div key={`${section.pageId}:${section.id}`} className="tray-row">
                  <div>
                    <div className="tray-row-title">{section.pageLabel} — {section.label}</div>
                    <div className="tray-row-sub">Saved for you; not yet on the website.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="button button-ghost" onClick={() => { setOpen(false); navigate('page', section.pageId, section.id); }}>Open</button>
                    <button type="button" className="button button-ghost" onClick={() => discardRow(section)}>Discard</button>
                  </div>
                </div>
              )) : (
                <div className="empty-state">
                  <div className="empty-state-title">Everything is published</div>
                  <div className="empty-state-description">Edits you make are listed here before they go live.</div>
                </div>
              )}
              {issues.length ? (
                <div className="issue-list">
                  <strong>Fix these before publishing:</strong>
                  {issues.map((issue, index) => (
                    <div key={index} className="issue-row"><strong>{issue.label}:</strong> {issue.message}</div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="tray-foot">
              {deploys?.length ? (
                <div className="field-help">Last published {timeAgo(deploys[0].date)} · {deploys[0].message}</div>
              ) : null}
              <button type="button" className="button button-primary" disabled={!rows.length || issues.length > 0 || publishPending} onClick={() => setConfirming(true)}>
                {publishPending ? 'Publishing…' : `Publish ${rows.length ? `${rows.length} change${rows.length === 1 ? '' : 's'}` : ''}`}
              </button>
              {deploys?.length ? (
                <button type="button" className="button button-ghost" disabled={revertPending} onClick={revertLatest}>
                  {revertPending ? 'Undoing…' : 'Undo last publish'}
                </button>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {confirming ? (
        <div className="publish-modal" role="presentation" onClick={() => setConfirming(false)}>
          <div className="publish-modal-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
            <div className="publish-modal-head">
              <div>
                <div className="publish-modal-kicker">Confirm publish</div>
                <h3 className="publish-modal-title">Put these changes on the website?</h3>
                <p className="publish-modal-copy">The website rebuilds and shows them in about a minute.</p>
              </div>
              <div className="publish-modal-counts">
                <div className="publish-modal-count">{rows.length} section{rows.length === 1 ? '' : 's'}</div>
              </div>
            </div>
            <div className="publish-modal-summary">
              {rows.map(section => (
                <span key={`${section.pageId}:${section.id}`} className="publish-modal-chip">{section.pageLabel} — {section.label}</span>
              ))}
            </div>
            <div className="publish-modal-actions">
              <button type="button" className="button button-ghost" onClick={() => setConfirming(false)} disabled={publishPending}>Cancel</button>
              <button type="button" className="button button-primary" onClick={publish} disabled={publishPending}>
                {publishPending ? 'Publishing…' : 'Publish to the website'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

Known limitation (pre-existing, identical to the old admin): if the publish commit lands but the deploy hook then fails, `/api/publish` responds 502 — the tray shows an error toast and keeps the files dirty even though the commit is already on GitHub; a retry produces a duplicate-content commit. (A 200 with `deployTriggered: false` means no deploy hook is configured; the success toast says the site may need a manual deploy.)

- [ ] **Step 2: Mount in `src/admin/shell/Topbar.jsx`** — replace `<div id="topbar-tray-slot" />` with `<ChangesTray />` and add `import { ChangesTray } from './ChangesTray.jsx';`.

- [ ] **Step 3: Verify** — `npm test` PASS; `npm run build` green.

- [ ] **Step 4: Commit**

```bash
git add src/admin/shell/ChangesTray.jsx src/admin/shell/Topbar.jsx
git commit -m "feat(cms-v2): changes tray with validation-gated publish, undo, unload guard"
```

### Task 18: Media screen

**Files:**
- Modify: `src/admin/fields/MediaPicker.jsx` (extract `useMediaUpload` hook)
- Modify: `src/admin/fields/ImageField.jsx` (drag-and-drop upload on the dropzone)
- Create: `src/admin/screens/MediaScreen.jsx`
- Modify: `src/admin/shell/Shell.jsx` (route `media` to the real screen)

- [ ] **Step 1: Extract the upload hook in `MediaPicker.jsx`.** Add this export and rewrite the picker's `handleUpload` to use it (behavior unchanged). Note: a review fix on `MediaPicker.jsx` already added a `MAX_UPLOAD_BYTES` size guard (Vercel's ~4.5 MB request-body ceiling, ~3 MB after base64 overhead) ahead of this task — the guard moves into the hook so every caller (picker, field, media screen) gets it, checked before the file is read/encoded:

```jsx
export function useMediaUpload(onUploaded, successMessage = 'Uploaded. Use it in a section and publish to show it on the website.') {
  const { api, setMediaIndex } = useAdmin();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const upload = async file => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast('Files must be smaller than 3 MB. Compress it and try again.', 'error');
      return;
    }
    setUploading(true);
    try {
      const data = await readFileAsDataUrl(file);
      const result = await api.upload({ name: file.name, type: file.type, data });
      setMediaIndex(current => ({
        ...(current || { files: [] }),
        files: [{ path: result.publicPath, name: file.name, size: file.size }, ...(current?.files || [])],
      }));
      toast(successMessage, 'success');
      onUploaded(result.publicPath);
    } catch (error) {
      toast(error.message || 'Could not upload the file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return { uploading, upload };
}
```

(The message is a parameter because context differs: from a field, the image shows after the section is published; from the Media screen, the file is simply added to the library — `MediaScreen` passes `'Uploaded to the library.'`. Note: the index records name/size only; image dimensions are deliberately omitted — spec §4.4 says "when known".)

In the picker: `const { uploading, upload } = useMediaUpload(path => onSelect(path));` and

```jsx
const handleUpload = event => {
  const file = event.target.files?.[0];
  if (file) {
    upload(file);
  }
  event.target.value = '';
};
```

Remove the now-unused local upload state/logic.

- [ ] **Step 1b: Restore drag-and-drop upload on the ImageField dropzone** (spec §4.2 carries the drag-drop uploader over). In `src/admin/fields/ImageField.jsx`, import and use the hook, and add drop handling to the empty-state dropzone:

```jsx
import { MediaPicker, useMediaUpload } from './MediaPicker.jsx';
import { useToast } from '../shell/Toasts.jsx';
// inside the component:
const [dragOver, setDragOver] = useState(false);
const { uploading, upload } = useMediaUpload(path => onChange(path));
const toast = useToast();
```

Replace the empty-state dropzone button with:

```jsx
<button
  type="button"
  className={`asset-dropzone ${dragOver ? 'is-dragover' : ''}`}
  onClick={() => setPickerOpen(true)}
  onDragOver={event => { event.preventDefault(); setDragOver(true); }}
  onDragLeave={() => setDragOver(false)}
  onDrop={event => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    // Match the picker's accept filter: image fields take images,
    // file fields take videos.
    const fits = kind === 'image' ? file.type.startsWith('image/') : file.type.startsWith('video/');
    if (!fits) {
      toast('That file type does not fit this field.', 'error');
      return;
    }
    upload(file);
  }}
>
  <span className="asset-dropzone-title">{uploading ? 'Uploading…' : kind === 'image' ? 'Choose an image' : 'Choose a file'}</span>
  <span className="asset-dropzone-hint">Drop a file here, pick from the library, or upload new</span>
</button>
```

(`.asset-dropzone.is-dragover` already exists in `admin.css`; `.asset-dropzone > * { pointer-events: none; }` keeps child spans from stealing dragenter/dragleave and flickering the dragover state.)

- [ ] **Step 2: Create `src/admin/screens/MediaScreen.jsx`**

```jsx
import React, { useMemo, useRef, useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { sectionsForFile } from '../manifest.js';
import { useMediaUpload } from '../fields/MediaPicker.jsx';
import { useToast } from '../shell/Toasts.jsx';

const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const formatSize = bytes => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function MediaScreen() {
  const { store, mediaIndex } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();
  const [query, setQuery] = useState('');
  const fileInput = useRef(null);
  const { uploading, upload } = useMediaUpload(() => {}, 'Uploaded to the library.');

  // Where is each media file used? Serialize per top-level key so hits credit
  // the section that actually contains the image (files are shared by
  // several sections, e.g. company.json powers four of them).
  const usedIn = useMemo(() => {
    const keyTexts = [];
    for (const filePath of store.allPaths()) {
      const draft = store.getDraft(filePath) || {};
      for (const [key, value] of Object.entries(draft)) {
        const section = sectionsForFile(filePath).find(candidate => !candidate.joined && candidate.keys.includes(key))
          || sectionsForFile(filePath)[0];
        keyTexts.push({ label: section ? `${section.pageLabel} — ${section.label}` : filePath, text: JSON.stringify(value) });
      }
    }
    const map = new Map();
    for (const media of mediaIndex?.files || []) {
      const hits = keyTexts.filter(entry => entry.text.includes(media.path)).map(entry => entry.label);
      map.set(media.path, [...new Set(hits)]);
    }
    return map;
  }, [mediaIndex, store.getVersion()]);

  const files = useMemo(() => {
    const all = mediaIndex?.files || [];
    const needle = query.trim().toLowerCase();
    return needle ? all.filter(file => file.path.toLowerCase().includes(needle)) : all;
  }, [mediaIndex, query]);

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">Media</h2>
          <p className="screen-subtitle">Every image and video available to the website.</p>
        </div>
        <div className="screen-actions">
          <button type="button" className="button button-primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <input ref={fileInput} type="file" className="hidden-input" onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ''; }} />
        </div>
      </div>

      <div className="media-toolbar">
        <input className="input" placeholder="Search files by name" value={query} onChange={event => setQuery(event.target.value)} />
        <span className="field-help">{files.length} file{files.length === 1 ? '' : 's'}</span>
      </div>

      {mediaIndex ? (
        <div className="item-grid">
          {files.map(file => {
            const uses = usedIn.get(file.path) || [];
            return (
              <div key={file.path} className="item-card">
                <div className="item-card-thumb">
                  {IMAGE_SHAPE.test(file.path) ? <img src={file.path} alt="" loading="lazy" /> : <span className="item-card-thumb-empty">{file.path.split('.').pop().toUpperCase()}</span>}
                </div>
                <div className="item-card-body">
                  <div className="item-card-title" style={{ wordBreak: 'break-all', fontSize: 12 }}>{file.name || file.path.split('/').pop()}</div>
                  <div className="item-card-subtitle">{formatSize(file.size)} · {uses.length ? uses.slice(0, 2).join(', ') + (uses.length > 2 ? '…' : '') : 'Not used'}</div>
                </div>
                <div className="item-card-flags">
                  <button type="button" className="button button-ghost" onClick={() => { navigator.clipboard.writeText(file.path); toast('Path copied.'); }}>Copy path</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-title">Media list unavailable</div>
          <div className="empty-state-description">The library index could not be loaded. You can still upload files, and image fields still work.</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Route it.** In `Shell.jsx`, import `MediaScreen` and replace the `media` placeholder branch with `return <MediaScreen />;`.

- [ ] **Step 4: Verify** — `npm test` PASS; `npm run build` green.

- [ ] **Step 5: Commit**

```bash
git add src/admin/fields/MediaPicker.jsx src/admin/fields/ImageField.jsx src/admin/screens/MediaScreen.jsx src/admin/shell/Shell.jsx
git commit -m "feat(cms-v2): media library screen, drag-drop uploads, where-used"
```

### Task 19: People screen + topbar search

**Files:**
- Create: `src/admin/screens/PeopleScreen.jsx`
- Create: `src/admin/shell/Search.jsx`
- Modify: `src/admin/shell/Shell.jsx` (route `people`), `src/admin/shell/Topbar.jsx` (mount search)

- [ ] **Step 1: Create `src/admin/screens/PeopleScreen.jsx`** (same behavior as the current admin's People panel, against the unchanged `/api/admin/users`)

```jsx
import React, { useEffect, useState } from 'react';
import { useAdmin } from '../lib/context.js';
import { useToast } from '../shell/Toasts.jsx';

export function PeopleScreen() {
  const { api, user: me } = useAdmin();
  const toast = useToast();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'editor' });
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState('');

  const reload = () => {
    setError('');
    api.listUsers().then(payload => setPeople(payload.users || [])).catch(err => { setPeople([]); setError(err.message); });
  };
  useEffect(reload, []);

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.addUser(form);
      toast(`${form.email} can sign in now.`, 'success');
      setForm({ name: '', email: '', password: '', role: 'editor' });
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, action) => {
    setPendingId(id);
    try {
      await action();
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPendingId('');
    }
  };

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">People</h2>
          <p className="screen-subtitle">Who can edit the website. Admins can also manage people.</p>
        </div>
      </div>

      <section className="group-card">
        <h3 className="group-card-title">Add a person</h3>
        <form className="field-grid two-col" onSubmit={submit}>
          <label className="field"><span className="field-label">Name</span>
            <input className="input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Full name" /></label>
          <label className="field"><span className="field-label">Email</span>
            <input className="input" type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="person@company.com" autoComplete="off" /></label>
          <label className="field"><span className="field-label">Password</span>
            <input className="input" type="text" required minLength={6} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters" autoComplete="off" /></label>
          <label className="field"><span className="field-label">Role</span>
            <select className="select" value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>
              <option value="editor">Editor — can edit the website</option>
              <option value="admin">Admin — can also manage people</option>
            </select></label>
          <div className="field-span">
            <button className="button button-primary" type="submit" disabled={saving || !form.email || form.password.length < 6}>
              {saving ? 'Saving…' : 'Add person'}
            </button>
          </div>
        </form>
      </section>

      <section className="group-card">
        <h3 className="group-card-title">Current people</h3>
        {people === null ? <div className="skeleton" /> : error ? (
          <div className="empty-state"><div className="empty-state-title">Could not load people</div><div className="empty-state-description">{error}</div></div>
        ) : (
          <div className="section-rows">
            {people.map(person => {
              const isSelf = person.id === me.id;
              const busy = pendingId === person.id;
              return (
                <div key={person.id} className="tray-row">
                  <div>
                    <div className="tray-row-title">{person.email} {isSelf ? '· you' : ''} <span className={`badge ${person.role === 'admin' ? 'badge-warning' : 'badge-neutral'}`}>{person.role === 'admin' ? 'Admin' : 'Editor'}</span></div>
                    <div className="tray-row-sub">{person.name || 'No name'} · {person.lastSignInAt ? `Last sign in ${new Date(person.lastSignInAt).toLocaleString()}` : 'Never signed in'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="button button-ghost" disabled={busy} onClick={() => {
                      const next = window.prompt(`New password for ${person.email} (at least 6 characters):`);
                      if (next === null) return;
                      if (next.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
                      act(person.id, () => api.updateUser({ id: person.id, password: next }).then(() => toast('Password updated.', 'success')));
                    }}>Reset password</button>
                    <button type="button" className="button button-ghost" disabled={busy || isSelf} onClick={() => act(person.id, () => api.updateUser({ id: person.id, role: person.role === 'admin' ? 'editor' : 'admin' }))}>
                      {person.role === 'admin' ? 'Make editor' : 'Make admin'}
                    </button>
                    {!isSelf ? (
                      <button type="button" className="button button-danger" disabled={busy} onClick={() => {
                        if (window.confirm(`Remove ${person.email}? They lose access immediately.`)) {
                          act(person.id, () => api.removeUser(person.id));
                        }
                      }}>Remove</button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/admin/shell/Search.jsx`**

```jsx
import React, { useMemo, useState } from 'react';
import { PAGES, allSections } from '../manifest.js';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { itemTitle } from '../lib/summarize.js';

const CMS = 'src/_data/cms';

export function Search() {
  const { store } = useAdmin();
  useStoreVersion(store);
  const [query, setQuery] = useState('');

  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) {
      return [];
    }
    const results = [];
    for (const page of PAGES) {
      if (page.label.toLowerCase().includes(needle)) {
        results.push({ title: page.label, sub: 'Page', to: ['page', page.id] });
      }
    }
    for (const section of allSections()) {
      if (section.label.toLowerCase().includes(needle)) {
        results.push({ title: section.label, sub: section.pageLabel, to: ['page', section.pageId, section.id] });
      }
    }
    const bgBrands = store.getDraft(`${CMS}/brandsPage/brands.json`)?.brands || [];
    bgBrands.forEach((brand, index) => {
      if (itemTitle(brand).toLowerCase().includes(needle)) {
        results.push({ title: itemTitle(brand), sub: 'Bollag brand', to: ['page', 'brands', 'all-brands', 'list', 'brands', String(index)] });
      }
    });
    const rosterItems = store.getDraft(`${CMS}/wearhousePage/roster.json`)?.rosterSection?.items || [];
    // Wearhouse records are index-addressed (roster order = joined-record
    // order for records with a roster half), matching WearhouseScreen.
    rosterItems.forEach((item, index) => {
      if ((item.name || '').toLowerCase().includes(needle)) {
        results.push({ title: item.name, sub: 'Wearhouse brand', to: ['page', 'wearhouse', 'wearhouse-brands', String(index)] });
      }
    });
    const groups = store.getDraft(`${CMS}/stores.json`)?.groups || [];
    groups.forEach((group, groupIndex) => {
      (group.stores || []).forEach((storeItem, storeIndex) => {
        if ((storeItem.name || '').toLowerCase().includes(needle)) {
          results.push({ title: storeItem.name, sub: `Store — ${group.title || ''}`, to: ['page', 'stores', 'store-list', 'list', `groups.${groupIndex}.stores`, String(storeIndex)] });
        }
      });
    });
    return results.slice(0, 12);
  }, [query, store.getVersion()]);

  return (
    <div className="search-wrap">
      <input
        className="input" placeholder="Search pages, sections, brands, stores…"
        value={query} onChange={event => setQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }}
        onBlur={() => setTimeout(() => setQuery(''), 150)} // delayed so a hit's onMouseDown (which fires before blur completes) still navigates
      />
      {hits.length ? (
        <div className="search-pop">
          {hits.map((hit, index) => (
            <button key={index} type="button" className="search-hit" onMouseDown={() => { navigate(...hit.to); setQuery(''); }}>
              <div className="search-hit-title">{hit.title}</div>
              <div className="search-hit-sub">{hit.sub}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Wire both.** In `Shell.jsx`: import `PeopleScreen`, replace the `people` placeholder branch with `return <PeopleScreen />;` (keep it admin-only: if `user?.role !== 'admin'`, render the NotFound state instead). In `Topbar.jsx`: import `Search` and replace `<div className="topbar-left" id="topbar-search-slot" />` with `<div className="topbar-left"><Search /></div>`.

- [ ] **Step 4: Verify** — `npm test` PASS; `npm run build` green.

- [ ] **Step 5: Commit**

```bash
git add src/admin/screens/PeopleScreen.jsx src/admin/shell/Search.jsx src/admin/shell/Shell.jsx src/admin/shell/Topbar.jsx
git commit -m "feat(cms-v2): people screen and global search"
```

**End of Chunk 6.**

---

### Task 19b: Legal Notice CMS page (added by owner request)

Makes the previously-hardcoded `/legal-notice/` page editable: extracts its text into
`src/_data/cms/legalNotice.json`, wires that file into the global `cms` data object,
rewrites the template to render from `cms.legalNotice.*`, and adds the corresponding
`config.yml` collection and `manifest.js` page entry.

**Files:**
- Create: `src/_data/cms/legalNotice.json`
- Modify: `src/_data/cms.js` (register the new file on the `cms` data object — required for `cms.legalNotice.*` to resolve in templates; not part of the original ask but load-bearing)
- Modify: `src/legal-notice/index.njk` (render from `cms.legalNotice.*` instead of hardcoded text)
- Modify: `src/admin/config.yml` (new `legal_page` collection)
- Modify: `src/admin/manifest.js` (new `legal` page entry, before `site`)

**Design note — the email-link paragraph:** the Privacy Policy's first paragraph ("The
controller for data processing on this website is Bollag-Guggenheim AG... Privacy
enquiries can be sent to `{{ cms.site.footer.bgContact.emailLabel }}`") contains an
inline mailto link built from `cms.site.footer.bgContact`. Rather than encoding HTML
markup inside a CMS text field, that one paragraph stays **hardcoded in the template**,
above the `paragraphs` loop. `legalNotice.json`'s `privacy.paragraphs` array holds the
remaining 7 plain-text paragraphs (i.e. everything except that first link-bearing
paragraph and the "Last updated" line, which has its own `lastUpdated` field).

- [ ] **Step 1: Create `src/_data/cms/legalNotice.json`** — current page text transcribed verbatim.

```json
{
  "hero": {
    "eyebrow": "Legal Notice",
    "title": "Legal Notice & Privacy Policy.",
    "summary": "Company information, website responsibility, and privacy information for the Bollag-Guggenheim website."
  },
  "legal": {
    "title": "Legal Notice",
    "bollag": {
      "name": "Bollag-Guggenheim AG",
      "addressLines": ["Thurgauerstrasse 113", "CH-8152 Glattpark", "Switzerland"],
      "responsibility": "Responsible for the website content: Bollag-Guggenheim AG."
    },
    "wearhouse": {
      "name": "The Wearhouse Fashion Trade GmbH",
      "addressLines": ["Seestrasse 78", "8703 Erlenbach", "Switzerland"]
    }
  },
  "liability": {
    "title": "Liability & Copyright",
    "paragraphs": [
      "We prepare the content of this website with care. However, we cannot guarantee that all information is complete, current, or free from errors at all times.",
      "This website may link to external websites. Bollag-Guggenheim AG is not responsible for the content or data processing practices of external websites.",
      "All website content, images, logos, texts, and design elements are protected by copyright or trademark rights unless otherwise stated. Use requires prior permission from the respective rights holder."
    ]
  },
  "privacy": {
    "title": "Privacy Policy",
    "paragraphs": [
      "We process personal data only as needed to operate this website, answer enquiries, maintain security, fulfil business communication, and comply with legal obligations. Depending on the case, this may include contact details, message content, technical access data, and correspondence history.",
      "When you use the contact form, the information you submit is sent to our team by email and used to process your enquiry. Required fields are used only to respond to the message and manage related communication.",
      "When you visit the website, technical data such as IP address, browser information, requested pages, timestamps, and server log data may be processed by us or by our hosting providers for delivery, troubleshooting, and security.",
      "This website does not intentionally use analytics cookies on the public pages. Links to external services, such as Google Maps, open third-party websites that process data under their own privacy policies.",
      "The website administration area uses Supabase authentication and internal CMS tools for authorised editors. These services are not required for ordinary public website visitors.",
      "We retain personal data only for as long as necessary for the relevant purpose, contractual or business communication, security, or legal retention requirements.",
      "Subject to applicable law, you may request access, correction, deletion, restriction, or objection to the processing of your personal data. You may also contact the competent data protection authority where applicable."
    ],
    "lastUpdated": "7 June 2026",
    "document": {
      "label": "Datenschutzerklärung — full privacy policy",
      "note": "PDF · German · Updated 2 July 2026",
      "href": "/assets/documents/datenschutzerklaerung-bollag-guggenheim.pdf"
    }
  }
}
```

- [ ] **Step 2: Register the file on the `cms` data object** — `src/_data/cms.js` only exposes the JSON files it explicitly `require`s as `cms.<key>`; without this, `cms.legalNotice` is `undefined` in templates.

```js
module.exports = {
  site: require("./cms/site.json"),
  home: require("./cms/home"),
  company: require("./cms/company.json"),
  contact: require("./cms/contact.json"),
  stores: require("./cms/stores.json"),
  agenda: require("./cms/agenda.json"),
  legalNotice: require("./cms/legalNotice.json"),
  brandsPage: require("./cms/brandsPage"),
  wearhousePage: require("./cms/wearhousePage"),
  selection: require("./cms/home").selection
};
```

- [ ] **Step 3: Rewrite `src/legal-notice/index.njk`** to render from `cms.legalNotice.*`, preserving the exact design. Address lines and paragraph lists render via `{% for %}` loops with leading-whitespace trim (`{%- for ... %}` / `{%- endfor %}`) so the built HTML has no extra blank lines. All CMS-sourced fields go through Nunjucks' default auto-escaping (no `| safe`), like every other CMS field on the site — so the two fields containing a literal `&` (`hero.title`, `liability.title`) come out as `&amp;` in the built HTML. Those two `&` → `&amp;` hunks are the only expected before/after diff and are visually identical: browsers render `&amp;` and a bare `&` between tags as the same glyph, and escaping keeps these fields from being an HTML-injection surface. The two contact blocks keep pulling phone/email from `cms.site.footer.bgContact` / `wearhouseContact`, unchanged. The privacy section's first, link-bearing paragraph stays hardcoded above the `paragraphs` loop (see design note above).

```njk
---
layout: layouts/base.njk
title: Legal Notice & Privacy Policy | Bollag-Guggenheim
---
{% include "components/site-header.njk" %}

<section class="relative isolate overflow-hidden bg-ink text-bone">
  <div class="relative mx-auto flex min-h-[54svh] w-full max-w-[1600px] items-end px-6 pb-12 pt-32 sm:px-10 lg:px-16 lg:pb-16">
    <div class="max-w-[64rem]">
      <p class="type-eyebrow-hero mb-4 text-bone/54" data-reveal>{{ cms.legalNotice.hero.eyebrow }}</p>
      <h1 class="type-hero-title max-w-[12ch]" data-reveal>
        {{ cms.legalNotice.hero.title }}
      </h1>
      <p class="type-body-lg mt-6 max-w-[42rem] text-bone/82" data-reveal>
        {{ cms.legalNotice.hero.summary }}
      </p>
    </div>
  </div>
</section>

<section class="bg-[#FAF8F6] text-ink">
  <div class="mx-auto w-full max-w-[1600px] px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
    <div class="grid gap-12 border-t border-black/10 pt-8 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)] lg:gap-16">
      <aside class="lg:sticky lg:top-28 lg:self-start">
        <p class="type-eyebrow mb-4 text-black/40" data-reveal>Information</p>
        <h2 class="type-section-title max-w-[11ch] text-black" data-reveal>
          Legal details.
        </h2>
      </aside>

      <div class="space-y-10">
        <section class="border border-black/10 bg-white/40 p-6 lg:p-8" data-reveal>
          <p class="type-label mb-4 text-black/38">{{ cms.legalNotice.legal.title }}</p>
          <div class="type-body type-body-stack text-black/72">
            <p>
              <strong>{{ cms.legalNotice.legal.bollag.name }}</strong><br>
              {% for line in cms.legalNotice.legal.bollag.addressLines %}{{ line }}{% if not loop.last %}<br>
              {% endif %}{% endfor %}
            </p>
            <p>
              Phone: <a href="{{ cms.site.footer.bgContact.phoneHref }}" class="nav-link inline-flex pb-1 transition duration-300 hover:text-black">{{ cms.site.footer.bgContact.phoneLabel }}</a><br>
              Email: <a href="{{ cms.site.footer.bgContact.emailHref }}" class="nav-link inline-flex pb-1 transition duration-300 hover:text-black">{{ cms.site.footer.bgContact.emailLabel }}</a>
            </p>
            <p>
              {{ cms.legalNotice.legal.bollag.responsibility }}
            </p>
            <p>
              <strong>{{ cms.legalNotice.legal.wearhouse.name }}</strong><br>
              {% for line in cms.legalNotice.legal.wearhouse.addressLines %}{{ line }}{% if not loop.last %}<br>
              {% endif %}{% endfor %}
            </p>
            <p>
              Phone: <a href="{{ cms.site.footer.wearhouseContact.phoneHref }}" class="nav-link inline-flex pb-1 transition duration-300 hover:text-black">{{ cms.site.footer.wearhouseContact.phoneLabel }}</a><br>
              Email: <a href="{{ cms.site.footer.wearhouseContact.emailHref }}" class="nav-link inline-flex pb-1 transition duration-300 hover:text-black">{{ cms.site.footer.wearhouseContact.emailLabel }}</a>
            </p>
          </div>
        </section>

        <section class="border border-black/10 bg-white/40 p-6 lg:p-8" data-reveal>
          <p class="type-label mb-4 text-black/38">{{ cms.legalNotice.liability.title }}</p>
          <div class="type-body type-body-stack text-black/72">
            {%- for paragraph in cms.legalNotice.liability.paragraphs %}
            <p>
              {{ paragraph }}
            </p>
            {%- endfor %}
          </div>
        </section>

        <section class="border border-black/10 bg-white/40 p-6 lg:p-8" data-reveal>
          <p class="type-label mb-4 text-black/38">{{ cms.legalNotice.privacy.title }}</p>
          <div class="type-body type-body-stack text-black/72">
            <p>
              The controller for data processing on this website is Bollag-Guggenheim AG, Thurgauerstrasse 113, CH-8152 Glattpark, Switzerland. Privacy enquiries can be sent to <a href="{{ cms.site.footer.bgContact.emailHref }}" class="nav-link inline-flex pb-1 transition duration-300 hover:text-black">{{ cms.site.footer.bgContact.emailLabel }}</a>.
            </p>
            {%- for paragraph in cms.legalNotice.privacy.paragraphs %}
            <p>
              {{ paragraph }}
            </p>
            {%- endfor %}
            <p>
              Last updated: {{ cms.legalNotice.privacy.lastUpdated }}.
            </p>

            <a
              href="{{ cms.legalNotice.privacy.document.href }}"
              target="_blank"
              rel="noopener"
              download
              class="group mt-2 flex items-center justify-between gap-6 border border-black/15 bg-white/70 p-5 no-underline transition duration-300 hover:border-black/45 hover:bg-white"
            >
              <span class="flex items-center gap-4">
                <span class="flex h-11 w-11 flex-none items-center justify-center border border-black/15 text-black/70">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </span>
                <span class="block">
                  <span class="type-body block font-semibold text-black">{{ cms.legalNotice.privacy.document.label }}</span>
                  <span class="type-label block text-black/45">{{ cms.legalNotice.privacy.document.note }}</span>
                </span>
              </span>
              <span class="type-label flex flex-none items-center gap-2 text-black/55 transition duration-300 group-hover:text-black">
                Download
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3v13" />
                  <path d="m7 12 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </span>
            </a>
          </div>
        </section>
      </div>
    </div>
  </div>
</section>

{% include "components/site-footer.njk" %}
```

- [ ] **Step 4: Add the `legal_page` collection to `src/admin/config.yml`** (appended at the end of `collections`):

```yaml
  - name: legal_page
    label: Legal Notice
    delete: false
    editor:
      preview: false
    files:
      - label: Legal Notice Content
        name: legal_notice
        file: src/_data/cms/legalNotice.json
        format: json
        fields:
          - label: Hero
            name: hero
            widget: object
            fields:
              - { label: Eyebrow, name: eyebrow, widget: string }
              - { label: Title, name: title, widget: string }
              - { label: Summary, name: summary, widget: text }
          - label: Company Details
            name: legal
            widget: object
            fields:
              - { label: Card Title, name: title, widget: string }
              - label: Bollag-Guggenheim
                name: bollag
                widget: object
                fields:
                  - { label: Name, name: name, widget: string }
                  - { label: Address, name: addressLines, widget: list, field: { label: Line, name: line, widget: string } }
                  - { label: Responsibility Note, name: responsibility, widget: string }
              - label: The Wearhouse
                name: wearhouse
                widget: object
                fields:
                  - { label: Name, name: name, widget: string }
                  - { label: Address, name: addressLines, widget: list, field: { label: Line, name: line, widget: string } }
          - label: Liability & Copyright
            name: liability
            widget: object
            fields:
              - { label: Card Title, name: title, widget: string }
              - { label: Paragraphs, name: paragraphs, widget: list, field: { label: Paragraph, name: paragraph, widget: text } }
          - label: Privacy Policy
            name: privacy
            widget: object
            fields:
              - { label: Card Title, name: title, widget: string }
              - { label: Paragraphs, name: paragraphs, widget: list, field: { label: Paragraph, name: paragraph, widget: text } }
              - { label: Last Updated, name: lastUpdated, widget: string, description: "Shown as 'Last updated: …' at the end of the privacy section." }
              - label: Privacy Document (PDF)
                name: document
                widget: object
                fields:
                  - { label: Title, name: label, widget: string }
                  - { label: Details Line, name: note, widget: string }
                  - { label: File, name: href, widget: file, description: "The official privacy policy PDF." }
```

- [ ] **Step 5: Add the `legal` page entry to `src/admin/manifest.js`**, inserted before the final `site` entry:

```js
  {
    id: 'legal', label: 'Legal Notice', url: '/legal-notice/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/legalNotice.json`, keys: ['hero'] },
      { id: 'company-details', label: 'Company details', file: `${CMS}/legalNotice.json`, keys: ['legal'] },
      { id: 'liability', label: 'Liability & copyright', file: `${CMS}/legalNotice.json`, keys: ['liability'] },
      { id: 'privacy', label: 'Privacy policy', hint: 'Privacy text and the downloadable PDF', file: `${CMS}/legalNotice.json`, keys: ['privacy'] },
    ],
  },
```

- [ ] **Step 6: Verify.**
  - `npm test` — 57/57 tests pass (manifest integrity suite covers the new `legalNotice.json` file and its section keys).
  - `npm run build` — green.
  - Built `_site/legal-notice/index.html` diffed against a pre-change build: the only hunks are the two expected `&` → `&amp;` entity encodings in `hero.title` and `liability.title` (see Step 3) — visually identical, no other differences.
  - `_site/cms-data/legalNotice.json` present (existing `src/_data/cms` → `cms-data` passthrough copy already covers it).

- [ ] **Step 7: Commit**

```bash
git add src/_data/cms/legalNotice.json src/_data/cms.js src/legal-notice/index.njk src/admin/config.yml src/admin/manifest.js docs/superpowers/plans/2026-07-14-cms-v2-phase1-site-mirror-admin.md
git commit -m "feat(cms-v2): make the Legal Notice page editable in the CMS"
```

**Note:** `src/admin/main.jsx` had an uncommitted, temporary localhost-preview bypass in the
working tree at the time of this task. It was left untouched and was not staged.

---

### Task 19c: Wearhouse-style BG brand editor (owner request)

BG brands (`brandsPage/brands.json` → `brands`) were the last single-file item list still
using the generic managed-list route (`ItemListScreen`/`ItemEditScreen`, address
`.../all-brands/list/brands/<index>`). The owner asked for BG brands to be edited exactly
like Wearhouse brands: a dedicated screen with a "New brand name" add box, index-identity
item routes (`.../all-brands/<index>`), a "Name & web address" identity block with a
prompt-based slug renamer, and the `card`/`detail` objects rendered as their own labeled
groups rather than one generic nested `card`/`detail` object field each. Piggybacks on this:
retiring `detail.gallery`, a list field with no template consumer (verified against
`src/brands/brand.njk`, which reads `detail.detailHeroImage` and `detail.detailGallery` only
— never `detail.gallery`), and clarifying three field labels/descriptions that were easy to
confuse (`card.heroImage`, `detail.detailHeroImage`, `detail.detailGallery`).

**Follow-up: page-shaped cascade (owner request).** The first landing grouped fields by
their *config file location* — one card-card, one flat "Card on the Brands page" group, one
flat "Brand detail page" group — which does not match the order an editor sees the fields
appear on the live page. Reworked into a five-group cascade that mirrors
`src/brands/brand.njk`'s actual render order: **Brand** (identity: name, logo, web address)
→ **Page top** (`detail.detailHeroImage`, `card.eyebrow`, `card.heroTitle`, `card.summary` —
the hero section, in the order it paints) → **Introduction** (`detail.intro`, `detail.focus`,
`detail.atmosphere`, `detail.categories` — the overview text block; the portrait image is
`detailGallery[1]`, not a separate field, so it isn't listed here) → **Visual journal**
(`detail.detailGallery`, unchanged) → **Card in the brand overviews** (`card.heroImage` — the
Brands-grid/homepage-wall tile, which appears nowhere on the brand's own page). `card` and
`detail` fields are now interleaved per placement instead of grouped by which JSON object
they live in; each field's definition is still resolved from `config.yml` (so widget type and
`required` stay in sync) via a small `{source, name, overrides}` layout table in
`BrandsScreen.jsx`, with `label`/`description` shallow-copy-overridden per placement where the
page-order label reads better than the config default (e.g. `card.eyebrow`'s config label
"Eyebrow" becomes "Small line above the logo" in the Page top group). Piggybacked on this:
`detail.tone` was verified dead —
`grep -rn "brand.tone\|\.tone\b" src --include='*.njk' --include='*.js' | grep -v admin | grep -v _site`
returns no hits, confirming no template or `src/_data/brands.js` consumer — so its field
definition was deleted from `config.yml`'s `detail` fields (existing `brands.<n>.detail.tone`
JSON data is left untouched; the field simply becomes uneditable, same treatment as the
earlier `detail.gallery` retirement).

**Files:**
- Create: `src/admin/screens/BrandsScreen.jsx`
- Create: `src/admin/lib/slugify.js` (the slug helper both brand editors share)
- Modify: `src/admin/manifest.js` (tag the `all-brands` section `custom: 'brands'`; `file`/`keys` unchanged so the manifest-integrity tests keep passing)
- Modify: `src/admin/screens/SectionScreen.jsx` (dispatch generic `'list'` subroutes first, then `section.custom === 'brands'` to `BrandsScreen` — order is load-bearing, see Step 3)
- Modify: `src/admin/screens/WearhouseScreen.jsx` (import the shared `slugify` instead of a local copy)
- Modify: `src/admin/config.yml` (`brands_page_brands` → `brands` item fields: delete the dead `gallery` list field; relabel `card.heroImage`, `detail.detailHeroImage`, `detail.detailGallery`)
- Modify: `src/admin/shell/Search.jsx` (BG brand hits route to the new index-identity path)
- Modify: `src/admin/lib/router.js` (route-table comment)

- [ ] **Step 1: Delete the dead `gallery` field and relabel three fields in `config.yml`.**
  `detail.gallery` (a `{image, note, source}` list, identical in shape to `detailGallery`) is
  read by no template — only `detail.detailGallery` and `detail.detailHeroImage` are used by
  `src/brands/brand.njk`. The JSON data under existing `brands.<n>.detail.gallery` keys is left
  untouched (the field is dropped from the *editable config* only); `BrandsScreen` never reads
  or writes that key, so it becomes inert. The final `brands_page_brands` file block:

```yaml
      - label: Brand Entries Div
        name: brands_page_brands
        file: src/_data/cms/brandsPage/brands.json
        format: json
        fields:
          - label: Brands
            name: brands
            widget: list
            summary: "{{fields.name}}"
            fields:
              - { label: Name, name: name, widget: string }
              - { label: Slug, name: slug, widget: string, description: "The brand's web-address piece: lowercase, words joined by hyphens (e.g. 'cuoieria-fiorentina'). Changing it changes the page's URL." }
              - { label: Logo Image, name: logoImage, widget: image, required: false }
              - label: Card on the Brands page
                name: card
                widget: object
                fields:
                  - { label: Eyebrow, name: eyebrow, widget: string }
                  - { label: Hero Title, name: heroTitle, widget: string }
                  - { label: Summary, name: summary, widget: text }
                  - { label: Photo, name: heroImage, widget: image, required: false, description: "Shown on the brand's card in the brands overview and on the homepage wall." }
              - label: Detail page
                name: detail
                widget: object
                fields:
                  - { label: Intro, name: intro, widget: text }
                  - { label: Focus, name: focus, widget: text }
                  - { label: Atmosphere, name: atmosphere, widget: string }
                  - { label: Categories, name: categories, widget: list, field: { label: Category, name: category, widget: string } }
                  - { label: Detail Hero Image, name: detailHeroImage, widget: image, required: false, description: "The big banner at the top of the brand's own page." }
                  - label: Visual journal
                    name: detailGallery
                    widget: list
                    summary: "{{fields.note}}"
                    description: "The image mosaic on the brand's page. The 2nd image also appears as the portrait beside the intro text."
                    fields:
                      - { label: Image, name: image, widget: image }
                      - { label: Note, name: note, widget: string }
                      - { label: Source, name: source, widget: string, required: false }
```

(The `Tone` field originally listed here (`{ label: Tone, name: tone, widget: text }`, between
`Categories` and `Detail Hero Image`) was removed in the page-shaped-cascade follow-up — see
above — after confirming it has no template or data consumer.)

- [ ] **Step 2: Extract the shared slug helper, then create `src/admin/screens/BrandsScreen.jsx`.**
  `WearhouseScreen` had a module-local `slugify`; rather than duplicating it, it moves to
  `src/admin/lib/slugify.js` and both brand editors import it (`WearhouseScreen.jsx` drops its
  local copy):

```js
// Turns a display name into a URL slug: lowercase, runs of anything that is
// not a letter or digit collapse to single hyphens, no leading/trailing
// hyphens. Shared by the Wearhouse and BG brand editors.
export const slugify = value => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
```

  `BrandsScreen` mirrors `WearhouseScreen`'s list/item split for the single-file case
  (identity by index, not slug — no join across files):

```jsx
import React, { useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { resolveListField, defaultValueForFields } from '../lib/configPath.js';
import { getAtPath, setAtPath, reorder } from '../lib/paths.js';
import { pruneEmptyAdditions } from '../lib/prune.js';
import { slugify } from '../lib/slugify.js';
import { itemImage } from '../lib/summarize.js';
import { FieldRenderer } from '../fields/FieldRenderer.jsx';
import { Breadcrumbs } from './SectionScreen.jsx';
import { useToast } from '../shell/Toasts.jsx';

// Mirrors WearhouseScreen's UX for the single-file BG brand list: a list of
// index-identity cards ('brands.<index>') plus an item editor whose groups
// cascade in the exact order the real brand page (src/brands/brand.njk)
// renders them: Brand (identity) → Page top (hero) → Introduction (overview
// text) → Visual journal (gallery) → Card in the brand overviews (grid/wall
// tile). Card and detail fields are interleaved per placement, not grouped
// by their config file location.
export function BrandsScreen({ page, section, rest }) {
  const { store, fieldConfig } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();
  const [newName, setNewName] = useState('');

  const entry = fieldConfig.get(section.file);
  const draft = store.getDraft(section.file);
  if (!entry || !draft) {
    return <div className="skeleton" style={{ minHeight: 220 }} />;
  }

  const listField = resolveListField(entry.fields, 'brands');
  const items = draft.brands || [];
  const logoField = listField?.fields.find(field => field.name === 'logoImage');
  const cardField = listField?.fields.find(field => field.name === 'card');
  const detailField = listField?.fields.find(field => field.name === 'detail');

  const setItems = next => store.update(section.file, draftCopy => { draftCopy.brands = next; });

  // ---------- item mode ----------
  if (rest.length) {
    const idx = Number(rest[0]);
    const item = Number.isInteger(idx) ? items[idx] : undefined;
    if (!item) {
      return (
        <div className="empty-state">
          <div className="empty-state-title">Brand not found</div>
          <div className="empty-state-description">It may have been deleted or renamed.</div>
        </div>
      );
    }

    const updateField = (childPath, value) => {
      const fullPath = `brands.${idx}.${childPath}`;
      const pruned = pruneEmptyAdditions(value, getAtPath(store.getRemote(section.file), fullPath));
      store.update(section.file, draftCopy => setAtPath(draftCopy, fullPath, pruned));
    };

    // Explicit field paths → groups, cascading in the exact order the real
    // brand page (src/brands/brand.njk) renders them. Each entry resolves
    // its field definition from config (card/detail object children) so
    // widget types and `required` stay in sync with config.yml; only
    // label/description are overridden per placement via a shallow copy.
    const findField = (source, name) => {
      const fields = source === 'card' ? cardField?.fields : detailField?.fields;
      return (fields || []).find(f => f.name === name) || null;
    };
    const withOverrides = (fieldDef, overrides) => {
      if (!fieldDef) {
        return null;
      }
      if (!overrides) {
        return fieldDef;
      }
      return { ...fieldDef, ...overrides };
    };
    const groups = [
      {
        title: 'Page top',
        help: "The opening of the brand's own page, in the order visitors see it.",
        fields: [
          { source: 'detail', name: 'detailHeroImage', overrides: { label: 'Background image', description: 'Full-screen photo behind the text. A dark gradient is used if empty.' } },
          { source: 'card', name: 'eyebrow', overrides: { label: 'Small line above the logo' } },
          { source: 'card', name: 'heroTitle', overrides: { label: 'Big headline', description: 'If left empty, the description below is shown as the headline.' } },
          { source: 'card', name: 'summary', overrides: { label: 'Description', description: 'The paragraph under the headline.' } },
        ],
      },
      {
        title: 'Introduction',
        help: 'The text block after the page top.',
        fields: [
          { source: 'detail', name: 'intro', overrides: { label: 'First paragraph' } },
          { source: 'detail', name: 'focus', overrides: { label: 'Second paragraph' } },
          { source: 'detail', name: 'atmosphere', overrides: { label: 'Style tag', description: 'Short phrase shown in the small info row, e.g. "Relaxed tailoring".' } },
          { source: 'detail', name: 'categories', overrides: { label: 'Categories', description: 'Only the first two are shown on the page.' } },
        ],
      },
      {
        title: 'Visual journal',
        fields: [
          { source: 'detail', name: 'detailGallery' },
        ],
      },
      {
        title: 'Card in the brand overviews',
        help: "The brand's tile in the Brands overview and on the homepage wall. The logo and name appear on top of this photo.",
        fields: [
          { source: 'card', name: 'heroImage' },
        ],
      },
    ];

    return (
      <div>
        <Breadcrumbs parts={[
          { label: page.label, to: ['page', page.id] },
          { label: section.label, to: ['page', page.id, section.id] },
          { label: item.name },
        ]} />
        <div className="screen-header">
          <div>
            <h2 className="screen-title">{item.name}</h2>
            <p className="screen-subtitle">Its card on the Brands page and its own detail page, edited together here.</p>
          </div>
          <div className="screen-actions">
            <a className="button button-ghost" href={`/brands/${item.slug}/`} target="_blank" rel="noreferrer">View page ↗</a>
            <button type="button" className="button button-danger" onClick={() => {
              if (window.confirm(`Delete “${item.name}” from the Brands page (card and detail page)?`)) {
                setItems(items.filter((_, i) => i !== idx));
                toast('Brand deleted.');
                navigate('page', page.id, section.id);
              }
            }}>Delete brand</button>
          </div>
        </div>

        <section className="group-card">
          <h3 className="group-card-title">Brand</h3>
          <div className="field-help">The basics. The logo appears at the top of the brand's page and on its cards.</div>
          <div className="field-grid two-col">
            <label className="field">
              <span className="field-label">Brand name</span>
              <input className="input" value={item.name} onChange={event => updateField('name', event.target.value)} />
            </label>
            {logoField ? (
              <FieldRenderer field={logoField} value={item.logoImage}
                onChange={next => updateField('logoImage', next)}
                pathPrefix={`brands.${idx}.logoImage`} routeBase={[page.id, section.id]} />
            ) : null}
            <div className="field">
              <span className="field-label">Web address</span>
              <div className="field-help">/brands/{item.slug}/ — renaming changes the page's link.</div>
              <button type="button" className="button button-secondary" onClick={() => {
                const input = window.prompt('New web address (lowercase, words joined by hyphens):', item.slug);
                if (input === null) {
                  return;
                }
                const nextSlug = slugify(input);
                if (!nextSlug) {
                  toast('That address is not valid.', 'error');
                  return;
                }
                if (nextSlug !== item.slug && items.some((candidate, i) => i !== idx && candidate.slug === nextSlug)) {
                  toast('That address is already used by another brand.', 'error');
                  return;
                }
                updateField('slug', nextSlug);
                toast('Address renamed.');
              }}>Rename address</button>
            </div>
          </div>
        </section>

        {groups.map(group => (
          <section className="group-card" key={group.title}>
            <h3 className="group-card-title">{group.title}</h3>
            {group.help ? <div className="field-help">{group.help}</div> : null}
            <div className="field-grid">
              {group.fields.map(({ source, name, overrides }) => {
                const fieldDef = withOverrides(findField(source, name), overrides);
                if (!fieldDef) {
                  return null;
                }
                return (
                  <FieldRenderer key={`${source}.${name}`} field={fieldDef} value={item[source]?.[name]}
                    onChange={next => updateField(`${source}.${name}`, next)}
                    pathPrefix={`brands.${idx}.${source}.${name}`} routeBase={[page.id, section.id]} />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ---------- list mode ----------
  const addBrand = () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    const nextSlug = slugify(name);
    if (!nextSlug) {
      toast('Use letters or numbers in the brand name.', 'error');
      return;
    }
    if (items.some(item => item.slug === nextSlug)) {
      toast('A brand with that name already exists.', 'error');
      return;
    }
    const newItem = {
      name,
      slug: nextSlug,
      logoImage: '',
      card: defaultValueForFields(cardField?.fields || []),
      detail: defaultValueForFields(detailField?.fields || []),
    };
    const newIndex = items.length;
    setItems([...items, newItem]);
    setNewName('');
    navigate('page', page.id, section.id, String(newIndex));
  };

  return (
    <div>
      <Breadcrumbs parts={[{ label: page.label, to: ['page', page.id] }, { label: section.label }]} />
      <div className="screen-header">
        <div>
          <h2 className="screen-title">{section.label}</h2>
          <p className="screen-subtitle">Each brand has a card on the Brands page and its own detail page — edited together here.</p>
        </div>
        <div className="screen-actions">
          <input className="input" placeholder="New brand name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addBrand(); }} />
          <button type="button" className="button button-primary" onClick={addBrand} disabled={!newName.trim()}>Add brand</button>
        </div>
      </div>

      <div className="item-grid">
        {items.map((item, index) => {
          const thumb = item.card?.heroImage || item.logoImage || itemImage(item);
          return (
            <div key={index} className="item-card" role="button" tabIndex={0}
              onClick={() => navigate('page', page.id, section.id, String(index))}
              onKeyDown={event => { if (event.key === 'Enter') navigate('page', page.id, section.id, String(index)); }}>
              <div className="item-card-thumb">
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="item-card-thumb-empty">No image</span>}
              </div>
              <div className="item-card-body">
                <div className="item-card-title">{item.name}</div>
                <div className="item-card-subtitle">{item.card?.eyebrow || '—'}</div>
              </div>
              <div className="item-card-flags" onClick={event => event.stopPropagation()}>
                <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => setItems(reorder(items, index, index - 1))}>↑</button>
                <button type="button" className="icon-button" title="Move down" disabled={index === items.length - 1} onClick={() => setItems(reorder(items, index, index + 1))}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Dispatch from `SectionScreen.jsx`.** Tag the section `custom: 'brands'` in
  `manifest.js` (keep `file`/`keys` unchanged — the manifest-integrity tests key off those).
  Dispatch order is load-bearing: the generic `'list'` subroute branch must come FIRST, then
  the custom brands branch, then the joined branch. `BrandsScreen`'s nested list fields (the
  Visual journal at `brands.<idx>.detail.detailGallery`, plus `card`/`detail` sub-lists)
  reuse the generic `ItemListScreen`/`ItemEditScreen` via FieldRenderer's "Manage items"
  route `.../all-brands/list/<listPath>` — if the custom branch ran first, `BrandsScreen`
  would see `rest[0] === 'list'`, fail the integer-index parse, and dead-end on "Brand not
  found". The ordering is safe: Wearhouse routes never carry a `'list'` segment and brands
  item routes never start with `'list'`. Only `BrandsScreen`'s TOP-LEVEL list/item duties
  replace the old generic `.../list/brands/<index>` route — that path form for the top-level
  `brands` list is no longer emitted anywhere (Search and BrandsScreen both use
  `.../all-brands/<index>`), which is intended:

```js
// manifest.js — 'all-brands' section
{ id: 'all-brands', label: 'All brands', hint: 'Every Bollag brand and its page', file: `${CMS}/brandsPage/brands.json`, keys: ['brands'], custom: 'brands' },
```

```jsx
// SectionScreen.jsx
import { BrandsScreen } from './BrandsScreen.jsx';
...
  // Managed-list subroutes: [.., 'list', <listPath>] and [.., 'list', <listPath>, <index>].
  // Checked BEFORE the custom brands dispatch: BrandsScreen's nested lists
  // (e.g. the Visual journal at 'brands.<idx>.detail.detailGallery') reuse the
  // generic list screens. Safe ordering — wearhouse routes never carry a
  // 'list' segment and brands item routes never start with 'list'.
  if (rest[0] === 'list' && rest.length >= 2) {
    const listPath = rest[1];
    if (rest.length >= 3) {
      return <ItemEditScreen page={page} section={section} listPath={listPath} index={Number(rest[2])} />;
    }
    return <ItemListScreen page={page} section={section} listPath={listPath} />;
  }

  if (section.custom === 'brands') {
    return <BrandsScreen page={page} section={section} rest={rest} />;
  }

  if (section.joined) {
    return <WearhouseScreen page={page} section={section} rest={rest} />;
  }
```

- [ ] **Step 4: Point brand-hit search results and the route comment at the new address.**

```jsx
// Search.jsx
const bgBrands = store.getDraft(`${CMS}/brandsPage/brands.json`)?.brands || [];
// BG brands are index-addressed via BrandsScreen (Wearhouse-style single-
// file editor), not the generic managed-list route.
bgBrands.forEach((brand, index) => {
  if (itemTitle(brand).toLowerCase().includes(needle)) {
    results.push({ title: itemTitle(brand), sub: 'Bollag brand', to: ['page', 'brands', 'all-brands', String(index)] });
  }
});
```

```js
// router.js route-table comment
//   #/page/wearhouse/wearhouse-brands/<recordIndex>         (joined item editor)
//   #/page/brands/all-brands/<index>                        (BG brand item editor)
//   #/media   #/people
```

- [ ] **Step 5: Verify.**
  - `npm test` — 58/58 pass (manifest integrity is unaffected: `file`/`keys` on `all-brands` are unchanged, only the additive `custom` key was added).
  - `npm run build` — green (`build:css`, `build:site`, `build:admin`).
  - Node sanity check: parsed `config.yml`, confirmed `brands_page_brands` → `brands` → `detail`'s child fields no longer include `gallery` but still include `detailGallery`.
  - Route traces: `#/page/brands/all-brands/list/brands.0.detail.detailGallery` hits the
    generic `'list'` branch first → `ItemListScreen` resolves the list field via
    `resolveListField(entry.fields, 'brands.0.detail.detailGallery')` and renders the
    gallery grid; `#/page/brands/all-brands/0` skips the `'list'` branch (`rest[0]` is
    `'0'`) → `BrandsScreen` item mode.

- [ ] **Step 6: Commit**

Landed as two commits (the dispatch-order fix and the shared `slugify` came out of review
of the first commit):

```bash
git add src/admin/screens/BrandsScreen.jsx src/admin/manifest.js src/admin/screens/SectionScreen.jsx src/admin/config.yml src/admin/shell/Search.jsx src/admin/lib/router.js docs/superpowers/plans/2026-07-14-cms-v2-phase1-site-mirror-admin.md
git commit -m "feat(cms-v2): wearhouse-style brand editor; retire dead gallery field"

git add src/admin/lib/slugify.js src/admin/screens/SectionScreen.jsx src/admin/screens/BrandsScreen.jsx src/admin/screens/WearhouseScreen.jsx docs/superpowers/plans/2026-07-14-cms-v2-phase1-site-mirror-admin.md
git commit -m "fix(cms-v2): restore nested gallery routes under the brands screen; shared slugify"
```

**Follow-up commit (page-shaped cascade, owner request):** landed as a third commit once the
five-group reorder above (Brand / Page top / Introduction / Visual journal / Card in the brand
overviews) and the `detail.tone` removal were verified — `npm test` 58/58, `npm run build`
green, and a Node parse of `config.yml` confirming `brands` → `detail`'s child fields no
longer include `tone` but still include `detailGallery`:

```bash
git add src/admin/screens/BrandsScreen.jsx src/admin/config.yml docs/superpowers/plans/2026-07-14-cms-v2-phase1-site-mirror-admin.md
git commit -m "feat(cms-v2): page-shaped cascade for the brand editor; retire dead tone field"
```

---

### Task 19d: Editor guidance (view-page, optional focus, image sizing/focus)

Three small, independent editor-experience improvements requested by the owner, landed as
three commits on `editor-guidance` (branched from `main` at `086e96a`).

**19d-1: "View page ↗" on every editor screen.** `SectionScreen`, `PageScreen`,
`BrandsScreen` (item mode), and `WearhouseScreen` (item mode, brand-half present) already had
the button. Added the same `<a className="button button-ghost" href={...} target="_blank"
rel="noreferrer">View page ↗</a>` to the four screens that were missing it: the two generic
managed-list screens (`ItemListScreen`, `ItemEditScreen` — both already receive `page` as a
prop, so `page.url` was available with no new plumbing) and the two brand-roster LIST-mode
headers (`WearhouseScreen`, `BrandsScreen`), which link to the fixed roster URLs (`/wearhouse/`,
`/brands/`) rather than a per-item page.

```jsx
// ItemListScreen.jsx — screen-header actions
<div className="screen-actions">
  <a className="button button-ghost" href={page.url} target="_blank" rel="noreferrer">View page ↗</a>
  <button type="button" className="button button-primary" onClick={addItem}>Add item</button>
</div>
```

```jsx
// ItemEditScreen.jsx — screen-header actions
<div className="screen-actions">
  <a className="button button-ghost" href={page.url} target="_blank" rel="noreferrer">View page ↗</a>
  <button type="button" className="button button-danger" onClick={() => { /* delete item */ }}>Delete item</button>
</div>
```

```jsx
// WearhouseScreen.jsx — list-mode screen-header actions
<div className="screen-actions">
  <a className="button button-ghost" href="/wearhouse/" target="_blank" rel="noreferrer">View page ↗</a>
  <input className="input" placeholder="New brand name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addBrand(); }} />
  <button type="button" className="button button-primary" onClick={addBrand} disabled={!newName.trim()}>Add brand</button>
</div>
```

```jsx
// BrandsScreen.jsx — list-mode screen-header actions
<div className="screen-actions">
  <a className="button button-ghost" href="/brands/" target="_blank" rel="noreferrer">View page ↗</a>
  <input className="input" placeholder="New brand name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addBrand(); }} />
  <button type="button" className="button button-primary" onClick={addBrand} disabled={!newName.trim()}>Add brand</button>
</div>
```

Verify: `npm test` 58/58, `npm run build` green, `src/admin/main.jsx` untouched.

```bash
git add src/admin/screens/BrandsScreen.jsx src/admin/screens/ItemEditScreen.jsx src/admin/screens/ItemListScreen.jsx src/admin/screens/WearhouseScreen.jsx
git commit -m "feat(cms-v2): view-page button on every editor screen"
```

**19d-2: Focus paragraph can be blank.** The brand detail page's second overview paragraph
(`detail.focus`) was `required: true` in `config.yml` even though `src/brands/brand.njk`
rendered it unconditionally next to `intro` — an editor who wanted a single-paragraph intro
had no way to express that. Set `required: false` on `brands_page_brands.brands.detail.focus`
(label/description overrides in `BrandsScreen.jsx`'s layout table shallow-copy over this same
config field, so `required` still flows through untouched) and wrapped the paragraph in the
template so an empty value renders nothing rather than an empty `<p>`.

```yaml
# config.yml — brands_page_brands → brands → detail
- { label: Focus, name: focus, widget: text, required: false }
```

```njk
{# src/brands/brand.njk #}
<p data-reveal>{{ brand.intro }}</p>
{% if brand.focus %}<p data-reveal>{{ brand.focus }}</p>{% endif %}
```

```jsx
// BrandsScreen.jsx — Introduction group layout table
{ source: 'detail', name: 'focus', overrides: { label: 'Second paragraph', description: 'Leave empty to show only the first.' } },
```

Verify: `npm test` 58/58, `npm run build` green. Confirmed with a scratch edit (blanked
`closed`'s `detail.focus`, rebuilt, checked the output, restored the file with no residual
diff) that an empty focus renders no second `<p>` and no template artifacts — and with the
real, unmodified data that every current brand (all still have `focus` text) still renders its
second paragraph verbatim, e.g. `_site/brands/closed/index.html` contains `<p
data-reveal>The brand&#39;s strength comes from long-standing Italian production
partnerships...</p>`.

```bash
git add src/admin/config.yml src/admin/screens/BrandsScreen.jsx src/brands/brand.njk
git commit -m "feat(cms-v2): focus paragraph optional; skip empty paragraph on the page"
```

**19d-3: Image size guidance, picker dimensions, brand hero focus control.** Three related
changes to reduce image-related guesswork for editors:

*(a) Size hints in `config.yml` descriptions* — appended (or set) a plain-language size hint
on every image field the owner specified (poster/hero images → "a wide photo around
2560×1440 px"; portrait card/roster images → "portrait, around 1200×1500 px"; gallery/showroom
images → "at least 1600 px on the long side"; wide content images → "at least 1600 px wide" or
"at least 1200 px wide"; logo fields → "Use an SVG or a transparent PNG at least 400 px wide.").
Where a field already had a description the hint was appended with a leading space; where it
had none, the hint became the field's whole description. All 25 fields named in the spec were
found and updated — none were skipped. Representative examples:

```yaml
# homepage hero.poster — existing description, appended
- { label: Poster Image, name: poster, widget: image, description: "Still image shown while the video loads (and if it cannot play). Best size: a wide photo around 2560×1440 px." }

# home intro.image — no prior description
- { label: Image, name: image, widget: image, description: "Best size: at least 1200 px wide." }

# brands card.heroImage — existing description, appended
- { label: Photo, name: heroImage, widget: image, required: false, description: "Shown on the brand's card in the brands overview and on the homepage wall. Best size: portrait, around 1200×1500 px." }
```

*(b) Natural dimensions in the picker and Media screen* — `MediaPicker.jsx` and
`MediaScreen.jsx` each render image cells through a small subcomponent (`PickerCell`,
`MediaCard`) that reads `naturalWidth`/`naturalHeight` off the thumbnail's `onLoad` and shows
e.g. `· 1200×800` next to the filename. Each file keeps its own module-level `Map`
(`dimensionsCache`, keyed by file path) so dimensions already seen aren't re-decoded on
re-render; videos and not-yet-loaded images degrade silently (no dimension suffix).

```jsx
// MediaPicker.jsx
const dimensionsCache = new Map();

function PickerCell({ file, onSelect }) {
  const [dims, setDims] = useState(() => dimensionsCache.get(file.path) || null);
  const isImage = IMAGE_SHAPE.test(file.path);
  return (
    <button type="button" className="picker-cell" onClick={() => onSelect(file.path)}>
      {isImage ? (
        <img src={file.path} alt="" loading="lazy" onLoad={event => {
          const { naturalWidth, naturalHeight } = event.target;
          if (naturalWidth && naturalHeight) {
            const next = { width: naturalWidth, height: naturalHeight };
            dimensionsCache.set(file.path, next);
            setDims(next);
          }
        }} />
      ) : (
        <div className="item-card-thumb"><span className="item-card-thumb-empty">{file.path.split('.').pop().toUpperCase()}</span></div>
      )}
      <div className="picker-cell-name">{file.name || file.path.split('/').pop()}{dims ? ` · ${dims.width}×${dims.height}` : ''}</div>
    </button>
  );
}
```

`MediaScreen.jsx`'s `MediaCard` follows the same shape, folded into the existing
`item-card`/`item-card-title` markup.

*(c) Brand page background focus control* — replaced the one-off
`{% if brand.slug == 'more-and-more' %}object-[50%_12%]{% endif %}` hardcode in
`src/brands/brand.njk` with a data-driven field. Added `detail.detailHeroFocus` (`select`:
`center`/`top`/`bottom`, `required: false`) to `config.yml` right after `detailHeroImage`, and
to `BrandsScreen.jsx`'s Page top layout-table group (right after the "Background image" field,
labeled "Image focus"). The template now maps `top` → `object-[50%_15%]`, `bottom` →
`object-[50%_85%]`, and `center`/absent → `object-center`.

```yaml
# config.yml — brands_page_brands → brands → detail, right after detailHeroImage
- { label: Image focus, name: detailHeroFocus, widget: select, options: ["center", "top", "bottom"], required: false, description: "Which part of the background image stays visible when the screen crops it." }
```

```njk
{# src/brands/brand.njk #}
{% if brand.detailHeroImage %}
  {% set detailHeroObjectClass = 'object-center' %}
  {% if brand.detailHeroFocus == 'top' %}
    {% set detailHeroObjectClass = 'object-[50%_15%]' %}
  {% elif brand.detailHeroFocus == 'bottom' %}
    {% set detailHeroObjectClass = 'object-[50%_85%]' %}
  {% endif %}
  <img src="{{ brand.detailHeroImage }}" alt="{{ brand.name }} editorial view" class="h-full w-full object-cover {{ detailHeroObjectClass }}">
```

The only content edit is `src/_data/cms/brandsPage/brands.json`: `more-and-more`'s `detail`
gained `"detailHeroFocus": "top"` (placed right after `detailHeroImage`) — the same brand the
old hardcode singled out, now expressed through the new field instead of a slug check.

Verify: `npm test` 58/58, `npm run build` green, `src/admin/main.jsx` untouched. Built-HTML
check across all 12 brand pages: `more-and-more/index.html` contains `object-cover
object-[50%_15%]` (the accepted ~3pt shift from the old `12%` crop), and every other brand
page (`0039-italy`, `closed`, `codello`, `cuoieria-fiorentina`, `drykorn`, `g-lab`, `guess`,
`iblues`, `rich-royal`, `yaya`, plus the `brands` index page) contains `object-cover
object-center`.

```bash
git add src/admin/config.yml src/admin/screens/BrandsScreen.jsx src/admin/fields/MediaPicker.jsx src/admin/screens/MediaScreen.jsx src/brands/brand.njk src/_data/cms/brandsPage/brands.json docs/superpowers/plans/2026-07-14-cms-v2-phase1-site-mirror-admin.md
git commit -m "feat(cms-v2): image size guidance, picker dimensions, brand hero focus control"
```

---

### Task 19e: Mirror the site structure (Company editorial, brand portrait, grouped sidebar)

Three editor-only changes landed on `cms-clarity` (branched from `main` at `64f8de9`), all in
service of the owner's core principle: "all the pages on the CMS should have the most possible
similar structure on CMS as they are on the website." Editor-only — no `.njk` template, no
`src/_data/**` content, and no `main.jsx` change in any of the three commits.

**19e-1: Company's missing Editorial section.** `src/company/index.njk` includes
`components/selected-stores.njk` as its LAST content section (after distribution, before the
footer), and that component renders from `cms.home.selection`
(`src/_data/cms/home/selectionSection.json`, key `selection`) — the same data the Homepage's
"Editorial selection" section already edited. The CMS only surfaced it under Homepage, so an
editor looking at Company had no way to find the block they see live on `/company/`. Added the
same section to Company, positioned last (matching page order: hero, intro, history,
distribution, editorial-selection), and cross-referenced the sharing in both sections' hints.

```jsx
// manifest.js — homepage.sections, editorial-selection hint updated
{ id: 'editorial-selection', label: 'Editorial selection', hint: 'Curated image mosaic — shared with the Company page; editing this changes both pages', file: `${CMS}/home/selectionSection.json`, keys: ['selection'] },
```

```jsx
// manifest.js — company.sections, new last entry
{ id: 'distribution', label: 'Distribution', file: `${CMS}/company.json`, keys: ['distribution'] },
{ id: 'editorial-selection', label: 'Editorial selection', hint: 'Shared with the homepage — editing this changes both pages', file: `${CMS}/home/selectionSection.json`, keys: ['selection'] },
```

Two sections now deliberately back the same file and the same key. `ALL_FILES` stays deduped
(it already builds off a `Set`) and `sectionsForFile('src/_data/cms/home/selectionSection.json')`
now returns both sections; every caller that does `sectionsForFile(file)[0]` as a fallback
(`ChangesTray.jsx`'s issue crumbs, `MediaScreen.jsx`'s "used in" labels) picks whichever section
`allSections()` reaches first — Homepage's, since it's earlier in `PAGES` — which is a harmless,
acceptable fallback, not a crash.

The manifest integrity test previously asserted **disjoint** keys per file shared by two
sections — a rule that was really guarding against two *different* sections silently racing to
edit the same JSON key, but is too strict now that two sections legitimately mirror the exact
same key on purpose. Relaxed it to allow an identical full mirror (same file, same key set)
while still failing on any partial or conflicting overlap, and added an explicit regression test
for the new dual-owner file:

```js
// manifest.test.js
it('covers every config.yml file, with no two sections claiming conflicting keys on a shared file', () => {
  const covered = [];
  for (const section of allSections()) {
    if (section.joined) {
      covered.push(...section.files);
    } else {
      covered.push(section.file);
    }
  }
  expect([...new Set(covered)].sort()).toEqual([...new Set(configFiles)].sort());

  const claimsByFile = new Map();
  for (const section of allSections()) {
    if (section.joined) {
      continue;
    }
    const signature = [...section.keys].sort().join(',');
    const claims = claimsByFile.get(section.file) || [];
    for (const key of section.keys) {
      const conflict = claims.find(claim => claim.keys.includes(key) && claim.signature !== signature);
      expect(conflict, `${section.file} key "${key}" is claimed by two sections with different key sets`).toBeUndefined();
    }
    claims.push({ signature, keys: section.keys });
    claimsByFile.set(section.file, claims);
  }
});

it('a file backing two sections (Homepage + Company editorial selection) is deduped in ALL_FILES and both sections resolve', () => {
  const file = 'src/_data/cms/home/selectionSection.json';
  expect(ALL_FILES.filter(f => f === file).length).toBe(1);
  const owners = sectionsForFile(file);
  expect(owners.length).toBe(2);
  expect(owners.map(s => s.pageId).sort()).toEqual(['company', 'homepage']);
  expect(owners.every(s => s.id === 'editorial-selection')).toBe(true);
});
```

Verify: `npm test` 59/59 (58 + 1 new dual-owner regression test), `npm run build` green.

```bash
git add src/admin/manifest.js src/admin/__tests__/manifest.test.js
git commit -m "feat(cms-v2): show the Editorial section on Company, where the page has it"
```

**19e-2: The brand's portrait beside the intro.** `src/brands/brand.njk` renders, next to the
intro/focus text, an `overview-image__media` portrait whose src is
`brand.detailGallery[1].image` — the SECOND item of "Visual journal" doubles as the portrait
beside the intro text (guarded by `{% if brand.detailGallery.length > 1 %}`). The only way to
change it was to realise it's secretly item #2 of a gallery list — invisible to editors, and the
owner explicitly asked to be able to change this "2nd image". Added a field to the top of the
Introduction group in `BrandsScreen.jsx`'s item editor, reusing the Visual journal's own `image`
field definition from config (same widget, same media picker) so it never drifts from
`config.yml`, with an honest label/description disclosing it's the same photo:

```jsx
// BrandsScreen.jsx — inside item mode, before the groups table
const galleryImageField = findField('detail', 'detailGallery')?.fields?.find(f => f.name === 'image') || null;
const portraitField = withOverrides(galleryImageField, {
  label: 'Portrait beside the intro',
  description: "The photo shown next to this text on the brand's page. It is also the 2nd photo in the Visual journal below — changing one changes the other.",
});
const groups = [
  {
    title: 'Introduction',
    help: 'The text block after the page top.',
    fields: [
      { custom: 'portrait' },
      { source: 'detail', name: 'intro', overrides: { label: 'First paragraph' } },
      // ...focus, atmosphere, categories unchanged
    ],
  },
  // ...
];
```

```jsx
// BrandsScreen.jsx — groups.map field renderer, custom 'portrait' branch
{group.fields.map(({ source, name, overrides, custom }) => {
  if (custom === 'portrait') {
    if (!portraitField) {
      return null;
    }
    return (
      <FieldRenderer key="detail.detailGallery.1.image" field={portraitField}
        value={item.detail?.detailGallery?.[1]?.image}
        onChange={next => updateField('detail.detailGallery.1.image', next)}
        pathPrefix={`brands.${idx}.detail.detailGallery.1.image`} routeBase={[page.id, section.id]} />
    );
  }
  // ...existing source/name branch unchanged
})}
```

It reads/writes `brands.<idx>.detail.detailGallery.1.image` through the SAME pruned-write
mechanism the screen already uses (`setAtPath` + `pruneEmptyAdditions` against `getRemote` at
the same path) — no new plumbing. Edge case: if `detailGallery` has fewer than 2 items, the
portrait doesn't render on the site either, so the field just shows empty; writing to it grows
the array to create index 1 (`setAtPath` treats a numeric next-segment as an array) without
reordering or touching index 0.

Verified with a node probe against the real, unmodified `brands.json`:
- **Case (a)**, a real brand (`Closed`, 28 gallery items): the field's computed value equals
  `detailGallery[1].image` exactly; writing a new path updates only `detailGallery[1].image`,
  leaves `detailGallery[1].note` and every other gallery item byte-identical, and leaves the
  array length unchanged.
- **Case (b)**, a simulated 1-item gallery: the field shows `undefined` (empty); writing does
  not throw, grows the gallery to length 2, leaves index 0 byte-identical to before, and creates
  index 1 as `{"image":"<new path>"}` — nothing else.

Verify: `npm test` 59/59, `npm run build` green.

```bash
git add src/admin/screens/BrandsScreen.jsx
git commit -m "feat(cms-v2): edit the brand's intro portrait directly (the Visual journal's 2nd photo)"
```

**19e-3: Grouped sidebar with the current page's sections nested.** The owner: "make the left
menu more intelligible, so you can understand where you are navigating... the hierarchy is
messed up legal, footer, homepage — also the navigation inside is a bit confusing." Two fixes:

*(a) Hierarchy* — each `PAGES` entry now carries a `group: 'pages' | 'site'` (the seven real
pages keep their existing website-nav order; `site` is Header & Footer then Legal Notice,
reordered — Header & Footer used to come after Legal Notice in the array). No page `id` changed.

```jsx
// manifest.js — SITE-WIDE entries, reordered and grouped
// SITE-WIDE, not a page: Header & Footer first, then Legal Notice
// (site-wide chrome before the one-off legal page it links to).
{
  id: 'site', label: 'Header & Footer', url: '/', group: 'site',
  sections: [
    { id: 'navigation', label: 'Navigation menu', file: `${CMS}/site.json`, keys: ['nav'] },
    { id: 'footer', label: 'Footer', file: `${CMS}/site.json`, keys: ['footer'] },
  ],
},
{
  id: 'legal', label: 'Legal Notice', url: '/legal-notice/', group: 'site',
  sections: [
    { id: 'hero', label: 'Hero banner', file: `${CMS}/legalNotice.json`, keys: ['hero'] },
    { id: 'company-details', label: 'Company details', file: `${CMS}/legalNotice.json`, keys: ['legal'] },
    { id: 'liability', label: 'Liability & copyright', file: `${CMS}/legalNotice.json`, keys: ['liability'] },
    { id: 'privacy', label: 'Privacy policy', hint: 'Privacy text and the downloadable PDF', file: `${CMS}/legalNotice.json`, keys: ['privacy'] },
  ],
},
```

Every one of the seven page entries (`homepage`, `company`, `brands`, `wearhouse`, `stores`,
`agenda`, `contact`) gained `group: 'pages'` in place, in their existing order.

`Shell.jsx`'s sidebar now renders three labelled groups — PAGES and SITE-WIDE from the
manifest's `group` field, LIBRARY hard-coded as Media + People (People still admin-only, as
before) — replacing the old flat list plus `sidebar-divider`.

*(b) "Where am I"* — when a page is active, its sections render as an indented, clickable
sub-list beneath it, with the current section highlighted; non-active pages show no sub-list.
The active section is derived from the route (`['page', pageId, sectionId, ...rest]` — the
section id sits at index 2 regardless of how deep a sub-route goes, so it stays correct while
editing an item inside a section too):

```jsx
// Shell.jsx
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
```

`admin.css` gained the group-heading and sub-nav styles (`.sidebar-group-heading` reuses the
`.sidebar-kicker` small-caps type treatment but in `var(--muted)` so it never reads as the
accent-coloured "BOLLAG CMS" brand kicker; `.sidebar-subnav`/`.sidebar-subnav-item` add a
left-rail indent, hover state, and an `is-active` state consistent with
`.sidebar-nav-item.is-active`), and the now-unused `.sidebar-divider` rule (nothing renders it
any more — the three group headings replace it) was removed:

```css
/* PAGES / SITE-WIDE / LIBRARY group headings — same small-caps type
   treatment as .sidebar-kicker, but muted rather than accent-coloured so it
   never reads as the "BOLLAG CMS" brand kicker at the top of the sidebar. */
.sidebar-group-heading {
  margin: 14px 4px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.sidebar-group-heading:first-child {
  margin-top: 2px;
}

.sidebar-nav-group {
  display: grid;
  gap: 4px;
}

/* Sub-list of a page's sections, shown only under the active page — the
   "where am I" cue: indented, smaller, with a left rail and an is-active
   state that mirrors .sidebar-nav-item.is-active. */
.sidebar-subnav {
  display: grid;
  gap: 2px;
  margin: 2px 0 4px 14px;
  padding-left: 10px;
  border-left: 2px solid var(--line);
  list-style: none;
}

.sidebar-subnav-item {
  display: block;
  width: 100%;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  padding: 6px 8px;
  text-align: left;
  font-size: 12.5px;
  font-weight: 600;
}

.sidebar-subnav-item:hover {
  background: var(--panel-soft);
  color: var(--text);
}

.sidebar-subnav-item.is-active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
```

The pre-existing global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
rule already applies to every focusable element, so the new sub-nav buttons get keyboard focus
rings for free — no new focus-visible rule was needed.

Verify: `npm test` 59/59, `npm run build` green, `src/admin/main.jsx` untouched, `PAGES` order
otherwise unchanged (`Search.jsx` and `allSections()` iterate it order-independently).

```bash
git add src/admin/manifest.js src/admin/shell/Shell.jsx src/admin/admin.css docs/superpowers/plans/2026-07-14-cms-v2-phase1-site-mirror-admin.md
git commit -m "feat(cms-v2): grouped sidebar with the current page's sections nested"
```

---

### Task 19f: Editable card label; Segment filed correctly

Two owner-reported bugs, fixed on `card-label` (branched from `main` at `6315b32`) in two
commits.

**Discovery: a third hardcoded copy.** The small `Women & Men` line above the logo on every
brand card — `/brands/` and `/wearhouse/` overviews — turned out to be a literal string baked
into the templates, not CMS data at all: `<p class="type-label mb-3 text-white/80">Women &amp;
Men</p>` in `src/brands/index.njk` and `src/wearhouse/index.njk`. A pre-brief said only those
two files were hardcoded, but the same literal was also in
`src/_includes/components/wearhouse-brands-wall.njk` — a shared partial included by both
`src/index.njk` (homepage) and `src/brands/index.njk`, rendering the Wearhouse roster a *third*
time. Skipping it would have left 15 un-editable labels behind (the homepage's Wearhouse wall,
plus a duplicate set on `/brands/`) even after "fixing" the two files the brief named. Found by
diffing a pre-change and post-change build and seeing stray unrendered lines survive in
`/brands/index.html` — the extra occurrences came from this third include, confirmed by `grep -rn
"Women &amp; Men" src/`.

**The seed-then-read approach.** Rather than invent new copy, the fix seeds a `cardLabel` field
onto every existing brand/roster record with the exact string that was already hardcoded
(`Women & Men`, plain ampersand — Nunjucks' auto-escaping turns it into `&amp;` on output, same
as the literal), then swaps each hardcoded `<p>` for a guarded
`{% if brand.cardLabel %}<p class="type-label mb-3 text-white/80">{{ brand.cardLabel
}}</p>{% endif %}`. Because the seeded value round-trips through the same auto-escaping the
literal always went through, and the guard is a no-op whenever the field is populated (as it now
always is), the rendered byte stream for every existing page is unchanged — only the *source* of
that byte stream moved from template literal to editable data. `cardLabel` was added as the
first key of `card` in `src/_data/cms/brandsPage/brands.json` (12 brands) and as the first
"content" field (after identity fields `name`/`slug`) in every item of
`src/_data/cms/wearhousePage/roster.json` (15 roster items).

**Byte-identical proof.** Before any edit, `npm run build` was run against a clean `origin/main`
checkout and `_site` copied aside (excluding `_site/admin`, which is the bundled admin app, not a
public page). After the full change:

```bash
diff -rq --exclude=admin --exclude=cms-data <pre-change _site> <post-change _site>
# (no output — zero differences)
```

`--exclude=cms-data` is needed alongside `--exclude=admin`: `.eleventy.js` passthrough-copies
`src/_data/cms` to `_site/cms-data` as a raw JSON mirror the admin app reads to diff local drafts
against the published state (`src/admin/lib/content.js`, `ChangesTray.jsx`) — it is not a
rendered page, and it necessarily differs because it mirrors the sanctioned `cardLabel` data
seed. Every actual page — every brand and Wearhouse card, the homepage Wearhouse wall, all other
routes and assets — came back byte-for-byte identical.

`config.yml`, `BrandsScreen.jsx` (new "Card label" field, first in the "Card in the brand
overviews" group), and `blankRosterItem()`/`addBrand()` (new records default to `Women & Men`)
were wired up in the same commit so the field is immediately editable and new brands match house
style; `WearhouseScreen.jsx` needed no code change — its "Card on the Wearhouse page" group
already renders every roster field except `name`/`slug`, so the new config field appears there
automatically.

**Second bug: Segment filed under the wrong page.** `wearhouse/brand.njk:33` renders `{{
brand.segment }}` (the roster item's `segment`) in the small info row on a brand's *own* detail
page — the Wearhouse roster *card* never renders segment at all. The CMS nonetheless grouped
`segment` inside "Card on the Wearhouse page" (it's a flat field on the roster item, alongside
`pageHref`/`logoSrc`/`hoverImage`, which *are* card fields), so editors saw it in the wrong
place. Moved it in `WearhouseScreen.jsx`: excluded from the "Card on the Wearhouse page" field
list, and rendered explicitly at the top of "Brand detail page" instead (still reading/writing
`record.roster.segment` — the data doesn't move, only where it's edited) with description "Shown
in the small info row on the brand's own page — not on the card."

While there, checked whether `rosterCard.segment` in `src/_data/cms/wearhousePage/brands.json`
(a *second*, differently-scoped `segment` field, editable under "Card details" in the same
screen) is live. `src/_data/wearhouse.js` builds each card's merged record as `{...detailBrand,
...rosterItem, ...detail}` and only ever reads `rosterCard.logoLines` off `detailBrand` — never
`rosterCard.segment`. No `.njk` template references `rosterCard` at all; every site read of
"segment" resolves to the roster item's field (confirmed by grep across `src/**/*.njk` and
`src/_data/wearhouse.js`). `rosterCard.segment` is dead on the site. It removed cleanly from
`config.yml` only — the JSON data and `blankBrandEntry()` were left untouched, since the field
still exists on records and the task was to stop presenting a phantom duplicate, not to migrate
data. (One nuance for the record: `WearhouseScreen.jsx`'s list-view subtitle badge already reads
`record.roster?.segment || record.brand?.rosterCard?.segment || '—'` as a fallback — an
admin-only usage, not a site read, and out of this task's scope to change.)

Also corrected an inaccurate field description while auditing the same area: `card.summary`
(labelled "Description" in `BrandsScreen.jsx`'s "Page top" group) said only "The paragraph under
the headline" — true on the brand's own page (`brand.njk:44`), but the same field is *also* the
body text on the brand's card in the `/brands/` overview (`index.njk` — `{{ brand.summary }}`).
Updated to: "The paragraph under the headline on the brand's page. It also appears on the
brand's card in the Brands overview." `card.eyebrow` and `card.heroTitle` were checked the same
way and found already accurate — both render only on the detail-page hero (zero occurrences on
`/brands/`), matching their existing descriptions.

Verify: `npm test` 59/59 and `npm run build` green before each commit; the byte-identical `diff
-rq` proof above re-run (and still empty) after every template/data change.

```bash
git commit -m "feat: make the brand card label editable without changing the page"
git commit -m "fix(cms-v2): file the Segment field where it renders; correct card/detail descriptions"
```

---

### Task 20: Preview pane (Phase 2, level 2 — section highlighting)

Phase 1 (Chunks 1–6, and Task 20 below in Chunk 7) shipped the editing surface: a form per
section, mirroring the site's structure. This task adds the thing editors kept needing next — a
way to *see* the section they're editing on the real page, without leaving the form. Level 2
means: show the published page, scroll to the section, outline it. Not a live-editing WYSIWYG
(that would be Level 3+, and out of scope), and explicitly not a preview of unsaved drafts — the
owner was firm that the CMS must never look like it's showing edits it isn't.

**The same-origin insight.** `/admin/` and the site are served from the same Eleventy build, same
origin, same deploy. That means the admin's JS can reach directly into an `<iframe src="/company/">`
via `iframe.contentDocument.querySelector(...)` — no `postMessage` bridge, no `?cms-preview=1`
query param, no script injected into the site's own bundle. The only thing that ever crosses into
the iframe is a `<style>` tag the ADMIN injects into the iframe's document at runtime, from
`PreviewPane.jsx`, after the iframe has loaded — it lives only in that in-memory document, is
never part of the site's shipped HTML/CSS/JS, and can never reach a real visitor.

**Commit 1 — invisible section markers.** Every section in `src/admin/manifest.js` needs exactly
one thing on the site side: `data-cms-section="<pageId>.<sectionId>"` on that section's root DOM
element. Two categories of template needed different handling:

- Most sections have their own dedicated template file or a standalone `<section>` in a page's
  `.njk` — one attribute on the root tag.
- A few pages render two sibling sections (an intro + a list, e.g. `stores.network` /
  `stores.store-list`, `contact.offices-intro` / `contact.bollag-office`, `brands.portfolio-heading`
  / `brands.all-brands`) inside one shared wrapper `<section>`. In those cases each sub-section has
  its own nested `<div>`/`<section>` already in the markup, so the marker goes on that inner
  element instead of the shared wrapper — no markup added, just an attribute on an element that
  was already there.
- `agenda.calendar` / `agenda.months` render as one visually fused block (same background, no
  seam) inside `src/agenda/index.njk`, but DO have two distinct DOM nodes: an outer `<section>`
  and, nested inside it, a `<div class="space-y-14 lg:space-y-20">` that holds just the month
  list. Marked the outer section `agenda.calendar` (the "shared root" the fused block reads as)
  and the inner div `agenda.months` — both markers exist, one nested inside the other.
- The shared `selected-stores.njk` include (rendered by both `src/index.njk` as
  `homepage.editorial-selection` and `src/company/index.njk` as `company.editorial-selection`)
  can't hardcode either id — it's one file backing two different manifest sections depending on
  which page includes it. Each page now does `{% set cmsSection = 'homepage.editorial-selection' -%}`
  (or the company equivalent) immediately before the include; the component renders
  `{% if cmsSection %} data-cms-section="{{ cmsSection }}"{% endif %}`, so an unrelated future
  include of this component without setting the variable stays unmarked instead of emitting a
  broken empty attribute.
- Two manifest sections have no on-page root to mark at all: `brands.page-settings` and
  `wearhouse.page-settings` are shared TEXT rendered on individual brand/wearhouse-brand *detail*
  pages (`brand.njk`), never on `/brands/` or `/wearhouse/` themselves. Allowlisted with a comment
  in the coverage test rather than marking something that isn't actually there.
- `src/brands/index.njk` also includes `wearhouse-brands-wall.njk` (a second render of the
  homepage's Wearhouse portfolio brands, reused as a teaser). That block isn't itself a manifest
  section of the Brands page — left unmarked.

**Coverage test** (`src/admin/__tests__/preview-sections.test.js`): rather than running a full
`npm run build` inside the vitest suite, it greps the SOURCE `.njk` templates for the exact
`data-cms-section="<page>.<section>"` string every manifest section is expected to produce (or
the `cmsSection = '...'` assignment, for the shared include). Every manifest section must either
match, or be named in an explicit, commented `NO_PREVIEW_TARGET` allowlist — plus a reverse check
that every marker found in source actually resolves to a real manifest id, and that every
allowlist entry is a real manifest id, catching typos in both directions. This is deliberately a
proxy for a built-HTML check, not the real thing — cheap enough to run on every `npm test`, and it
fails exactly when a template stops emitting a marker a screen still expects one from.

**Proof of zero visual change.** Cleaned `_site`, built origin/main into one directory and this
branch into another, then normalized the AFTER tree by stripping every
`data-cms-section="..."` occurrence (including the whole line, so a multi-line attribute list
collapses back to its original line count) before diffing:

```bash
find after_normalized -name '*.html' -exec \
  perl -0777 -pi -e 's/[ \t]*data-cms-section="[^"]*"[ \t]*\n?//g' {} \;
diff -rq before after_normalized   # admin/index.html and admin/media-index.json excluded —
                                    # both stamp a fresh Date.now()/ISO timestamp on every
                                    # build regardless of any template change (buildHash.js,
                                    # media-index.11ty.js), and neither is a site page.
```

Result: empty diff across all 35 rendered site pages. Two `{% set cmsSection = '...' -%}` lines
use the `-%}` whitespace-control suffix specifically so they don't add a stray blank line to their
page's output — everything else already matched byte-for-byte once the attribute itself was
stripped. Confirmed separately that no site CSS/JS (`src/assets/**`, `tailwind.config.js`)
references `data-cms-section` anywhere.

**Commit 2 — the pane.** `src/admin/preview/previewLogic.js` holds the pure, DOM-shaped logic
(marker selector, localStorage read/write, highlight inject/clear/locate) so it's unit-testable in
vitest's `node` environment without jsdom — the fakes in `previewLogic.test.js` duck-type just the
`querySelector`/`setAttribute`/`scrollIntoView`/`scrollBy` surface the real code calls.
`src/admin/preview/PreviewPane.jsx` wraps that logic in a component: an `<iframe src={page.url}>`,
a header with the exact required copy ("Live page — the published version. Your unsaved edits are
not shown here.") plus "Open in new tab ↗", and a collapse toggle persisted to `localStorage` under
`bg-cms-preview-open`. `SectionScreen.jsx` was restructured — the section-specific editor (plain
field form, managed list, or one of the custom Brands/Wearhouse screens) now renders inside a
`.section-preview-form` column, with `PreviewPane` beside it in `.section-preview-layout`; every
route through `SectionScreen` gets a preview without each sub-screen needing to know about it.
CSS uses flexbox, not grid, so the form column reliably reclaims the space the pane gives up when
collapsed to its 44px rail, regardless of how the browser would resolve an intrinsic grid-track
size for that rail; hidden entirely below 1100px so it never competes with the form on small
screens.

Every iframe DOM access (`contentDocument`, `contentWindow`) is wrapped in try/catch — a
cross-origin frame, a not-yet-navigated frame, or a missing marker all degrade to a "Preview
unavailable" note rather than throwing into React, and the form itself never depends on the
preview succeeding. Switching between two sections of the *same* page relocates and re-highlights
in the already-loaded iframe instead of reloading; switching to a section on a different page lets
the iframe's `src` change (React `key={page.url}`) trigger a normal reload, and the `onLoad`
handler re-applies the highlight once it fires.

Manually verified in a real browser (temporary harness importing the real `PreviewPane.jsx`,
deleted before commit — Supabase admin login wasn't available in this environment) against the
actual built site, same origin, on `localhost:8080`: hero/intro/history sections locate and
highlight correctly with the header-offset scroll visible as a gap above the outlined block; the
`agenda.calendar` / `agenda.months` fused case highlights the correct one of the two nested
elements and switching between them re-highlights without an iframe reload; a missing marker shows
"Preview unavailable" without breaking the pane; the collapse toggle persists to `localStorage` and
survives; the pane disappears entirely below the 1100px breakpoint. No console errors in any of
these interactions. `[data-reveal]` content did become visible after the offset scroll in every
case checked (the site's own `IntersectionObserver` fired naturally) — no case was hit here where
a `[data-reveal]` ancestor stayed un-revealed, so there was nothing to work around.

**Non-goal, stated explicitly:** this pane never shows unpublished drafts. It always renders
whatever is currently live on the site, refetched fresh in the iframe — editing a field and
looking at the pane without publishing first will show the *old* value, by design, so the CMS
never looks like it's previewing something a visitor can't yet see.

Verify: `npm test` 62/62 → 76/76 (14 new preview-pane tests) and `npm run build` green before each
commit; the normalized byte-diff proof above re-run (and still empty) before commit 1.

```bash
git commit -m "feat: mark section roots for the CMS preview (invisible attributes only)"
git commit -m "feat(cms-v2): section preview pane (published page, highlights the edited block)"
```

---

### Task 21: Live preview (Phase 2, level 3)

Task 20 shipped Level 2: the published page, scrolled and outlined. Editors still had to publish
and reload to see whether a text edit or a new image actually looked right. This task upgrades the
same pane to Level 3 — unsaved edits patched directly into the iframe's DOM as the editor types —
while fixing three reliability gaps in the Level 2 highlight along the way.

**The same-origin direct-patch approach, unchanged from Task 20.** No script is added to the site.
The live-patch engine lives entirely in the admin (`previewLogic.js` + `PreviewPane.jsx`) and reaches
into the same-origin iframe via `iframe.contentDocument`, exactly like the Level 2 highlight already
did. The only thing that ever crosses into the iframe is admin-injected `<style>` tags (the existing
highlight style, now also force-revealing `[data-reveal]` content, plus a new broken-image dimming
style) and direct DOM writes (`textContent` / `img.src`) — never a `<script>`, never `postMessage`,
never a site-side bundle change.

**Commit 1 — reliability fixes for the Level 2 highlight**, before touching bind attributes at all:
- **Force-reveal.** The site hides `[data-reveal]` content until an `IntersectionObserver` fires
  (`body.is-ready [data-reveal]{opacity:0}` in `site.css`). A highlighted or live-patched node could
  sit invisible in the pane despite being correctly targeted. `HIGHLIGHT_CSS` now also carries
  `[data-reveal]{opacity:1 !important;transform:none !important;}` — admin-injected, iframe-only, so
  it never touches the site's own stylesheet.
- **Retry after layout.** `locateAndHighlight` now runs immediately on load/section-change AND once
  more on the next animation frame, so a target that hadn't finished laying out yet (fonts, reveal-
  triggered shifts) still resolves instead of flaking to "Preview unavailable".
- **Friendlier no-target copy.** `noTargetMessage(pageId, sectionId)` returns a specific reason for
  the two allowlisted sections (`brands.page-settings`, `wearhouse.page-settings` — text shown on
  individual brand pages, not the listing) instead of the generic message.
- **Per-brand preview URL.** `computePreviewUrl(page, section, rest, store)` resolves the item
  editors' (BrandsScreen / WearhouseScreen, item mode) preview target to that ONE brand's own page
  (`/brands/<slug>/` or `/wearhouse/<slug>/`) by reading the slug straight out of the draft store —
  reusing `adapters/wearhouse.js`'s `joinWearhouse` for the joined Wearhouse case. `PreviewPane` takes
  an optional `previewUrl` override; `SectionScreen` computes and passes it down.

**Commit 2 — the bind scheme, added to the site templates (still invisible attributes only).** A
bound node carries `data-cms-bind="<pageId>.<sectionId>#<jsonPathFromFileRoot>"` — e.g.
`homepage.intro#intro.title`, `company.history#history.title`, `brands.all-brands#brands.3.card.eyebrow`.
The engine resolves `pageId.sectionId` via the EXISTING `findSection()` in `manifest.js` to get the
section's `file` (or, for a `joined` section, its `files`), then `getAtPath(store.getDraft(file),
jsonPath)` — the same helper `SectionScreen`/`BrandsScreen`/etc. already use to read/write drafts.
No second file map was introduced.

Binding rules applied uniformly:
- **Text:** only bind an element whose entire text content is exactly one `{{ ... }}` scalar
  (whitespace around it is fine — that's just template indentation). An element mixing literal text
  with the interpolation (`Fax {{ office.fax }}`), multiple interpolations, an `or`-fallback
  (`{{ heroTitle or summary }}`), or a filter (`{{ x | replace(...) }}`) is left unbound — the
  live-patched value could show something the published fallback logic would never actually render.
- **Images:** `<img src="{{ x }}">` binds on the `<img>` itself (the engine sets `src`). Video
  `poster`/`<source>` attributes and CSS `background-image` are out of scope (only `<img src>` is
  patchable per the spec) and left as publish-only.
- **List items:** where a loop cleanly exposes an index (`loop.index0`, or — for the two paginated
  brand-detail templates, `pagination.pageNumber`, which is provably the same index as the
  paginated array since both `src/_data/brands.js` and `wearhousePage.js`'s roster-based `brands`
  build their arrays via a plain `.map()` over the manifest's own array, preserving order 1:1) fields
  are bound with that index in the path. Deeply-nested double loops (a store card inside a store
  group, an event inside an agenda month) are left publish-only beyond their OUTER loop's
  object-level heading fields (group/month label, title, intro) — correct per-item binding would need
  two nested loop indices threaded through the path, and those cards aren't the highest-priority
  surface.
- **The Wearhouse joined section** (`wearhousePage/roster.json` + `wearhousePage/brands.json`,
  merged per-record by `src/_data/wearhouse.js` with field-level override precedence) has NO clean
  single-file-plus-index mapping for its per-brand card/detail fields — the merge picks fields from
  either file depending on which one defines them, and the joined array's index doesn't reliably
  match either underlying file's array index. Only its section-level heading fields
  (`rosterSection.eyebrow`/`title`, unambiguously roster-only) and — on `wearhouse/brand.njk` — the
  fields provably sourced from ONE file at the page's `pagination.pageNumber` index (`brand.name`/
  `segment` from the roster; `brand.eyebrow`/`detailPage.*` from the single-file, non-joined
  `wearhousePage/detail.json`) are bound. `brand.summary`/`intro`/`focus`/`atmosphere`/`categories`
  (sourced from `brands.json`'s `detail`, matched by slug rather than index) are left publish-only.
- **Prioritized** heroes, intros, section headings/summaries, CTA button labels, all standalone
  `<img>` nodes, and the brand detail page (`brands/brand.njk`) — the most-edited surface, and,
  being backed by a single non-joined file (`brandsPage/brands.json`), fully bindable via
  `pagination.pageNumber`.

**Byte-identical proof — the headline requirement.** Built `origin/main` and this branch into
separate temp trees (`git worktree add --detach`, shared `node_modules`, `npm run build`), stripped
BOTH `data-cms-section` and `data-cms-bind` from the AFTER tree, then `diff -rq`:

```bash
find after -name '*.html' -print0 | xargs -0 perl -0777 -pi -e \
  's/ data-cms-(section|bind)="[^"]*"//g'
diff -rq before after -x admin -x cms-data -x media-index.json
```

Result: empty, across all 35 rendered site pages AND `assets/styles/site.css`. Two real bugs
surfaced and were fixed to get there:
1. **Multi-line tags.** A few `<img>`/`<a>` bindings were placed on their own line inside a
   multi-line tag. Stripping ` data-cms-bind="..."` (a single leading space) from `\n      data-cms-bind="..."\n` leaves a stray whitespace-only line the ORIGINAL never had. Fixed by appending the
   attribute to an existing attribute's line instead of giving it its own — including one
   pre-existing case in `site-header.njk`'s `data-cms-section` (Task 20), which had the identical bug
   and would have failed this same proof for a joined-file bind path if it had been checked there.
2. **Tailwind content-scanner leakage.** `tailwind.config.js`'s `content` glob (`src/**/*.{njk,html,md,js}`)
   reads every `.js` file under `src/admin/`, comments included, for anything that LOOKS like a
   utility class name — not just literal `className="..."` usage. A code comment mentioning
   "invisible", a test description mentioning "outline", and the (pre-existing, Task 20) highlight
   style's own `outline: 3px solid ...` CSS shorthand all independently caused Tailwind to emit an
   unused `.invisible{...}`/`.outline{...}` rule into the SITE's own `site.css` — zero visual effect
   (nothing ever applies those classes) but real bytes, and exactly what the proof exists to catch.
   Fixed by rewording the comments/test description and rewriting the highlight CSS as four longhand
   `outline-width`/`-style`/`-color`/`-offset` declarations instead of the shorthand (see
   `previewLogic.js`'s `HIGHLIGHT_CSS` comment) — no `tailwind.config.js` change was needed once the
   literal source text stopped containing bare utility-matching words.

**Commit 3 — the live-patch engine.** `previewLogic.js` gained:
- `resolveBind(bindAttr)` → `{pageId, sectionId, jsonPath}` (pure string parsing).
- `patchNode(el, value)` → sets `src` for an `<img>`, else `textContent`; refuses to write when
  `value` is `undefined`/`null` (leaves the published DOM as-is rather than blanking it) or when the
  element already has ELEMENT children (never nukes nested markup, even though Commit 2's rules
  should mean this never actually happens).
- `patchAll(doc, getDraft)` → queries every `[data-cms-bind]` node, resolves it via the manifest's
  `findSection`, tries each of a `joined` section's files in order for the first defined value
  (still just the manifest's existing `file`/`files` — no second map), and calls `patchNode`. One bad
  node (unknown section, missing draft, a throw) is skipped and never stops the rest.
- `isManagedListRoute(section, rest)` → true for BrandsScreen/WearhouseScreen in EITHER list or item
  mode (item mode still has a "Delete brand" button — a structural change) and for the generic
  managed-list sub-routes (`rest[0] === 'list'`); false for plain sections.

`PreviewPane.jsx`: `applyPatch()` runs `patchAll` on load, on section/page change (riding along with
the existing highlight retry), and — via a separate `useEffect` keyed on `useStoreVersion(store)`,
rAF-coalesced so a burst of keystrokes collapses into one patch per frame — on every store mutation.
Deliberately does NOT re-run `locateAndHighlight` on store changes, since that scrolls the iframe;
typing must never yank the preview's scroll position around.

**Honesty label flip.** Level 2's copy ("Live page — the published version. Your unsaved edits are
not shown here.") is now the opposite of true, since edits ARE shown. Replaced with the exact
required copy: `Live preview — your unsaved edits show here. Publish to put them on the real site.`
"Open in new tab ↗" still opens the published page (now the per-brand URL when applicable).

**Structural-change note.** When `isManagedListRoute` is true, a small sub-note appears under the
header: `Adding, removing, or reordering items appears after publishing.` Text/image edits to
EXISTING items on those same routes still patch live wherever bound — only add/remove/reorder is
publish-only.

**Fresh-upload edge case.** A newly-picked image's file may not exist in the already-built page yet
(it lands on the next publish, not immediately). `patchNode` still sets the `src` — the browser
shows its native broken-image rendering, no crash risk (a 404 is an async network event, not a
thrown exception). On top of that, `patchNode` attaches one-time `error`/`load` listeners that toggle
a `data-cms-preview-broken` attribute, dimmed via a small admin-injected style
(`ensureBrokenImageStyle`) — a subtle visual hint, never a blocker.

**Non-goals, stated explicitly (mirrors the coverage table in the task report):** structural list
changes (add/remove/reorder) are never simulated, only announced via the sub-note; background-image
CSS and video `poster`/`<source>` are publish-only; multi-value/fallback/filtered template
expressions are publish-only; the Wearhouse joined section's per-record card/detail fields (beyond
what's provably single-file-and-indexed) are publish-only.

Verify: `npm test` 85/85 → 107/107 (22 new tests: reliability-fix helpers + the full live-patch
engine) and `npm run build` green before each commit; the byte-identical proof above re-run (still
empty) before commit 2.

```bash
git commit -m "fix(cms-v2): reliable preview highlight (force-reveal, retry, per-brand page)"
git commit -m "feat: bind text/image nodes for live preview (invisible attributes only)"
git commit -m "feat(cms-v2): live preview — patch text and images in the pane as you type"
```

---

### Task 22: Wearhouse brand editor mirrors Bollag

**Editor-only rebuild** (`src/admin/**` only — no `.njk`, no `src/_data/**` touched). Rebuilt
`WearhouseScreen.jsx`'s item mode to mirror `BrandsScreen.jsx`'s structure: explicit field-path
groups cascading in the exact order `src/wearhouse/brand.njk` renders them, field defs resolved
from `config.yml` (`findField`/`withOverrides`) so widget types and `required` stay in sync, only
label/description overridden per placement, and a per-path `updateField(half, path, value)` (clone
the touched half with `deepClone` + `setAtPath`, then route through the existing `updateRecord`
so it's still pruned against that half's remote counterpart by slug) — adapted from BrandsScreen's
single-file `setAtPath`/`pruneEmptyAdditions` pattern to the two-file roster/brand join.

**Verified mapping** (what the live site actually reads, confirmed against `src/_data/wearhouse.js`
and the templates — `src/_data/wearhouse.js` merges `{...detailBrand, ...rosterItem, ...detail}`
and reads `detailBrand.detailImage`/`detailBrand.websiteHref`, which don't exist at that level, so
those two rosterCard fields were always dead):

| Editor field | Stored at | Where it renders |
|---|---|---|
| Brand name | `roster.name` AND `brand.name` (kept in sync) | brand page H1 + card |
| Logo | `roster.logoSrc` | card on the Wearhouse page (not the brand's own page) |
| Web address | `roster.slug` + `brand.slug` + `roster.pageHref` | the page URL |
| Background photo | `roster.hoverImage` | brand page hero background + intro portrait + card photo (one image, three jobs) |
| Description | `brand.detail.summary` | paragraph under the brand name + card body text |
| Segment | `roster.segment` | small meta row under the hero on the brand's own page |
| First paragraph | `brand.detail.intro` | overview paragraph 1 |
| Second paragraph | `brand.detail.focus` | overview paragraph 2 |
| Style tag | `brand.detail.atmosphere` | meta row in the overview |
| Categories | `brand.detail.categories` | meta row (list) |
| Card label | `roster.cardLabel` | small line above the logo on the card |
| Logo text lines | `brand.rosterCard.logoLines` | text-logo fallback when `logoSrc` is empty (only `via-masini`) |

Wearhouse brand pages have no gallery/visual journal and no per-brand eyebrow (shared
`detailPage.heroEyebrow`, called out in a `field-help` line at the end of the "Page top" group
instead of a fake per-brand field) — so, unlike BrandsScreen, there is no "Visual journal" group.

**Groups implemented** (item mode): **Brand** (name, logo, logo text lines, web address + rename) →
**Page top** (background photo, description, segment, + the shared-eyebrow help line) →
**Introduction** (first/second paragraph, style tag, categories) → **Card on the Wearhouse page**
(card label only — reuses the Page top background photo, never binds a second field to the same
path).

**Dead `rosterCard` fields removed from `config.yml`** (data untouched): `websiteHref`, `logoSrc`,
`hoverImage`, `detailImage` — all four were shadowed or read at the wrong level by
`src/_data/wearhouse.js`, so editing them changed nothing on the site. `logoLines` was kept
(genuinely live as the no-logo text fallback) and relabeled "Logo text lines". Note: the intended
fifth removal, `rosterCard.segment`, turned out to already be absent from `config.yml` — the
JSON data carries a `segment` key under `rosterCard` on every brand entry, but no field ever
exposed it in the editor, so there was nothing to delete there.

Also repointed `WearhouseScreen.jsx`'s own list-mode subtitle/thumbnail fallbacks off the dead
`record.brand?.rosterCard?.segment` / `...detailImage` onto the live `record.roster?.segment` /
`roster.hoverImage`+`logoSrc` (`Search.jsx` had no such reference to begin with).

Verify: `node_modules/.bin/vitest run` 107/107 and `npm run build` green; a standalone Node probe
loaded the real `roster.json`/`brands.json`, ran `joinWearhouse` → edited one field from each group
→ `splitWearhouse`, and confirmed: all 15 roster items and 15 brand entries preserved, no key-order
churn on touched or untouched records, edits landed at the correct file/path with no cross-file
leakage, and (via a synthetic missing-half fixture, since the real data has none) a record missing
either half round-trips without inventing the missing one.

```bash
git commit -m "feat(cms-v2): wearhouse brand editor mirrors the Bollag structure; drop dead fields"
```

---

## Chunk 7: Cutover, verification, walkthrough, handoff

### Task 20: Delete the old monolith

**Files:**
- Delete: `src/admin/app.jsx`

- [ ] **Step 1: Confirm nothing imports it** (must print "clean")

```bash
grep -rn "app.jsx\|from './app'" src/admin --include='*.jsx' --include='*.js' | grep -v "main.jsx was" || echo clean
grep -rn "app.jsx" package.json || echo "package.json clean"
```

If `main.jsx` still contains the Task 7 placeholder import, that means Chunk 3 was skipped — stop and fix.

- [ ] **Step 2: Delete and verify**

```bash
git rm -q src/admin/app.jsx
npm run build && npm test
```

Expected: both green.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(cms-v2): delete the legacy admin monolith"
```

**Post-walkthrough fixes (applied after the first pass of Task 22):** the browser walkthrough surfaced three issues, fixed in one follow-up commit before sign-off:
- **Dev labels leaking into the UI.** `config.yml` field-level labels ending in ` Div` (the ones that actually render as `FieldRenderer` group-card titles / list labels / breadcrumbs — as opposed to the sibling `files:`-level `label:`, which the app never reads) were renamed to editor-facing text, e.g. `Brand Entries Div` → `Brands`, `Brand Card Div` → `Card on the Brands page`, `Roster Card Div` → `Card details`. `wearhouse_page`'s `Roster Section Div` was deliberately left as-is — it is technically field-level but `WearhouseScreen` bypasses it (hardcodes "Section heading" and reads only the child eyebrow/title fields), so it never renders anywhere.
- **"Stores / Stores / Stores" breadcrumb stutter.** `manifest.js`'s `store-list` section label changed `Stores` → `Store list`; `config.yml`'s nested stores-within-a-group list label changed `Stores` → `Stores in this group`. (So Step 6 below now reads: Stores → Store list → Store Groups grid → open a group → its "Stores in this group" list.) The Agenda page has the same months → events shape but was already fine: `months` section label is `Events by month`, distinct from the field labels `Months`/`Events`, so no stutter and no change was needed there.
- **Raw HTML error bodies leaking into toasts.** `lib/api.js`'s `request()` no longer surfaces a non-JSON response body verbatim; if it looks like an HTML page (`raw.trim().startsWith('<')`) the error message is replaced with a plain `The server returned an error (<status>).`, otherwise the raw text is kept (truncated to 200 chars) so short plain-text errors (e.g. `boom`) still surface. See the updated Task 6 code block and tests above.

### Task 21: Full verification sweep

- [ ] **Step 1: Run the complete check battery**

```bash
npm test                                    # all logic suites green
npm run build                               # eleventy + css + admin bundle green
test -f _site/admin/media-index.json && echo "media index ok"
grep -o 'app.js?v=[a-z0-9]*' _site/admin/index.html   # cache-busted bundle reference
grep -rn "TEMP-LOCAL" src && echo "FAIL: bypass committed" || echo "no bypass in source"
grep -c "console.log" src/admin --include='*.jsx' -r || true   # expect 0 or intentional only
```

- [ ] **Step 2: Bundle sanity** — `ls -la _site/admin/app.js` (expect roughly 1.5–2.5 MB, in line with the old bundle; a 10 KB file means the entry broke).

- [ ] **Step 3: Commit anything outstanding** — working tree must be clean: `git status --short` → empty.

### Task 22: Guided localhost walkthrough (manual, with temporary bypass)

- [ ] **Step 1: Apply the TEMPORARY localhost bypass.** In `src/admin/main.jsx`, at the very top of the `useEffect` in `AdminRoot` (before `supabase.auth.getSession()`), insert:

```jsx
// TEMP-LOCAL-PREVIEW-BYPASS — never commit. Loads the workspace with a fake
// admin so screens can be walked through without Supabase on localhost.
if (window.location.hostname === 'localhost') {
  Promise.all([loadFieldConfig(), loadMediaIndex()]).then(async ([config, media]) => {
    await Promise.all(ALL_FILES.map(async filePath => store.loadFile(filePath, await loadContentFile(filePath))));
    setFieldConfig(config);
    setMediaIndex(media);
    setUser({ id: 'preview', email: 'preview@local', name: 'Preview', role: 'admin' });
    setMode('app');
  });
  return;
}
```

- [ ] **Step 2: Run and walk through** — `npm run dev:static`, open `http://localhost:8080/admin/`, and verify every line:

1. Sidebar lists: Homepage, Company, Brands, The Wearhouse, Stores, Agenda, Contact, Header & Footer, Media, People.
2. Homepage → sections in page order with summaries; open "Hero banner" → flat form, no accordions; edit Title → topbar flips to "Saved — not published yet"; Changes button shows (1).
3. Section "Discard changes" restores the value and the badge returns to "All changes published".
4. Brands → All brands → card grid of ~11 brands with logos; open one → full-screen editor with breadcrumb; its Gallery renders as a "Manage items" block → opens a nested card grid; add, duplicate, reorder (↑/↓), delete an item — all work and are announced by toasts.
5. The Wearhouse → Wearhouse brands → joined grid (~16 cards, segments as subtitles); any mis-synced brand shows a "Missing …" badge; open a brand → three group cards ("Name & web address" / "Card on the Wearhouse page" / "Brand detail page"); "Rename address" prompts, rejects a duplicate, and renames both halves + navigates to the new address; add a test brand via the name box → both halves created → delete it.
6. Stores → Store list → Store Groups grid → open a group → its "Stores in this group" list renders as a managed list → open a store → edit → breadcrumbs navigate back correctly.
7. Image field: open Homepage → Introduction → Image → "Replace" opens the media picker; search works; picking swaps the preview. "Edit file path manually" reveals the raw input. Remove the image, then drag an image file from the desktop onto the empty dropzone — on the static server the upload must fail with a plain error TOAST (no crash, `/api` is absent locally).
8. Media screen: grid renders with sizes and "used in" hints; search filters; "Copy path" toasts.
9. Search box: type "closed" → brand hit navigates to the brand; type "hero" → section hits.
10. Changes tray: make 2 edits in different pages → tray lists both rows with page names; per-row Discard works; clear a required Title and confirm the tray shows a plain-language issue and the Publish button is disabled; restore it → publish enabled. (Actual publish fails on the static server — clicking it must show an error TOAST, not break the UI.)
11. People: shows the "Could not load people" empty state (no API on the static server) — graceful, no crash.
12. Reload the page mid-edit → drafts persist (localStorage), tray still lists them.

- [ ] **Step 3: REMOVE the bypass** — restore `main.jsx` exactly:

```bash
git checkout src/admin/main.jsx
npm run build:admin
grep -c "TEMP-LOCAL\|preview@local" _site/admin/app.js   # must print 0
```

- [ ] **Step 4: Final state check** — `git status --short` → clean; `git log --oneline main..cms-v2` shows all task commits.

### Task 23: Handoff (no deploy — owner decides)

- [ ] **Step 1: Do NOT merge or push.** Deployment is the owner's call because the live CMS is in active use and editors' localStorage drafts keyed to old file paths are unaffected (paths unchanged) but their muscle memory is not.

- [ ] **Step 2: Report back with:**
- The branch name (`cms-v2`) and commit list.
- Deploy steps for the owner: `git checkout main && git pull --rebase origin main && git merge cms-v2 && npm run build && git push origin main`, then hard-refresh `https://bg-murex-three.vercel.app/admin/` (the cache-busted bundle makes later deploys instant), sign in, and run a real publish round-trip on one harmless field.
- Rollback: Vercel dashboard → Deployments → promote the previous deployment; or `git revert -m 1 <merge-commit>` and push.

**End of Chunk 7.**
