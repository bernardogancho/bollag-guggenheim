import React, { useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { navigate } from '../lib/router.js';
import { resolveListField, defaultValueForFields } from '../lib/configPath.js';
import { getAtPath, setAtPath, reorder } from '../lib/paths.js';
import { pruneEmptyAdditions } from '../lib/prune.js';
import { slugify } from '../lib/slugify.js';
import { itemImage } from '../lib/summarize.js';
import { FieldRenderer } from '../fields/FieldRenderer.jsx';
import { Breadcrumbs } from './SectionScreen.jsx';
import { useToast } from '../shell/Toasts.jsx';

// Mirrors WearhouseScreen's UX for the single-file BG brand list: a list of
// index-identity cards ('brands.<index>') plus an item editor whose groups
// cascade in the exact order the real brand page (src/brands/brand.njk)
// renders them: Brand (identity) → Page top (hero) → Introduction (overview
// text) → Visual journal (gallery) → Card in the brand overviews (grid/wall
// tile). Card and detail fields are interleaved per placement, not grouped
// by their config file location.
export function BrandsScreen({ page, section, rest }) {
  const { store, fieldConfig } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();
  const [newName, setNewName] = useState('');

  const entry = fieldConfig.get(section.file);
  const draft = store.getDraft(section.file);
  if (!entry || !draft) {
    return <div className="skeleton" style={{ minHeight: 220 }} />;
  }

  const listField = resolveListField(entry.fields, 'brands');
  const items = draft.brands || [];
  const logoField = listField?.fields.find(field => field.name === 'logoImage');
  const cardField = listField?.fields.find(field => field.name === 'card');
  const detailField = listField?.fields.find(field => field.name === 'detail');

  const setItems = next => store.update(section.file, draftCopy => { draftCopy.brands = next; });

  // ---------- item mode ----------
  if (rest.length) {
    const idx = Number(rest[0]);
    const item = Number.isInteger(idx) ? items[idx] : undefined;
    if (!item) {
      return (
        <div className="empty-state">
          <div className="empty-state-title">Brand not found</div>
          <div className="empty-state-description">It may have been deleted or renamed.</div>
        </div>
      );
    }

    const updateField = (childPath, value) => {
      const fullPath = `brands.${idx}.${childPath}`;
      const pruned = pruneEmptyAdditions(value, getAtPath(store.getRemote(section.file), fullPath));
      store.update(section.file, draftCopy => setAtPath(draftCopy, fullPath, pruned));
    };

    // Explicit field paths → groups, cascading in the exact order the real
    // brand page (src/brands/brand.njk) renders them. Each entry resolves
    // its field definition from config (card/detail object children) so
    // widget types and `required` stay in sync with config.yml; only
    // label/description are overridden per placement via a shallow copy.
    const findField = (source, name) => {
      const fields = source === 'card' ? cardField?.fields : detailField?.fields;
      return (fields || []).find(f => f.name === name) || null;
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
    const groups = [
      {
        title: 'Page top',
        help: "The opening of the brand's own page, in the order visitors see it.",
        fields: [
          { source: 'detail', name: 'detailHeroImage', overrides: { label: 'Background image', description: 'Full-screen photo behind the text. A dark gradient is used if empty.' } },
          { source: 'detail', name: 'detailHeroFocus', overrides: { label: 'Image focus' } },
          { source: 'card', name: 'eyebrow', overrides: { label: 'Small line above the logo' } },
          { source: 'card', name: 'heroTitle', overrides: { label: 'Big headline', description: 'If left empty, the description below is shown as the headline.' } },
          { source: 'card', name: 'summary', overrides: { label: 'Description', description: 'The paragraph under the headline.' } },
        ],
      },
      {
        title: 'Introduction',
        help: 'The text block after the page top.',
        fields: [
          { source: 'detail', name: 'intro', overrides: { label: 'First paragraph' } },
          { source: 'detail', name: 'focus', overrides: { label: 'Second paragraph', description: 'Leave empty to show only the first.' } },
          { source: 'detail', name: 'atmosphere', overrides: { label: 'Style tag', description: 'Short phrase shown in the small info row, e.g. "Relaxed tailoring".' } },
          { source: 'detail', name: 'categories', overrides: { label: 'Categories', description: 'Only the first two are shown on the page.' } },
        ],
      },
      {
        title: 'Visual journal',
        fields: [
          { source: 'detail', name: 'detailGallery' },
        ],
      },
      {
        title: 'Card in the brand overviews',
        help: "The brand's tile in the Brands overview and on the homepage wall. The logo and name appear on top of this photo.",
        fields: [
          { source: 'card', name: 'heroImage' },
        ],
      },
    ];

    return (
      <div>
        <Breadcrumbs parts={[
          { label: page.label, to: ['page', page.id] },
          { label: section.label, to: ['page', page.id, section.id] },
          { label: item.name },
        ]} />
        <div className="screen-header">
          <div>
            <h2 className="screen-title">{item.name}</h2>
            <p className="screen-subtitle">Its card on the Brands page and its own detail page, edited together here.</p>
          </div>
          <div className="screen-actions">
            <a className="button button-ghost" href={`/brands/${item.slug}/`} target="_blank" rel="noreferrer">View page ↗</a>
            <button type="button" className="button button-danger" onClick={() => {
              if (window.confirm(`Delete “${item.name}” from the Brands page (card and detail page)?`)) {
                setItems(items.filter((_, i) => i !== idx));
                toast('Brand deleted.');
                navigate('page', page.id, section.id);
              }
            }}>Delete brand</button>
          </div>
        </div>

        <section className="group-card">
          <h3 className="group-card-title">Brand</h3>
          <div className="field-help">The basics. The logo appears at the top of the brand's page and on its cards.</div>
          <div className="field-grid two-col">
            <label className="field">
              <span className="field-label">Brand name</span>
              <input className="input" value={item.name} onChange={event => updateField('name', event.target.value)} />
            </label>
            {logoField ? (
              <FieldRenderer field={logoField} value={item.logoImage}
                onChange={next => updateField('logoImage', next)}
                pathPrefix={`brands.${idx}.logoImage`} routeBase={[page.id, section.id]} />
            ) : null}
            <div className="field">
              <span className="field-label">Web address</span>
              <div className="field-help">/brands/{item.slug}/ — renaming changes the page's link.</div>
              <button type="button" className="button button-secondary" onClick={() => {
                const input = window.prompt('New web address (lowercase, words joined by hyphens):', item.slug);
                if (input === null) {
                  return;
                }
                const nextSlug = slugify(input);
                if (!nextSlug) {
                  toast('That address is not valid.', 'error');
                  return;
                }
                if (nextSlug !== item.slug && items.some((candidate, i) => i !== idx && candidate.slug === nextSlug)) {
                  toast('That address is already used by another brand.', 'error');
                  return;
                }
                updateField('slug', nextSlug);
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
              {group.fields.map(({ source, name, overrides }) => {
                const fieldDef = withOverrides(findField(source, name), overrides);
                if (!fieldDef) {
                  return null;
                }
                return (
                  <FieldRenderer key={`${source}.${name}`} field={fieldDef} value={item[source]?.[name]}
                    onChange={next => updateField(`${source}.${name}`, next)}
                    pathPrefix={`brands.${idx}.${source}.${name}`} routeBase={[page.id, section.id]} />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ---------- list mode ----------
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
    if (items.some(item => item.slug === nextSlug)) {
      toast('A brand with that name already exists.', 'error');
      return;
    }
    const newItem = {
      name,
      slug: nextSlug,
      logoImage: '',
      card: defaultValueForFields(cardField?.fields || []),
      detail: defaultValueForFields(detailField?.fields || []),
    };
    const newIndex = items.length;
    setItems([...items, newItem]);
    setNewName('');
    navigate('page', page.id, section.id, String(newIndex));
  };

  return (
    <div>
      <Breadcrumbs parts={[{ label: page.label, to: ['page', page.id] }, { label: section.label }]} />
      <div className="screen-header">
        <div>
          <h2 className="screen-title">{section.label}</h2>
          <p className="screen-subtitle">Each brand has a card on the Brands page and its own detail page — edited together here.</p>
        </div>
        <div className="screen-actions">
          <a className="button button-ghost" href="/brands/" target="_blank" rel="noreferrer">View page ↗</a>
          <input className="input" placeholder="New brand name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addBrand(); }} />
          <button type="button" className="button button-primary" onClick={addBrand} disabled={!newName.trim()}>Add brand</button>
        </div>
      </div>

      <div className="item-grid">
        {items.map((item, index) => {
          const thumb = item.card?.heroImage || item.logoImage || itemImage(item);
          return (
            <div key={index} className="item-card" role="button" tabIndex={0}
              onClick={() => navigate('page', page.id, section.id, String(index))}
              onKeyDown={event => { if (event.key === 'Enter') navigate('page', page.id, section.id, String(index)); }}>
              <div className="item-card-thumb">
                {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="item-card-thumb-empty">No image</span>}
              </div>
              <div className="item-card-body">
                <div className="item-card-title">{item.name}</div>
                <div className="item-card-subtitle">{item.card?.eyebrow || '—'}</div>
              </div>
              <div className="item-card-flags" onClick={event => event.stopPropagation()}>
                <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => setItems(reorder(items, index, index - 1))}>↑</button>
                <button type="button" className="icon-button" title="Move down" disabled={index === items.length - 1} onClick={() => setItems(reorder(items, index, index + 1))}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
