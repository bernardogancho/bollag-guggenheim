import { describe, it, expect } from 'vitest';
import { summarize, itemTitle, itemImage } from '../summarize.js';

describe('summarize', () => {
  it('previews scalars and counts arrays', () => {
    expect(summarize({ title: 'Hello', items: [1, 2, 3] })).toBe('Title: Hello · Items: 3 items');
  });
  it('handles empty values', () => {
    expect(summarize({})).toBe('Empty');
    expect(summarize('Plain')).toBe('Plain');
  });
  it('itemTitle prefers name-like keys then first non-empty string', () => {
    expect(itemTitle({ name: 'Closed' })).toBe('Closed');
    expect(itemTitle({ brand: 'Duno' })).toBe('Duno');
    expect(itemTitle({ month: 'July' })).toBe('July');
    expect(itemTitle({ dateLabel: '12–14 July' })).toBe('12–14 July');
    expect(itemTitle({ note: '' , other: 42 })).toBe('Untitled');
  });
  it('itemImage returns the first image-looking string value', () => {
    expect(itemImage({ logoImage: '/assets/media/a.svg', name: 'X' })).toBe('/assets/media/a.svg');
    expect(itemImage({ card: { heroImage: '/assets/media/b.jpg' } })).toBe('/assets/media/b.jpg');
    expect(itemImage({ name: 'X' })).toBeNull();
  });
});
