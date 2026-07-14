// The Wearhouse brand data is split across two parallel lists synced by slug:
// roster.json → rosterSection.items[] (card on the Wearhouse page) and
// brands.json → brands[] (detail page). This adapter joins them into one
// record per slug for editing, and splits them back for publishing.

export function joinWearhouse(rosterItems, brandEntries) {
  const bySlug = new Map((brandEntries || []).map(entry => [entry.slug, entry]));
  const seen = new Set();
  const records = [];

  for (const item of rosterItems || []) {
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
      records.push({ slug: entry.slug, name: entry.name || entry.slug, roster: null, brand: entry, missing: 'roster' });
    }
  }

  return { records };
}

export function splitWearhouse(records) {
  return {
    rosterItems: records.filter(record => record.roster).map(record => record.roster),
    brandEntries: records.filter(record => record.brand).map(record => record.brand),
  };
}

export function blankRosterItem({ slug = '', name = '' } = {}) {
  return { name, slug, segment: '', pageHref: slug ? `/wearhouse/${slug}/` : '', logoSrc: '', hoverImage: '' };
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
