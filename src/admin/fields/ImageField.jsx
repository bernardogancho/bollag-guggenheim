import React, { useState } from 'react';
import { FieldShell } from './basics.jsx';
import { MediaPicker } from './MediaPicker.jsx';

const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

export function ImageField({ field, value, onChange, kind = 'image' }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPath, setShowPath] = useState(false);
  const current = String(value || '');
  const hasPreview = current && IMAGE_SHAPE.test(current);

  return (
    <FieldShell field={field}>
      {current ? (
        <div className="asset-card">
          {hasPreview ? <img className="asset-card-image" src={current} alt="" /> : <a className="asset-card-file" href={current} target="_blank" rel="noreferrer">{current}</a>}
          <div className="asset-card-actions">
            <button type="button" className="button button-secondary" onClick={() => setPickerOpen(true)}>Replace</button>
            <button type="button" className="button button-ghost" onClick={() => onChange('')}>Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="asset-dropzone" onClick={() => setPickerOpen(true)}>
          <span className="asset-dropzone-title">{kind === 'image' ? 'Choose an image' : 'Choose a file'}</span>
          <span className="asset-dropzone-hint">Pick from the media library or upload new</span>
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
