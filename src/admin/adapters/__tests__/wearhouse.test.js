import { describe, it, expect } from 'vitest';
import { joinWearhouse, splitWearhouse, blankRosterItem, blankBrandEntry } from '../wearhouse.js';

const roster = [
  { name: 'Circolo 1901', slug: 'circolo-1901', segment: 'Menswear' },
  { name: 'Only Roster', slug: 'only-roster', segment: 'X' },
];
const brands = [
  { name: 'Circolo 1901', slug: 'circolo-1901', detail: { summary: 'S' } },
  { name: 'Only Brand', slug: 'only-brand', detail: { summary: 'B' } },
];

describe('wearhouse adapter', () => {
  it('joins by slug in roster order, appending brand-only records', () => {
    const { records } = joinWearhouse(roster, brands);
    expect(records.map(record => record.slug)).toEqual(['circolo-1901', 'only-roster', 'only-brand']);
    expect(records[0].roster.segment).toBe('Menswear');
    expect(records[0].brand.detail.summary).toBe('S');
  });

  it('marks incomplete records', () => {
    const { records } = joinWearhouse(roster, brands);
    expect(records[0].missing).toBeNull();
    expect(records[1].missing).toBe('brand');
    expect(records[2].missing).toBe('roster');
  });

  it('splits back into the two arrays, skipping missing halves', () => {
    const { records } = joinWearhouse(roster, brands);
    const { rosterItems, brandEntries } = splitWearhouse(records);
    expect(rosterItems.map(item => item.slug)).toEqual(['circolo-1901', 'only-roster']);
    expect(brandEntries.map(entry => entry.slug)).toEqual(['circolo-1901', 'only-brand']);
  });

  it('round-trips without data loss', () => {
    const { records } = joinWearhouse(roster, brands);
    const { rosterItems, brandEntries } = splitWearhouse(records);
    expect(rosterItems[0]).toEqual(roster[0]);
    expect(brandEntries[0]).toEqual(brands[0]);
    expect(rosterItems[1]).toEqual(roster[1]); // roster-only entry survives split intact
    expect(brandEntries[1]).toEqual(brands[1]); // brand-only entry survives split intact
    expect(rosterItems).toEqual(roster);
    expect(brandEntries).toEqual(brands);
  });

  it('marks duplicate roster slugs and never emits their brand entry twice', () => {
    const dupRoster = [...roster, { name: 'Circolo Again', slug: 'circolo-1901', segment: 'Dup' }];
    const { records } = joinWearhouse(dupRoster, brands);
    const dupRecord = records.find(record => record.duplicate);
    expect(dupRecord.slug).toBe('circolo-1901');
    expect(dupRecord.brand).toBeNull();
    expect(dupRecord.missing).toBe('brand');
    expect(dupRecord.duplicate).toBe(true);
    const { rosterItems, brandEntries } = splitWearhouse(records);
    expect(rosterItems).toHaveLength(3); // roster rows are all kept for the editor to fix
    expect(brandEntries.filter(entry => entry.slug === 'circolo-1901')).toHaveLength(1);
  });

  it('blank factories carry the slug and name over', () => {
    expect(blankRosterItem({ slug: 's', name: 'N' }).slug).toBe('s');
    expect(blankBrandEntry({ slug: 's', name: 'N' }).name).toBe('N');
  });
});
