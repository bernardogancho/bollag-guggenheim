import { describe, it, expect } from 'vitest';
import { pruneEmptyAdditions } from '../prune.js';

describe('pruneEmptyAdditions', () => {
  it('drops a top-level "" key that is absent on remote', () => {
    const next = { title: 'Hello', subtitle: '' };
    const remote = { title: 'Hello' };
    expect(pruneEmptyAdditions(next, remote)).toEqual({ title: 'Hello' });
  });

  it('keeps "" when the remote already has that key (a real clearing)', () => {
    const next = { title: 'Hello', subtitle: '' };
    const remote = { title: 'Hello', subtitle: 'Old subtitle' };
    expect(pruneEmptyAdditions(next, remote)).toEqual({ title: 'Hello', subtitle: '' });
  });

  it('drops nested empty additions, mirroring brands.json logoImage', () => {
    const next = { name: 'Closed', slug: 'closed', logoImage: '', card: { eyebrow: 'x' } };
    const remote = { name: 'Closed', slug: 'closed', card: { eyebrow: 'x' } };
    expect(pruneEmptyAdditions(next, remote)).toEqual({ name: 'Closed', slug: 'closed', card: { eyebrow: 'x' } });
  });

  it('drops "" keys touched into existence on a new array item, but keeps the array slot', () => {
    const next = [{ image: '/a.jpg', note: 'A' }, { image: '', note: '' }];
    const remote = [{ image: '/a.jpg', note: 'A' }];
    // The new item's slot is kept (array length unchanged) but its
    // touched-into-existence '' keys are pruned, leaving an empty object.
    expect(pruneEmptyAdditions(next, remote)).toEqual([{ image: '/a.jpg', note: 'A' }, {}]);
  });

  it('keeps a real value alongside a pruned "" key on a new array item', () => {
    const next = [{ image: '/a.jpg', note: 'A' }, { image: '/b.jpg', note: '' }];
    const remote = [{ image: '/a.jpg', note: 'A' }];
    expect(pruneEmptyAdditions(next, remote)).toEqual([{ image: '/a.jpg', note: 'A' }, { image: '/b.jpg' }]);
  });

  it('keeps an array slot that is itself "" (a scalar list entry)', () => {
    const next = ['a', '', 'c'];
    const remote = ['a', 'b', 'c'];
    expect(pruneEmptyAdditions(next, remote)).toEqual(['a', '', 'c']);
  });

  it('preserves key order of kept keys', () => {
    const next = { a: '1', b: '', c: '3' };
    const remote = { a: '0', c: '2' };
    const result = pruneEmptyAdditions(next, remote);
    expect(Object.keys(result)).toEqual(['a', 'c']);
    expect(result).toEqual({ a: '1', c: '3' });
  });

  it('drops a top-level "" when remote is entirely undefined', () => {
    expect(pruneEmptyAdditions('', undefined)).toBeUndefined();
  });
});
