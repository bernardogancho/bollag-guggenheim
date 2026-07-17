import React, { useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { resolveListField } from '../lib/configPath.js';
import { joinWearhouse, splitWearhouse, blankRosterItem, blankBrandEntry } from '../adapters/wearhouse.js';
import { reorder } from '../lib/paths.js';
import { pruneEmptyAdditions } from '../lib/prune.js';
import { slugify } from '../lib/slugify.js';
import { FieldRenderer } from '../fields/FieldRenderer.jsx';
import { Breadcrumbs } from './SectionScreen.jsx';
import { useToast } from '../shell/Toasts.jsx';

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
  // Segment is stored on the roster half but is shown in the "Brand detail
  // page" group below, since that's the only place it actually renders.
  const segmentField = rosterItemFields.find(field => field.name === 'segment') || null;
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
          <h3 className="group-card-title">Name & web address</h3>
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

        <section className="group-card">
          <h3 className="group-card-title">Card on the Wearhouse page</h3>
          {record.roster ? (
            <div className="field-grid">
              {rosterItemFields.filter(field => !['name', 'slug', 'segment'].includes(field.name)).map(field => (
                <FieldRenderer key={field.name} field={field} value={record.roster[field.name]}
                  onChange={next => updateRecord(idx, { roster: { ...record.roster, [field.name]: next } })}
                  pathPrefix={`__wearhouse.${idx}.roster.${field.name}`} routeBase={[page.id, section.id]} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">No card yet</div>
              <div className="empty-state-description">This brand has a detail page but no card on the Wearhouse page.</div>
              <button type="button" className="button button-secondary" onClick={() => updateRecord(idx, { roster: blankRosterItem(record), missing: null })}>Create the card</button>
            </div>
          )}
        </section>

        <section className="group-card">
          <h3 className="group-card-title">Brand detail page</h3>
          {record.brand ? (
            <div className="field-grid">
              {/* Segment lives on the roster half (roster.json), not the brand
                  half, but it only renders on the brand's own page (see
                  wearhouse/brand.njk) — not on the card — so it's shown here
                  with the rest of the detail-page fields, sourced from
                  record.roster. */}
              {segmentField && record.roster ? (
                <FieldRenderer key="roster.segment" field={segmentField} value={record.roster.segment}
                  onChange={next => updateRecord(idx, { roster: { ...record.roster, segment: next } })}
                  pathPrefix={`__wearhouse.${idx}.roster.segment`} routeBase={[page.id, section.id]} />
              ) : null}
              {brandEntryFields.filter(field => !['name', 'slug'].includes(field.name)).map(field => (
                <FieldRenderer key={field.name} field={field} value={record.brand[field.name]}
                  onChange={next => updateRecord(idx, { brand: { ...record.brand, [field.name]: next } })}
                  pathPrefix={`__wearhouse.${idx}.brand.${field.name}`} routeBase={[page.id, section.id]} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-title">No detail page yet</div>
              <div className="empty-state-description">This brand has a card but no detail page of its own.</div>
              <button type="button" className="button button-secondary" onClick={() => updateRecord(idx, { brand: blankBrandEntry(record), missing: null })}>Create the detail page</button>
            </div>
          )}
        </section>
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
          const thumb = record.roster?.hoverImage || record.roster?.logoSrc || record.brand?.rosterCard?.detailImage || null;
          return (
            <div key={index} className="item-card" role="button" tabIndex={0}
              onClick={() => navigate('page', page.id, section.id, String(index))}
              onKeyDown={event => { if (event.key === 'Enter') navigate('page', page.id, section.id, String(index)); }}>
              <div className="item-card-thumb">
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="item-card-thumb-empty">No image</span>}
              </div>
              <div className="item-card-body">
                <div className="item-card-title">{record.name}</div>
                <div className="item-card-subtitle">{record.roster?.segment || record.brand?.rosterCard?.segment || '—'}</div>
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
