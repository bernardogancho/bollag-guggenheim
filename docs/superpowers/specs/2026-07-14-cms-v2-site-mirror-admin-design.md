# CMS v2 — Site-Mirror Admin (Design)

- **Date:** 2026-07-14
- **Status:** Approved direction; spec under review
- **Owner:** Bernardo (Bollag-Guggenheim website)

## 1. Context and problem

The website (Eleventy static site on Vercel) is edited through a custom admin at `/admin`:
a single 2,300-line React app (`src/admin/app.jsx`) that renders forms from a Decap-style
manifest (`src/admin/config.yml`) over 22 JSON content files (`src/_data/cms/**`). Publishing
commits the JSON to GitHub via serverless functions (`api/`) and Vercel rebuilds the site.
Auth is Supabase email + password with `admin` / `editor` roles (recently rebuilt, working well).

The pipeline is sound. The editing experience is not. Confirmed pains from the site owner:

1. **Editors can't see what they're changing** — editing is a wall of form fields with no
   visual connection to the page; they publish and hope.
2. **Too deep / too nested** — brands, stores, and galleries are accordions inside accordions;
   editing one thing is a clicking expedition.
3. **Feels DIY, not professional** — the admin lacks the conventions editors know from real
   CMS products (media library, save/publish semantics, validation, search).

Editors are a small non-technical team (2–3 people). Constraints: free to run, everything on
Vercel + Supabase, email/password login, content stays as JSON in git. No new services.

## 2. Goals

- Editors always **see** what they are editing (real page, live text/image updates pre-publish).
- **No accordion nesting**: nothing on screen is ever more than one level deep.
- Navigation mirrors **the website** (pages → sections in page order, human names), not data files.
- UX follows **real-CMS conventions**: media library, explicit saved/published states, inline
  validation, unsaved-changes guards, search, plain language.
- Ship in phases; the current CMS keeps working for editors throughout.

## 3. Non-goals

- No CMS platform migration (Payload/Sanity rejected: constraint fit and migration cost).
- No backend/auth changes — `api/*` endpoints and Supabase roles stay as-is.
- No content-model changes — the 22 JSON files keep their shape; publishing stays git-based.
- No rich-text editing (site design uses plain strings; out of scope deliberately).
- No real-time multi-user editing. Concurrent edits stay last-write-wins per file (documented).

## 4. UX design

### 4.1 Navigation (site-mirror IA)

Sidebar lists the site's pages, top-to-bottom as on the website:

> Homepage · Company · Brands · The Wearhouse · Stores · Agenda · Contact · Header & Footer
> — plus **Media** (library) and **People** (admins only).

- Selecting a page shows its **sections in page order** with editor-facing names
  ("Hero banner", "Introduction", "Bollag portfolio") and a one-line summary of current content.
- A single search box filters pages, sections, brands, and stores by name.
- A new **manifest module** maps pages → sections → existing `config.yml` file entries
  (labels, page URL, section anchor). `config.yml` remains the single source of truth for
  field definitions; the manifest adds organization and naming only.

### 4.2 Editing screens (de-nesting)

- **Master-detail for lists of things.** Brands, Wearhouse brands, stores, agenda events, and
  gallery images render as card grids (thumbnail + name). Clicking a card opens a full-screen
  editor for that one item with a breadcrumb back. Accordions are eliminated.
- **Flat groups for objects.** Object fields render as titled groups laid out in one scrollable
  form (two-column on wide screens), never collapsed.
- **Inline rows for simple lists** (address lines, stats): compact rows with drag handles and
  up/down buttons.
- **Wearhouse join.** Wearhouse brand data currently lives in two parallel lists synced by slug
  (`roster.json` items and `brands.json` entries). A small adapter presents them as one brand
  record per slug; publish writes both files. Mis-synced slugs surface as a visible warning row.
- Existing field improvements carry over: drag-drop image uploader with preview, help text.

### 4.3 Preview pane (centerpiece)

Split view: form on the left, the **real page** (same-origin iframe of the live site) on the right.

- Selecting a section scrolls the pane to it and outlines it.
- Typing into a bound text field or changing an image updates the pane **live** (pre-publish).
- On load, the admin pushes all current draft values for the page so the pane reflects drafts
  immediately, not only on keystroke.
- Structural changes (add/remove/reorder list items) are not simulated; the pane header shows
  "List changes appear after publishing."
- Desktop / mobile width toggle.
- **Bridge mechanism:** site templates gain `data-cms-section="<page>.<section>"` on ~22 section
  roots and `data-cms-bind="<file>#<json.path>"` on bound text/image nodes (~80 bindings to
  start; coverage grows over time). A ~100-line vanilla `preview-bridge.js` is included by the
  base template **only when the page runs inside the admin preview** (same-origin iframe +
  `?cms-preview=1`); it listens for `postMessage` events: `highlight`, `patch`, `patch-all`.
- **Handshake:** on load the bridge posts `ready` to the admin; the admin waits for it (with a
  timeout) before sending `patch-all`. No `ready` within the timeout → degrade to plain view.
- **Degradation:** if the bridge fails or a binding is missing, the pane silently behaves as a
  plain page view. Preview must never block editing.
- **Fresh-upload edge:** a newly uploaded image referenced in a draft will 404 in the preview
  iframe until the site rebuild (~1–2 min) completes; the pane shows a subtle "image
  processing" placeholder for image patches whose URL does not yet resolve.

