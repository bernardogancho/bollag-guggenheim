// Pure helpers for the Level 2 preview pane (Task 20). Kept free of React and
// DOM globals so they're testable in the vitest `node` environment without a
// jsdom dependency — PreviewPane.jsx wraps every call to these in try/catch,
// since real iframe access can throw for cross-origin, timing, or navigation
// reasons that don't matter here.

export const STORAGE_KEY = 'bg-cms-preview-open';

// The site's header is `position: fixed`, so scrollIntoView({block:'start'})
// alone leaves the target's top edge underneath it. This is how much extra
// we scroll back up by afterwards.
export const HEADER_SCROLL_OFFSET = 90;

export const HIGHLIGHT_ATTR = 'data-cms-preview-active';
export const HIGHLIGHT_STYLE_ID = 'bg-cms-preview-style';
export const HIGHLIGHT_CSS = `[${HIGHLIGHT_ATTR}]{outline:3px solid #1a73e8;outline-offset:-3px;}`;

export function markerSelector(pageId, sectionId) {
  return `[data-cms-section="${pageId}.${sectionId}"]`;
}

// Reads the persisted open/closed state. Any storage failure (private
// browsing, disabled storage, etc.) falls back to `defaultValue` rather than
// throwing — the pane's collapse state is a nicety, never a blocker.
export function readPreviewOpen(defaultValue = true) {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return defaultValue;
    }
    return raw === 'true';
  } catch {
    return defaultValue;
  }
}

export function writePreviewOpen(value) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Persistence is a nicety; a write failure must never block the toggle.
  }
}

// Ensures the highlight <style> exists exactly once in the given document.
// Injected by the ADMIN at runtime, into the admin's own iframe — this
// never touches the site's own stylesheets and never reaches a real visitor.
export function ensureHighlightStyle(doc) {
  if (!doc || !doc.head || typeof doc.createElement !== 'function') {
    return false;
  }
  const existing = typeof doc.getElementById === 'function' ? doc.getElementById(HIGHLIGHT_STYLE_ID) : null;
  if (existing) {
    return true;
  }
  const style = doc.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = HIGHLIGHT_CSS;
  doc.head.appendChild(style);
  return true;
}

// Clears any previously active highlight marker left over from switching
// sections.
export function clearHighlight(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return;
  }
  const marked = doc.querySelectorAll(`[${HIGHLIGHT_ATTR}]`);
  marked.forEach(el => el.removeAttribute(HIGHLIGHT_ATTR));
}

// Finds the section's marker element in `doc`, scrolls it into view
// (offsetting the site's fixed header via `win`) and highlights it.
// Returns true if a target was found, false otherwise — callers use that to
// decide whether to show the "Preview unavailable" note. Never throws: a
// missing target, or a doc/win that doesn't support these calls, is treated
// as "not found" rather than an error.
export function locateAndHighlight(doc, win, pageId, sectionId) {
  if (!doc || typeof doc.querySelector !== 'function') {
    return false;
  }
  ensureHighlightStyle(doc);
  clearHighlight(doc);
  const target = doc.querySelector(markerSelector(pageId, sectionId));
  if (!target) {
    return false;
  }
  target.setAttribute(HIGHLIGHT_ATTR, '');
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  if (win && typeof win.scrollBy === 'function') {
    win.scrollBy(0, -HEADER_SCROLL_OFFSET);
  }
  return true;
}
