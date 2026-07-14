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

// Vercel serverless functions reject request bodies over ~4.5 MB and base64
// encoding adds ~33%, so the practical raw-file ceiling is ~3 MB.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export function useMediaUpload(onUploaded, successMessage = 'Uploaded. Use it in a section and publish to show it on the website.') {
  const { api, setMediaIndex } = useAdmin();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const upload = async file => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast('Files must be smaller than 3 MB. Compress it and try again.', 'error');
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
      toast(successMessage, 'success');
      onUploaded(result.publicPath);
    } catch (error) {
      toast(error.message || 'Could not upload the file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return { uploading, upload };
}

export function MediaPicker({ kind, onSelect, onClose }) {
  const { mediaIndex } = useAdmin();
  const [query, setQuery] = useState('');
  const fileInput = useRef(null);
  const { uploading, upload } = useMediaUpload(path => onSelect(path));

  const files = useMemo(() => {
    const all = mediaIndex?.files || [];
    const typed = kind === 'image' ? all.filter(file => IMAGE_SHAPE.test(file.path)) : all.filter(file => !IMAGE_SHAPE.test(file.path));
    const needle = query.trim().toLowerCase();
    return needle ? typed.filter(file => file.path.toLowerCase().includes(needle)) : typed;
  }, [mediaIndex, kind, query]);

  const handleUpload = event => {
    const file = event.target.files?.[0];
    if (file) {
      upload(file);
    }
    event.target.value = '';
  };

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker-modal" onClick={event => event.stopPropagation()}>
        <div className="picker-head">
          <input className="input" placeholder="Search files by name" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
          <button type="button" className="button button-primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload new'}
          </button>
          <input ref={fileInput} type="file" className="hidden-input" accept={kind === 'image' ? 'image/*' : 'video/*'} onChange={handleUpload} />
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
