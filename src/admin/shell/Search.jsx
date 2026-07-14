import React, { useMemo, useState } from 'react';
import { PAGES, allSections } from '../manifest.js';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { itemTitle } from '../lib/summarize.js';

const CMS = 'src/_data/cms';

export function Search() {
  const { store } = useAdmin();
  useStoreVersion(store);
  const [query, setQuery] = useState('');

  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) {
      return [];
    }
    const results = [];
    for (const page of PAGES) {
      if (page.label.toLowerCase().includes(needle)) {
        results.push({ title: page.label, sub: 'Page', to: ['page', page.id] });
      }
    }
    for (const section of allSections()) {
      if (section.label.toLowerCase().includes(needle)) {
        results.push({ title: section.label, sub: section.pageLabel, to: ['page', section.pageId, section.id] });
      }
    }
    const bgBrands = store.getDraft(`${CMS}/brandsPage/brands.json`)?.brands || [];
    bgBrands.forEach((brand, index) => {
      if (itemTitle(brand).toLowerCase().includes(needle)) {
        results.push({ title: itemTitle(brand), sub: 'Bollag brand', to: ['page', 'brands', 'all-brands', 'list', 'brands', String(index)] });
      }
    });
    const rosterItems = store.getDraft(`${CMS}/wearhousePage/roster.json`)?.rosterSection?.items || [];
    // Wearhouse records are index-addressed (roster order = joined-record
    // order for records with a roster half), matching WearhouseScreen.
    rosterItems.forEach((item, index) => {
      if ((item.name || '').toLowerCase().includes(needle)) {
        results.push({ title: item.name, sub: 'Wearhouse brand', to: ['page', 'wearhouse', 'wearhouse-brands', String(index)] });
      }
    });
    const groups = store.getDraft(`${CMS}/stores.json`)?.groups || [];
    groups.forEach((group, groupIndex) => {
      (group.stores || []).forEach((storeItem, storeIndex) => {
        if ((storeItem.name || '').toLowerCase().includes(needle)) {
          results.push({ title: storeItem.name, sub: `Store — ${group.title || ''}`, to: ['page', 'stores', 'store-list', 'list', `groups.${groupIndex}.stores`, String(storeIndex)] });
        }
      });
    });
    return results.slice(0, 12);
  }, [query, store.getVersion()]);

  return (
    <div className="search-wrap">
      <input
        className="input" placeholder="Search pages, sections, brands, stores…"
        value={query} onChange={event => setQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }}
      />
      {hits.length ? (
        <div className="search-pop">
          {hits.map((hit, index) => (
            <button key={index} type="button" className="search-hit" onMouseDown={() => { navigate(...hit.to); setQuery(''); }}>
              <div className="search-hit-title">{hit.title}</div>
              <div className="search-hit-sub">{hit.sub}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
