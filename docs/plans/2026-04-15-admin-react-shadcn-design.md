# Admin React/shadcn Rewrite Design

**Goal:** Replace the current vanilla admin shell with a compact React UI that feels like a serious back-office system while keeping Supabase auth, GitHub publishing, and CMS data contracts unchanged.

**Architecture:** The admin page will become a bundled React app mounted from `/admin/app.js`. The app will keep the existing backend endpoints (`/api/admin/request-link`, `/api/publish`, `/api/upload`) and the same CMS file structure, but the UI will use Radix collapsibles and dropdown menus for compact, expandable editing and drag-and-drop list ordering.

The next iteration adds a deploy history surface powered by new GitHub-backed API routes. Editors will be able to inspect recent CMS deploys and safely revert the latest one by creating a normal rollback commit on `main`.

**Tech Stack:** React, esbuild, Radix UI, lucide-react, yaml, Supabase JS, Eleventy.
---

## UI Direction

- Hard edges, low-radius panels, thin borders, minimal shadows.
- Compact information density with collapsed repeatable items by default.
- Explicit disclosure buttons for expandable sections.
- Drag handle plus action dropdown on repeatable items.
- Clear hierarchy: sidebar for section navigation, main canvas for editing.

## Implementation Scope

- Add a React admin entrypoint and bundle it with esbuild.
- Keep the CMS config loading logic identical.
- Keep login, upload, and publish endpoints unchanged.
- Remove the old custom admin shell from the page entrypoint.
- Add a deploy history panel with rollback controls backed by server-side GitHub commits.

## Verification

- Run the production build.
- Confirm the admin bundle and CSS emit into `_site/admin/`.
- Open the admin page and verify login, section loading, list expansion, drag-and-drop reorder, upload, and publish still work.
