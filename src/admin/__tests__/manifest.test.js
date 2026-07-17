import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parse as parseYAML } from 'yaml';
import { PAGES, allSections, findSection, sectionsForFile, ALL_FILES } from '../manifest.js';

const config = parseYAML(fs.readFileSync('src/admin/config.yml', 'utf8'));
const configFiles = config.collections.flatMap(c => c.files.map(f => f.file));

describe('manifest integrity', () => {
  // Note: several sections share one file (e.g. company.json powers 4 sections),
  // so coverage is asserted on UNIQUE files. A file MAY also back more than one
  // section outright — e.g. home/selectionSection.json backs both the
  // Homepage's and the Company page's "Editorial selection" sections, because
  // the website itself renders that one block on both pages (src/company/index.njk
  // includes the same component the homepage does). That's an intentional full
  // mirror (same file, same keys), not a conflict, so it's allowed. What must
  // never happen is two DIFFERENT sections claiming an overlapping-but-different
  // key set on the same file — that would mean two screens silently racing to
  // edit the same JSON key.
  it('covers every config.yml file, with no two sections claiming conflicting keys on a shared file', () => {
    const covered = [];
    for (const section of allSections()) {
      if (section.joined) {
        covered.push(...section.files);
      } else {
        covered.push(section.file);
      }
    }
    expect([...new Set(covered)].sort()).toEqual([...new Set(configFiles)].sort());

    const claimsByFile = new Map();
    for (const section of allSections()) {
      if (section.joined) {
        continue;
      }
      const signature = [...section.keys].sort().join(',');
      const claims = claimsByFile.get(section.file) || [];
      for (const key of section.keys) {
        const conflict = claims.find(claim => claim.keys.includes(key) && claim.signature !== signature);
        expect(conflict, `${section.file} key "${key}" is claimed by two sections with different key sets`).toBeUndefined();
      }
      claims.push({ signature, keys: section.keys });
      claimsByFile.set(section.file, claims);
    }
  });

  it('every section key exists in the actual JSON data', () => {
    for (const section of allSections()) {
      if (section.joined) {
        continue;
      }
      const data = JSON.parse(fs.readFileSync(section.file, 'utf8'));
      for (const key of section.keys) {
        expect(data, `${section.file} missing key ${key}`).toHaveProperty(key);
      }
    }
  });

  it('every section id is unique within its page and every page id unique', () => {
    const pageIds = PAGES.map(p => p.id);
    expect(new Set(pageIds).size).toBe(pageIds.length);
    for (const page of PAGES) {
      const ids = page.sections.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('lookup helpers work', () => {
    expect(findSection('homepage', 'hero').label).toBe('Hero banner');
    expect(sectionsForFile('src/_data/cms/site.json').length).toBe(2);
    expect(ALL_FILES).toContain('src/_data/cms/agenda.json');
  });

  it('a file backing two sections (Homepage + Company editorial selection) is deduped in ALL_FILES and both sections resolve', () => {
    const file = 'src/_data/cms/home/selectionSection.json';
    expect(ALL_FILES.filter(f => f === file).length).toBe(1);
    const owners = sectionsForFile(file);
    expect(owners.length).toBe(2);
    expect(owners.map(s => s.pageId).sort()).toEqual(['company', 'homepage']);
    expect(owners.every(s => s.id === 'editorial-selection')).toBe(true);
  });
});
