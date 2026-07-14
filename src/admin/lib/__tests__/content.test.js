import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadFieldConfig, loadContentFile, loadMediaIndex } from '../content.js';

const CONFIG_YAML = `
collections:
  - name: homepage
    files:
      - name: home_hero
        label: Hero
        file: src/_data/cms/home/hero.json
        fields:
          - { label: Title, name: title, widget: string }
`;

function stubFetch(impl) {
  const fetcher = vi.fn(impl);
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadFieldConfig', () => {
  it('throws with the status in the message on a non-ok response', async () => {
    stubFetch(async () => ({ ok: false, status: 404 }));
    await expect(loadFieldConfig()).rejects.toThrow(/404/);
  });

  it('returns a Map keyed by file path with a fields array', async () => {
    stubFetch(async () => ({ ok: true, text: async () => CONFIG_YAML }));
    const byFile = await loadFieldConfig();
    expect(byFile).toBeInstanceOf(Map);
    const entry = byFile.get('src/_data/cms/home/hero.json');
    expect(entry.name).toBe('home_hero');
    expect(Array.isArray(entry.fields)).toBe(true);
    expect(entry.fields[0].name).toBe('title');
  });
});

describe('loadContentFile', () => {
  it('strips the src/_data/cms/ prefix when fetching', async () => {
    const fetcher = stubFetch(async () => ({ ok: true, json: async () => ({ hero: {} }) }));
    const data = await loadContentFile('src/_data/cms/home/hero.json');
    expect(fetcher.mock.calls[0][0]).toBe('/cms-data/home/hero.json');
    expect(data).toEqual({ hero: {} });
  });

  it('throws on a non-ok response', async () => {
    stubFetch(async () => ({ ok: false, status: 500 }));
    await expect(loadContentFile('src/_data/cms/home/hero.json')).rejects.toThrow(/500/);
  });
});

describe('loadMediaIndex', () => {
  it('returns null on a non-ok response', async () => {
    stubFetch(async () => ({ ok: false, status: 404 }));
    await expect(loadMediaIndex()).resolves.toBeNull();
  });

  it('returns null when the fetch itself rejects', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    await expect(loadMediaIndex()).resolves.toBeNull();
  });
});
