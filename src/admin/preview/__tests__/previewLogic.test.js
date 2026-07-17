import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY,
  HIGHLIGHT_ATTR,
  HIGHLIGHT_STYLE_ID,
  HIGHLIGHT_CSS,
  markerSelector,
  readPreviewOpen,
  writePreviewOpen,
  ensureHighlightStyle,
  clearHighlight,
  locateAndHighlight,
  noTargetMessage,
  computePreviewUrl,
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
    it('force-reveals [data-reveal] content inside the iframe, in addition to the highlight outline', () => {
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
});
