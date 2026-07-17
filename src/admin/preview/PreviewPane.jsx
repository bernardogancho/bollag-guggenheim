import React, { useCallback, useEffect, useRef, useState } from 'react';
import { readPreviewOpen, writePreviewOpen, locateAndHighlight } from './previewLogic.js';

// Level 2 preview: the real, PUBLISHED page rendered beside the edit form,
// scrolled to and outlining the section being edited. /admin/ and the site
// are the same origin, so the admin can reach into the iframe directly via
// iframe.contentDocument — no bridge script or postMessage required. The
// highlight <style> is injected by the admin into the iframe document at
// runtime, so it can never reach a real visitor.
//
// This pane only ever shows the published site. It never blocks editing:
// every iframe DOM access is wrapped in try/catch, and a missing marker, a
// failed load, or an unreachable contentDocument all just degrade to a
// "Preview unavailable" note rather than an error.
export function PreviewPane({ page, section }) {
  const [open, setOpen] = useState(() => readPreviewOpen(true));
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'unavailable'
  const iframeRef = useRef(null);
  const loadedUrlRef = useRef(null);

  const toggle = () => {
    setOpen(prev => {
      const next = !prev;
      writePreviewOpen(next);
      return next;
    });
  };

  const applyHighlight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }
    try {
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      const found = locateAndHighlight(doc, win, page.id, section.id);
      setStatus(found ? 'ready' : 'unavailable');
    } catch {
      // Cross-origin, a not-yet-navigated frame, or any other timing issue —
      // never let this reach React as an error.
      setStatus('unavailable');
    }
  }, [page.id, section.id]);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Switching between sections of the SAME page: the iframe is already
    // showing the right document, so just relocate + re-highlight instead of
    // waiting for a reload that will never come.
    if (loadedUrlRef.current === page.url) {
      applyHighlight();
    } else {
      setStatus('loading');
    }
  }, [open, page.url, section.id, applyHighlight]);

  const handleLoad = () => {
    loadedUrlRef.current = page.url;
    applyHighlight();
  };

  const handleError = () => setStatus('unavailable');

  if (!open) {
    return (
      <aside className="preview-pane preview-pane-collapsed">
        <button type="button" className="preview-pane-reopen" onClick={toggle} aria-label="Show page">
          <span aria-hidden="true">↔</span>
          <span className="preview-pane-reopen-label">Show page</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="preview-pane">
      <div className="preview-pane-head">
        <div className="preview-pane-head-copy">
          <p className="preview-pane-label">
            Live page — the published version. Your unsaved edits are not shown here.
          </p>
          <a className="preview-pane-link" href={page.url} target="_blank" rel="noreferrer">Open in new tab ↗</a>
        </div>
        <button type="button" className="button button-ghost preview-pane-toggle" onClick={toggle}>
          Hide page
        </button>
      </div>
      <div className="preview-pane-frame-wrap">
        {status === 'unavailable' ? <p className="preview-pane-note">Preview unavailable.</p> : null}
        <iframe
          ref={iframeRef}
          key={page.url}
          className="preview-pane-frame"
          src={page.url}
          title={`Live preview of ${page.label}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </aside>
  );
}
