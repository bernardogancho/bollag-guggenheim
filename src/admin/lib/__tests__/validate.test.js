import { describe, it, expect } from 'vitest';
import { validateValue } from '../validate.js';

const fields = [
  { label: 'Title', name: 'title', widget: 'string' },
  { label: 'Note', name: 'note', widget: 'string', required: false },
  { label: 'Link', name: 'href', widget: 'string' },
  { label: 'Image', name: 'image', widget: 'image' },
  {
    label: 'Items', name: 'items', widget: 'list',
    fields: [{ label: 'Name', name: 'name', widget: 'string' }],
  },
];

describe('validateValue', () => {
  it('passes a fully valid object', () => {
    const value = { title: 'Hi', note: '', href: '/brands/', image: '/assets/media/a.jpg', items: [{ name: 'X' }] };
    expect(validateValue(fields, value, 'Section')).toEqual([]);
  });

  it('flags required empty strings but not optional ones', () => {
    const issues = validateValue(fields, { title: '', note: '', href: '/x', image: '/assets/a.jpg', items: [] }, 'Section');
    expect(issues).toHaveLength(1);
    expect(issues[0].label).toContain('Title');
  });

  it('flags malformed links (href-ish names must be URL, mailto, tel or site path)', () => {
    const issues = validateValue(fields, { title: 'T', href: 'www.example.com', image: '/assets/a.jpg', items: [] }, 'Section');
    expect(issues.some(issue => issue.label.includes('Link'))).toBe(true);
  });

  it('flags image paths that are neither /-rooted nor http', () => {
    const issues = validateValue(fields, { title: 'T', href: '/ok', image: 'foo.jpg', items: [] }, 'Section');
    expect(issues.some(issue => issue.label.includes('Image'))).toBe(true);
  });

  it('recurses into list items with item position in the label', () => {
    const issues = validateValue(fields, { title: 'T', href: '/ok', image: '/assets/a.jpg', items: [{ name: '' }] }, 'Section');
    expect(issues).toHaveLength(1);
    expect(issues[0].label).toContain('Items');
    expect(issues[0].label).toContain('#1');
  });
});
