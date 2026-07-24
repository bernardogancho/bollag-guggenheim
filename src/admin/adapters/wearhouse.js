// The Wearhouse brand data is split across two parallel lists synced by slug:
// roster.json → rosterSection.items[] (card on the Wearhouse page) and
// brands.json → brands[] (detail page). This adapter joins them into one
// record per slug for editing, and splits them back for publishing.

export function joinWearhouse(rosterItems, brandEntries) {
  const bySlug = new Map((brandEntries || []).map(entry => [entry.slug, entry]));
  const seen = new Set();
  const records = [];

  for (const item of rosterItems || []) {
    if (seen.has(item.slug)) {
      // Duplicate roster slug: never attach the same brand entry object to a
      // second record, or a split would re-emit that brand twice into
      // brands.json. `duplicate` documents why the brand half is missing;
      // the UI renders a warning badge from `missing`.
      records.push({
        slug: item.slug,
        name: item.name || item.slug,
        roster: item,
        brand: null,
        missing: 'brand',
        duplicate: true,
      });
      continue;
    }
    const brand = bySlug.get(item.slug) || null;
    seen.add(item.slug);
    records.push({
      slug: item.slug,
      name: item.name || brand?.name || item.slug,
      roster: item,
      brand,
      missing: brand ? null : 'brand',
    });
  }

  for (const entry of brandEntries || []) {
    if (!seen.has(entry.slug)) {
      seen.add(entry.slug);
      records.push({ slug: entry.slug, name: entry.name || entry.slug, roster: null, brand: entry, missing: 'roster' });
    }
  }

  return { records };
}

export function splitWearhouse(records) {
  // Dedupe brand entries by slug (first occurrence wins) so a brand entry
  // can never be emitted twice into brands.json regardless of the input.
  const emitted = new Set();
  const brandEntries = [];
  for (const record of records) {
    if (record.brand && !emitted.has(record.brand.slug)) {
      emitted.add(record.brand.slug);
      brandEntries.push(record.brand);
    }
  }
  return {
    rosterItems: records.filter(record => record.roster).map(record => record.roster),
    brandEntries,
  };
}

export function blankRosterItem({ slug = '', name = '' } = {}) {
  return { name, slug, cardLabel: 'Women & Men', segment: '', pageHref: slug ? `/wearhouse/${slug}/` : '', logoSrc: '', hoverImage: '', detailImage: '', heroTitle: '', portraitImage: '', gallery: [] };
}

export function blankBrandEntry({ slug = '', name = '' } = {}) {
  // Matches the canonical shape of every existing record in brands.json:
  // focus/atmosphere/categories live inside `detail`.
  return {
    name,
    slug,
    rosterCard: { segment: '', websiteHref: '', logoSrc: '', hoverImage: '', detailImage: '', logoLines: [] },
    detail: { summary: '', intro: '', focus: '', atmosphere: '', categories: [] },
  };
}
