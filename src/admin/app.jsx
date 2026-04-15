import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { createClient } from '@supabase/supabase-js';
import { parse as parseYAML } from 'yaml';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  UserPlus,
  UserX,
} from 'lucide-react';
import './admin.css';

const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';
const LOGIN_REDIRECT = `${window.location.origin}/admin/`;
const OWNER_EMAIL = 'bernardogancho99@gmail.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

function deepClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isOwnerEmail(email) {
  return normalizeEmail(email) === OWNER_EMAIL;
}

function draftStorageKey(path) {
  return `bg-cms-draft:${path}`;
}

function isImagePath(value) {
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(String(value || ''));
}

function resolveTemplate(template, value) {
  if (!template) {
    return '';
  }

  return template.replace(/\{\{\s*fields\.([a-zA-Z0-9_-]+)\s*\}\}/g, (_, key) => {
    const resolved = value && typeof value === 'object' ? value[key] : '';
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
}

function defaultValueForField(field) {
  const widget = field?.widget || 'string';

  if (widget === 'object') {
    const result = {};
    for (const child of field.fields || []) {
      result[child.name] = defaultValueForField(child);
    }
    return result;
  }

  if (widget === 'list') {
    return [];
  }

  if (widget === 'select') {
    const first = Array.isArray(field.options) && field.options.length ? field.options[0] : '';
    return typeof first === 'object' && first !== null ? first.value ?? first.label ?? '' : first;
  }

  if (widget === 'number') {
    return 0;
  }

  if (widget === 'boolean') {
    return false;
  }

  return '';
}

function reorderArray(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) {
    return list.slice();
  }

  const next = list.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function flattenManifest(config) {
  const collections = [];

  for (const collection of config.collections || []) {
    const files = (collection.files || []).map(file => ({
      collectionName: collection.name,
      collectionLabel: collection.label || collection.name,
      collectionPreview: collection.editor?.preview !== false,
      fileName: file.name,
      fileLabel: file.label || file.name,
      path: normalizePath(file.file),
      fields: file.fields || [],
      format: file.format || 'json',
    }));

    collections.push({
      name: collection.name,
      label: collection.label || collection.name,
      files,
    });
  }

  return collections;
}

function previewValue(value) {
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).slice(0, 2);
    if (!entries.length) {
      return 'Object';
    }
    return entries
      .map(([key, next]) => `${key}: ${previewValue(next)}`)
      .join(' · ');
  }

  const text = String(value ?? '').trim();
  return text || 'Empty';
}

function summarizeObject(field, value) {
  const current = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const parts = [];

  for (const child of field.fields || []) {
    const next = current[child.name];
    if (next === undefined || next === null || String(next).trim() === '') {
      continue;
    }

    const label = child.label || child.name;
    parts.push(`${label}: ${previewValue(next)}`);

    if (parts.length >= 2) {
      break;
    }
  }

  return parts.join(' · ') || 'Edit this group';
}

function summarizeListItem(field, item, index) {
  if (field.summary) {
    const summary = resolveTemplate(field.summary, item);
    if (summary) {
      return summary;
    }
  }

  if (field.fields) {
    return summarizeObject({ fields: field.fields }, item);
  }

  if (field.field) {
    return previewValue(item);
  }

  return `${field.label || field.name} ${index + 1}`;
}

