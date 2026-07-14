import { describe, it, expect } from 'vitest';
import { deepClone, getAtPath, setAtPath, reorder } from '../paths.js';

describe('paths', () => {
  it('deepClone produces an independent copy', () => {
    const a = { x: { y: [1, 2] } };
    const b = deepClone(a);
    b.x.y.push(3);
    expect(a.x.y).toEqual([1, 2]);
  });

  it('getAtPath resolves dotted paths with numeric indexes', () => {
    const obj = { groups: [{ stores: [{ name: 'Zurich' }] }] };
    expect(getAtPath(obj, 'groups.0.stores.0.name')).toBe('Zurich');
    expect(getAtPath(obj, 'groups.9.stores')).toBeUndefined();
    expect(getAtPath(obj, '')).toBe(obj);
  });

  it('setAtPath mutates the target at a dotted path', () => {
    const obj = { a: [{ b: 1 }] };
    setAtPath(obj, 'a.0.b', 2);
    expect(obj.a[0].b).toBe(2);
  });

  it('setAtPath creates missing intermediate objects', () => {
    const obj = {};
    setAtPath(obj, 'a.b', 5);
    expect(obj.a.b).toBe(5);
  });

  it('reorder moves an item and returns a new array', () => {
    const list = ['a', 'b', 'c'];
    expect(reorder(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
