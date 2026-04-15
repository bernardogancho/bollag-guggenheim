import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as YAML from 'https://cdn.jsdelivr.net/npm/yaml@2.8.1/+esm';

const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';
const LOGIN_REDIRECT = `${window.location.origin}/admin/`;
const root = document.getElementById('admin-root');
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

let APPROVED_EMAILS = new Set();

const state = {
  session: null,
  user: null,
  manifest: null,
  files: [],
  drafts: new Map(),
  currentPath: null,
  dirtyPaths: new Set(),
  loading: true,
  loadingManifest: false,
  appReady: false,
  message: '',
  publishPending: false,
};

function injectStyles() {
  if (document.getElementById('admin-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'admin-styles';
  style.textContent = `
    :root {
      color-scheme: light;
      --bg: #f7f7f5;
      --panel: #ffffff;
      --panel-strong: #ffffff;
      --panel-border: rgba(20, 28, 33, 0.10);
      --text: #172026;
      --muted: #67727b;
      --accent: #0d5b53;
      --accent-strong: #0a4943;
      --danger: #9a3636;
      --warning: #9b6b1b;
      --shadow: 0 10px 28px rgba(20, 28, 33, 0.05);
    }

    html, body {
      min-height: 100%;
    }

    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background: linear-gradient(180deg, #fbfbfa 0%, var(--bg) 100%);
    }

    #admin-root {
      min-height: 100vh;
    }

    .auth-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      box-sizing: border-box;
    }

    .auth-card {
      width: min(100%, 480px);
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      backdrop-filter: none;
      padding: 30px;
      box-sizing: border-box;
    }

    .auth-kicker,
    .sidebar-kicker,
    .toolbar-kicker {
      margin: 0 0 12px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--accent);
    }

    .auth-title {
      margin: 0;
      font-size: clamp(2rem, 4.5vw, 2.8rem);
      line-height: 0.98;
      letter-spacing: -0.04em;
      font-weight: 700;
    }

    .auth-copy,
    .toolbar-subtitle,
    .sidebar-note,
    .status-note {
      margin: 12px 0 0;
      line-height: 1.6;
      color: var(--muted);
    }

    .auth-form,
    .toolbar-actions,
    .asset-actions,
    .list-actions,
    .field-head,
    .editor-toolbar,
    .list-item-head,
    .file-row-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .auth-form {
      margin-top: 24px;
      flex-direction: column;
      align-items: stretch;
    }

    .auth-label,
    .field-label {
      display: grid;
      gap: 8px;
      font-weight: 600;
      font-size: 0.95rem;
    }

    .auth-input,
    .text-input,
    .select-input,
    .textarea-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(31, 36, 40, 0.14);
      border-radius: 14px;
      padding: 13px 15px;
      font: inherit;
      background: rgba(255, 255, 255, 0.95);
      color: var(--text);
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .text-input:focus,
    .select-input:focus,
    .textarea-input:focus,
    .auth-input:focus {
      border-color: rgba(13, 91, 83, 0.42);
      box-shadow: 0 0 0 4px rgba(13, 91, 83, 0.11);
    }

    .textarea-input {
      min-height: 120px;
      resize: vertical;
    }

    .btn {
      appearance: none;
      border: 0;
      border-radius: 14px;
      padding: 12px 16px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, background 160ms ease, opacity 160ms ease, color 160ms ease;
      white-space: nowrap;
    }

    .btn:disabled {
      cursor: progress;
      opacity: 0.7;
    }

    .btn-primary {
      background: var(--accent);
      color: #fff;
    }

    .btn-primary:hover {
      background: var(--accent-strong);
    }

    .btn-secondary {
      background: rgba(13, 91, 83, 0.08);
      color: var(--accent);
    }

    .btn-secondary:hover {
      background: rgba(13, 91, 83, 0.14);
    }

    .btn-ghost {
      background: transparent;
      color: var(--muted);
      padding-inline: 10px;
    }

    .btn-danger {
      background: rgba(154, 54, 54, 0.11);
      color: var(--danger);
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .auth-status,
    .status-line {
      min-height: 1.25rem;
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.45;
      color: var(--muted);
    }

    .auth-status[data-tone="error"],
    .status-line[data-tone="error"] {
      color: var(--danger);
    }

    .auth-status[data-tone="success"],
    .status-line[data-tone="success"] {
      color: var(--accent);
    }

    .auth-meta {
      margin-top: 18px;
      font-size: 0.84rem;
      color: var(--muted);
    }

    .app-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
    }

    .sidebar {
      padding: 24px;
      border-right: 1px solid var(--panel-border);
      background: rgba(255, 255, 255, 0.6);
    }

    .sidebar-card,
    .editor-card,
    .toolbar-card {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      backdrop-filter: none;
    }

    .sidebar-card {
      padding: 22px;
    }

    .sidebar-title {
      margin: 0;
      font-size: 2rem;
      line-height: 1;
      letter-spacing: -0.03em;
      font-weight: 700;
    }

    .sidebar-email {
      margin: 10px 0 0;
      font-size: 0.9rem;
      color: var(--muted);
      word-break: break-word;
    }

    .sidebar-search {
      margin-top: 18px;
    }

    .file-search {
      width: 100%;
      box-sizing: border-box;
      border-radius: 14px;
      border: 1px solid rgba(31, 36, 40, 0.12);
      background: rgba(255, 255, 255, 0.92);
      padding: 12px 14px;
      font: inherit;
    }

    .collection-list {
      margin-top: 16px;
      display: grid;
      gap: 14px;
    }

    .collection-group {
      display: grid;
      gap: 10px;
      padding-top: 2px;
    }

    .collection-label {
      margin: 0;
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--muted);
    }

    .file-list {
      display: grid;
      gap: 6px;
    }

    .file-button {
      width: 100%;
      border: 1px solid transparent;
      border-left-width: 3px;
      border-radius: 10px;
      background: #fafafa;
      text-align: left;
      padding: 11px 12px;
      cursor: pointer;
      color: var(--text);
      transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
    }

    .file-button:hover {
      background: rgba(13, 91, 83, 0.06);
      transform: translateX(1px);
    }

    .file-button[data-active="true"] {
      background: rgba(13, 91, 83, 0.10);
      border-color: rgba(13, 91, 83, 0.22);
      border-left-color: var(--accent);
    }

    .file-button-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .file-button-title {
      display: block;
      font-weight: 700;
      line-height: 1.3;
    }

    .file-button-subtitle {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 0.84rem;
    }

    .dirty-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: transparent;
      flex: 0 0 auto;
    }

    .dirty-dot[data-dirty="true"] {
      background: var(--warning);
      box-shadow: 0 0 0 5px rgba(155, 107, 27, 0.12);
    }

    .workspace {
      min-width: 0;
      padding: 24px 24px 24px 0;
    }

    .toolbar-card {
      margin: 0 24px 16px 0;
      padding: 18px 20px;
      position: sticky;
      top: 18px;
      z-index: 2;
    }

    .toolbar-title {
      margin: 0;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 0.96;
      letter-spacing: -0.04em;
      font-weight: 700;
    }

    .toolbar-status {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(13, 91, 83, 0.08);
      color: var(--accent);
      font-size: 0.88rem;
      font-weight: 700;
    }

    .editor-card {
      margin-right: 24px;
      padding: 18px 20px 20px;
      max-width: 980px;
    }

    .editor-empty {
      padding: 14px 4px 4px;
      color: var(--muted);
    }

    .editor-section {
      display: grid;
      gap: 16px;
    }

    .section-panel {
      border: 1px solid rgba(20, 28, 33, 0.08);
      border-radius: 14px;
      background: #ffffff;
      padding: 16px;
    }

    .section-panel + .section-panel {
      margin-top: 16px;
    }

    .section-title {
      margin: 0 0 12px;
      font-size: 1.35rem;
      line-height: 1.2;
      letter-spacing: -0.02em;
      font-weight: 700;
    }

    .field-list {
      display: grid;
      gap: 14px;
    }

    .field {
      display: grid;
      gap: 8px;
    }

    .field-hint {
      font-size: 0.86rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .object-panel {
      border: 1px solid rgba(20, 28, 33, 0.08);
      border-radius: 12px;
      background: #fafafa;
      padding: 16px;
    }

    .object-title {
      margin: 0 0 12px;
      font-size: 1rem;
      line-height: 1.3;
      font-weight: 700;
    }

    .list-panel {
      border: 1px solid rgba(20, 28, 33, 0.08);
      border-radius: 12px;
      background: #fafafa;
      padding: 14px;
    }

    .list-item {
      border: 1px solid rgba(20, 28, 33, 0.08);
      border-radius: 12px;
      background: #ffffff;
      padding: 0;
      overflow: hidden;
    }

    .list-item + .list-item {
      margin-top: 12px;
    }

    .list-item summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 12px 10px;
    }

    .list-item summary::-webkit-details-marker {
      display: none;
    }

    .list-item-grip {
      flex: 0 0 auto;
      margin-top: 2px;
      color: var(--muted);
      font-size: 0.9rem;
      letter-spacing: -0.08em;
      user-select: none;
    }

    .list-item-title {
      margin: 0;
      font-weight: 700;
      line-height: 1.3;
      font-size: 0.98rem;
    }

    .list-item-subtitle {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.45;
    }

    .list-actions {
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .list-item-body {
      border-top: 1px solid rgba(20, 28, 33, 0.08);
      padding: 14px;
      display: grid;
      gap: 14px;
    }

    .list-item-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .list-item[data-drop-target="true"] {
      outline: 2px solid rgba(13, 91, 83, 0.22);
      outline-offset: 0;
    }

    .list-item[data-dragging="true"] {
      opacity: 0.55;
    }

    .list-item:not([open]) .list-item-body {
      display: none;
    }

    .asset-row {
      display: grid;
      gap: 10px;
    }

    .asset-preview {
      display: grid;
      gap: 8px;
    }

    .asset-preview img {
      display: block;
      width: min(240px, 100%);
      max-height: 180px;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid rgba(20, 28, 33, 0.12);
      background: #ffffff;
    }

    .asset-preview a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 700;
      word-break: break-all;
    }

    .summary-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 7px 10px;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--muted);
      background: rgba(31, 36, 40, 0.05);
    }

    .editor-loading {
      padding: 28px 4px;
      color: var(--muted);
    }

    .hidden-file-input {
      display: none;
    }

    @media (max-width: 980px) {
      .app-shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        border-right: 0;
        border-bottom: 1px solid var(--panel-border);
        position: static;
        height: auto;
      }

      .workspace {
        padding: 0 24px 24px;
      }

      .toolbar-card,
      .editor-card {
        margin-right: 0;
        max-width: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function draftStorageKey(path) {
  return `bg-cms-draft:${path}`;
}

function isImagePath(value) {
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(String(value || ''));
}

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
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
    (field.fields || []).forEach(child => {
      result[child.name] = defaultValueForField(child);
    });
    return result;
  }

  if (widget === 'list') {
    return [];
  }

  if (widget === 'select') {
    return field.options && field.options.length ? field.options[0] : '';
  }

  if (widget === 'number') {
    return 0;
  }

  return '';
}

function deepClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
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

async function fetchJsonPath(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load ${path} (${response.status})`);
  }
  return response.text();
}

