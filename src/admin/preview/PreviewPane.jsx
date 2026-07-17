import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import {
  readPreviewOpen, writePreviewOpen, locateAndHighlight, noTargetMessage,
  patchAll, ensureBrokenImageStyle,
} from './previewLogic.js';

// Level 3 preview: the real, PUBLISHED page rendered beside the edit form,
// with unsaved edits patched directly into it as you type (see Commit 3 of
// docs/superpowers/plans/2026-07-14-cms-v2-phase1-site-mirror-admin.md,
// "Task 21"). /admin/ and the site are the same origin, so the admin can
// reach into the iframe directly via iframe.contentDocument — no bridge
// script, postMessage, or code added to the site itself. Both the highlight
// <style> and the live-patch writes happen entirely from here, into the
// admin's own iframe document at runtime.
//
// This pane never blocks editing: every iframe DOM access is wrapped in
// try/catch, and a missing marker, a failed load, or an unreachable
// contentDocument all just degrade to a "Preview unavailable" note (or,
// for live patching, silently skip that pass) rather than an error.
export function PreviewPane({ page, section, previewUrl, previewTargets, isManagedList }) {
  const { store } = useAdmin();
  const storeVersion = useStoreVersion(store);
  const [open, setOpen] = useState(() => readPreviewOpen(true));
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'unavailable'
  const iframeRef = useRef(null);
  const loadedUrlRef = useRef(null);
  const retryFrameRef = useRef(null);
  const patchFrameRef = useRef(null);

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

  // The live-patch pass: writes every [data-cms-bind] node's CURRENT draft
  // value into the iframe DOM. Independent of the highlight pass below (it
  // must run on every keystroke, not just on load/section-change) and never
  // touches scroll position, so typing never yanks the preview around.
  const applyPatch = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }
    try {
      const doc = iframe.contentDocument;
      if (!doc) {
        return;
      }
      ensureBrokenImageStyle(doc);
      patchAll(doc, store.getDraft);
    } catch {
      // Cross-origin, a not-yet-navigated frame, or any other timing issue —
      // live patching is a nicety layered on top of the plain published
      // page; a failure here must never block editing.
    }
  }, [store]);

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
  // a reliably found target. The patch pass rides along on both the
  // immediate call and the retry, since a freshly-loaded document needs its
  // unsaved edits applied too.
  const syncPreview = useCallback(() => {
    applyHighlight();
    applyPatch();
    if (retryFrameRef.current) {
      cancelAnimationFrame(retryFrameRef.current);
    }
    try {
      retryFrameRef.current = requestAnimationFrame(() => {
        applyHighlight();
        applyPatch();
      });
    } catch {
      // requestAnimationFrame unavailable (e.g. some test environments) —
      // the immediate calls above already ran, so just skip the retry.
    }
  }, [applyHighlight, applyPatch]);

  useEffect(() => () => {
    if (retryFrameRef.current) {
      cancelAnimationFrame(retryFrameRef.current);
    }
    if (patchFrameRef.current) {
      cancelAnimationFrame(patchFrameRef.current);
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
      syncPreview();
    } else {
      setStatus('loading');
    }
  }, [open, effectiveUrl, targetPageId, targetSectionId, syncPreview]);

  // Re-patch (but deliberately do NOT re-highlight/re-scroll) on every store
  // mutation — this is what makes typing show up live. React already commits
  // this effect once per keystroke (one per render), so we patch synchronously
  // here rather than deferring to requestAnimationFrame: rAF is throttled (and
  // in a background/offscreen tab may not fire at all), which would silently
  // stall the live preview. patchAll only rewrites the bound nodes' text/src,
  // which is cheap enough to run inline per keystroke.
  useEffect(() => {
    if (!open) {
      return;
    }
    applyPatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storeVersion is the trigger; applyPatch is stable per store.
  }, [storeVersion, open, applyPatch]);

  const handleLoad = () => {
    loadedUrlRef.current = effectiveUrl;
    syncPreview();
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
            Live preview — your unsaved edits show here. Publish to put them on the real site.
          </p>
          {isManagedList ? (
            <p className="preview-pane-subnote">
              Adding, removing, or reordering items appears after publishing.
            </p>
          ) : null}
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
