import React, { useMemo, useRef, useState } from 'react';
import { useAdmin } from '../lib/context.js';
import { useToast } from '../shell/Toasts.jsx';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

const IMAGE_SHAPE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

export function MediaPicker({ kind, onSelect, onClose }) {
  const { api, mediaIndex, setMediaIndex } = useAdmin();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const files = useMemo(() => {
    const all = mediaIndex?.files || [];
    const typed = kind === 'image' ? all.filter(file => IMAGE_SHAPE.test(file.path)) : all;
    const needle = query.trim().toLowerCase();
    return needle ? typed.filter(file => file.path.toLowerCase().includes(needle)) : typed;
  }, [mediaIndex, kind, query]);

  const handleUpload = async event => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const data = await readFileAsDataUrl(file);
      const result = await api.upload({ name: file.name, type: file.type, data });
      setMediaIndex(current => ({
        ...(current || { files: [] }),
        files: [{ path: result.publicPath, name: file.name, size: file.size }, ...(current?.files || [])],
      }));
      toast('Uploaded. It appears on the website after your next publish.', 'success');
      onSelect(result.publicPath);
    } catch (error) {
      toast(error.message || 'Could not upload the file.', 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker-modal" onClick={event => event.stopPropagation()}>
        <div className="picker-head">
          <input className="input" placeholder="Search files by name" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
          <button type="button" className="button button-primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload new'}
          </button>
          <input ref={fileInput} type="file" className="hidden-input" accept={kind === 'image' ? 'image/*' : '*'} onChange={handleUpload} />
        </div>
        <div className="picker-grid">
          {files.length ? files.map(file => (
            <button key={file.path} type="button" className="picker-cell" onClick={() => onSelect(file.path)}>
              {IMAGE_SHAPE.test(file.path) ? <img src={file.path} alt="" loading="lazy" /> : <div className="item-card-thumb"><span className="item-card-thumb-empty">{file.path.split('.').pop().toUpperCase()}</span></div>}
              <div className="picker-cell-name">{file.name || file.path.split('/').pop()}</div>
            </button>
          )) : (
            <div className="empty-state">
              <div className="empty-state-title">{mediaIndex ? 'No matching files' : 'Media list unavailable'}</div>
              <div className="empty-state-description">{mediaIndex ? 'Try another search, or upload a new file.' : 'You can still upload a new file.'}</div>
            </div>
          )}
        </div>
        <div className="picker-foot">
          <span className="field-help">{files.length} file{files.length === 1 ? '' : 's'}</span>
          <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