### 4.4 Media Library

- New **Media** screen: grid of all images under `/assets/media` with filename, dimensions
  (when known), and where-used hints where cheap to compute.
- Image fields open a **picker** over the library (choose existing or upload new) instead of
  requiring uploads or paths. Manual path entry remains behind an "advanced" toggle.
- **Index mechanism:** an Eleventy JS template emits `media-index.json` at build time by
  globbing the media directory. Uploads (existing `/api/upload`) commit to git → rebuild →
  index refreshes; the admin appends newly uploaded files to its in-memory index optimistically
  so they are usable immediately.

### 4.5 Save / publish model and polish

- Drafts autosave locally (existing localStorage mechanism) with an explicit **"Saved"**
  indicator; the mental model shown to editors: *saved for you* vs *published to the website*.
- **Unpublished changes tray** (top bar): every pending change listed by page/section,
  individual discard, publish-all via the existing confirmation dialog (Cancel ≠ Discard).
- **Validation before publish:** required fields and malformed links flagged inline; publish is
  blocked with a plain-language list of what to fix.
- **Unsaved-changes guard** on tab close and in-app navigation mid-edit.
- Toasts for save/publish/errors; skeleton loading; designed empty states; "Last published
  X min ago"; one-click revert of the last publish (existing `/api/revert`).
- Visual system: keep current Google-style tokens; tighten spacing/typography; polish login.
- **People** screen carries over unchanged.

## 5. Technical design

### 5.1 Frontend structure (rewrite of `src/admin/`)

~15 focused modules replacing the monolith (esbuild-bundled, no framework change; tiny hash
router, no router lib):

- `main.jsx` — bootstrap, auth gate (existing `/api/me` flow)
- `manifest.js` — pages/sections mapping over `config.yml`
- `store.js` — drafts, dirty state, autosave, publish queue (extracted from current logic)
- `shell/` — `Sidebar`, `Topbar`, `ChangesTray`, `Search`, `Toasts`
- `screens/` — `PageScreen`, `ItemListScreen`, `ItemEditScreen`, `MediaScreen`, `PeopleScreen`
- `fields/` — `TextField`, `TextareaField`, `SelectField`, `ImageField` (+ picker), `ListField`
- `preview/` — `PreviewPane` (admin side), `bindings.js` (field-path → bind-key mapping)
- `adapters/wearhouse.js` — slug join/split
- Site side: `src/assets/scripts/preview-bridge.js` + template annotations

### 5.2 Backend

Unchanged: `/api/me`, `/api/admin/users`, `/api/publish`, `/api/upload`, `/api/revert`,
`/api/deploys`, `api/_lib/*`. Auth and roles unchanged.

### 5.3 Build additions

- Eleventy JS template emitting `media-index.json`.
- **Binding check script** (runs in `npm run build`): every `data-cms-bind` key in templates
  must resolve to an existing path in the CMS JSON; unknown keys fail the build with a clear
  message. Prevents silent preview rot.
- Cache-busting for the admin bundle (content-hash query or filename) so deploys are visible
  without hard refresh — fixes a known papercut.

## 6. Error handling

- Preview bridge: postMessage handshake with timeout → fall back to plain iframe; binding
  misses are no-ops.
- Publish failures: existing error surfacing, now via toasts + tray states; drafts are never
  cleared on failure.
- Media index missing/stale: picker still allows upload + manual path; shows a note.
- Route guards: deep links to nonexistent sections/items show a friendly not-found state.

## 7. Phasing

- **Phase 1 — structure & polish:** shell, site-mirror nav, de-nested editors (master-detail),
  media library, changes tray, validation, guards, toasts, search, cache-busting. Includes a
  content-hygiene step: delete the unused legacy JSON under `src/_data/cms/home/selectionCards/`
  and `src/_data/cms/wearhousePage/showroomGalleryItems/` (data now embedded in
  `selectionSection.json` / `showroom.json`; verify no data file requires them before removal)
  so the media where-used scan and binding check don't index dead data. Ships alone.
- **Phase 2 — preview:** template annotations + bridge; Homepage first, then remaining pages;
  binding check in CI.

Each phase gets **its own implementation plan** (they are independently shippable), and each
ends with a local walkthrough and a production smoke test after deploy.

## 8. Testing / verification

- Build-time: esbuild bundle, Eleventy build, binding check green.
- Manual walkthrough per screen on localhost. Auth bypass for local walkthroughs = a temporary
  edit to the bootstrap in `main.jsx` that, when `window.location.hostname === 'localhost'`,
  loads the workspace with a fake admin user instead of calling Supabase. It is applied only
  during a walkthrough and reverted before commit (verified by grepping the bundle); it never
  ships.
- Publish round-trip on production after each phase (edit → publish → verify commit + site).
- Cross-check: every `config.yml` file entry is reachable from the new navigation (script).

## 9. Risks and known limitations

- **Annotation coverage** is incremental; unbound fields simply don't live-update (acceptable,
  visible, grows over time).
- **Media index freshness** depends on rebuilds (~1–2 min); optimistic client-side append
  covers the gap for the uploader's own session.
- **Concurrent editors** remain last-write-wins per file (unchanged from today; documented).
- **Preview shows live site as base** — a page never published won't preview until first publish.

## 10. Out of scope

Rich text, scheduled publishing, per-field revision history, multi-language, image
transforms/CDN, comments/workflows.
