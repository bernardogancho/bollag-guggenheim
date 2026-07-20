import React, { useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { resolveListField } from '../lib/configPath.js';
import { joinWearhouse, splitWearhouse, blankRosterItem, blankBrandEntry } from '../adapters/wearhouse.js';
import { reorder, setAtPath, deepClone } from '../lib/paths.js';
import { pruneEmptyAdditions } from '../lib/prune.js';
import { slugify } from '../lib/slugify.js';
import { FieldRenderer } from '../fields/FieldRenderer.jsx';
import { Breadcrumbs } from './SectionScreen.jsx';
import { useToast } from '../shell/Toasts.jsx';

// Mirrors BrandsScreen's UX for the two-file Wearhouse roster: a list of
// index-identity cards (joined by adapters/wearhouse.js) plus an item editor
// whose groups cascade in the exact order the real brand page
// (src/wearhouse/brand.njk) renders them: Brand (identity) → Page top (hero)
// → Introduction (overview text) → Card on the Wearhouse page (grid tile).
// Unlike BrandsScreen, a record's two halves (roster.json / brands.json) can
// each be independently missing — every group below degrades gracefully
// instead of assuming both halves exist.
export function WearhouseScreen({ page, section, rest }) {
  const { store, fieldConfig } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();
  const [newName, setNewName] = useState('');

  const [rosterFile, brandsFile] = section.files;
  const rosterDraft = store.getDraft(rosterFile);
  const brandsDraft = store.getDraft(brandsFile);
  const rosterEntry = fieldConfig.get(rosterFile);
  const brandsEntry = fieldConfig.get(brandsFile);
  if (!rosterDraft || !brandsDraft || !rosterEntry || !brandsEntry) {
    return <div className="skeleton" style={{ minHeight: 220 }} />;
  }

  const rosterItemFields = resolveListField(rosterEntry.fields, 'rosterSection.items')?.fields || [];
  const brandEntryFields = resolveListField(brandsEntry.fields, 'brands')?.fields || [];
  const rosterCardFields = brandEntryFields.find(field => field.name === 'rosterCard')?.fields || [];
  const detailFields = brandEntryFields.find(field => field.name === 'detail')?.fields || [];
  const { records } = joinWearhouse(rosterDraft.rosterSection.items || [], brandsDraft.brands || []);

  const writeRecords = nextRecords => {
    const { rosterItems, brandEntries } = splitWearhouse(nextRecords);
    store.update(rosterFile, draft => { draft.rosterSection.items = rosterItems; });
    store.update(brandsFile, draft => { draft.brands = brandEntries; });
  };

  // Records are identified by index, never by slug: joinWearhouse deliberately
  // preserves duplicate-slug records (marked so an editor can fix them), so a
  // slug does not uniquely name a record.
  const updateRecord = (idx, patch) => {
    const next = { ...patch };
    // Prune touched-into-existence '' keys from a patched half against its
    // remote counterpart, matched by the record's CURRENT (pre-patch) slug —
    // the halves live in two files where slug is the join key. New or renamed
    // records have no remote match and pass through unpruned.
    if (next.roster) {
      const remoteItem = (store.getRemote(rosterFile)?.rosterSection?.items || []).find(item => item.slug === records[idx].slug);
      next.roster = remoteItem ? pruneEmptyAdditions(next.roster, remoteItem) : next.roster;
    }
    if (next.brand) {
      const remoteEntry = (store.getRemote(brandsFile)?.brands || []).find(entry => entry.slug === records[idx].slug);
      next.brand = remoteEntry ? pruneEmptyAdditions(next.brand, remoteEntry) : next.brand;
    }
    writeRecords(records.map((record, i) => (i === idx ? { ...record, ...next } : record)));
  };

  // ---------- item mode ----------
  if (rest.length) {
    const idx = Number(rest[0]);
    const record = Number.isInteger(idx) ? records[idx] : undefined;
    if (!record) {
      return (
        <div className="empty-state">
          <div className="empty-state-title">Brand not found</div>
          <div className="empty-state-description">It may have been deleted or renamed.</div>
        </div>
      );
    }

    // Writes a single leaf path within one half ('roster' or 'brand'),
    // cloning that half so sibling keys are untouched, then routes the
    // clone through updateRecord so it still gets pruned against that
    // half's remote counterpart (matched by slug). Never creates a missing
    // half implicitly — a field whose half is absent isn't rendered at all
    // (see renderField below), so this is never called for one.
    const updateField = (half, path, value) => {
      const current = record[half];
      if (!current) {
        return;
      }
      const nextHalf = deepClone(current);
      setAtPath(nextHalf, path, value);
      updateRecord(idx, { [half]: nextHalf });
    };

    // Resolves a field definition from config (roster item fields, or the
    // brand entry's card/detail object children) so widget types and
    // `required` stay in sync with config.yml; only label/description are
    // overridden per placement.
    const findField = (source, name) => {
      const fields = source === 'roster' ? rosterItemFields : source === 'rosterCard' ? rosterCardFields : detailFields;
      return fields.find(field => field.name === name) || null;
    };
    const withOverrides = (fieldDef, overrides) => {
      if (!fieldDef) {
        return null;
      }
      if (!overrides) {
        return fieldDef;
      }
      return { ...fieldDef, ...overrides };
    };
    // A group field's config `source` maps to the {half, path} it's actually
    // stored at: roster-level fields live directly on the roster half;
    // rosterCard/detail fields are nested one level inside the brand half.
    const renderField = ({ source, name, overrides }) => {
      const fieldDef = withOverrides(findField(source, name), overrides);
      if (!fieldDef) {
        return null;
      }
      const half = source === 'roster' ? 'roster' : 'brand';
      const path = source === 'roster' ? name : `${source}.${name}`;
      const data = record[half];
      if (!data) {
        return null; // this record has no data for this field's half
      }
      const value = source === 'roster' ? data[name] : data[source]?.[name];
      return (
        <FieldRenderer key={`${source}.${name}`} field={fieldDef} value={value}
          onChange={next => updateField(half, path, next)}
          pathPrefix={`__wearhouse.${idx}.${half}.${path}`} routeBase={[page.id, section.id]} />
      );
    };

    const groups = [
      {
        title: 'Page top',
        help: "The opening of the brand's own page, in the order visitors see it.",
        fields: [
          { source: 'roster', name: 'hoverImage', overrides: { label: 'Background photo', description: "The large photo behind the brand name. This same photo is also used as the brand's card photo on the Wearhouse page and as the portrait beside the introduction. Best size: a wide photo around 2560×1440 px." } },
          { source: 'detail', name: 'summary', overrides: { label: 'Description', description: "The paragraph under the brand name. It also appears on the brand's card." } },
          { source: 'roster', name: 'segment', overrides: { description: 'Shown in the small info row under the heading, e.g. "Women & Men".' } },
        ],
        footerHelp: 'The small label above the heading is the same for every brand — edit it under The Wearhouse → Brand page settings.',
      },
      {
        title: 'Introduction',
        help: 'The text block after the page top.',
        fields: [
          { source: 'detail', name: 'intro', overrides: { label: 'First paragraph' } },
          { source: 'detail', name: 'focus', overrides: { label: 'Second paragraph' } },
          { source: 'detail', name: 'atmosphere', overrides: { label: 'Style tag', description: 'Short phrase shown in the small info row.' } },
          { source: 'detail', name: 'categories' },
        ],
      },
      {
        title: 'Card on the Wearhouse page',
        help: "The brand's tile in the Wearhouse overview. It uses the Background photo above.",
        fields: [
          { source: 'roster', name: 'cardLabel', overrides: { label: 'Card label', description: 'The small line above the logo on the card.' } },
        ],
      },
    ];

    return (
      <div>
        <Breadcrumbs parts={[
          { label: page.label, to: ['page', page.id] },
          { label: section.label, to: ['page', page.id, section.id] },
          { label: record.name },
        ]} />
        <div className="screen-header">
          <div>
            <h2 className="screen-title">{record.name}</h2>
            <p className="screen-subtitle">One brand — its card on the Wearhouse page and its own detail page, kept in sync.</p>
          </div>
          <div className="screen-actions">
            {record.brand ? <a className="button button-ghost" href={`/wearhouse/${record.slug}/`} target="_blank" rel="noreferrer">View page ↗</a> : null}
            <button type="button" className="button button-danger" onClick={() => {
              if (window.confirm(`Delete “${record.name}” from the Wearhouse (card and detail page)?`)) {
                writeRecords(records.filter((_, i) => i !== idx));
                toast('Brand deleted.');
                navigate('page', page.id, section.id);
              }
            }}>Delete brand</button>
          </div>
        </div>

        <section className="group-card">
          <h3 className="group-card-title">Brand</h3>
          <div className="field-help">The basics. The logo appears on this brand's card on the Wearhouse page.</div>
          <div className="field-grid two-col">
            <label className="field">
              <span className="field-label">Brand name</span>
              <input className="input" value={record.name} onChange={event => {
                const name = event.target.value;
                updateRecord(idx, {
                  name,
                  roster: record.roster ? { ...record.roster, name } : record.roster,
                  brand: record.brand ? { ...record.brand, name } : record.brand,
                });
              }} />
            </label>
            {renderField({ source: 'roster', name: 'logoSrc', overrides: { label: 'Logo', description: "Shown on the brand's card on the Wearhouse page. Use an SVG or a transparent PNG at least 400 px wide." } })}
            {renderField({ source: 'rosterCard', name: 'logoLines', overrides: { label: 'Logo text lines', description: 'Only used when no logo image is set: the brand name is drawn as text instead.' } })}
            <div className="field">
              <span className="field-label">Web address</span>
              <div className="field-help">/wearhouse/{record.slug}/ — renaming changes the page's link.</div>
              <button type="button" className="button button-secondary" onClick={() => {
                const input = window.prompt('New web address (lowercase, words joined by hyphens):', record.slug);
                if (input === null) {
                  return;
                }
                const nextSlug = slugify(input);
                if (!nextSlug) {
                  toast('That address is not valid.', 'error');
                  return;
                }
                if (nextSlug !== record.slug && records.some(candidate => candidate.slug === nextSlug)) {
                  toast('That address is already used by another brand.', 'error');
                  return;
                }
                writeRecords(records.map((candidate, i) => (i === idx ? {
                  ...candidate,
                  slug: nextSlug,
                  roster: candidate.roster ? { ...candidate.roster, slug: nextSlug, pageHref: `/wearhouse/${nextSlug}/` } : candidate.roster,
                  brand: candidate.brand ? { ...candidate.brand, slug: nextSlug } : candidate.brand,
                } : candidate)));
                toast('Address renamed.');
              }}>Rename address</button>
            </div>
          </div>
        </section>

        {groups.map(group => (
          <section className="group-card" key={group.title}>
            <h3 className="group-card-title">{group.title}</h3>
            {group.help ? <div className="field-help">{group.help}</div> : null}
            <div className="field-grid">
              {group.fields.map(renderField)}
            </div>
            {group.footerHelp ? <div className="field-help">{group.footerHelp}</div> : null}
          </section>
        ))}
      </div>
    );
  }

  // ---------- list mode ----------
  const headingFields = (rosterEntry.fields.find(field => field.name === 'rosterSection')?.fields || [])
    .filter(field => field.name !== 'items');

  const addBrand = () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    const nextSlug = slugify(name);
    if (!nextSlug) {
      toast('Use letters or numbers in the brand name.', 'error');
      return;
    }
    if (records.some(record => record.slug === nextSlug)) {
      toast('A brand with that name already exists.', 'error');
      return;
    }
    writeRecords([...records, { slug: nextSlug, name, roster: blankRosterItem({ slug: nextSlug, name }), brand: blankBrandEntry({ slug: nextSlug, name }), missing: null }]);
    setNewName('');
    // The new record has a roster half, so after the split/re-join it sits at
    // the end of the roster-ordered records, BEFORE any brand-only orphans.
    navigate('page', page.id, section.id, String(records.filter(record => record.roster).length));
  };

  return (
    <div>
      <Breadcrumbs parts={[{ label: page.label, to: ['page', page.id] }, { label: section.label }]} />
      <div className="screen-header">
        <div>
          <h2 className="screen-title">{section.label}</h2>
          <p className="screen-subtitle">Each brand has a card on the Wearhouse page and its own detail page — edited together here.</p>
        </div>
        <div className="screen-actions">
          <a className="button button-ghost" href="/wearhouse/" target="_blank" rel="noreferrer">View page ↗</a>
          <input className="input" placeholder="New brand name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addBrand(); }} />
          <button type="button" className="button button-primary" onClick={addBrand} disabled={!newName.trim()}>Add brand</button>
        </div>
      </div>

      <section className="group-card">
        <h3 className="group-card-title">Section heading</h3>
        <div className="field-grid two-col">
          {headingFields.map(field => (
            <FieldRenderer key={field.name} field={field} value={rosterDraft.rosterSection[field.name]}
              onChange={next => store.update(rosterFile, draft => { draft.rosterSection[field.name] = next; })}
              pathPrefix={`rosterSection.${field.name}`} routeBase={[page.id, section.id]} />
          ))}
        </div>
      </section>

      <div className="item-grid" style={{ marginTop: 12 }}>
        {records.map((record, index) => {
          const thumb = record.roster?.hoverImage || record.roster?.logoSrc || null;
          return (
            <div key={index} className="item-card" role="button" tabIndex={0}
              onClick={() => navigate('page', page.id, section.id, String(index))}
              onKeyDown={event => { if (event.key === 'Enter') navigate('page', page.id, section.id, String(index)); }}>
              <div className="item-card-thumb">
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="item-card-thumb-empty">No image</span>}
              </div>
              <div className="item-card-body">
                <div className="item-card-title">{record.name}</div>
                <div className="item-card-subtitle">{record.roster?.segment || '—'}</div>
              </div>
              <div className="item-card-flags" onClick={event => event.stopPropagation()}>
                {record.missing === 'brand' ? <span className="badge badge-warning">Missing detail page</span> : null}
                {record.missing === 'roster' ? <span className="badge badge-warning">Missing card</span> : null}
                <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => writeRecords(reorder(records, index, index - 1))}>↑</button>
                <button type="button" className="icon-button" title="Move down" disabled={index === records.length - 1} onClick={() => writeRecords(reorder(records, index, index + 1))}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
