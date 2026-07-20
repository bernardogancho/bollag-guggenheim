import React, { useState } from 'react';
import { FieldShell } from './basics.jsx';
import { MediaPicker, useMediaUpload } from './MediaPicker.jsx';
import { useToast } from '../shell/Toasts.jsx';

const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

export function ImageField({ field, value, onChange, kind = 'image', inheritedSrc, inheritedNote }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPath, setShowPath] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { uploading, upload } = useMediaUpload(path => onChange(path));
  const toast = useToast();
  const current = String(value || '');
  const hasPreview = current && IMAGE_SHAPE.test(current);
  // An empty optional field can still render a picture on the site, because it
  // falls back to another field (e.g. the Wearhouse background photo reuses the
  // card photo). Showing a bare dropzone there reads as "no image", so show the
  // picture the page is actually using, marked as inherited.
  const inherited = !current && inheritedSrc && IMAGE_SHAPE.test(String(inheritedSrc)) ? String(inheritedSrc) : '';

  return (
    <FieldShell field={field}>
      {inherited ? (
        <div className="asset-card is-inherited">
          <img className="asset-card-image" src={inherited} alt="" />
          <div className="asset-card-note">{inheritedNote || 'Using another photo until you set one here.'}</div>
          <div className="asset-card-actions">
            <button type="button" className="button button-secondary" onClick={() => setPickerOpen(true)}>Choose a different photo</button>
          </div>
        </div>
      ) : current ? (
        <div className="asset-card">
          {hasPreview ? <img className="asset-card-image" src={current} alt="" /> : <a className="asset-card-file" href={current} target="_blank" rel="noreferrer">{current}</a>}
          <div className="asset-card-actions">
            <button type="button" className="button button-secondary" onClick={() => setPickerOpen(true)}>Replace</button>
            <button type="button" className="button button-ghost" onClick={() => onChange('')}>Remove</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`asset-dropzone ${dragOver ? 'is-dragover' : ''}`}
          onClick={() => setPickerOpen(true)}
          onDragOver={event => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={event => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files?.[0];
            if (!file) {
              return;
            }
            // Match the picker's accept filter: image fields take images,
            // file fields take videos.
            const fits = kind === 'image' ? file.type.startsWith('image/') : file.type.startsWith('video/');
            if (!fits) {
              toast('That file type does not fit this field.', 'error');
              return;
            }
            upload(file);
          }}
        >
          <span className="asset-dropzone-title">{uploading ? 'Uploading…' : kind === 'image' ? 'Choose an image' : 'Choose a file'}</span>
          <span className="asset-dropzone-hint">Drop a file here, pick from the library, or upload new</span>
        </button>
      )}

      <button type="button" className="asset-path-toggle" onClick={() => setShowPath(open => !open)}>
        {showPath ? 'Hide file path' : 'Edit file path manually'}
      </button>
      {showPath ? <input className="input" value={current} onChange={event => onChange(event.target.value)} placeholder="/assets/media/example.jpg" /> : null}

      {pickerOpen ? (
        <MediaPicker kind={kind} onClose={() => setPickerOpen(false)} onSelect={path => { onChange(path); setPickerOpen(false); }} />
      ) : null}
    </FieldShell>
  );
}
