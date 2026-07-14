import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parse as parseYAML } from 'yaml';
import { PAGES, allSections, findSection, sectionsForFile, ALL_FILES } from '../manifest.js';

const config = parseYAML(fs.readFileSync('src/admin/config.yml', 'utf8'));
const configFiles = config.collections.flatMap(c => c.files.map(f => f.file));

describe('manifest integrity', () => {
  // Note: several sections share one file (e.g. company.json powers 4 sections),
  // so coverage is asserted on UNIQUE files, and sections sharing a file must
  // edit disjoint top-level keys.
  it('covers every config.yml file, with disjoint keys per shared file', () => {
    const covered = [];
    for (const section of allSections()) {
      if (section.joined) {
        covered.push(...section.files);
      } else {
        covered.push(section.file);
      }
    }
    expect([...new Set(covered)].sort()).toEqual([...new Set(configFiles)].sort());

    const keysByFile = new Map();
    for (const section of allSections()) {
      if (section.joined) {
        continue;
      }
      const seen = keysByFile.get(section.file) || new Set();
      for (const key of section.keys) {
        expect(seen.has(key), `${section.file} key "${key}" is claimed by two sections`).toBe(false);
        seen.add(key);
      }
      keysByFile.set(section.file, seen);
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
});
