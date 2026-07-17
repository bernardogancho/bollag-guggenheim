import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY,
  HIGHLIGHT_ATTR,
  HIGHLIGHT_STYLE_ID,
  markerSelector,
  readPreviewOpen,
  writePreviewOpen,
  ensureHighlightStyle,
  clearHighlight,
  locateAndHighlight,
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
});
