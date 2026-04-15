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
  FileUp,
  GripVertical,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import './admin.css';

const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';
const LOGIN_REDIRECT = `${window.location.origin}/admin/`;
const FALLBACK_EMAILS = ['bernardogancho99@gmail.com'];

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

async function loadAdminSettings() {
  const raw = await fetchText('/admin/admin-settings.json');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in /admin/admin-settings.json: ${error.message}`);
  }
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

        <div className={cn('status-line', note && `status-${tone || 'neutral'}`)}>{note || 'The editor publishes to GitHub after Supabase login.'}</div>
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
  onSignOut,
  publishPending,
  workspaceNote,
  workspaceTone,
  files,
  drafts,
  onDraftChange,
  onUploadAsset,
}) {
  const currentFile = files.find(file => file.path === currentPath) || null;
  const currentDraft = currentPath ? drafts.get(currentPath) : null;
  const dirtyCount = dirtyPaths.size;

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
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <div className="workspace-kicker">Now editing</div>
            <h2 className="workspace-title">{currentFile?.fileLabel || 'Choose a section'}</h2>
            <div className="workspace-subtitle">
              {currentFile ? `${currentFile.collectionLabel} · ${currentFile.fileLabel}` : 'Select a section from the sidebar.'}
            </div>
          </div>

          <div className="workspace-actions">
            <Badge tone={dirtyCount ? 'warning' : 'neutral'}>{dirtyCount ? `${dirtyCount} unsaved` : 'No changes'}</Badge>
            <Button
              type="button"
              variant="primary"
              onClick={onPublish}
              disabled={publishPending || dirtyCount === 0}
              iconLeft={publishPending ? <LoaderCircle className="spinner" size={16} /> : <Upload size={16} />}
            >
              {publishPending ? 'Publishing' : 'Publish changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={onSignOut} iconLeft={<LogOut size={16} />}>
              Sign out
            </Button>
          </div>
        </header>

        <div className={cn('workspace-note', `status-${workspaceTone || 'neutral'}`)}>{workspaceNote || 'Drafts autosave locally until you publish.'}</div>

        <div className="editor-canvas">
          {!currentFile || !currentDraft ? (
            <EmptyState title="Pick a section" description="The current section will appear here once you select one from the sidebar." />
          ) : (
            <div className="editor-stack">
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
      </main>
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
                <span className={cn('dirty-dot', dirtyPaths.has(file.path) && 'is-dirty')} />
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
  const approvedEmailsRef = useRef(new Set(FALLBACK_EMAILS.map(normalizeEmail)));
  const [mode, setMode] = useState('boot');
  const [authNote, setAuthNote] = useState({ text: '', tone: '' });
  const [workspaceNote, setWorkspaceNote] = useState('Loading content...');
  const [workspaceTone, setWorkspaceTone] = useState('');
  const [email, setEmail] = useState(FALLBACK_EMAILS[0]);
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

  const resetWorkspace = () => {
    setCollections([]);
    setFiles([]);
    setDrafts(new Map());
    setDirtyPaths(new Set());
    setCurrentPath(null);
    setSearch('');
    setPublishPending(false);
    setLoadingContent(false);
    setWorkspaceTone('');
    setWorkspaceNote('Loading content...');
  };

  const loadWorkspace = async nextSession => {
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
      setCurrentPath(loadedFiles[0]?.path || null);
      setWorkspaceTone('success');
      setWorkspaceNote(`Loaded ${loadedFiles.length} section${loadedFiles.length === 1 ? '' : 's'}.`);
      setMode('app');
      setSession(nextSession);
      setUser(nextSession?.user || null);
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
    const nextEmail = normalizeEmail(nextSession?.user?.email);
    if (!nextEmail || !approvedEmailsRef.current.has(nextEmail)) {
      await supabase.auth.signOut();
      setAuthNote({ text: 'That email is not approved for CMS access.', tone: 'error' });
      setMode('login');
      resetWorkspace();
      return false;
    }
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const settings = await loadAdminSettings();
        if (cancelled) {
          return;
        }

        const approvedList = Array.isArray(settings.approvedEmails) && settings.approvedEmails.length ? settings.approvedEmails : FALLBACK_EMAILS;
        const approvedSet = new Set(approvedList.map(normalizeEmail).filter(Boolean));
        approvedEmailsRef.current = approvedSet;

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        const nextSession = data.session || null;
        const nextEmail = normalizeEmail(nextSession?.user?.email);

        if (nextSession && nextEmail && approvedSet.has(nextEmail)) {
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

    if (!approvedEmailsRef.current.has(nextEmail)) {
      setAuthNote({ text: 'That email is not approved for CMS access.', tone: 'error' });
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
    } catch (error) {
      setWorkspaceTone('error');
      setWorkspaceNote(error.message || 'Could not publish changes.');
    } finally {
      setPublishPending(false);
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
      onSignOut={cms.onSignOut}
      publishPending={cms.publishPending}
      workspaceNote={cms.workspaceNote}
      workspaceTone={cms.workspaceTone}
      files={cms.files}
      drafts={cms.drafts}
      onDraftChange={cms.onDraftChange}
      onUploadAsset={cms.onUploadAsset}
    />
  );
}

const mountNode = document.getElementById('admin-root');

if (mountNode) {
  createRoot(mountNode).render(<AdminApp />);
}