async function loadManifest() {
  const raw = await fetchJsonPath('/admin/config.yml');
  return YAML.parse(raw);
}

async function loadAdminSettings() {
  const raw = await fetchJsonPath('/admin/admin-settings.json');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in /admin/admin-settings.json: ${error.message}`);
  }
}

async function loadFileData(path) {
  const relativePath = normalizePath(path).replace(/^src\/_data\/cms\//, '');
  const response = await fetch(`/cms-data/${relativePath}`);
  if (!response.ok) {
    throw new Error(`Unable to load ${path} from site data (${response.status})`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
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

function setStatus(message, tone = '') {
  state.message = message;
  const target = document.getElementById('admin-status');
  if (target) {
    target.textContent = message || '';
    target.dataset.tone = tone || '';
  }
}

function setCurrentFile(path) {
  state.currentPath = path;
  renderSidebar();
  renderEditor();
}

function markDirty(path) {
  state.dirtyPaths.add(path);
  writeLocalDraft(path, state.drafts.get(path));
  renderSidebar();
  renderToolbar();
}

function clearDirty(path) {
  state.dirtyPaths.delete(path);
  clearLocalDraft(path);
  renderSidebar();
  renderToolbar();
}

function updateDraft(path, nextValue) {
  state.drafts.set(path, nextValue);
  markDirty(path);
}

function createLoginShell(message = '', tone = '') {
  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <p class="auth-kicker">Admin access</p>
        <h1 class="auth-title">Bollag CMS</h1>
        <p class="auth-copy">
          Sign in with an approved email address to edit page sections and publish changes.
        </p>

        <form class="auth-form" id="login-form">
          <label class="auth-label" for="email">
            Email address
            <input
              class="auth-input"
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="bernardogancho99@gmail.com"
              required
            >
          </label>

          <button class="btn btn-primary" type="submit" id="login-submit">Send magic link</button>
        </form>

        <p class="auth-status" id="login-status"${tone ? ` data-tone="${escapeHtml(tone)}"` : ''}>${message ? escapeHtml(message) : ''}</p>
        <p class="auth-meta">
          The editor publishes to GitHub on your behalf after Supabase login.
        </p>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const statusEl = document.getElementById('login-status');
  const submitButton = document.getElementById('login-submit');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();

    if (!email) {
      statusEl.textContent = 'Enter an email address first.';
      statusEl.dataset.tone = 'error';
      return;
    }

    if (!APPROVED_EMAILS.has(email)) {
      statusEl.textContent = 'That email is not approved for CMS access.';
      statusEl.dataset.tone = 'error';
      return;
    }

    submitButton.disabled = true;
    statusEl.textContent = 'Sending your login link...';
    statusEl.dataset.tone = '';

    const response = await fetch('/api/admin/request-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        redirectTo: LOGIN_REDIRECT,
      }),
    });

    submitButton.disabled = false;

    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { error: text };
    }

    if (!response.ok) {
      statusEl.textContent = payload.error || `Could not send the login link (${response.status}).`;
      statusEl.dataset.tone = 'error';
      return;
    }

    statusEl.textContent = payload.message || 'Check your email for the login link.';
    statusEl.dataset.tone = 'success';
  });
}

function createAppShell() {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-card">
          <p class="sidebar-kicker">Bollag CMS</p>
          <h1 class="sidebar-title">Sections</h1>
          <p class="sidebar-email" id="sidebar-email"></p>
          <div class="sidebar-search">
            <input class="file-search" id="file-search" type="search" placeholder="Search sections">
          </div>
          <p class="sidebar-note">One file equals one section. Edit the section, then publish.</p>
          <div class="collection-list" id="collection-list"></div>
        </div>
      </aside>

      <main class="workspace">
        <div class="toolbar-card">
          <div class="editor-toolbar">
            <div>
              <p class="toolbar-kicker">Now editing</p>
              <h2 class="toolbar-title" id="current-file-title">Choose a section</h2>
              <p class="toolbar-subtitle" id="current-file-subtitle"></p>
            </div>
            <div class="toolbar-status">
              <span class="status-pill" id="dirty-pill">No changes</span>
              <button class="btn btn-primary" id="publish-button" type="button">Publish changes</button>
              <button class="btn btn-secondary" id="signout-button" type="button">Sign out</button>
            </div>
          </div>
          <p class="status-line" id="admin-status"></p>
        </div>

        <div class="editor-card">
          <div id="editor-loading" class="editor-loading">Pick a section from the left.</div>
          <div id="editor-panel" class="editor-section" hidden></div>
        </div>
      </main>
    </div>
  `;

  document.getElementById('signout-button').addEventListener('click', async () => {
    await supabase.auth.signOut();
    renderLogin();
  });

  document.getElementById('publish-button').addEventListener('click', publishChanges);
  document.getElementById('file-search').addEventListener('input', renderSidebar);
}

