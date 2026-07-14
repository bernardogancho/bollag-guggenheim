import React, { useEffect, useMemo, useState } from 'react';
import { useAdmin, useStoreVersion } from '../lib/context.js';
import { allSections } from '../manifest.js';
import { navigate } from '../lib/router.js';
import { validateValue } from '../lib/validate.js';
import { useToast } from './Toasts.jsx';

const timeAgo = iso => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

function sectionIsDirty(store, section) {
  if (section.joined) {
    return section.files.some(filePath => store.isDirty(filePath));
  }
  return section.keys.some(key => store.isKeyDirty(section.file, key));
}

export function ChangesTray() {
  const { store, fieldConfig, api } = useAdmin();
  useStoreVersion(store);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [publishPending, setPublishPending] = useState(false);
  const [deploys, setDeploys] = useState(null);
  const [revertPending, setRevertPending] = useState(false);

  const dirtyPaths = store.dirtyPaths();
  const rows = useMemo(() => allSections().filter(section => sectionIsDirty(store, section)), [store.getVersion(), dirtyPaths.length]);

  // Warn when leaving mid-publish or with unpublished changes.
  useEffect(() => {
    const handler = event => {
      if (publishPending || store.dirtyPaths().length) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [publishPending]);

  useEffect(() => {
    if (open) {
      api.deploys(3).then(payload => setDeploys(payload.deploys || [])).catch(() => setDeploys([]));
    }
  }, [open]);

  // Validate only what changed: for each dirty file, only its dirty top-level
  // keys. Issue crumbs use manifest page/section labels (editor language),
  // never config.yml's internal labels. (Inline in-form flags are deliberately
  // de-scoped for Phase 1 — the tray list is the single validation surface.)
  const issues = useMemo(() => {
    const found = [];
    for (const filePath of dirtyPaths) {
      const entry = fieldConfig.get(filePath);
      if (!entry) {
        continue;
      }
      for (const field of entry.fields) {
        if (!store.isKeyDirty(filePath, field.name)) {
          continue;
        }
        const owner = allSections().find(section => !section.joined && section.file === filePath && section.keys.includes(field.name));
        const crumb = owner ? `${owner.pageLabel} — ${owner.label}` : entry.label || filePath;
        found.push(...validateValue([field], store.getDraft(filePath), crumb));
      }
    }
    return found;
  }, [store.getVersion()]);

  const discardRow = section => {
    if (!window.confirm(`Discard unpublished changes to “${section.label}”?`)) {
      return;
    }
    if (section.joined) {
      section.files.forEach(filePath => store.discardFile(filePath));
    } else {
      store.discardKeys(section.file, section.keys);
    }
    toast('Changes discarded.');
  };

  const publish = async () => {
    setPublishPending(true);
    try {
      const paths = store.dirtyPaths();
      await api.publish(
        paths.map(path => ({ path, content: `${JSON.stringify(store.getDraft(path), null, 2)}\n` })),
        `Update CMS content (${paths.length} file${paths.length === 1 ? '' : 's'})`,
      );
      store.markPublished(paths);
      setConfirming(false);
      setOpen(false);
      toast('Published. The website updates in about a minute.', 'success');
    } catch (error) {
      toast(error.message || 'Could not publish.', 'error');
    } finally {
      setPublishPending(false);
    }
  };

  const revertLatest = async () => {
    const latest = deploys?.[0];
    if (!latest || !window.confirm(`Undo the last publish (${latest.message})? This creates a new rollback publish.`)) {
      return;
    }
    setRevertPending(true);
    try {
      await api.revert(latest.sha);
      // Do NOT reload content from /cms-data here: the currently deployed
      // build still serves the just-undone content until the rollback deploy
      // finishes (~1–2 min). Reloading now would silently re-arm the undone
      // changes as a clean baseline. The editor reloads the admin instead.
      toast('Last publish undone. Reload the admin in about a minute to see the restored content.', 'success');
      setOpen(false);
    } catch (error) {
      toast(error.message || 'Could not undo the last publish.', 'error');
    } finally {
      setRevertPending(false);
    }
  };

  return (
    <>
      <button type="button" className={`button ${rows.length ? 'button-primary' : 'button-secondary'}`} onClick={() => setOpen(true)}>
        Changes{rows.length ? ` (${rows.length})` : ''}
      </button>

      {open ? (
        <>
          <div className="tray-backdrop" onClick={() => setOpen(false)} />
          <aside className="tray-panel">
            <div className="tray-head">
              <h3 className="tray-title">Unpublished changes</h3>
              <button type="button" className="button button-ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="tray-body">
              {rows.length ? rows.map(section => (
                <div key={`${section.pageId}:${section.id}`} className="tray-row">
                  <div>
                    <div className="tray-row-title">{section.pageLabel} — {section.label}</div>
                    <div className="tray-row-sub">Saved for you; not yet on the website.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="button button-ghost" onClick={() => { setOpen(false); navigate('page', section.pageId, section.id); }}>Open</button>
                    <button type="button" className="button button-ghost" onClick={() => discardRow(section)}>Discard</button>
                  </div>
                </div>
              )) : (
                <div className="empty-state">
                  <div className="empty-state-title">Everything is published</div>
                  <div className="empty-state-description">Edits you make are listed here before they go live.</div>
                </div>
              )}
              {issues.length ? (
                <div className="issue-list">
                  <strong>Fix these before publishing:</strong>
                  {issues.map((issue, index) => (
                    <div key={index} className="issue-row"><strong>{issue.label}:</strong> {issue.message}</div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="tray-foot">
              {deploys?.length ? (
                <div className="field-help">Last published {timeAgo(deploys[0].date)} · {deploys[0].message}</div>
              ) : null}
              <button type="button" className="button button-primary" disabled={!rows.length || issues.length > 0 || publishPending} onClick={() => setConfirming(true)}>
                {publishPending ? 'Publishing…' : `Publish ${rows.length ? `${rows.length} change${rows.length === 1 ? '' : 's'}` : ''}`}
              </button>
              {deploys?.length ? (
                <button type="button" className="button button-ghost" disabled={revertPending} onClick={revertLatest}>
                  {revertPending ? 'Undoing…' : 'Undo last publish'}
                </button>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {confirming ? (
        <div className="publish-modal" role="presentation" onClick={() => setConfirming(false)}>
          <div className="publish-modal-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
            <div className="publish-modal-head">
              <div>
                <div className="publish-modal-kicker">Confirm publish</div>
                <h3 className="publish-modal-title">Put these changes on the website?</h3>
                <p className="publish-modal-copy">The website rebuilds and shows them in about a minute.</p>
              </div>
              <div className="publish-modal-counts">
                <div className="publish-modal-count">{rows.length} section{rows.length === 1 ? '' : 's'}</div>
              </div>
            </div>
            <div className="publish-modal-summary">
              {rows.map(section => (
                <span key={`${section.pageId}:${section.id}`} className="publish-modal-chip">{section.pageLabel} — {section.label}</span>
              ))}
            </div>
            <div className="publish-modal-actions">
              <button type="button" className="button button-ghost" onClick={() => setConfirming(false)} disabled={publishPending}>Cancel</button>
              <button type="button" className="button button-primary" onClick={publish} disabled={publishPending}>
                {publishPending ? 'Publishing…' : 'Publish to the website'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
