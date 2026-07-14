import React, { useMemo, useRef, useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { sectionsForFile } from '../manifest.js';
import { useMediaUpload } from '../fields/MediaPicker.jsx';
import { useToast } from '../shell/Toasts.jsx';

const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const formatSize = bytes => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function MediaScreen() {
  const { store, mediaIndex } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();
  const [query, setQuery] = useState('');
  const fileInput = useRef(null);
  const { uploading, upload } = useMediaUpload(() => {}, 'Uploaded to the library.');

  // Where is each media file used? Serialize per top-level key so hits credit
  // the section that actually contains the image (files are shared by
  // several sections, e.g. company.json powers four of them).
  const usedIn = useMemo(() => {
    const keyTexts = [];
    for (const filePath of store.allPaths()) {
      const draft = store.getDraft(filePath) || {};
      for (const [key, value] of Object.entries(draft)) {
        const section = sectionsForFile(filePath).find(candidate => !candidate.joined && candidate.keys.includes(key))
          || sectionsForFile(filePath)[0];
        keyTexts.push({ label: section ? `${section.pageLabel} — ${section.label}` : filePath, text: JSON.stringify(value) });
      }
    }
    const map = new Map();
    for (const media of mediaIndex?.files || []) {
      const hits = keyTexts.filter(entry => entry.text.includes(media.path)).map(entry => entry.label);
      map.set(media.path, [...new Set(hits)]);
    }
    return map;
  }, [mediaIndex, store.getVersion()]);

  const files = useMemo(() => {
    const all = mediaIndex?.files || [];
    const needle = query.trim().toLowerCase();
    return needle ? all.filter(file => file.path.toLowerCase().includes(needle)) : all;
  }, [mediaIndex, query]);

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">Media</h2>
          <p className="screen-subtitle">Every image and video available to the website.</p>
        </div>
        <div className="screen-actions">
          <button type="button" className="button button-primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <input ref={fileInput} type="file" className="hidden-input" onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ''; }} />
        </div>
      </div>

      <div className="media-toolbar">
        <input className="input" placeholder="Search files by name" value={query} onChange={event => setQuery(event.target.value)} />
        <span className="field-help">{files.length} file{files.length === 1 ? '' : 's'}</span>
      </div>

      {mediaIndex ? (
        <div className="item-grid">
          {files.map(file => {
            const uses = usedIn.get(file.path) || [];
            return (
              <div key={file.path} className="item-card">
                <div className="item-card-thumb">
                  {IMAGE_SHAPE.test(file.path) ? <img src={file.path} alt="" loading="lazy" /> : <span className="item-card-thumb-empty">{file.path.split('.').pop().toUpperCase()}</span>}
                </div>
                <div className="item-card-body">
                  <div className="item-card-title" style={{ wordBreak: 'break-all', fontSize: 12 }}>{file.name || file.path.split('/').pop()}</div>
                  <div className="item-card-subtitle">{formatSize(file.size)} · {uses.length ? uses.slice(0, 2).join(', ') + (uses.length > 2 ? '…' : '') : 'Not used'}</div>
                </div>
                <div className="item-card-flags">
                  <button type="button" className="button button-ghost" onClick={() => { navigator.clipboard.writeText(file.path); toast('Path copied.'); }}>Copy path</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-title">Media list unavailable</div>
          <div className="empty-state-description">The library index could not be loaded. You can still upload files, and image fields still work.</div>
        </div>
      )}
    </div>
  );
}