function renderLogin(message = '', tone = '') {
  injectStyles();
  createLoginShell(message, tone);
}

function renderToolbar() {
  const dirtyCount = state.dirtyPaths.size;
  const pill = document.getElementById('dirty-pill');
  const title = document.getElementById('current-file-title');
  const subtitle = document.getElementById('current-file-subtitle');
  const button = document.getElementById('publish-button');
  const loading = document.getElementById('editor-loading');
  const panel = document.getElementById('editor-panel');

  if (pill) {
    pill.textContent = dirtyCount > 0 ? `${dirtyCount} unsaved file${dirtyCount === 1 ? '' : 's'}` : 'No changes';
  }

  if (button) {
    button.disabled = state.publishPending || dirtyCount === 0;
    button.textContent = state.publishPending ? 'Publishing...' : 'Publish changes';
  }

  if (title && state.currentPath) {
    const current = state.files.find(file => file.path === state.currentPath);
    title.textContent = current?.fileLabel || 'Untitled section';
    subtitle.textContent = current ? `${current.collectionLabel} • ${current.fileLabel}` : '';
  }

  if (loading && panel) {
    if (state.files.length) {
      loading.hidden = true;
      panel.hidden = false;
    }
  }
}

function renderSidebar() {
  const container = document.getElementById('collection-list');
  const email = document.getElementById('sidebar-email');
  const search = document.getElementById('file-search');
  const query = search ? search.value.trim().toLowerCase() : '';

  if (email && state.user) {
    email.textContent = `Signed in as ${state.user.email}`;
  }

  if (!container) {
    return;
  }

  container.innerHTML = '';

  for (const collection of state.manifestCollections || []) {
    const matchingFiles = collection.files.filter(file => {
      if (!query) {
        return true;
      }
      return [collection.label, file.fileLabel, file.path].some(value => value.toLowerCase().includes(query));
    });

    if (!matchingFiles.length) {
      continue;
    }

    const group = document.createElement('div');
    group.className = 'collection-group';

    const label = document.createElement('p');
    label.className = 'collection-label';
    label.textContent = `${collection.label} (${matchingFiles.length})`;
    group.appendChild(label);

    const fileList = document.createElement('div');
    fileList.className = 'file-list';

    for (const file of matchingFiles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'file-button';
      button.dataset.active = String(file.path === state.currentPath);

      const row = document.createElement('div');
      row.className = 'file-button-row';

      const textWrap = document.createElement('div');
      const title = document.createElement('span');
      title.className = 'file-button-title';
      title.textContent = file.fileLabel;

      const subtitle = document.createElement('span');
      subtitle.className = 'file-button-subtitle';
      subtitle.textContent = `${file.collectionLabel} section`;

      const dot = document.createElement('span');
      dot.className = 'dirty-dot';
      dot.dataset.dirty = String(state.dirtyPaths.has(file.path));

      textWrap.append(title, subtitle);
      row.append(textWrap, dot);
      button.append(row);

      button.addEventListener('click', () => setCurrentFile(file.path));
      fileList.appendChild(button);
    }

    group.appendChild(fileList);
    container.appendChild(group);
  }
}

