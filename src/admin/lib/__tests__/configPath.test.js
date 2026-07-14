import { describe, it, expect } from 'vitest';
import { resolveListField, defaultValueForFields } from '../configPath.js';

const entryFields = [
  {
    name: 'groups', label: 'Store Groups', widget: 'list',
    fields: [
      { name: 'title', label: 'Title', widget: 'string' },
      {
        name: 'stores', label: 'Stores', widget: 'list',
        fields: [
          { name: 'name', label: 'Name', widget: 'string' },
          { name: 'image', label: 'Image', widget: 'image' },
        ],
      },
    ],
  },
];

describe('resolveListField', () => {
  it('resolves a root list', () => {
    expect(resolveListField(entryFields, 'groups').label).toBe('Store Groups');
  });
  it('resolves a nested list across a numeric index', () => {
    expect(resolveListField(entryFields, 'groups.2.stores').label).toBe('Stores');
  });
  it('returns null for non-list or unknown paths', () => {
    expect(resolveListField(entryFields, 'groups.2.title')).toBeNull();
    expect(resolveListField(entryFields, 'nope')).toBeNull();
  });
});

describe('defaultValueForFields', () => {
  it('builds a blank item from field defs', () => {
    const fields = [
      { name: 'name', widget: 'string' },
      { name: 'image', widget: 'image' },
      { name: 'tags', widget: 'list', field: { name: 'tag', widget: 'string' } },
      { name: 'card', widget: 'object', fields: [{ name: 'title', widget: 'string' }] },
      { name: 'size', widget: 'select', options: ['standard', 'wide'] },
      { name: 'active', widget: 'boolean' },
    ];
    expect(defaultValueForFields(fields)).toEqual({
      name: '', image: '', tags: [], card: { title: '' }, size: 'standard', active: false,
    });
  });
});
