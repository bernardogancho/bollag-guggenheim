# Supabase Publish Admin Implementation Plan

**Goal:** Let approved non-technical admins sign in with Supabase, edit page/section content in the CMS UI, and publish changes to production without using GitHub directly.

**Architecture:** Replace the Decap runtime in `/admin` with a custom browser admin app that reads the existing `src/admin/config.yml` as its content manifest. The app will fetch current JSON content from the public GitHub repo, render section-based forms, and submit saves to a Vercel serverless publish API. The API will verify the Supabase session, then create Git commits on `main` through the GitHub API so Vercel deploys the change automatically.

**Tech Stack:** Vanilla browser JS in `/admin`, Supabase Auth, Vercel serverless functions, GitHub REST API, YAML parsing in the browser.

---

## Scope

- Keep Supabase email login for approved admins.
- Replace Decap’s GitHub-backed editor with a custom editor shell.
- Preserve the existing section/page-oriented content structure.
- Publish by committing to GitHub on `main`.

## Files

- `src/admin/index.html`
- `src/admin/admin-app.js`
- `api/publish.js`
- `api/upload.js`
- `src/admin/config.yml` only if a small auth metadata tweak is needed

## Verification

- `npm run build`
- Open `/admin/` locally and confirm:
  - approved email can sign in
  - collections and section files load
  - edits can be saved and published
  - rejected emails are blocked