function buildField(field, value, onChange) {
  const widget = field.widget || 'string';
  const wrap = document.createElement('div');
  wrap.className = 'field';

  if (field.label) {
    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = field.label;
    wrap.appendChild(label);
  }

  if (field.description) {
    const hint = document.createElement('div');
    hint.className = 'field-hint';
    hint.textContent = field.description;
    wrap.appendChild(hint);
  }

  if (widget === 'object') {
    const panel = document.createElement('div');
    panel.className = 'object-panel';
    const title = document.createElement('p');
    title.className = 'object-title';
    title.textContent = field.label || field.name;
    panel.appendChild(title);

    const fieldList = document.createElement('div');
    fieldList.className = 'field-list';
    const current = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

    for (const child of field.fields || []) {
      const childValue = current[child.name];
      const childField = buildField(child, childValue, nextValue => {
        current[child.name] = nextValue;
        onChange(current);
      });
      fieldList.appendChild(childField);
    }

    panel.appendChild(fieldList);
    wrap.appendChild(panel);
    return wrap;
  }

  if (widget === 'list') {
    const panel = document.createElement('div');
    panel.className = 'list-panel';
    const current = Array.isArray(value) ? value : [];

    const list = document.createElement('div');

    const itemField = field.fields ? null : field.field;
    let dragIndex = null;

    current.forEach((item, index) => {
      const itemWrap = document.createElement('details');
      itemWrap.className = 'list-item';
      itemWrap.open = false;
      itemWrap.draggable = true;
      itemWrap.dataset.index = String(index);

      const head = document.createElement('summary');

      const textWrap = document.createElement('div');
      const title = document.createElement('p');
      title.className = 'list-item-title';
      title.textContent = resolveTemplate(field.summary, item) || `${field.label || field.name} ${index + 1}`;
      textWrap.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'list-item-subtitle';
      subtitle.textContent = item && typeof item === 'object' && !Array.isArray(item)
        ? Object.entries(item)
            .slice(0, 3)
            .map(([key, next]) => `${key}: ${Array.isArray(next) ? `${next.length} items` : String(next || '')}`)
            .join(' | ')
        : String(item ?? '');
      textWrap.appendChild(subtitle);

      const grip = document.createElement('span');
      grip.className = 'list-item-grip';
      grip.textContent = '⋮⋮';

      const upButton = document.createElement('button');
      upButton.type = 'button';
      upButton.className = 'btn btn-ghost';
      upButton.textContent = 'Up';
      upButton.disabled = index === 0;
      upButton.addEventListener('click', () => {
        const next = current.slice();
        const [moved] = next.splice(index, 1);
        next.splice(index - 1, 0, moved);
        onChange(next);
        renderEditor();
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn btn-danger';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        const next = current.slice();
        next.splice(index, 1);
        onChange(next);
        renderEditor();
      });

      head.append(grip, textWrap);
      itemWrap.appendChild(head);

      const itemFields = document.createElement('div');
      itemFields.className = 'list-item-body';

      const actions = document.createElement('div');
      actions.className = 'list-item-actions';
      actions.append(upButton, removeButton);
      itemFields.appendChild(actions);

      if (field.fields) {
        const itemValue = item && typeof item === 'object' ? item : {};
        for (const child of field.fields) {
          const childValue = itemValue[child.name];
          const childField = buildField(child, childValue, nextValue => {
            itemValue[child.name] = nextValue;
            onChange(current);
          });
          itemFields.appendChild(childField);
        }
      } else if (itemField) {
        const childField = buildField(itemField, item, nextValue => {
          current[index] = nextValue;
          onChange(current);
        });
        itemFields.appendChild(childField);
      }

      itemWrap.appendChild(itemFields);

      itemWrap.addEventListener('dragstart', event => {
        dragIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
        itemWrap.dataset.dragging = 'true';
      });

      itemWrap.addEventListener('dragend', () => {
        dragIndex = null;
        delete itemWrap.dataset.dragging;
        for (const node of list.querySelectorAll('.list-item[data-drop-target="true"]')) {
          delete node.dataset.dropTarget;
        }
      });

      itemWrap.addEventListener('dragover', event => {
        event.preventDefault();
        if (dragIndex === null || dragIndex === index) {
          return;
        }
        itemWrap.dataset.dropTarget = 'true';
      });

      itemWrap.addEventListener('dragleave', () => {
        delete itemWrap.dataset.dropTarget;
      });

      itemWrap.addEventListener('drop', event => {
        event.preventDefault();
        delete itemWrap.dataset.dropTarget;
        const sourceIndex = dragIndex !== null ? dragIndex : Number(event.dataTransfer.getData('text/plain'));
        if (Number.isNaN(sourceIndex) || sourceIndex === index) {
          return;
        }
        const next = reorderArray(current, sourceIndex, index);
        onChange(next);
        renderEditor();
      });

      list.appendChild(itemWrap);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn btn-secondary';
    addButton.textContent = `Add ${field.label || field.name}`;
    addButton.addEventListener('click', () => {
      const next = current.slice();
      if (field.fields) {
        const item = {};
        for (const child of field.fields) {
          item[child.name] = defaultValueForField(child);
        }
        next.push(item);
      } else if (itemField) {
        next.push(defaultValueForField(itemField));
      } else {
        next.push('');
      }
      onChange(next);
      renderEditor();
    });

    panel.append(list, addButton);
    wrap.appendChild(panel);
    return wrap;
  }

  if (widget === 'image' || widget === 'file') {
    const assetRow = document.createElement('div');
    assetRow.className = 'asset-row';

    const input = document.createElement('input');
    input.className = 'text-input';
    input.type = 'text';
    input.value = value || '';
    input.placeholder = widget === 'image' ? '/assets/media/example.jpg' : '/assets/media/example.mp4';

    const actions = document.createElement('div');
    actions.className = 'asset-actions';

    const uploadButton = document.createElement('button');
    uploadButton.type = 'button';
    uploadButton.className = 'btn btn-secondary';
    uploadButton.textContent = 'Upload file';

    const fileInput = document.createElement('input');
    fileInput.className = 'hidden-file-input';
    fileInput.type = 'file';
    fileInput.accept = widget === 'image' ? 'image/*' : '*';

    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        return;
      }

      uploadButton.disabled = true;
      setStatus(`Uploading ${file.name}...`);

      try {
        const uploaded = await uploadAsset(file);
        input.value = uploaded.publicPath;
        onChange(uploaded.publicPath);
        updatePreview(uploaded.publicPath);
        setStatus(`Uploaded ${file.name}.`, 'success');
      } catch (error) {
        setStatus(error.message, 'error');
      } finally {
        uploadButton.disabled = false;
        fileInput.value = '';
      }
    });

    input.addEventListener('input', () => {
      onChange(input.value);
      updatePreview(input.value);
    });

    actions.append(uploadButton, fileInput);
    assetRow.append(input, actions);

    const preview = document.createElement('div');
    preview.className = 'asset-preview';

    const updatePreview = nextValue => {
      preview.innerHTML = '';
      if (!nextValue) {
        return;
      }

      if (widget === 'image' && isImagePath(nextValue)) {
        const img = document.createElement('img');
        img.src = nextValue;
        img.alt = nextValue;
        preview.appendChild(img);
        return;
      }

      const link = document.createElement('a');
      link.href = nextValue;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = nextValue;
      preview.appendChild(link);
    };

    updatePreview(value);

    wrap.append(assetRow, preview);
    return wrap;
  }

  if (widget === 'select') {
    const select = document.createElement('select');
    select.className = 'select-input';
    for (const option of field.options || []) {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      select.appendChild(optionEl);
    }
    select.value = value || defaultValueForField(field);
    select.addEventListener('change', () => onChange(select.value));
    wrap.appendChild(select);
    return wrap;
  }

  if (widget === 'text') {
    const textarea = document.createElement('textarea');
    textarea.className = 'textarea-input';
    textarea.value = value || '';
    textarea.addEventListener('input', () => onChange(textarea.value));
    wrap.appendChild(textarea);
    return wrap;
  }

  const input = document.createElement('input');
  input.className = 'text-input';
  input.type = widget === 'number' ? 'number' : 'text';
  input.value = value ?? '';
  input.addEventListener('input', () => onChange(widget === 'number' ? Number(input.value) : input.value));
  wrap.appendChild(input);
  return wrap;
}

