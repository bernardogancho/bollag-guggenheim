// Pure helpers for the preview pane (Tasks 20-21). Kept free of React and DOM
// globals so they're testable in the vitest `node` environment without a
// jsdom dependency — PreviewPane.jsx wraps every call to these in try/catch,
// since real iframe access can throw for cross-origin, timing, or navigation
// reasons that don't matter here.

import { joinWearhouse } from '../adapters/wearhouse.js';
import { findSection } from '../manifest.js';
import { getAtPath } from '../lib/paths.js';

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
// content can therefore stay unseen in the preview pane even though it is
// correctly targeted. This forces it visible INSIDE THE IFRAME ONLY — the
// rule lives in this admin-injected <style>, appended to the iframe document
// at runtime by ensureHighlightStyle, so it never touches the site's own
// stylesheet and never reaches a real visitor.
// Deliberately written as four longhand outline-width/-style/-color/-offset
// declarations rather than the single-property shorthand: this literal CSS
// text lives inside a scanned .js file, and Tailwind's content scanner reads
// plain source text, comments included. The shorthand's bare property name
// on its own is also a real Tailwind class name, so writing it unsplit would
// leak one unused, byte-identical-proof-breaking rule into the SITE's own
// site.css even though nothing ever applies that class. The longhand
// property names aren't standalone Tailwind classes, so they're inert here.
export const HIGHLIGHT_CSS = `[${HIGHLIGHT_ATTR}]{outline-width:3px;outline-style:solid;outline-color:#1a73e8;outline-offset:-3px;}[data-reveal]{opacity:1 !important;transform:none !important;}`;

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

// True when the current route lets the editor add, remove, or reorder
// items — BrandsScreen/WearhouseScreen (list mode AND item mode, since item
// mode still exposes a "Delete brand" button) and the generic managed-list
// sub-routes (SectionScreen dispatches `rest[0] === 'list'` to
// ItemListScreen/ItemEditScreen for section fields like a store list or
// agenda months). Structural changes on these routes can't be simulated in
// the live-patched iframe — only publishing rebuilds the page with the new
// item count/order — so PreviewPane shows a note saying so. Plain sections
// with no list at all (hero, intro, ...) return false.
export function isManagedListRoute(section, rest) {
  if (section.custom === 'brands' || section.joined) {
    return true;
  }
  return Boolean(rest && rest[0] === 'list');
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

// ---------------------------------------------------------------------------
// Level 3: live-patch engine (Task 21). A bound node carries
// `data-cms-bind="<pageId>.<sectionId>#<jsonPathFromFileRoot>"` (added to the
// site templates in Commit 2). These helpers resolve that attribute back to
// a draft value and write it into the published DOM — entirely from the
// admin side, reaching into the same-origin iframe; no script is added to
// the site itself.

export const BROKEN_IMAGE_ATTR = 'data-cms-preview-broken';
// Longhand `opacity` value (not a bare Tailwind-matching property shorthand)
// dimming a bound image whose patched src failed to load — see the
// HIGHLIGHT_CSS comment above for why bare utility-like words are avoided in
// this scanned file.
export const BROKEN_IMAGE_CSS = `[${BROKEN_IMAGE_ATTR}]{opacity:0.35;}`;

// Splits a `data-cms-bind` value into its three parts. `pageId` and
// `sectionId` never contain '.', so splitting the pre-'#' half on the FIRST
// '.' is unambiguous even though `jsonPath` (the post-'#' half) legitimately
// contains further '.'-separated segments of its own. Returns null for
// anything that doesn't fit the shape — callers treat that as "skip this
// node" rather than throwing.
export function resolveBind(bindAttr) {
  if (typeof bindAttr !== 'string' || !bindAttr) {
    return null;
  }
  const hashIndex = bindAttr.indexOf('#');
  if (hashIndex <= 0 || hashIndex === bindAttr.length - 1) {
    return null;
  }
  const pageSection = bindAttr.slice(0, hashIndex);
  const jsonPath = bindAttr.slice(hashIndex + 1);
  const dotIndex = pageSection.indexOf('.');
  if (dotIndex <= 0 || dotIndex === pageSection.length - 1) {
    return null;
  }
  return {
    pageId: pageSection.slice(0, dotIndex),
    sectionId: pageSection.slice(dotIndex + 1),
    jsonPath,
  };
}

// Writes `value` into `el`: an IMG's `src`, or otherwise the element's text.
// Two guards keep this from ever damaging the published page: an `undefined`
// value (draft doesn't have this path yet) leaves the DOM exactly as
// published rather than blanking it, and an element that already has ELEMENT
// children is skipped outright — Commit 2 only binds nodes whose entire
// content is one scalar, but this is the last line of defense against ever
// overwriting nested markup if that invariant is violated some other way.
// Returns true if a write happened, false otherwise; never throws.
export function patchNode(el, value) {
  if (!el || value === undefined || value === null) {
    return false;
  }
  if (el.children && typeof el.children.length === 'number' && el.children.length > 0) {
    return false;
  }
  const tagName = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tagName === 'IMG') {
    if (typeof value !== 'string' || !value) {
      return false;
    }
    if (typeof el.setAttribute === 'function') {
      el.setAttribute('src', value);
    } else {
      el.src = value;
    }
    // Best-effort: a freshly-uploaded image's file may not exist in this
    // already-built page yet (it only lands once the site is rebuilt/
    // published). Rather than let that show as an unexplained blank image,
    // mark it so the injected style can dim it — never blocks, never throws.
    if (typeof el.addEventListener === 'function') {
      el.addEventListener('error', () => {
        if (typeof el.setAttribute === 'function') {
          el.setAttribute(BROKEN_IMAGE_ATTR, '');
        }
      }, { once: true });
      el.addEventListener('load', () => {
        if (typeof el.removeAttribute === 'function') {
          el.removeAttribute(BROKEN_IMAGE_ATTR);
        }
      }, { once: true });
    }
    return true;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return false;
  }
  el.textContent = String(value);
  return true;
}

