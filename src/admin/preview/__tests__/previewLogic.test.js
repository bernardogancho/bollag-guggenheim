import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY,
  HIGHLIGHT_ATTR,
  HIGHLIGHT_STYLE_ID,
  HIGHLIGHT_CSS,
  BROKEN_IMAGE_ATTR,
  BROKEN_IMAGE_CSS,
  markerSelector,
  readPreviewOpen,
  writePreviewOpen,
  ensureHighlightStyle,
  ensureBrokenImageStyle,
  clearHighlight,
  locateAndHighlight,
  noTargetMessage,
  computePreviewUrl,
  isManagedListRoute,
  resolveBind,
  patchNode,
  patchAll,
} from '../previewLogic.js';

// Minimal duck-typed DOM stand-ins — the vitest config runs in the `node`
// environment (no jsdom), so these fakes exercise the exact call shape
// PreviewPane.jsx relies on without needing a full DOM implementation.
function makeElement(overrides = {}) {
  const attrs = new Map();
  return {
    attrs,
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: name => attrs.delete(name),
    hasAttribute: name => attrs.has(name),
    scrollIntoView: () => {},
    ...overrides,
  };
}

function makeDoc({ target = null, marked = [] } = {}) {
  return {
    head: { appendChild: () => {} },
    createElement: () => ({ id: '', textContent: '' }),
    getElementById: () => null,
    querySelector: () => target,
    querySelectorAll: () => marked,
  };
}