function renderEditor() {
  const panel = document.getElementById('editor-panel');
  const loading = document.getElementById('editor-loading');
  const current = state.currentPath ? state.drafts.get(state.currentPath) : null;
  const file = state.files.find(next => next.path === state.currentPath);

  if (!panel || !loading) {
    return;
  }

  if (!state.files.length) {
    loading.hidden = false;
    loading.textContent = 'No files found in the manifest.';
    panel.hidden = true;
    return;
  }

  loading.hidden = true;
  panel.hidden = false;
  panel.innerHTML = '';

  if (!file || !current) {
    const empty = document.createElement('div');
    empty.className = 'editor-empty';
    empty.textContent = 'Choose a section from the sidebar.';
    panel.appendChild(empty);
    return;
  }

  const section = document.createElement('div');
  section.className = 'section-panel';

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.textContent = file.fileLabel;

  const subtitle = document.createElement('p');
  subtitle.className = 'status-note';
  subtitle.textContent = `${file.collectionLabel} • ${file.fileLabel}`;

  const fieldList = document.createElement('div');
  fieldList.className = 'field-list';

  for (const field of file.fields) {
    const fieldValue = current[field.name];
    const rendered = buildField(field, fieldValue, nextValue => {
      current[field.name] = nextValue;
      updateDraft(file.path, current);
    });
    fieldList.appendChild(rendered);
  }

  section.append(title, subtitle, fieldList);
  panel.appendChild(section);
  renderToolbar();
}

