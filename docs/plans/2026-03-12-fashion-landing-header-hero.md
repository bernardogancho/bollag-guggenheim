# Fashion Landing Header + Hero Implementation Plan

**Goal:** Build the approved first slice of the fashion landing page with reusable Eleventy components, Tailwind-driven styling, and minimal JS.
**Architecture:** Use Eleventy with a `src` input directory, Nunjucks layouts/components, a single Tailwind entry stylesheet, and a small JS enhancement for header state. Keep the first iteration limited to one page and two reusable components.
**Tech Stack:** Eleventy, Tailwind CSS, Nunjucks, vanilla JavaScript
---

## Task 1: Create the project skeleton

- Create:
  - `package.json`
  - `.gitignore`
  - `.eleventy.js`
  - `src/index.njk`
  - `src/_includes/layouts/base.njk`
  - `src/_includes/components/site-header.njk`
  - `src/_includes/components/hero-section.njk`
  - `src/assets/styles/site.css`
  - `src/assets/scripts/site.js`
  - `src/assets/media/logo.svg`
  - `src/assets/media/hero.svg`
- Verification:
  - Files exist in the expected locations

## Task 2: Configure build scripts

- Add npm scripts for:
  - `dev`
  - `build`
  - `serve`
- Configure Eleventy input/output directories and passthrough copy for assets
- Verification:
  - `npm run build` should generate `_site`

## Task 3: Implement the reusable base layout

- Add a base HTML layout with:
  - metadata
  - stylesheet include
  - script include
  - page slot
- Verification:
  - `src/index.njk` renders within the layout

## Task 4: Implement `site-header` component

- Build an overlay header with:
  - logo on the left
  - navigation on the right
  - monochrome styling
  - scroll-state hook via `data-site-header`
- Verification:
  - Header appears above the hero and remains legible

## Task 5: Implement `hero-section` component

- Build a full-viewport hero with:
  - placeholder background treatment until the final image is added
  - dark overlay gradient
  - bottom-centered `hero.svg`
- Verification:
  - Hero fills the viewport and the lockup sits at the bottom center

## Task 6: Add light interaction polish

- Add minimal JS so the header gains a darker background after scrolling
- Keep motion subtle and non-generic
- Verification:
  - Header state changes when the page scrolls

## Task 7: Validate

- Install dependencies
- Run the build
- Report any remaining gaps, especially the missing final hero photo asset
