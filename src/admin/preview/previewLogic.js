// Pure helpers for the preview pane (Tasks 20-21). Kept free of React and DOM
// globals so they're testable in the vitest `node` environment without a
// jsdom dependency — PreviewPane.jsx wraps every call to these in try/catch,
// since real iframe access can throw for cross-origin, timing, or navigation
// reasons that don't matter here.

import { joinWearhouse } from '../adapters/wearhouse.js';

export const STORAGE_KEY = 'bg-cms-preview-open';

// The site's header is `position: fixed`, so scrollIntoView({block:'start'})
// alone leaves the target's top edge underneath it. This is how much extra
// we scroll back up by afterwards.
export const HEADER_SCROLL_OFFSET = 90;

export const HIGHLIGHT_ATTR = 'data-cms-preview-active';
export const HIGHLIGHT_STYLE_ID = 'bg-cms-preview-style';
// The site hides [data-reveal] content until it scrolls into view (see
// src/assets/scripts/site.js's IntersectionObserver + site.css's
// `body.is-ready [data-reveal]{opacity:0}` rule). Highlighted or live-patched
// content can therefore sit invisible in the preview pane even though it is
// correctly targeted. This forces it visible INSIDE THE IFRAME ONLY — the
// rule lives in this admin-injected <style>, appended to the iframe document
// at runtime by ensureHighlightStyle, so it never touches the site's own
// stylesheet and never reaches a real visitor.
export const HIGHLIGHT_CSS = `[${HIGHLIGHT_ATTR}]{outline:3px solid #1a73e8;outline-offset:-3px;}[data-reveal]{opacity:1 !important;transform:none !important;}`;

export function markerSelector(pageId, sectionId) {
  return `[data-cms-section="${pageId}.${sectionId}"]`;
}

// Sections with no on-page marker on their OWN manifest page: shared TEXT
// rendered only on individual brand / wearhouse-brand detail pages (see
// src/admin/__tests__/preview-sections.test.js's NO_PREVIEW_TARGET, which
// this mirrors). Highlighting can never find a target for these on the
// /brands/ or /wearhouse/ listing page, so the pane should say why instead of
// showing the generic "unavailable" message.
export const NO_ON_PAGE_TARGET = new Set(['brands.page-settings', 'wearhouse.page-settings']);

// Copy shown in the pane when locateAndHighlight finds nothing. Distinguishes
// "this section genuinely has no on-page block" (allowlisted) from the
// generic case (timing, a stale route, or a real bug).
export function noTargetMessage(pageId, sectionId) {
  if (NO_ON_PAGE_TARGET.has(`${pageId}.${sectionId}`)) {
    return "This section's content appears on the individual brand pages, not here.";
  }
  return 'Preview unavailable.';
}

// Brand/Wearhouse item editors (BrandsScreen and WearhouseScreen, item mode —
// route `.../all-brands/<idx>` or `.../wearhouse-brands/<idx>`) point the
// preview pane at that ONE brand's own page instead of the /brands/ or
// /wearhouse/ listing page: the fields being edited there (hero, intro,
// gallery, card) render on the brand's detail page, not the listing. Reads
// the slug straight from the store the same way the item screens themselves
// do (BrandsScreen / WearhouseScreen + adapters/wearhouse.js's joinWearhouse),
// so no extra state needs to be threaded down from those screens. `store` is
// duck-typed to just `{ getDraft(filePath) }` so this stays testable without
// a real store instance.
export function computePreviewUrl(page, section, rest, store) {
  if (!rest || !rest.length) {
    return page.url;
  }
  const idx = Number(rest[0]);
  if (!Number.isInteger(idx)) {
    return page.url;
  }
  if (section.custom === 'brands') {
    const slug = store.getDraft(section.file)?.brands?.[idx]?.slug;
    return slug ? `/brands/${slug}/` : page.url;
  }
  if (section.joined) {
    const [rosterFile, brandsFile] = section.files;
    const rosterDraft = store.getDraft(rosterFile);
    const brandsDraft = store.getDraft(brandsFile);
    if (!rosterDraft || !brandsDraft) {
      return page.url;
    }
    const { records } = joinWearhouse(rosterDraft.rosterSection?.items || [], brandsDraft.brands || []);
    const slug = records[idx]?.slug;
    return slug ? `/wearhouse/${slug}/` : page.url;
  }
  return page.url;
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
