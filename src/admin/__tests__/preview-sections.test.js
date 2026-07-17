import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { allSections } from '../manifest.js';

// The preview pane (Task 20) locates the DOM element being edited via an
// unseen `data-cms-section="<page>.<section>"` attribute placed on that
// section's root element in the site templates (see
// docs/superpowers/plans/2026-07-14-cms-v2-phase1-site-mirror-admin.md,
// "Task 20"). This test guards against silent rot: every manifest section
// must either produce that marker, or be explicitly allowlisted below with a
// reason it can't.
//
// Approach: grep the SOURCE templates for the exact marker string, rather
// than running a full `npm run build` inside the test suite. A build-based
// check would also work but is heavier (spawns Eleventy, writes _site) for a
// check that source-grep already satisfies: every marker below is a literal
// string in some .njk file, or set via a `{% set cmsSection = '...' %}`
// variable feeding the one shared include (selected-stores.njk) that renders
// `data-cms-section="{{ cmsSection }}"`. A future change that deletes the
// attribute, or a new manifest section nobody wired up, fails this test the
// same way a built-HTML check would.
const TEMPLATE_FILES = [
  'src/_includes/components/hero-section.njk',
  'src/_includes/components/home-intro.njk',
  'src/_includes/components/brands-wall.njk',
  'src/_includes/components/home-wearhouse-brands-wall.njk',
  'src/_includes/components/selected-stores.njk',
  'src/index.njk',
  'src/company/index.njk',
  'src/_includes/components/company-hero.njk',
  'src/_includes/components/company-intro.njk',
  'src/_includes/components/company-history.njk',
  'src/_includes/components/company-distribution.njk',
  'src/brands/index.njk',
  'src/wearhouse/index.njk',
  'src/stores/index.njk',
  'src/agenda/index.njk',
  'src/contact/index.njk',
  'src/legal-notice/index.njk',
  'src/_includes/components/site-header.njk',
  'src/_includes/components/site-footer.njk',
];

const SOURCE = TEMPLATE_FILES.map(file => `${file}\n${fs.readFileSync(file, 'utf8')}`).join('\n');

// Sections with NO root element to mark on their own manifest page: these are
// shared TEXT rendered on OTHER pages (individual brand / wearhouse-brand
// detail pages via src/brands/brand.njk and src/wearhouse/brand.njk), never
// on /brands/ or /wearhouse/ themselves, so there is no on-page block to
// point the preview at.
const NO_PREVIEW_TARGET = new Set([
  'brands.page-settings',
  'wearhouse.page-settings',
]);

describe('CMS preview section markers (Task 20)', () => {
  it('every manifest section has a data-cms-section marker in a page template, or is allowlisted', () => {
    const missing = [];
    for (const section of allSections()) {
      const id = `${section.pageId}.${section.id}`;
      if (NO_PREVIEW_TARGET.has(id)) {
        continue;
      }
      const marker = `data-cms-section="${id}"`;
      // The two Editorial selection sections are rendered via a `{% set
      // cmsSection = '...' %}` variable feeding a shared include, not a
      // literal attribute string in the template — check for the assignment
      // instead of the rendered attribute.
      const setMarker = `cmsSection = '${id}'`;
      if (!SOURCE.includes(marker) && !SOURCE.includes(setMarker)) {
        missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the allowlist only names real manifest sections (catches typos / stale entries)', () => {
    const known = new Set(allSections().map(section => `${section.pageId}.${section.id}`));
    for (const id of NO_PREVIEW_TARGET) {
      expect(known.has(id), `${id} is not a real manifest section`).toBe(true);
    }
  });

  it('every marker id resolves back to a real manifest section (catches typos going the other way)', () => {
    const known = new Set(allSections().map(section => `${section.pageId}.${section.id}`));
    const attrPattern = /data-cms-section="([^"]+)"/g;
    const setPattern = /cmsSection = '([^']+)'/g;
    const found = new Set();
    for (const match of SOURCE.matchAll(attrPattern)) {
      // Skip the templated `{{ cmsSection }}` literal in selected-stores.njk —
      // its actual values are covered by the `cmsSection = '...'` assignments
      // matched below, from the pages that set it.
      if (match[1].includes('{{')) {
        continue;
      }
      found.add(match[1]);
    }
    for (const match of SOURCE.matchAll(setPattern)) {
      found.add(match[1]);
    }
    for (const id of found) {
      expect(known.has(id), `data-cms-section="${id}" does not match any manifest section`).toBe(true);
    }
  });
});
