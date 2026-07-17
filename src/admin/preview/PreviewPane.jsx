import React, { useCallback, useEffect, useRef, useState } from 'react';
import { readPreviewOpen, writePreviewOpen, locateAndHighlight, noTargetMessage } from './previewLogic.js';

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
export function PreviewPane({ page, section, previewUrl, previewTargets }) {
  const [open, setOpen] = useState(() => readPreviewOpen(true));
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'unavailable'
  const iframeRef = useRef(null);
  const loadedUrlRef = useRef(null);
  const retryFrameRef = useRef(null);

  // The item editors (BrandsScreen / WearhouseScreen, item mode) point the
  // pane at the specific brand's OWN page instead of the /brands/ or
  // /wearhouse/ listing page — see SectionScreen's computePreviewUrl. Falls
  // back to the section's normal page whenever no override is supplied.
  const effectiveUrl = previewUrl || page.url;
  const targetPageId = previewTargets?.pageId ?? page.id;
  const targetSectionId = previewTargets?.sectionId ?? section.id;

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
      const found = locateAndHighlight(doc, win, targetPageId, targetSectionId);
      setStatus(found ? 'ready' : 'unavailable');
    } catch {
      // Cross-origin, a not-yet-navigated frame, or any other timing issue —
      // never let this reach React as an error.
      setStatus('unavailable');
    }
  }, [targetPageId, targetSectionId]);

  // Locate/highlight can run before the target has finished laying out
  // (fonts, images, or reveal-triggered layout shifts land a frame late), so
  // every call is followed by exactly one retry on the next animation frame.
  // Cheap, and it's the difference between a flaky "Preview unavailable" and
  // a reliably found target.
  const applyHighlightWithRetry = useCallback(() => {
    applyHighlight();
    if (retryFrameRef.current) {
      cancelAnimationFrame(retryFrameRef.current);
    }
    try {
      retryFrameRef.current = requestAnimationFrame(() => applyHighlight());
    } catch {
      // requestAnimationFrame unavailable (e.g. some test environments) —
      // the immediate call above already ran, so just skip the retry.
    }
  }, [applyHighlight]);

  useEffect(() => () => {
    if (retryFrameRef.current) {
      cancelAnimationFrame(retryFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Switching between sections of the SAME page: the iframe is already
    // showing the right document, so just relocate + re-highlight instead of
    // waiting for a reload that will never come.
    if (loadedUrlRef.current === effectiveUrl) {
      applyHighlightWithRetry();
    } else {
      setStatus('loading');
    }
  }, [open, effectiveUrl, targetPageId, targetSectionId, applyHighlightWithRetry]);

  const handleLoad = () => {
    loadedUrlRef.current = effectiveUrl;
    applyHighlightWithRetry();
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
          <a className="preview-pane-link" href={effectiveUrl} target="_blank" rel="noreferrer">Open in new tab ↗</a>
        </div>
        <button type="button" className="button button-ghost preview-pane-toggle" onClick={toggle}>
          Hide page
        </button>
      </div>
      <div className="preview-pane-frame-wrap">
        {status === 'unavailable' ? <p className="preview-pane-note">{noTargetMessage(targetPageId, targetSectionId)}</p> : null}
        <iframe
          ref={iframeRef}
          key={effectiveUrl}
          className="preview-pane-frame"
          src={effectiveUrl}
          title={`Live preview of ${page.label}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </aside>
  );
}
