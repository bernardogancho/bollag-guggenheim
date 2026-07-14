import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, DRAFT_PREFIX } from '../store.js';

const FILE = 'src/_data/cms/company.json';
const remote = () => ({ hero: { title: 'Old' }, intro: { text: 'Hi' } });

describe('store', () => {
  beforeEach(() => localStorage.clear());

  it('loads remote as draft when no local draft exists', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    expect(store.getDraft(FILE)).toEqual(remote());
    expect(store.isDirty(FILE)).toBe(false);
  });

  it('restores a persisted local draft over remote', () => {
    localStorage.setItem(DRAFT_PREFIX + FILE, JSON.stringify({ hero: { title: 'Draft' }, intro: { text: 'Hi' } }));
    const store = createStore();
    store.loadFile(FILE, remote());
    expect(store.getDraft(FILE).hero.title).toBe('Draft');
    expect(store.isDirty(FILE)).toBe(true);
  });

  it('falls back to remote when the persisted draft is corrupted JSON', () => {
    localStorage.setItem(DRAFT_PREFIX + FILE, '{not valid json');
    const store = createStore();
    store.loadFile(FILE, remote());
    expect(store.getDraft(FILE)).toEqual(remote());
    expect(store.isDirty(FILE)).toBe(false);
  });

  it('update mutates a clone, persists, and marks dirty (per top-level key too)', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; });
    expect(store.isDirty(FILE)).toBe(true);
    expect(store.isKeyDirty(FILE, 'hero')).toBe(true);
    expect(store.isKeyDirty(FILE, 'intro')).toBe(false);
    expect(JSON.parse(localStorage.getItem(DRAFT_PREFIX + FILE)).hero.title).toBe('New');
  });

  it('reverting an edit back to remote clears dirty and localStorage', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; });
    store.update(FILE, draft => { draft.hero.title = 'Old'; });
    expect(store.isDirty(FILE)).toBe(false);
    expect(localStorage.getItem(DRAFT_PREFIX + FILE)).toBeNull();
  });

  it('discardKeys restores only the given keys', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; draft.intro.text = 'Changed'; });
    store.discardKeys(FILE, ['hero']);
    expect(store.getDraft(FILE).hero.title).toBe('Old');
    expect(store.getDraft(FILE).intro.text).toBe('Changed');
    expect(store.isDirty(FILE)).toBe(true);
  });

  it('markPublished snapshots draft as new remote and clears storage', () => {
    const store = createStore();
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; });
    store.markPublished([FILE]);
    expect(store.isDirty(FILE)).toBe(false);
    expect(store.getRemote(FILE).hero.title).toBe('New');
    expect(localStorage.getItem(DRAFT_PREFIX + FILE)).toBeNull();
  });

  it('notifies subscribers on change', () => {
    const store = createStore();
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    store.loadFile(FILE, remote());
    store.update(FILE, draft => { draft.hero.title = 'New'; });
    expect(calls).toBe(2);
  });
});