describe('previewLogic', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  describe('markerSelector', () => {
    it('builds the attribute selector from page + section ids', () => {
      expect(markerSelector('homepage', 'hero')).toBe('[data-cms-section="homepage.hero"]');
    });
  });

  describe('readPreviewOpen / writePreviewOpen', () => {
    it('defaults to the given default when nothing is stored', () => {
      expect(readPreviewOpen(true)).toBe(true);
      expect(readPreviewOpen(false)).toBe(false);
    });

    it('round-trips a written value', () => {
      writePreviewOpen(false);
      expect(readPreviewOpen(true)).toBe(false);
      writePreviewOpen(true);
      expect(readPreviewOpen(false)).toBe(true);
    });

    it('never throws when storage is unavailable', () => {
      const original = globalThis.localStorage;
      // Simulate a storage that throws (private browsing / disabled storage).
      globalThis.localStorage = {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
      };
      expect(() => writePreviewOpen(true)).not.toThrow();
      expect(readPreviewOpen(true)).toBe(true);
      expect(readPreviewOpen(false)).toBe(false);
      globalThis.localStorage = original;
    });
  });

  describe('ensureHighlightStyle', () => {
    it('appends a style tag once', () => {
      let appended = 0;
      const doc = {
        head: { appendChild: () => { appended += 1; } },
        createElement: () => ({ id: '', textContent: '' }),
        getElementById: () => null,
      };
      expect(ensureHighlightStyle(doc)).toBe(true);
      expect(appended).toBe(1);
    });

    it('does not append twice if the style already exists', () => {
      let appended = 0;
      const doc = {
        head: { appendChild: () => { appended += 1; } },
        createElement: () => ({ id: '', textContent: '' }),
        getElementById: id => (id === HIGHLIGHT_STYLE_ID ? {} : null),
      };
      ensureHighlightStyle(doc);
      expect(appended).toBe(0);
    });

    it('returns false for a doc missing the required DOM surface, without throwing', () => {
      expect(ensureHighlightStyle(null)).toBe(false);
      expect(ensureHighlightStyle({})).toBe(false);
    });
  });

  describe('clearHighlight', () => {
    it('removes the highlight attribute from every previously-marked element', () => {
      const a = makeElement();
      const b = makeElement();
      a.setAttribute(HIGHLIGHT_ATTR, '');
      b.setAttribute(HIGHLIGHT_ATTR, '');
      const doc = makeDoc({ marked: [a, b] });
      clearHighlight(doc);
      expect(a.hasAttribute(HIGHLIGHT_ATTR)).toBe(false);
      expect(b.hasAttribute(HIGHLIGHT_ATTR)).toBe(false);
    });

    it('is a no-op for a doc without querySelectorAll', () => {
      expect(() => clearHighlight(null)).not.toThrow();
      expect(() => clearHighlight({})).not.toThrow();
    });
  });

  describe('locateAndHighlight', () => {
    it('finds, highlights and scrolls to the target, returning true', () => {
      let scrolledInto = false;
      let scrolledBy = null;
      const target = makeElement({ scrollIntoView: () => { scrolledInto = true; } });
      const doc = makeDoc({ target });
      const win = { scrollBy: (x, y) => { scrolledBy = [x, y]; } };

      const found = locateAndHighlight(doc, win, 'homepage', 'hero');

      expect(found).toBe(true);
      expect(target.hasAttribute(HIGHLIGHT_ATTR)).toBe(true);
      expect(scrolledInto).toBe(true);
      expect(scrolledBy[1]).toBeLessThan(0); // scrolls back up, past the fixed header
    });

    it('returns false and highlights nothing when the marker is missing', () => {
      const doc = makeDoc({ target: null });
      const found = locateAndHighlight(doc, {}, 'homepage', 'does-not-exist');
      expect(found).toBe(false);
    });

    it('degrades to false instead of throwing for an unusable doc', () => {
      expect(locateAndHighlight(null, null, 'homepage', 'hero')).toBe(false);
      expect(locateAndHighlight({}, null, 'homepage', 'hero')).toBe(false);
    });

    it('clears a previous highlight before applying the new one', () => {
      const stale = makeElement();
      stale.setAttribute(HIGHLIGHT_ATTR, '');
      const target = makeElement();
      const doc = {
        head: { appendChild: () => {} },
        createElement: () => ({ id: '', textContent: '' }),
        getElementById: () => null,
        querySelectorAll: () => [stale],
        querySelector: () => target,
      };
      locateAndHighlight(doc, {}, 'homepage', 'intro');
      expect(stale.hasAttribute(HIGHLIGHT_ATTR)).toBe(false);
      expect(target.hasAttribute(HIGHLIGHT_ATTR)).toBe(true);
    });
  });

  it('STORAGE_KEY is the documented localStorage key', () => {
    expect(STORAGE_KEY).toBe('bg-cms-preview-open');
  });

  describe('HIGHLIGHT_CSS', () => {
    it('force-reveals [data-reveal] content inside the iframe, in addition to marking the highlighted element', () => {
      // The site hides [data-reveal] until scrolled into view; the preview
      // pane's injected style must override that so highlighted/patched
      // content is legible without scrolling to trigger it.
      expect(HIGHLIGHT_CSS).toContain('[data-reveal]');
      expect(HIGHLIGHT_CSS).toContain('opacity:1 !important');
      expect(HIGHLIGHT_CSS).toContain(`[${HIGHLIGHT_ATTR}]`);
    });
  });

  describe('noTargetMessage', () => {
    it('gives the allowlisted brand/wearhouse page-settings sections a specific reason', () => {
      expect(noTargetMessage('brands', 'page-settings')).toBe(
        "This section's content appears on the individual brand pages, not here."
      );
      expect(noTargetMessage('wearhouse', 'page-settings')).toBe(
        "This section's content appears on the individual brand pages, not here."
      );
    });

    it('falls back to the generic message for everything else', () => {
      expect(noTargetMessage('homepage', 'hero')).toBe('Preview unavailable.');
      expect(noTargetMessage('brands', 'all-brands')).toBe('Preview unavailable.');
    });
  });

  describe('computePreviewUrl', () => {
    const page = { id: 'brands', url: '/brands/' };

    it('returns the page url when there is no item route (list mode)', () => {
      const section = { id: 'all-brands', custom: 'brands', file: 'brands.json' };
      expect(computePreviewUrl(page, section, [], { getDraft: () => undefined })).toBe('/brands/');
    });

    it('resolves the brand item route to that brand\'s own page via its slug', () => {
      const section = { id: 'all-brands', custom: 'brands', file: 'brands.json' };
      const store = { getDraft: file => (file === 'brands.json' ? { brands: [{ slug: 'closed' }, { slug: 'codello' }] } : undefined) };
      expect(computePreviewUrl(page, section, ['1'], store)).toBe('/brands/codello/');
    });

    it('falls back to the page url when the brand index is out of range', () => {
      const section = { id: 'all-brands', custom: 'brands', file: 'brands.json' };
      const store = { getDraft: () => ({ brands: [{ slug: 'closed' }] }) };
      expect(computePreviewUrl(page, section, ['9'], store)).toBe('/brands/');
    });

    it('resolves a joined wearhouse item route to that brand\'s own page via the joined slug', () => {
      const wearhousePage = { id: 'wearhouse', url: '/wearhouse/' };
      const section = { id: 'wearhouse-brands', joined: true, files: ['roster.json', 'brands.json'] };
      const store = {
        getDraft: file => {
          if (file === 'roster.json') return { rosterSection: { items: [{ slug: 'caliban', name: 'Caliban' }] } };
          if (file === 'brands.json') return { brands: [{ slug: 'caliban', name: 'Caliban' }] };
          return undefined;
        },
      };
      expect(computePreviewUrl(wearhousePage, section, ['0'], store)).toBe('/wearhouse/caliban/');
    });

    it('falls back to the page url when the joined files are not loaded yet', () => {
      const wearhousePage = { id: 'wearhouse', url: '/wearhouse/' };
      const section = { id: 'wearhouse-brands', joined: true, files: ['roster.json', 'brands.json'] };
      expect(computePreviewUrl(wearhousePage, section, ['0'], { getDraft: () => undefined })).toBe('/wearhouse/');
    });

    it('returns the page url for a plain (non-item, non-joined) section', () => {
      const section = { id: 'hero', file: 'hero.json' };
      expect(computePreviewUrl(page, section, [], { getDraft: () => undefined })).toBe('/brands/');
    });
  });

  describe('isManagedListRoute', () => {
    it('is true for BrandsScreen in both list and item mode (item mode still has a delete button)', () => {
      const section = { id: 'all-brands', custom: 'brands', file: 'brands.json' };
      expect(isManagedListRoute(section, [])).toBe(true);
      expect(isManagedListRoute(section, ['2'])).toBe(true);
    });

    it('is true for a joined Wearhouse section in both list and item mode', () => {
      const section = { id: 'wearhouse-brands', joined: true, files: ['roster.json', 'brands.json'] };
      expect(isManagedListRoute(section, [])).toBe(true);
      expect(isManagedListRoute(section, ['0'])).toBe(true);
    });

    it('is true for a generic managed-list sub-route (rest[0] === "list")', () => {
      const section = { id: 'store-list', file: 'stores.json' };
      expect(isManagedListRoute(section, ['list', 'groups'])).toBe(true);
      expect(isManagedListRoute(section, ['list', 'groups', '0'])).toBe(true);
    });

    it('is false for a plain section with no list route', () => {
      const section = { id: 'hero', file: 'hero.json' };
      expect(isManagedListRoute(section, [])).toBe(false);
      expect(isManagedListRoute(section, undefined)).toBe(false);
    });
  });

  describe('resolveBind', () => {
    it('splits pageId, sectionId and jsonPath, keeping later dots in jsonPath intact', () => {
      expect(resolveBind('homepage.intro#intro.title')).toEqual({
        pageId: 'homepage',
        sectionId: 'intro',
        jsonPath: 'intro.title',
      });
    });

    it('handles a hyphenated sectionId', () => {
      expect(resolveBind('brands.all-brands#brands.3.card.eyebrow')).toEqual({
        pageId: 'brands',
        sectionId: 'all-brands',
        jsonPath: 'brands.3.card.eyebrow',
      });
    });

    it('returns null for malformed input instead of throwing', () => {
      expect(resolveBind(null)).toBeNull();
      expect(resolveBind('')).toBeNull();
      expect(resolveBind('no-hash-here')).toBeNull();
      expect(resolveBind('homepage.hero#')).toBeNull();
      expect(resolveBind('#hero.title')).toBeNull();
      expect(resolveBind('homepage#hero.title')).toBeNull();
    });
  });

  describe('patchNode', () => {
    it('sets an IMG element\'s src attribute', () => {
      const attrs = new Map();
      const el = { tagName: 'IMG', children: [], setAttribute: (name, value) => attrs.set(name, value), addEventListener: () => {} };
      expect(patchNode(el, '/assets/media/example.jpg')).toBe(true);
      expect(attrs.get('src')).toBe('/assets/media/example.jpg');
    });

    it('sets textContent for a non-IMG element', () => {
      const el = { tagName: 'P', children: [] };
      expect(patchNode(el, 'New title')).toBe(true);
      expect(el.textContent).toBe('New title');
    });

    it('stringifies a numeric value', () => {
      const el = { tagName: 'SPAN', children: [] };
      expect(patchNode(el, 42)).toBe(true);
      expect(el.textContent).toBe('42');
    });

    it('does not blank the DOM when the draft value is undefined', () => {
      const el = { tagName: 'P', children: [], textContent: 'Published text' };
      expect(patchNode(el, undefined)).toBe(false);
      expect(el.textContent).toBe('Published text');
    });

    it('refuses to patch an element that already has element children (never nukes markup)', () => {
      const el = { tagName: 'DIV', children: [{}], textContent: 'original' };
      expect(patchNode(el, 'replacement')).toBe(false);
      expect(el.textContent).toBe('original');
    });

    it('refuses an empty-string image src (would blank the image)', () => {
      const el = { tagName: 'IMG', children: [], setAttribute: () => { throw new Error('should not be called'); } };
      expect(patchNode(el, '')).toBe(false);
    });

    it('degrades to false instead of throwing for a null element', () => {
      expect(patchNode(null, 'value')).toBe(false);
    });
  });

  describe('patchAll', () => {
    // homepage.intro is a real manifest section (file src/_data/cms/home/intro.json,
    // key 'intro') — using real pageId/sectionId values here exercises the
    // actual findSection() lookup, not a fake.
    function makeBoundElement(bindAttr, overrides = {}) {
      const attrs = new Map([['data-cms-bind', bindAttr]]);
      return {
        tagName: 'P',
        children: [],
        getAttribute: name => attrs.get(name),
        setAttribute: (name, value) => attrs.set(name, value),
        addEventListener: () => {},
        ...overrides,
      };
    }

    it('patches every bound node it can resolve, using the current draft', () => {
      const title = makeBoundElement('homepage.intro#intro.title');
      const summary = makeBoundElement('homepage.intro#intro.summary');
      const doc = { querySelectorAll: () => [title, summary] };
      const draft = { intro: { title: 'New headline', summary: 'New summary' } };
      const getDraft = file => (file === 'src/_data/cms/home/intro.json' ? draft : undefined);

      const result = patchAll(doc, getDraft);

      expect(title.textContent).toBe('New headline');
      expect(summary.textContent).toBe('New summary');
      expect(result).toEqual({ patched: 2, skipped: 0 });
    });

    it('skips a node whose section is unknown, without throwing or stopping the pass', () => {
      const bad = makeBoundElement('nope.nope#nope');
      const good = makeBoundElement('homepage.intro#intro.title');
      const doc = { querySelectorAll: () => [bad, good] };
      const getDraft = () => ({ intro: { title: 'Still works' } });

      const result = patchAll(doc, getDraft);

      expect(good.textContent).toBe('Still works');
      expect(result).toEqual({ patched: 1, skipped: 1 });
    });

    it('leaves the DOM untouched when the draft value is undefined (counts as skipped, not an error)', () => {
      const el = makeBoundElement('homepage.intro#intro.doesNotExist', { textContent: 'Published' });
      const doc = { querySelectorAll: () => [el] };
      const result = patchAll(doc, () => ({ intro: {} }));

      expect(el.textContent).toBe('Published');
      expect(result).toEqual({ patched: 0, skipped: 1 });
    });

    it('tries each file of a joined section in order and uses the first defined value', () => {
      // wearhouse.wearhouse-brands is a real joined manifest section spanning
      // wearhousePage/roster.json and wearhousePage/brands.json.
      const el = makeBoundElement('wearhouse.wearhouse-brands#rosterSection.eyebrow');
      const doc = { querySelectorAll: () => [el] };
      const getDraft = file => {
        if (file.endsWith('roster.json')) return { rosterSection: { eyebrow: 'From roster' } };
        if (file.endsWith('brands.json')) return { brands: [] };
        return undefined;
      };

      const result = patchAll(doc, getDraft);

      expect(el.textContent).toBe('From roster');
      expect(result).toEqual({ patched: 1, skipped: 0 });
    });

    it('degrades to a no-op instead of throwing for a doc without querySelectorAll', () => {
      expect(patchAll(null, () => undefined)).toEqual({ patched: 0, skipped: 0 });
      expect(patchAll({}, () => undefined)).toEqual({ patched: 0, skipped: 0 });
    });

    it('keeps patching the rest of the nodes even if one throws while resolving', () => {
      const throwing = { tagName: 'P', children: [], getAttribute: () => { throw new Error('boom'); } };
      const good = makeBoundElement('homepage.intro#intro.title');
      const doc = { querySelectorAll: () => [throwing, good] };
      const result = patchAll(doc, () => ({ intro: { title: 'Survived' } }));

      expect(good.textContent).toBe('Survived');
      expect(result).toEqual({ patched: 1, skipped: 1 });
    });
  });

  describe('BROKEN_IMAGE_CSS / ensureBrokenImageStyle', () => {
    it('dims elements marked with the broken-image attribute', () => {
      expect(BROKEN_IMAGE_CSS).toContain(`[${BROKEN_IMAGE_ATTR}]`);
      expect(BROKEN_IMAGE_CSS).toContain('opacity:0.35');
    });

    it('appends the style tag once', () => {
      let appended = 0;
      const doc = {
        head: { appendChild: () => { appended += 1; } },
        createElement: () => ({ id: '', textContent: '' }),
        getElementById: () => null,
      };
      expect(ensureBrokenImageStyle(doc)).toBe(true);
      expect(appended).toBe(1);
      expect(ensureBrokenImageStyle({ ...doc, getElementById: id => (id ? {} : null) })).toBe(true);
    });
  });
});