async function loadEditor() {
  if (state.loadingManifest) {
    return;
  }

  state.loadingManifest = true;
  state.loading = true;
  createAppShell();
  setStatus('Loading content...');

  try {
    const manifest = await loadManifest();
    state.manifest = manifest;
    state.manifestCollections = flattenManifest(manifest);

    const files = [];
    for (const collection of state.manifestCollections) {
      files.push(...collection.files);
    }

    const loadedFiles = await Promise.all(
      files.map(async file => {
        const remote = await loadFileData(file.path);
        const localDraft = readLocalDraft(file.path);
        const value = localDraft || remote;

        if (localDraft) {
          state.dirtyPaths.add(file.path);
        }

        state.drafts.set(file.path, deepClone(value));
        return file;
      }),
    );

    state.files = loadedFiles;
    state.currentPath = state.files[0]?.path || null;
    state.loading = false;
    state.appReady = true;
    renderSidebar();
    renderToolbar();
    renderEditor();
    setStatus('Ready.', 'success');
  } finally {
    state.loadingManifest = false;
  }
}

async function uploadAsset(file) {
  const token = state.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to upload files.');
  }

  const data = await readFileAsDataUrl(file);
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: file.name,
      type: file.type,
      data,
    }),
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text };
  }

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Upload failed (${response.status})`);
  }

  return payload;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function publishChanges() {
  if (state.publishPending) {
    return;
  }

  const dirtyPaths = Array.from(state.dirtyPaths);
  if (!dirtyPaths.length) {
    setStatus('No files to publish.');
    return;
  }

  const token = state.session?.access_token;
  if (!token) {
    setStatus('Your Supabase session expired. Please sign in again.', 'error');
    return;
  }

  state.publishPending = true;
  renderToolbar();
  setStatus(`Publishing ${dirtyPaths.length} file${dirtyPaths.length === 1 ? '' : 's'}...`);

  try {
    const payload = {
      message: `Update CMS content (${dirtyPaths.length} file${dirtyPaths.length === 1 ? '' : 's'})`,
      files: dirtyPaths.map(path => ({
        path,
        content: `${JSON.stringify(state.drafts.get(path), null, 2)}\n`,
      })),
    };

    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Publish failed (${response.status})`);
    }

    for (const path of dirtyPaths) {
      clearLocalDraft(path);
      state.dirtyPaths.delete(path);
    }

    renderSidebar();
    renderToolbar();
    setStatus(
      data.deployMessage
        ? `Published commit ${data.commitSha?.slice(0, 7) || ''}. ${data.deployMessage}`
        : `Published commit ${data.commitSha?.slice(0, 7) || ''}.`,
      'success',
    );
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    state.publishPending = false;
    renderToolbar();
  }
}

