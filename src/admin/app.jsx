import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import './admin.css';

const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';

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

const Button = React.forwardRef(function Button({ className, variant = 'secondary', iconLeft, iconRight, children, ...props }, ref) {
  return (
    <button ref={ref} className={cn('button', `button-${variant}`, className)} {...props}>
      {iconLeft ? <span className="button-icon">{iconLeft}</span> : null}
      <span>{children}</span>
      {iconRight ? <span className="button-icon">{iconRight}</span> : null}
    </button>
  );
});

const IconButton = React.forwardRef(function IconButton({ className, variant = 'ghost', title, ...props }, ref) {
  return <button ref={ref} aria-label={title} title={title} className={cn('icon-button', `icon-button-${variant}`, className)} {...props} />;
});

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

function PublishConfirmationDialog({ open, onClose, onDiscardAll, onConfirm, publishPending, dirtyFiles, dirtyCollections }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    confirmRef.current?.focus();

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="publish-modal" role="presentation" onClick={onClose}>
      <div
        className="publish-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
        aria-describedby="publish-modal-description"
        onClick={event => event.stopPropagation()}
      >
        <div className="publish-modal-head">
          <div>
            <div className="publish-modal-kicker">Confirm publish</div>
            <h3 id="publish-modal-title" className="publish-modal-title">
              Review changes before they go live
            </h3>
            <p id="publish-modal-description" className="publish-modal-copy">
              These edits will be committed to `main` and published to production after you confirm.
            </p>
          </div>

          <div className="publish-modal-counts">
            <div className="publish-modal-count">{dirtyFiles.length} section{dirtyFiles.length === 1 ? '' : 's'}</div>
            <div className="publish-modal-count">{dirtyCollections.length} collection{dirtyCollections.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        <div className="publish-modal-summary">
          {dirtyCollections.map(group => (
            <div key={group.label} className="publish-modal-group">
              <div className="publish-modal-group-label">{group.label}</div>
              <div className="publish-modal-group-items">
                {group.files.map(file => (
                  <span key={file.path} className="publish-modal-chip">
                    {file.fileLabel}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="publish-modal-note">Cancel keeps your edits. Discard all changes restores the last published version and cannot be undone.</div>

        <div className="publish-modal-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={publishPending}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onDiscardAll} disabled={publishPending} iconLeft={<Trash2 size={16} />}>
            Discard all changes
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="primary"
            onClick={onConfirm}
            disabled={publishPending}
            iconLeft={publishPending ? <LoaderCircle className="spinner" size={16} /> : <Upload size={16} />}
          >
            {publishPending ? 'Publishing' : 'Publish to production'}
          </Button>
        </div>
      </div>
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

function LoginScreen({ email, onEmailChange, password, onPasswordChange, onSubmit, pending, note, tone }) {
  return (
    <div className="auth-shell">
      <Card className="auth-card">
        <div className="auth-kicker">Admin access</div>
        <h1 className="auth-title">Bollag CMS</h1>
        <p className="auth-copy">Sign in with your email and password to edit the website.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Email address</span>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => onEmailChange(event.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => onPasswordChange(event.target.value)}
              placeholder="Your password"
              required
            />
          </label>

          <Button type="submit" variant="primary" disabled={pending} iconLeft={pending ? <LoaderCircle className="spinner" size={16} /> : <Shield size={16} />}>
            {pending ? 'Signing in' : 'Sign in'}
          </Button>
        </form>

        <div className={cn('status-line', note && `status-${tone || 'neutral'}`)}>
          {note || 'Forgot your password? Ask an admin to reset it for you.'}
        </div>
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
  onDiscardAllChanges,
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
  people,
  peopleLoading,
  peopleError,
  onRefreshPeople,
  onAddPerson,
  onUpdatePerson,
  onRemovePerson,
  personActionPendingId,
}) {
  const [activeView, setActiveView] = useState('sections');
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const currentFile = files.find(file => file.path === currentPath) || null;
  const currentDraft = currentPath ? drafts.get(currentPath) : null;
  const dirtyCount = dirtyPaths.size;
  const latestDeploy = deploys[0] || null;
  const isAdmin = user?.role === 'admin';
  const filesByPath = useMemo(() => new Map(files.map(file => [file.path, file])), [files]);
  const dirtyFiles = useMemo(() => files.filter(file => dirtyPaths.has(file.path)), [files, dirtyPaths]);
  const dirtyCollections = useMemo(() => {
    const groups = new Map();

    for (const file of dirtyFiles) {
      const group = groups.get(file.collectionLabel) || [];
      group.push(file);
      groups.set(file.collectionLabel, group);
    }

    return Array.from(groups.entries()).map(([label, groupFiles]) => ({
      label,
      files: groupFiles,
    }));
  }, [dirtyFiles]);
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
    activeView === 'people' && !workspaceTone && /^Loaded \d+ section/.test(workspaceNote)
      ? 'Add people with an email and password. Admins manage people; editors edit the website.'
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
          {isAdmin ? (
            <button
              type="button"
              className={cn('sidebar-nav-item', 'sidebar-nav-admin', activeView === 'people' && 'is-active')}
              onClick={() => setActiveView('people')}
            >
              <span className="sidebar-nav-label">People</span>
              <span className="sidebar-nav-count">{people.length}</span>
            </button>
          ) : null}
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
            <div className="sidebar-note-label">People</div>
            <div className="sidebar-note-value">Add or remove people who can edit the website.</div>
            <div className="sidebar-note-detail">Give each person an email and password. Admins can manage people too.</div>
          </div>
        )}
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <div className="workspace-kicker">{activeView === 'sections' ? 'Now editing' : 'People'}</div>
            <h2 className="workspace-title">{activeView === 'sections' ? currentFile?.fileLabel || 'Choose a section' : 'Manage people'}</h2>
            <div className="workspace-subtitle">
              {activeView === 'sections'
                ? currentFile
                  ? `${currentFile.collectionLabel} · ${currentFile.fileLabel}`
                  : 'Select a section from the sidebar.'
                : 'Add or remove people and set their passwords.'}
            </div>
          </div>

          <div className="workspace-actions">
            <Badge tone={dirtyCount ? 'warning' : 'neutral'}>
              {activeView === 'sections'
                ? dirtyCount
                  ? `${dirtyCount} unsaved`
                  : 'No changes'
                : `${people.length} ${people.length === 1 ? 'person' : 'people'}`}
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
                    onClick={() => setPublishConfirmOpen(true)}
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
          <PeoplePanel
            people={people}
            loading={peopleLoading}
            error={peopleError}
            onRefresh={onRefreshPeople}
            onAdd={onAddPerson}
            onUpdate={onUpdatePerson}
            onRemove={onRemovePerson}
            pendingId={personActionPendingId}
            currentUserId={user?.id}
          />
        )}

        <PublishConfirmationDialog
          open={publishConfirmOpen}
          onClose={() => setPublishConfirmOpen(false)}
          onDiscardAll={async () => {
            const count = dirtyFiles.length;
            const confirmed = window.confirm(
              `Discard unpublished changes to ${count} section${count === 1 ? '' : 's'}? This restores the last published version and cannot be undone.`,
            );
            if (!confirmed) {
              return;
            }
            setPublishConfirmOpen(false);
            await onDiscardAllChanges();
          }}
          onConfirm={() => {
            setPublishConfirmOpen(false);
            void onPublish();
          }}
          publishPending={publishPending}
          dirtyFiles={dirtyFiles}
          dirtyCollections={dirtyCollections}
        />
      </main>
    </div>
  );
}

function PeoplePanel({
  people,
  loading,
  error,
  onRefresh,
  onAdd,
  onUpdate,
  onRemove,
  pendingId,
  currentUserId,
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('editor');
  const [submitting, setSubmitting] = useState(false);

  const adminCount = people.filter(person => person.role === 'admin').length;
  const editorCount = people.length - adminCount;

  const handleSubmit = async event => {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onAdd({ name: name.trim(), email: email.trim(), password, role });
      if (ok) {
        setName('');
        setEmail('');
        setPassword('');
        setRole('editor');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="access-canvas">
      <Card className="access-panel">
        <div className="access-panel-head">
          <div>
            <div className="panel-label">People</div>
            <div className="panel-meta">Add someone with an email and a password and they can sign in right away. Admins can manage people; editors can only edit the website.</div>
          </div>

          <div className="access-panel-actions">
            <Button type="button" variant="ghost" iconLeft={<RefreshCw size={14} />} onClick={onRefresh} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <form className="access-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Name</span>
            <Input value={name} onChange={event => setName(event.target.value)} placeholder="Full name" />
          </label>

          <label className="field">
            <span className="field-label">Email</span>
            <Input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="person@company.com" autoComplete="off" />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <Input type="text" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete="off" />
          </label>

          <label className="field">
            <span className="field-label">Role</span>
            <Select value={role} onChange={event => setRole(event.target.value)}>
              <option value="editor">Editor — can edit the website</option>
              <option value="admin">Admin — can also manage people</option>
            </Select>
          </label>

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !email.trim() || password.length < 6}
            iconLeft={submitting ? <LoaderCircle className="spinner" size={16} /> : <UserPlus size={16} />}
          >
            {submitting ? 'Saving' : 'Add person'}
          </Button>
        </form>

        <div className="access-roster">
          {loading ? (
            <div className="access-empty">Loading people…</div>
          ) : error ? (
            <div className="access-empty">
              <div className="empty-state-title">Could not load people</div>
              <div className="empty-state-description">{error}</div>
            </div>
          ) : (
            <>
              <div className="access-roster-head">
                <div className="access-roster-title">Current people</div>
                <div className="access-roster-count">
                  {adminCount} admin{adminCount === 1 ? '' : 's'}, {editorCount} editor{editorCount === 1 ? '' : 's'}
                </div>
              </div>

              <div className="access-list">
                {people.length ? (
                  people.map(person => {
                    const isSelf = person.id === currentUserId;
                    const busy = pendingId === person.id;
                    return (
                      <div className="access-row" key={person.id || person.email}>
                        <div className="access-row-main">
                          <div className="access-row-top">
                            <div className="access-row-email">{person.email}</div>
                            <Badge tone={person.role === 'admin' ? 'warning' : 'neutral'}>
                              {person.role === 'admin' ? 'Admin' : 'Editor'}
                            </Badge>
                          </div>
                          <div className="access-row-subtitle">
                            {person.name || 'No name'}
                            {isSelf ? ' · you' : ''}
                          </div>
                          <div className="access-row-meta">
                            {person.lastSignInAt ? `Last sign in ${formatTimestamp(person.lastSignInAt)}` : 'Never signed in'}
                          </div>
                        </div>

                        <div className="access-row-actions">
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              const next = window.prompt(`Set a new password for ${person.email} (at least 6 characters):`);
                              if (next === null) {
                                return;
                              }
                              if (next.length < 6) {
                                window.alert('Password must be at least 6 characters.');
                                return;
                              }
                              onUpdate(person.id, { password: next });
                            }}
                          >
                            Reset password
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy || isSelf}
                            onClick={() => onUpdate(person.id, { role: person.role === 'admin' ? 'editor' : 'admin' })}
                          >
                            {person.role === 'admin' ? 'Make editor' : 'Make admin'}
                          </Button>
                          {isSelf ? (
                            <Badge tone="neutral">You</Badge>
                          ) : (
                            <Button
                              type="button"
                              variant="danger"
                              disabled={busy}
                              iconLeft={busy ? <LoaderCircle className="spinner" size={14} /> : <Trash2 size={14} />}
                              onClick={() => {
                                if (window.confirm(`Remove ${person.email}? They lose access immediately.`)) {
                                  onRemove(person.id);
                                }
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="access-empty">
                    <div className="empty-state-title">No people yet</div>
                    <div className="empty-state-description">Add the first person above.</div>
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
  const [openIndices, setOpenIndices] = useState(() => new Set());

  const setItemOpen = (index, open) => {
    setOpenIndices(prev => {
      const next = new Set(prev);
      if (open) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  const expandAll = () => setOpenIndices(new Set(current.map((_, index) => index)));
  const collapseAll = () => setOpenIndices(new Set());

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
          <div className="list-panel-actions">
            {current.length > 1 ? (
              <>
                <Button type="button" variant="ghost" onClick={expandAll}>
                  Expand all
                </Button>
                <Button type="button" variant="ghost" onClick={collapseAll}>
                  Collapse all
                </Button>
              </>
            ) : null}
            <Button type="button" variant="secondary" iconLeft={<Plus size={16} />} onClick={addItem}>
              Add item
            </Button>
          </div>
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
                open={openIndices.has(index)}
                onOpenChange={next => setItemOpen(index, next)}
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
  open,
  onOpenChange,
}) {
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

        <button type="button" className="list-item-toggle" onClick={() => onOpenChange(!open)} aria-expanded={open}>
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
            <DropdownMenu.Item className="menu-item" onSelect={() => onOpenChange(true)}>
              <ChevronDown size={14} />
              Open
            </DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={() => onOpenChange(false)}>
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

      <Collapsible.Root open={open} onOpenChange={onOpenChange}>
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
  const [dragOver, setDragOver] = useState(false);
  const [showPath, setShowPath] = useState(false);
  const inputRef = useRef(null);
  const current = String(value || '');
  const isImage = kind === 'image';
  const hasPreview = current && isImage && isImagePath(current);

  const uploadFile = async file => {
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
    }
  };

  const handlePickFile = async event => {
    await uploadFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = async event => {
    event.preventDefault();
    setDragOver(false);
    await uploadFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="field-stack">
      <label className="field-label">{field.label || field.name}</label>
      {field.description ? <div className="field-help">{field.description}</div> : null}

      <input ref={inputRef} type="file" className="hidden-input" accept={isImage ? 'image/*' : '*'} onChange={handlePickFile} />

      {current ? (
        <div className="asset-card">
          {hasPreview ? (
            <img className="asset-card-image" src={current} alt={field.label || field.name} />
          ) : (
            <a className="asset-card-file" href={current} target="_blank" rel="noreferrer">
              {current}
            </a>
          )}
          <div className="asset-card-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              iconLeft={uploading ? <LoaderCircle className="spinner" size={16} /> : <Upload size={16} />}
            >
              {uploading ? 'Uploading' : 'Replace'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onChange('')} disabled={uploading} iconLeft={<Trash2 size={16} />}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={cn('asset-dropzone', dragOver && 'is-dragover')}
          onClick={() => inputRef.current?.click()}
          onDragOver={event => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          disabled={uploading}
        >
          {uploading ? <LoaderCircle className="spinner" size={22} /> : <Upload size={22} />}
          <span className="asset-dropzone-title">
            {uploading ? 'Uploading…' : isImage ? 'Drop an image here, or click to choose one' : 'Drop a file here, or click to choose one'}
          </span>
          {!uploading ? <span className="asset-dropzone-hint">{isImage ? 'JPG, PNG, WEBP, SVG or GIF' : 'Any file type'}</span> : null}
        </button>
      )}

      <button type="button" className="asset-path-toggle" onClick={() => setShowPath(value => !value)}>
        {showPath ? 'Hide file path' : 'Edit file path manually'}
      </button>
      {showPath ? (
        <Input
          value={current}
          onChange={event => onChange(event.target.value)}
          placeholder={isImage ? '/assets/media/example.jpg' : '/assets/media/example.mp4'}
        />
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
  const [email, setEmail] = useState('');
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [collections, setCollections] = useState([]);
  const [files, setFiles] = useState([]);
  const [drafts, setDrafts] = useState(() => new Map());
  const [dirtyPaths, setDirtyPaths] = useState(() => new Set());
  const [currentPath, setCurrentPath] = useState(null);
  const [search, setSearch] = useState('');
  const [publishPending, setPublishPending] = useState(false);
  const [password, setPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [deploys, setDeploys] = useState([]);
  const [deploysLoading, setDeploysLoading] = useState(false);
  const [deploysError, setDeploysError] = useState('');
  const [revertPendingSha, setRevertPendingSha] = useState(null);
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState('');
  const [personActionPendingId, setPersonActionPendingId] = useState('');

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
    setPeople([]);
    setPeopleLoading(false);
    setPeopleError('');
    setPersonActionPendingId('');
    setWorkspaceTone('');
    setWorkspaceNote('Loading content...');
  };

  // Only admins can list people. For editors this returns 403, which we treat as
  // "no people to show" rather than an error (the People screen is hidden anyway).
  const loadPeople = async (nextSession, currentRole) => {
    const token = nextSession?.access_token;
    if (!token || currentRole !== 'admin') {
      setPeople([]);
      setPeopleError('');
      return [];
    }

    setPeopleLoading(true);
    setPeopleError('');

    try {
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || `Could not load people (${response.status}).`);
      }

      const nextPeople = Array.isArray(payload.users) ? payload.users : [];
      setPeople(nextPeople);
      return nextPeople;
    } catch (error) {
      setPeople([]);
      setPeopleError(error.message || 'Could not load people.');
      return [];
    } finally {
      setPeopleLoading(false);
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

  const loadWorkspace = async (nextSession, me, options = {}) => {
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
      setUser(me || null);
      void loadDeploys(nextSession);
      void loadPeople(nextSession, me?.role);
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not load CMS data.');
      setMode('login');
      setAuthNote({ text: error.message || 'Could not load CMS data.', tone: 'error' });
    } finally {
      setLoadingContent(false);
    }
  };

  // Returns the signed-in person { id, email, name, role } if they have access,
  // otherwise signs them out and returns null.
  const ensureAuthorized = async nextSession => {
    const accessToken = nextSession?.access_token;
    if (!accessToken) {
      return null;
    }

    try {
      const response = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || 'That account does not have CMS access.');
      }

      return payload.user || null;
    } catch (error) {
      await supabase.auth.signOut();
      setAuthNote({ text: error.message || 'That account does not have CMS access.', tone: 'error' });
      setMode('login');
      resetWorkspace();
      return null;
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
        const me = nextSession ? await ensureAuthorized(nextSession) : null;
        if (me) {
          await loadWorkspace(nextSession, me);
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
        const me = await ensureAuthorized(nextSession);
        if (me) {
          await loadWorkspace(nextSession, me);
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

    if (!nextEmail || !password) {
      setAuthNote({ text: 'Enter your email and password.', tone: 'error' });
      return;
    }

    setLoginPending(true);
    setAuthNote({ text: 'Signing in...', tone: '' });

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: nextEmail,
        password,
      });

      if (error) {
        throw error;
      }
      // On success, onAuthStateChange (SIGNED_IN) authorizes and loads the workspace.
      setPassword('');
    } catch (error) {
      setAuthNote({ text: error.message || 'Could not sign in. Check your email and password.', tone: 'error' });
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
      setWorkspaceNote('Published. This may take a few minutes to be live on the website.');
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

  const onDiscardAllChanges = async () => {
    const dirtyFiles = Array.from(dirtyPaths);
    if (!dirtyFiles.length) {
      return;
    }

    try {
      const nextDrafts = new Map(drafts);
      const nextDirty = new Set(dirtyPaths);

      for (const path of dirtyFiles) {
        const remote = await loadCmsFile(path);
        nextDrafts.set(path, deepClone(remote));
        nextDirty.delete(path);
        clearLocalDraft(path);
      }

      setDrafts(nextDrafts);
      setDirtyPaths(nextDirty);
      setWorkspaceTone('neutral');
      setWorkspaceNote('Discarded unpublished changes.');
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not discard changes.');
    }
  };

  const onRefreshDeploys = async () => {
    await loadDeploys(session);
  };

  const onRefreshPeople = async () => {
    await loadPeople(session, user?.role);
  };

  const peopleRequest = async (method, body, pendingId, pendingNote) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setWorkspaceTone('error');
      setWorkspaceNote('Your session expired. Please sign in again.');
      return { ok: false };
    }

    setPersonActionPendingId(pendingId);
    setWorkspaceTone('');
    setWorkspaceNote(pendingNote);

    try {
      const response = await fetch('/api/admin/users', {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!response.ok) {
        throw new Error(payload.error || `Could not save (${response.status}).`);
      }

      setWorkspaceTone('success');
      setWorkspaceNote(payload.message || 'Saved.');
      await loadPeople(session, user?.role);
      return { ok: true, payload };
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not save.');
      return { ok: false };
    } finally {
      setPersonActionPendingId('');
    }
  };

  const onAddPerson = async ({ name, email, password, role }) => {
    const result = await peopleRequest('POST', { name, email, password, role }, 'new', `Saving ${normalizeEmail(email)}…`);
    return result.ok;
  };

  const onUpdatePerson = async (id, changes) => {
    if (!id) {
      return;
    }
    await peopleRequest('PATCH', { id, ...changes }, id, changes.password ? 'Updating password…' : 'Saving…');
  };

  const onRemovePerson = async id => {
    if (!id) {
      return;
    }
    await peopleRequest('DELETE', { id }, id, 'Removing…');
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
      setWorkspaceNote('Published. This may take a few minutes to be live on the website.');

      await loadWorkspace(session, user, { preferredPath: currentPath });
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
    people,
    peopleLoading,
    peopleError,
    onRefreshPeople,
    onAddPerson,
    onUpdatePerson,
    onRemovePerson,
    personActionPendingId,
    email,
    setEmail,
    loginPending,
    password,
    setPassword,
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
    onDiscardAllChanges,
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
        password={cms.password}
        onPasswordChange={cms.setPassword}
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
      onDiscardAllChanges={cms.onDiscardAllChanges}
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
      people={cms.people}
      peopleLoading={cms.peopleLoading}
      peopleError={cms.peopleError}
      onRefreshPeople={cms.onRefreshPeople}
      onAddPerson={cms.onAddPerson}
      onUpdatePerson={cms.onUpdatePerson}
      onRemovePerson={cms.onRemovePerson}
      personActionPendingId={cms.personActionPendingId}
    />
  );
}

const mountNode = document.getElementById('admin-root');

if (mountNode) {
  createRoot(mountNode).render(<AdminApp />);
}