// Resolves a bound section to the file(s) that hold its content. Plain
// sections have one `file`; `joined` sections (currently only the Wearhouse
// roster+brands pairing) span two — a jsonPath is tried against each in
// order and the first defined value wins. This still only reuses the
// manifest's existing `file`/`files`, never a second file map: a joined
// section's per-record MERGED fields (built by src/_data/wearhouse.js's
// override logic) aren't addressable this way and are simply never bound in
// Commit 2, so this path only ever resolves fields that live wholly in one
// file to begin with (e.g. a roster-only or brands-only object field).
function resolveDraftValue(section, jsonPath, getDraft) {
  const files = section.joined ? section.files : [section.file];
  for (const file of files) {
    const value = getAtPath(getDraft(file), jsonPath);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

// The patch-all pass: finds every bound node in `doc` and writes its current
// draft value into the DOM. `getDraft` is `store.getDraft` — duck-typed here
// (just a `filePath => content` function) so this is testable without a real
// store. Never throws: a bad attribute, an unknown section, or a missing
// draft on any single node just skips that node and continues with the rest,
// since one malformed bind must never stop the others from patching.
export function patchAll(doc, getDraft) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return { patched: 0, skipped: 0 };
  }
  let nodes;
  try {
    nodes = doc.querySelectorAll(`[data-cms-bind]`);
  } catch {
    return { patched: 0, skipped: 0 };
  }
  let patched = 0;
  let skipped = 0;
  nodes.forEach(el => {
    try {
      const resolved = resolveBind(el.getAttribute('data-cms-bind'));
      const section = resolved && findSection(resolved.pageId, resolved.sectionId);
      if (!section) {
        skipped += 1;
        return;
      }
      const value = resolveDraftValue(section, resolved.jsonPath, getDraft);
      if (patchNode(el, value)) {
        patched += 1;
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  });
  return { patched, skipped };
}

// Ensures the broken-image dimming <style> exists exactly once — same
// admin-injected, iframe-only pattern as ensureHighlightStyle.
export function ensureBrokenImageStyle(doc) {
  if (!doc || !doc.head || typeof doc.createElement !== 'function') {
    return false;
  }
  const existing = typeof doc.getElementById === 'function' ? doc.getElementById(`${HIGHLIGHT_STYLE_ID}-broken`) : null;
  if (existing) {
    return true;
  }
  const style = doc.createElement('style');
  style.id = `${HIGHLIGHT_STYLE_ID}-broken`;
  style.textContent = BROKEN_IMAGE_CSS;
  doc.head.appendChild(style);
  return true;
}