function formatTimestamp(value) {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load ${path} (${response.status}).`);
  }
  return response.text();
}

async function loadManifest() {
  const raw = await fetchText('/admin/config.yml');
  return parseYAML(raw);
}

async function loadCmsFile(path) {
  const relativePath = normalizePath(path).replace(/^src\/_data\/cms\//, '');
  const response = await fetch(`/cms-data/${relativePath}`);
  if (!response.ok) {
    throw new Error(`Unable to load ${path} from site data (${response.status}).`);
  }

  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

function readLocalDraft(path) {
  const raw = window.localStorage.getItem(draftStorageKey(path));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocalDraft(path, value) {
  window.localStorage.setItem(draftStorageKey(path), JSON.stringify(value));
}

function clearLocalDraft(path) {
  window.localStorage.removeItem(draftStorageKey(path));
}

function Button({ className, variant = 'secondary', iconLeft, iconRight, children, ...props }) {
  return (
    <button className={cn('button', `button-${variant}`, className)} {...props}>
      {iconLeft ? <span className="button-icon">{iconLeft}</span> : null}
      <span>{children}</span>
      {iconRight ? <span className="button-icon">{iconRight}</span> : null}
    </button>
  );
}

function IconButton({ className, variant = 'ghost', title, ...props }) {
  return <button aria-label={title} title={title} className={cn('icon-button', `icon-button-${variant}`, className)} {...props} />;
}

function Input(props) {
  return <input className={cn('input', props.className)} {...props} />;
}

function Textarea(props) {
  return <textarea className={cn('textarea', props.className)} {...props} />;
}

function Select(props) {
  return <select className={cn('select', props.className)} {...props} />;
}

function Badge({ tone = 'neutral', children }) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>;
}

function Card({ className, children }) {
  return <section className={cn('card', className)}>{children}</section>;
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-description">{description}</div>
    </div>
  );
}

function BootScreen({ label = 'Loading admin' }) {
  return (
    <div className="boot-shell">
      <Card className="boot-card">
        <div className="boot-kicker">Bollag CMS</div>
        <h1 className="boot-title">{label}</h1>
        <div className="boot-copy">Preparing the editor and loading the current site content.</div>
        <div className="boot-loader">
          <LoaderCircle className="spinner" size={18} />
          <span>Working</span>
        </div>
      </Card>
    </div>
  );
}

function LoginScreen({ email, onEmailChange, onSubmit, pending, note, tone }) {
  return (
    <div className="auth-shell">
      <Card className="auth-card">
        <div className="auth-kicker">Admin access</div>
        <h1 className="auth-title">Bollag CMS</h1>
        <p className="auth-copy">Sign in with an approved email to edit sections, reorder items, and publish changes.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Email address</span>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => onEmailChange(event.target.value)}
              placeholder="bernardogancho99@gmail.com"
              required
            />
          </label>

          <Button type="submit" variant="primary" disabled={pending} iconLeft={pending ? <LoaderCircle className="spinner" size={16} /> : <Shield size={16} />}>
            {pending ? 'Sending link' : 'Send magic link'}
          </Button>
        </form>

        <div className={cn('status-line', note && `status-${tone || 'neutral'}`)}>{note || 'The editor publishes after Supabase login.'}</div>
      </Card>
    </div>
  );
}

function AppShell({
  user,
  search,
  onSearchChange,
  collections,
  currentPath,
  dirtyPaths,
  onSelectFile,
  onPublish,
  onDiscardChanges,
  onSignOut,
  publishPending,
  workspaceNote,
  workspaceTone,
  deploys,
  deploysLoading,
  deploysError,
  onRefreshDeploys,
  onRevertDeploy,
  revertPendingSha,
  files,
  drafts,
  onDraftChange,
  onUploadAsset,
  admins,
  adminsLoading,
  adminsError,
  onRefreshAdmins,
  onInviteAdmin,
  onRevokeAdmin,
  adminActionPendingEmail,
}) {
  const [activeView, setActiveView] = useState('sections');
  const currentFile = files.find(file => file.path === currentPath) || null;
  const currentDraft = currentPath ? drafts.get(currentPath) : null;
  const dirtyCount = dirtyPaths.size;
  const latestDeploy = deploys[0] || null;
  const isOwner = isOwnerEmail(user?.email);
  const filesByPath = useMemo(() => new Map(files.map(file => [file.path, file])), [files]);
  const latestDeployCollectionLabels = useMemo(() => {
    const labels = [];
    const seen = new Set();

    for (const file of latestDeploy?.files || []) {
      const currentFileMeta = filesByPath.get(file.path);
      const label = currentFileMeta?.collectionLabel || file.path.replace(/^src\/_data\/cms\//, '').split('/')[0] || 'Unknown';
      if (seen.has(label)) {
        continue;
      }
      seen.add(label);
      labels.push(label);
    }

    return labels;
  }, [latestDeploy, filesByPath]);

  const visibleCollections = useMemo(() => {
    const query = search.trim().toLowerCase();

    return collections
      .map(collection => {
        const filteredFiles = collection.files.filter(file => {
          if (!query) {
            return true;
          }

          return [collection.label, file.fileLabel, file.path].some(value => value.toLowerCase().includes(query));
        });

        return {
          ...collection,
          files: filteredFiles,
        };
      })
      .filter(collection => collection.files.length > 0);
  }, [collections, search]);

  const workspaceStatusText =
    activeView === 'access' && !workspaceTone && /^Loaded \d+ section/.test(workspaceNote)
      ? 'Invite editors from the panel below. Access is managed in Supabase Auth.'
      : workspaceNote || 'Drafts autosave locally until you publish.';

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div>
            <div className="sidebar-kicker">Bollag CMS</div>
            <h1 className="sidebar-title">Sections</h1>
            <div className="sidebar-user">{user?.email}</div>
          </div>

          <label className="sidebar-search">
            <Search size={16} />
            <Input value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Search sections" />
          </label>
        </div>

        <div className="sidebar-nav">
          <button
            type="button"
            className={cn('sidebar-nav-item', activeView === 'sections' && 'is-active')}
            onClick={() => setActiveView('sections')}
          >
            <span className="sidebar-nav-label">Sections</span>
            <span className="sidebar-nav-count">{collections.length}</span>
          </button>
          <button
            type="button"
            className={cn('sidebar-nav-item', 'sidebar-nav-admin', activeView === 'access' && 'is-active')}
            onClick={() => setActiveView('access')}
          >
            <span className="sidebar-nav-label">Admin</span>
            <span className="sidebar-nav-count">{admins.length}</span>
          </button>
        </div>

        <div className="sidebar-note sidebar-note-compact">
          <div className="sidebar-note-label">Change log</div>
          {deploysLoading ? (
            <div className="sidebar-note-value">Loading publish history...</div>
          ) : deploysError ? (
            <>
              <div className="sidebar-note-value">Publish history unavailable</div>
              <div className="sidebar-note-detail">{deploysError}</div>
            </>
          ) : latestDeploy ? (
            <>
              <div className="sidebar-note-value">
                {latestDeployCollectionLabels.length
                  ? `Last publish changed ${latestDeployCollectionLabels.length} collection${latestDeployCollectionLabels.length === 1 ? '' : 's'}`
                  : 'Last publish details available'}
              </div>
              {latestDeployCollectionLabels.length ? (
                <div className="sidebar-note-list">
                  {latestDeployCollectionLabels.slice(0, 6).map(label => (
                    <span key={label} className="sidebar-note-chip">
                      {label}
                    </span>
                  ))}
                  {latestDeployCollectionLabels.length > 6 ? (
                    <span className="sidebar-note-chip">+{latestDeployCollectionLabels.length - 6} more</span>
                  ) : null}
                </div>
              ) : null}
              <div className="sidebar-note-actions">
                <Button
                  type="button"
                  variant="secondary"
                  iconLeft={revertPendingSha === latestDeploy?.sha ? <LoaderCircle className="spinner" size={14} /> : <RotateCcw size={14} />}
                  onClick={() => latestDeploy && onRevertDeploy(latestDeploy.sha)}
                  disabled={!latestDeploy || Boolean(revertPendingSha) || deploysLoading}
                >
                  {revertPendingSha === latestDeploy?.sha ? 'Reverting latest' : 'Revert latest'}
                </Button>
                <Button type="button" variant="ghost" iconLeft={<RefreshCw size={14} />} onClick={onRefreshDeploys} disabled={deploysLoading}>
                  Refresh history
                </Button>
              </div>
            </>
          ) : (
              <div className="sidebar-note-value">No publishes yet.</div>
          )}
        </div>

        {activeView === 'sections' ? (
          <>
            <div className="sidebar-note">Each file is one section. Expand only what you need, then publish.</div>

            <div className="collection-list">
              {visibleCollections.length ? (
                visibleCollections.map(collection => (
                  <CollectionGroup
                    key={collection.name}
                    collection={collection}
                    currentPath={currentPath}
                    dirtyPaths={dirtyPaths}
                    onSelectFile={onSelectFile}
                  />
                ))
              ) : (
                <EmptyState title="No matching sections" description="Try a different search term or clear the filter." />
              )}
            </div>
          </>
        ) : (
          <div className="sidebar-note sidebar-note-compact">
            <div className="sidebar-note-label">Admin</div>
            <div className="sidebar-note-value">Manage editor access from the left menu.</div>
            <div className="sidebar-note-detail">Use this when you need to invite, revoke, or review CMS access.</div>
          </div>
        )}
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <div className="workspace-kicker">{activeView === 'sections' ? 'Now editing' : 'Access control'}</div>
            <h2 className="workspace-title">{activeView === 'sections' ? currentFile?.fileLabel || 'Choose a section' : 'Admin access'}</h2>
            <div className="workspace-subtitle">
              {activeView === 'sections'
                ? currentFile
                  ? `${currentFile.collectionLabel} · ${currentFile.fileLabel}`
                  : 'Select a section from the sidebar.'
                : 'Invite editors and revoke access without touching GitHub or Vercel.'}
            </div>
          </div>

          <div className="workspace-actions">
            <Badge tone={dirtyCount ? 'warning' : 'neutral'}>
              {activeView === 'sections'
                ? dirtyCount
                  ? `${dirtyCount} unsaved`
                  : 'No changes'
                : `${admins.length} account${admins.length === 1 ? '' : 's'}`}
            </Badge>
            <Button type="button" variant="ghost" onClick={onSignOut} iconLeft={<LogOut size={16} />}>
              Sign out
            </Button>
          </div>
        </header>

        <div className={cn('workspace-note', `status-${workspaceTone || 'neutral'}`)}>{workspaceStatusText}</div>

        {activeView === 'sections' ? (
          <div className="editor-canvas">
            {!currentFile || !currentDraft ? (
              <EmptyState title="Pick a section" description="The current section will appear here once you select one from the sidebar." />
            ) : (
              <div className="editor-stack">
                <div className="editor-toolbar">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onDiscardChanges}
                    disabled={!currentPath || !dirtyPaths.has(currentPath)}
                    iconLeft={<Trash2 size={16} />}
                  >
                    Discard changes
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={onPublish}
                    disabled={publishPending || dirtyCount === 0}
                    iconLeft={publishPending ? <LoaderCircle className="spinner" size={16} /> : <Upload size={16} />}
                  >
                    {publishPending ? 'Publishing' : 'Publish changes'}
                  </Button>
                </div>

                {currentFile.fields.map(field => (
                  <FieldRenderer
                    key={field.name}
                    field={field}
                    value={currentDraft[field.name]}
                    onChange={nextValue => onDraftChange(currentPath, field.name, nextValue)}
                    uploadAsset={onUploadAsset}
                    depth={0}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <AccessPanel
            admins={admins}
            loading={adminsLoading}
            error={adminsError}
            onRefresh={onRefreshAdmins}
            onInvite={onInviteAdmin}
            onRevoke={onRevokeAdmin}
            pendingEmail={adminActionPendingEmail}
            isOwner={isOwner}
            currentUserEmail={user?.email}
          />
        )}
      </main>
    </div>
  );
}

function AccessPanel({
  admins,
  loading,
  error,
  onRefresh,
  onInvite,
  onRevoke,
  pendingEmail,
  isOwner,
  currentUserEmail,
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeAdmins = admins.filter(admin => admin.active);
  const disabledAdmins = admins.filter(admin => !admin.active);

  const handleSubmit = async event => {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await onInvite({ email: email.trim(), name: name.trim() });
      setEmail('');
      setName('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="access-canvas">
      <Card className="access-panel">
        <div className="access-panel-head">
          <div>
            <div className="panel-label">Editor invites</div>
            <div className="panel-meta">Add people here to give them CMS access. They receive a Supabase login link.</div>
          </div>

          <div className="access-panel-actions">
            <Button type="button" variant="ghost" iconLeft={<RefreshCw size={14} />} onClick={onRefresh} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <form className="access-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Email address</span>
            <Input value={email} onChange={event => setEmail(event.target.value)} placeholder="person@company.com" autoComplete="email" disabled={!isOwner} />
          </label>

          <label className="field">
            <span className="field-label">Name</span>
            <Input value={name} onChange={event => setName(event.target.value)} placeholder="Optional display name" disabled={!isOwner} />
          </label>

          <Button
            type="submit"
            variant="primary"
            disabled={!isOwner || submitting || !email.trim()}
            iconLeft={submitting || pendingEmail ? <LoaderCircle className="spinner" size={16} /> : <UserPlus size={16} />}
          >
            {submitting || pendingEmail ? 'Saving access' : 'Invite editor'}
          </Button>
        </form>

        {!isOwner ? (
          <div className="access-note">Only the owner can add or remove editor access.</div>
        ) : null}

        <div className="access-roster">
          {loading ? (
            <div className="access-empty">Loading access list...</div>
          ) : error ? (
            <div className="access-empty">
              <div className="empty-state-title">Access list unavailable</div>
              <div className="empty-state-description">{error}</div>
            </div>
          ) : (
            <>
              <div className="access-roster-head">
                <div className="access-roster-title">Current access</div>
                <div className="access-roster-count">{activeAdmins.length} active, {disabledAdmins.length} disabled</div>
              </div>

              <div className="access-list">
                {admins.length ? (
                  admins.map(admin => (
                    <div className="access-row" key={admin.id || admin.email}>
                      <div className="access-row-main">
                        <div className="access-row-top">
                          <div className="access-row-email">{admin.email}</div>
                          <Badge tone={admin.role === 'owner' ? 'neutral' : admin.active ? 'warning' : 'danger'}>
                            {admin.role === 'owner' ? 'Owner' : admin.active ? 'Editor' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="access-row-subtitle">
                          {admin.name || 'No display name'}
                          {admin.email === normalizeEmail(currentUserEmail) ? ' · you' : ''}
                        </div>
                        <div className="access-row-meta">
                          {admin.lastSignInAt ? `Last sign in ${formatTimestamp(admin.lastSignInAt)}` : 'Never signed in'}
                          {admin.invitedAt ? ` · Invited ${formatTimestamp(admin.invitedAt)}` : ''}
                        </div>
                      </div>

                      <div className="access-row-actions">
                        {admin.role === 'owner' ? (
                          <Badge tone="neutral">Protected</Badge>
                        ) : admin.active ? (
                          <Button
                            type="button"
                            variant="ghost"
                            iconLeft={pendingEmail === admin.email ? <LoaderCircle className="spinner" size={14} /> : <UserX size={14} />}
                            onClick={() => onRevoke(admin.email)}
                            disabled={!isOwner || pendingEmail === admin.email}
                          >
                            {pendingEmail === admin.email ? 'Updating' : 'Revoke'}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            iconLeft={pendingEmail === admin.email ? <LoaderCircle className="spinner" size={14} /> : <UserPlus size={14} />}
                            onClick={() => onInvite({ email: admin.email, name: admin.name })}
                            disabled={!isOwner || pendingEmail === admin.email}
                          >
                            {pendingEmail === admin.email ? 'Updating' : 'Restore'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="access-empty">
                    <div className="empty-state-title">No editors yet</div>
                    <div className="empty-state-description">Invite the first editor from this panel.</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function CollectionGroup({ collection, currentPath, dirtyPaths, onSelectFile }) {
  const active = collection.files.some(file => file.path === currentPath);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) {
      setOpen(true);
    }
  }, [active]);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <div className="collection-card">
        <Collapsible.Trigger asChild>
          <button className="collection-trigger" type="button">
            <span className="collection-trigger-left">
              <span className="collection-chevron">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              <span className="collection-label">{collection.label}</span>
            </span>
            <span className="collection-count">{collection.files.length}</span>
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="collection-content">
          <div className="file-list">
            {collection.files.map(file => (
              <button
                key={file.path}
                type="button"
                className={cn('file-row', file.path === currentPath && 'is-active')}
                onClick={() => onSelectFile(file.path)}
              >
                <span className="file-row-main">
                  <span className="file-row-title">{file.fileLabel}</span>
                  <span className="file-row-subtitle">{file.collectionLabel} section</span>
                </span>
                <span className="file-row-meta">
                  <span className={cn('dirty-dot', dirtyPaths.has(file.path) && 'is-dirty')} />
                </span>
              </button>
            ))}
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible.Root>
  );
}

function FieldRenderer({ field, value, onChange, uploadAsset, depth }) {
  const widget = field.widget || 'string';

  if (widget === 'object') {
    return (
      <ObjectField
        field={field}
        value={value}
        onChange={onChange}
        uploadAsset={uploadAsset}
        depth={depth}
      />
    );
  }

  if (widget === 'list') {
    return <ListField field={field} value={value} onChange={onChange} uploadAsset={uploadAsset} depth={depth} />;
  }

  if (widget === 'image' || widget === 'file') {
    return <AssetField field={field} value={value} onChange={onChange} uploadAsset={uploadAsset} kind={widget} />;
  }

  if (widget === 'select') {
    return <SelectField field={field} value={value} onChange={onChange} />;
  }

  if (widget === 'text') {
    return <TextField field={field} value={value} onChange={onChange} />;
  }

  if (widget === 'boolean') {
    return <BooleanField field={field} value={value} onChange={onChange} />;
  }

  return <InputField field={field} value={value} onChange={onChange} widget={widget} />;
}

function FieldFrame({ field, children, summary, depth = 0, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const label = field.label || field.name;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Card className={cn('field-card', depth > 0 && 'field-card-nested')}>
        <Collapsible.Trigger asChild>
          <button className="field-header" type="button">
            <span className="field-header-main">
              <span className="field-header-chevron">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
              <span>
                <span className="field-title">{label}</span>
                <span className="field-summary">{summary}</span>
              </span>
            </span>
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content className="field-content">
          <div className="field-body">{children}</div>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  );
}

function ObjectField({ field, value, onChange, uploadAsset, depth }) {
  const current = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return (
    <FieldFrame field={field} summary={summarizeObject(field, current)} depth={depth} defaultOpen={depth < 1}>
      <div className="field-grid">
        {(field.fields || []).map(child => (
          <FieldRenderer
            key={child.name}
            field={child}
            value={current[child.name]}
            onChange={nextValue => {
              const next = deepClone(current);
              next[child.name] = nextValue;
              onChange(next);
            }}
            uploadAsset={uploadAsset}
            depth={depth + 1}
          />
        ))}
      </div>
    </FieldFrame>
  );
}

function ListField({ field, value, onChange, uploadAsset, depth }) {
  const current = Array.isArray(value) ? value : [];
  const [dropIndex, setDropIndex] = useState(null);

  const addItem = () => {
    const next = current.slice();
    if (field.fields) {
      const item = {};
      for (const child of field.fields) {
        item[child.name] = defaultValueForField(child);
      }
      next.push(item);
    } else if (field.field) {
      next.push(defaultValueForField(field.field));
    } else {
      next.push('');
    }
    onChange(next);
  };

  const updateItem = (index, nextItem) => {
    const next = current.slice();
    next[index] = nextItem;
    onChange(next);
  };

  const moveItem = (fromIndex, toIndex) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
      return;
    }
    onChange(reorderArray(current, fromIndex, toIndex));
  };

  const duplicateItem = index => {
    const next = current.slice();
    next.splice(index + 1, 0, deepClone(current[index]));
    onChange(next);
  };

  const removeItem = index => {
    const next = current.slice();
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <FieldFrame field={field} summary={`${current.length} item${current.length === 1 ? '' : 's'}`} depth={depth} defaultOpen={depth < 1}>
      <div className="list-panel">
        <div className="list-panel-head">
          <div>
            <div className="panel-label">{field.label || field.name}</div>
            <div className="panel-meta">Drag the handle to reorder. Use the chevron to expand an item.</div>
          </div>
          <Button type="button" variant="secondary" iconLeft={<Plus size={16} />} onClick={addItem}>
            Add item
          </Button>
        </div>

        <div className="list-items">
          {current.length ? (
            current.map((item, index) => (
              <ListItemEditor
                key={`${field.name}-${index}`}
                field={field}
                item={item}
                index={index}
                total={current.length}
                isDropTarget={dropIndex === index}
                onDropIndexChange={setDropIndex}
                onMove={moveItem}
                onDuplicate={duplicateItem}
                onRemove={removeItem}
                onUpdate={nextItem => updateItem(index, nextItem)}
                uploadAsset={uploadAsset}
              />
            ))
          ) : (
            <div className="list-empty">No items yet. Add one to start editing this section.</div>
          )}
        </div>
      </div>
    </FieldFrame>
  );
}

function ListItemEditor({
  field,
  item,
  index,
  total,
  isDropTarget,
  onDropIndexChange,
  onMove,
  onDuplicate,
  onRemove,
  onUpdate,
  uploadAsset,
}) {
  const [open, setOpen] = useState(false);
  const isObjectItem = Boolean(field.fields);
  const summary = summarizeListItem(field, item, index);

  const handleDragStart = event => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragEnd = () => {
    onDropIndexChange(null);
  };

  const handleDragOver = event => {
    event.preventDefault();
    if (index !== null) {
      onDropIndexChange(index);
    }
  };

  const handleDrop = event => {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer.getData('text/plain'));
    if (Number.isNaN(sourceIndex) || sourceIndex === index) {
      onDropIndexChange(null);
      return;
    }
    onMove(sourceIndex, index);
    onDropIndexChange(null);
  };

  const updateObjectItem = (childName, nextValue) => {
    const next = isObjectItem && item && typeof item === 'object' && !Array.isArray(item) ? deepClone(item) : {};
    next[childName] = nextValue;
    onUpdate(next);
  };

  const updateScalarItem = nextValue => {
    onUpdate(nextValue);
  };

  return (
    <div
      className={cn('list-item', isDropTarget && 'is-drop-target')}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="list-item-head">
        <button
          type="button"
          className="drag-handle"
          draggable
          aria-label="Drag to reorder"
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <GripVertical size={16} />
        </button>

        <button type="button" className="list-item-toggle" onClick={() => setOpen(next => !next)} aria-expanded={open}>
          <span className={cn('list-item-toggle-icon', open && 'is-open')}>
            <ChevronRight size={14} />
          </span>
          <span className="list-item-toggle-copy">
            <span className="list-item-title">{summary}</span>
            <span className="list-item-subtitle">
              Item {index + 1} of {total}
            </span>
          </span>
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton title="Item actions" className="list-item-menu">
              <MoreHorizontal size={16} />
            </IconButton>
          </DropdownMenu.Trigger>

          <DropdownMenu.Content className="menu-content" sideOffset={6} align="end">
            <DropdownMenu.Item className="menu-item" onSelect={() => setOpen(true)}>
              <ChevronDown size={14} />
              Open
            </DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={() => setOpen(false)}>
              <ChevronRight size={14} />
              Close
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="menu-separator" />
            <DropdownMenu.Item className="menu-item" onSelect={() => onMove(index, Math.max(0, index - 1))} disabled={index === 0}>
              Move up
            </DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={() => onMove(index, Math.min(total - 1, index + 1))} disabled={index === total - 1}>
              Move down
            </DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={() => onDuplicate(index)}>
              <Copy size={14} />
              Duplicate
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="menu-separator" />
            <DropdownMenu.Item className="menu-item is-danger" onSelect={() => onRemove(index)}>
              <Trash2 size={14} />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Content className="list-item-content">
          <div className="list-item-body">
            {isObjectItem && field.fields ? (
              <div className="field-grid">
                {field.fields.map(child => (
                  <FieldRenderer
                    key={child.name}
                    field={child}
                    value={item && typeof item === 'object' && !Array.isArray(item) ? item[child.name] : undefined}
                    onChange={nextValue => updateObjectItem(child.name, nextValue)}
                    uploadAsset={uploadAsset}
                    depth={2}
                  />
                ))}
              </div>
            ) : field.field ? (
              <FieldRenderer field={field.field} value={item} onChange={updateScalarItem} uploadAsset={uploadAsset} depth={2} />
            ) : null}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}

function AssetField({ field, value, onChange, uploadAsset, kind }) {
  const [uploading, setUploading] = useState(false);
  const current = String(value || '');

  const handlePickFile = async event => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadAsset(file);
      onChange(uploaded.publicPath);
    } catch (error) {
      window.alert(error.message || 'Could not upload file.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const clearAsset = () => onChange('');

  return (
    <div className="field-stack">
      <label className="field-label">{field.label || field.name}</label>
      {field.description ? <div className="field-help">{field.description}</div> : null}

      <div className="asset-row">
        <Input
          value={current}
          onChange={event => onChange(event.target.value)}
          placeholder={kind === 'image' ? '/assets/media/example.jpg' : '/assets/media/example.mp4'}
        />

        <div className="asset-actions">
          <label className="button button-secondary asset-upload">
            <Upload size={16} />
            <span>{uploading ? 'Uploading' : 'Upload'}</span>
            <input type="file" className="hidden-input" accept={kind === 'image' ? 'image/*' : '*'} onChange={handlePickFile} />
          </label>
          <Button type="button" variant="ghost" onClick={clearAsset} disabled={!current}>
            Clear
          </Button>
        </div>
      </div>

      {current ? (
        <div className="asset-preview">
          {kind === 'image' && isImagePath(current) ? <img src={current} alt={field.label || field.name} /> : null}
          <a href={current} target="_blank" rel="noreferrer">
            {current}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function SelectField({ field, value, onChange }) {
  const options = Array.isArray(field.options) ? field.options : [];
  const current = value === undefined || value === null ? defaultValueForField(field) : value;

  return (
    <div className="field-stack">
      <label className="field-label">{field.label || field.name}</label>
      {field.description ? <div className="field-help">{field.description}</div> : null}
      <Select value={current} onChange={event => onChange(event.target.value)}>
        {options.map(option => {
          const optionValue = typeof option === 'object' && option !== null ? option.value ?? option.label ?? '' : option;
          const optionLabel = typeof option === 'object' && option !== null ? option.label ?? option.value ?? optionValue : option;
          return (
            <option key={String(optionValue)} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </Select>
    </div>
  );
}

function TextField({ field, value, onChange }) {
  return (
    <div className="field-stack">
      <label className="field-label">{field.label || field.name}</label>
      {field.description ? <div className="field-help">{field.description}</div> : null}
      <Textarea value={value || ''} rows={5} onChange={event => onChange(event.target.value)} />
    </div>
  );
}

function BooleanField({ field, value, onChange }) {
  return (
    <label className="field-check">
      <input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} />
      <span>
        <span className="field-label">{field.label || field.name}</span>
        {field.description ? <span className="field-help">{field.description}</span> : null}
      </span>
    </label>
  );
}

function InputField({ field, value, onChange, widget }) {
  const type = widget === 'number' ? 'number' : 'text';

  return (
    <div className="field-stack">
      <label className="field-label">{field.label || field.name}</label>
      {field.description ? <div className="field-help">{field.description}</div> : null}
      <Input type={type} value={value ?? ''} onChange={event => onChange(type === 'number' ? Number(event.target.value) : event.target.value)} />
    </div>
  );
}

function useCmsBootstrap() {
  const [mode, setMode] = useState('boot');
  const [authNote, setAuthNote] = useState({ text: '', tone: '' });
  const [workspaceNote, setWorkspaceNote] = useState('Loading content...');
  const [workspaceTone, setWorkspaceTone] = useState('');
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [collections, setCollections] = useState([]);
  const [files, setFiles] = useState([]);
  const [drafts, setDrafts] = useState(() => new Map());
  const [dirtyPaths, setDirtyPaths] = useState(() => new Set());
  const [currentPath, setCurrentPath] = useState(null);
  const [search, setSearch] = useState('');
  const [publishPending, setPublishPending] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [deploys, setDeploys] = useState([]);
  const [deploysLoading, setDeploysLoading] = useState(false);
  const [deploysError, setDeploysError] = useState('');
  const [revertPendingSha, setRevertPendingSha] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsError, setAdminsError] = useState('');
  const [adminActionPendingEmail, setAdminActionPendingEmail] = useState('');

  const resetWorkspace = () => {
    setCollections([]);
    setFiles([]);
    setDrafts(new Map());
    setDirtyPaths(new Set());
    setCurrentPath(null);
    setSearch('');
    setPublishPending(false);
    setLoadingContent(false);
    setDeploys([]);
    setDeploysLoading(false);
    setDeploysError('');
    setRevertPendingSha(null);
    setAdmins([]);
    setAdminsLoading(false);
    setAdminsError('');
    setAdminActionPendingEmail('');
    setWorkspaceTone('');
    setWorkspaceNote('Loading content...');
  };

  const loadAdmins = async nextSession => {
    const token = nextSession?.access_token;
    if (!token) {
      setAdmins([]);
      setAdminsError('');
      return [];
    }

    setAdminsLoading(true);
    setAdminsError('');

    try {
      const response = await fetch('/api/admin/admins', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || `Could not load CMS access list (${response.status}).`);
      }

      const nextAdmins = Array.isArray(payload.admins) ? payload.admins : [];
      setAdmins(nextAdmins);
      return nextAdmins;
    } catch (error) {
      setAdmins([]);
      setAdminsError(error.message || 'Could not load CMS access list.');
      return [];
    } finally {
      setAdminsLoading(false);
    }
  };

  const loadDeploys = async nextSession => {
    const token = nextSession?.access_token;
    if (!token) {
      setDeploys([]);
      setDeploysError('');
      return;
    }

    setDeploysLoading(true);
    setDeploysError('');

    try {
      const response = await fetch('/api/deploys?limit=6', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || `Could not load deploy history (${response.status}).`);
      }

      setDeploys(Array.isArray(payload.deploys) ? payload.deploys : []);
    } catch (error) {
      setDeploys([]);
      setDeploysError(error.message || 'Could not load deploy history.');
    } finally {
      setDeploysLoading(false);
    }
  };

  const loadWorkspace = async (nextSession, options = {}) => {
    const preferredPath = options.preferredPath || null;
    setMode('boot');
    setLoadingContent(true);
    setWorkspaceTone('');
    setWorkspaceNote('Loading content...');

    try {
      const manifest = await loadManifest();
      const manifestCollections = flattenManifest(manifest);
      const fileEntries = manifestCollections.flatMap(collection => collection.files);
      const loadedEntries = await Promise.all(
        fileEntries.map(async file => {
          const remote = await loadCmsFile(file.path);
          const localDraft = readLocalDraft(file.path);
          const nextValue = localDraft || remote;

          return {
            file,
            draft: deepClone(nextValue),
            dirty: Boolean(localDraft),
          };
        }),
      );

      const nextDrafts = new Map();
      const nextDirty = new Set();
      const loadedFiles = loadedEntries.map(entry => {
        nextDrafts.set(entry.file.path, entry.draft);
        if (entry.dirty) {
          nextDirty.add(entry.file.path);
        }
        return entry.file;
      });

      setCollections(manifestCollections);
      setFiles(loadedFiles);
      setDrafts(nextDrafts);
      setDirtyPaths(nextDirty);
      const nextCurrentPath = preferredPath && loadedFiles.some(file => file.path === preferredPath)
        ? preferredPath
        : loadedFiles[0]?.path || null;
      setCurrentPath(nextCurrentPath);
      setWorkspaceTone('success');
      setWorkspaceNote(`Loaded ${loadedFiles.length} section${loadedFiles.length === 1 ? '' : 's'}.`);
      setMode('app');
      setSession(nextSession);
      setUser(nextSession?.user || null);
      void loadDeploys(nextSession);
      void loadAdmins(nextSession);
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not load CMS data.');
      setMode('login');
      setAuthNote({ text: error.message || 'Could not load CMS data.', tone: 'error' });
    } finally {
      setLoadingContent(false);
    }
  };

  const ensureAuthorized = async nextSession => {
    const accessToken = nextSession?.access_token;
    if (!accessToken) {
      return false;
    }

    try {
      const response = await fetch('/api/admin/admins?limit=1', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const raw = await response.text();
        let payload = {};
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {
          payload = { error: raw };
        }
        throw new Error(payload.error || 'That account does not have CMS access.');
      }

      return true;
    } catch (error) {
      await supabase.auth.signOut();
      setAuthNote({ text: error.message || 'That account is not approved for CMS access.', tone: 'error' });
      setMode('login');
      resetWorkspace();
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        const nextSession = data.session || null;
        if (nextSession && (await ensureAuthorized(nextSession))) {
          await loadWorkspace(nextSession);
        } else {
          setMode('login');
          setSession(null);
          setUser(null);
          resetWorkspace();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMode('login');
        setAuthNote({ text: error.message || 'Could not start the admin.', tone: 'error' });
        setSession(null);
        setUser(null);
        resetWorkspace();
      }
    }

    bootstrap();

    const { data } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === 'SIGNED_IN' && nextSession) {
        const authorized = await ensureAuthorized(nextSession);
        if (authorized) {
          await loadWorkspace(nextSession);
        }
      }

      if (event === 'SIGNED_OUT') {
        setMode('login');
        setSession(null);
        setUser(null);
        setAuthNote({ text: '', tone: '' });
        resetWorkspace();
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const onSubmitLogin = async event => {
    event.preventDefault();
    const nextEmail = normalizeEmail(email);

    if (!nextEmail) {
      setAuthNote({ text: 'Enter an email address first.', tone: 'error' });
      return;
    }

    setLoginPending(true);
    setAuthNote({ text: 'Sending your login link...', tone: '' });

    try {
      const response = await fetch('/api/admin/request-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: nextEmail,
          redirectTo: LOGIN_REDIRECT,
        }),
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || `Could not send the login link (${response.status}).`);
      }

      setAuthNote({ text: payload.message || 'Check your email for the login link.', tone: 'success' });
    } catch (error) {
      setAuthNote({ text: error.message || 'Could not send the login link.', tone: 'error' });
    } finally {
      setLoginPending(false);
    }
  };

  const onDraftChange = (path, fieldName, nextValue) => {
    setDrafts(prev => {
      const next = new Map(prev);
      const current = deepClone(next.get(path) || {});
      current[fieldName] = nextValue;
      next.set(path, current);
      return next;
    });

    setDirtyPaths(prev => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });

    const current = deepClone(drafts.get(path) || {});
    current[fieldName] = nextValue;
    writeLocalDraft(path, current);
  };

  const onSelectFile = path => {
    setCurrentPath(path);
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
  };

  const onPublish = async () => {
    if (publishPending) {
      return;
    }

    const dirtyFiles = Array.from(dirtyPaths);
    if (!dirtyFiles.length) {
      setWorkspaceTone('neutral');
      setWorkspaceNote('Nothing to publish yet.');
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setWorkspaceTone('error');
      setWorkspaceNote('Your session expired. Please sign in again.');
      return;
    }

    setPublishPending(true);
    setWorkspaceTone('');
    setWorkspaceNote(`Publishing ${dirtyFiles.length} file${dirtyFiles.length === 1 ? '' : 's'}...`);

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Update CMS content (${dirtyFiles.length} file${dirtyFiles.length === 1 ? '' : 's'})`,
          files: dirtyFiles.map(path => ({
            path,
            content: `${JSON.stringify(drafts.get(path), null, 2)}\n`,
          })),
        }),
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || payload.message || `Publish failed (${response.status}).`);
      }

      for (const path of dirtyFiles) {
        clearLocalDraft(path);
      }

      setDirtyPaths(new Set());
      setWorkspaceTone('success');
      setWorkspaceNote(
        payload.deployMessage
          ? `Published commit ${payload.commitSha?.slice(0, 7) || ''}. ${payload.deployMessage}`
          : `Published commit ${payload.commitSha?.slice(0, 7) || ''}.`,
      );
      await loadDeploys(session);
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not publish changes.');
    } finally {
      setPublishPending(false);
    }
  };

  const onDiscardChanges = async () => {
    if (!currentPath || !dirtyPaths.has(currentPath)) {
      return;
    }

    try {
      const remote = await loadCmsFile(currentPath);
      setDrafts(prev => {
        const next = new Map(prev);
        next.set(currentPath, deepClone(remote));
        return next;
      });

      setDirtyPaths(prev => {
        const next = new Set(prev);
        next.delete(currentPath);
        return next;
      });

      clearLocalDraft(currentPath);
      setWorkspaceTone('neutral');
      setWorkspaceNote('Discarded changes for the current section.');
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not discard changes.');
    }
  };

  const onRefreshDeploys = async () => {
    await loadDeploys(session);
  };

  const onRefreshAdmins = async () => {
    await loadAdmins(session);
  };

  const onInviteAdmin = async ({ email: nextEmail, name }) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setWorkspaceTone('error');
      setWorkspaceNote('Your session expired. Please sign in again.');
      return;
    }

    const normalizedEmail = normalizeEmail(nextEmail);
    if (!normalizedEmail) {
      setWorkspaceTone('error');
      setWorkspaceNote('Enter an email address first.');
      return;
    }

    setAdminActionPendingEmail(normalizedEmail);
    setWorkspaceTone('');
    setWorkspaceNote(`Updating access for ${normalizedEmail}...`);

    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          name,
        }),
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || payload.message || `Could not update access (${response.status}).`);
      }

      setWorkspaceTone('success');
      setWorkspaceNote(payload.message || 'Access updated.');
      await loadAdmins(session);
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not update CMS access.');
    } finally {
      setAdminActionPendingEmail('');
    }
  };

  const onRevokeAdmin = async nextEmail => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setWorkspaceTone('error');
      setWorkspaceNote('Your session expired. Please sign in again.');
      return;
    }

    const normalizedEmail = normalizeEmail(nextEmail);
    if (!normalizedEmail) {
      return;
    }

    const confirmed = window.confirm(`Revoke CMS access for ${normalizedEmail}?`);
    if (!confirmed) {
      return;
    }

    setAdminActionPendingEmail(normalizedEmail);
    setWorkspaceTone('');
    setWorkspaceNote(`Updating access for ${normalizedEmail}...`);

    try {
      const response = await fetch('/api/admin/admins', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || payload.message || `Could not revoke access (${response.status}).`);
      }

      setWorkspaceTone('success');
      setWorkspaceNote(payload.message || 'Access revoked.');
      await loadAdmins(session);
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not revoke CMS access.');
    } finally {
      setAdminActionPendingEmail('');
    }
  };

  const onRevertDeploy = async sha => {
    const targetSha = String(sha || '').trim();
    if (!targetSha) {
      return;
    }

    const confirmed = window.confirm(`Revert deploy ${targetSha.slice(0, 7)}? This will create a new rollback commit.`);
    if (!confirmed) {
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setWorkspaceTone('error');
      setWorkspaceNote('Your session expired. Please sign in again.');
      return;
    }

    setRevertPendingSha(targetSha);
    setWorkspaceTone('');
    setWorkspaceNote(`Reverting ${targetSha.slice(0, 7)}...`);

    try {
      const response = await fetch('/api/revert', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: targetSha,
        }),
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || payload.message || `Revert failed (${response.status}).`);
      }

      for (const path of payload.revertedFiles || []) {
        clearLocalDraft(path);
      }

      setWorkspaceTone('success');
      setWorkspaceNote(
        payload.deployMessage
          ? `Published rollback commit ${payload.commitSha?.slice(0, 7) || ''}. ${payload.deployMessage}`
          : `Published rollback commit ${payload.commitSha?.slice(0, 7) || ''}.`,
      );

      await loadWorkspace(session, { preferredPath: currentPath });
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not revert the deploy.');
    } finally {
      setRevertPendingSha(null);
    }
  };

  const onUploadAsset = async file => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error('You must be signed in to upload files.');
    }

    const data = await readFileAsDataUrl(file);
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        data,
      }),
    });

    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { error: raw };
    }

    if (!response.ok) {
      throw new Error(payload.error || payload.message || `Upload failed (${response.status}).`);
    }

    return payload;
  };

  return {
    mode,
    authNote,
    workspaceNote,
    workspaceTone,
    deploys,
    deploysLoading,
    deploysError,
    onRefreshDeploys,
    onRevertDeploy,
    revertPendingSha,
    admins,
    adminsLoading,
    adminsError,
    onRefreshAdmins,
    onInviteAdmin,
    onRevokeAdmin,
    adminActionPendingEmail,
    email,
    setEmail,
    loginPending,
    onSubmitLogin,
    user,
    collections,
    currentPath,
    dirtyPaths,
    onSelectFile,
    onPublish,
    onSignOut,
    publishPending,
    search,
    setSearch,
    files,
    drafts,
    onDraftChange,
    onDiscardChanges,
    onUploadAsset,
    loadingContent,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function AdminApp() {
  const cms = useCmsBootstrap();

  if (cms.mode === 'boot') {
    return <BootScreen label={cms.loadingContent ? 'Loading sections' : 'Loading admin'} />;
  }

  if (cms.mode === 'login') {
    return (
      <LoginScreen
        email={cms.email}
        onEmailChange={cms.setEmail}
        onSubmit={cms.onSubmitLogin}
        pending={cms.loginPending}
        note={cms.authNote.text}
        tone={cms.authNote.tone}
      />
    );
  }

  return (
    <AppShell
      user={cms.user}
      search={cms.search}
      onSearchChange={cms.setSearch}
      collections={cms.collections}
      currentPath={cms.currentPath}
      dirtyPaths={cms.dirtyPaths}
      onSelectFile={cms.onSelectFile}
      onPublish={cms.onPublish}
      onDiscardChanges={cms.onDiscardChanges}
      onSignOut={cms.onSignOut}
      publishPending={cms.publishPending}
      workspaceNote={cms.workspaceNote}
      workspaceTone={cms.workspaceTone}
      deploys={cms.deploys}
      deploysLoading={cms.deploysLoading}
      deploysError={cms.deploysError}
      onRefreshDeploys={cms.onRefreshDeploys}
      onRevertDeploy={cms.onRevertDeploy}
      revertPendingSha={cms.revertPendingSha}
      files={cms.files}
      drafts={cms.drafts}
      onDraftChange={cms.onDraftChange}
      onUploadAsset={cms.onUploadAsset}
      admins={cms.admins}
      adminsLoading={cms.adminsLoading}
      adminsError={cms.adminsError}
      onRefreshAdmins={cms.onRefreshAdmins}
      onInviteAdmin={cms.onInviteAdmin}
      onRevokeAdmin={cms.onRevokeAdmin}
      adminActionPendingEmail={cms.adminActionPendingEmail}
    />
  );
}

const mountNode = document.getElementById('admin-root');

if (mountNode) {
  createRoot(mountNode).render(<AdminApp />);
}