async function bootstrap() {
  injectStyles();
  if (!state.settings) {
    state.settings = await loadAdminSettings();
  }

  const approvedEmails = Array.isArray(state.settings.approvedEmails) && state.settings.approvedEmails.length
    ? state.settings.approvedEmails
    : ['bernardogancho99@gmail.com'];
  APPROVED_EMAILS = new Set(approvedEmails.map(email => String(email).trim().toLowerCase()).filter(Boolean));

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    renderLogin(error.message, 'error');
    return;
  }

  state.session = data.session || null;
  state.user = state.session?.user || null;

  if (!state.session || !state.user?.email) {
    renderLogin();
    return;
  }

  const email = state.user.email.toLowerCase();
  if (!APPROVED_EMAILS.has(email)) {
    await supabase.auth.signOut();
    renderLogin('That email is not approved for CMS access.', 'error');
    return;
  }

  await loadEditor();
}

supabase.auth.onAuthStateChange(async (_event, session) => {
  state.session = session || null;
  state.user = session?.user || null;

  if (!session || !session.user?.email) {
    state.manifest = null;
    state.files = [];
    state.drafts.clear();
    state.dirtyPaths.clear();
    state.currentPath = null;
    state.appReady = false;
    renderLogin();
    return;
  }

  if (!state.appReady && !state.loadingManifest) {
    await loadEditor();
  }
});

bootstrap().catch(error => {
  renderLogin(error.message, 'error');
});
