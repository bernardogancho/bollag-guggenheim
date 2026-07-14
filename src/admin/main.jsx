import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './admin.css';
import { AdminContext } from './lib/context.js';
import { createApi } from './lib/api.js';
import { createStore } from './lib/store.js';
import { loadFieldConfig, loadContentFile, loadMediaIndex } from './lib/content.js';
import { ALL_FILES } from './manifest.js';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { Shell } from './shell/Shell.jsx';

const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

let accessToken = '';
const api = createApi(() => accessToken);
const store = createStore();

function BootScreen() {
  return (
    <div className="auth-shell">
      <section className="card auth-card">
        <div className="auth-kicker">Bollag CMS</div>
        <h1 className="auth-title">Loading…</h1>
        <p className="auth-copy">Preparing the editor and loading the current website content.</p>
      </section>
    </div>
  );
}

function LoadErrorScreen({ message, onRetry }) {
  return (
    <div className="auth-shell">
      <section className="card auth-card">
        <div className="auth-kicker">Bollag CMS</div>
        <h1 className="auth-title">Could not load the website content</h1>
        <p className="auth-copy">{message}</p>
        <button type="button" className="button button-primary" onClick={onRetry}>Try again</button>
      </section>
    </div>
  );
}

function AdminRoot() {
  const [mode, setMode] = useState('boot');
  const [user, setUser] = useState(null);
  const [fieldConfig, setFieldConfig] = useState(null);
  const [mediaIndex, setMediaIndex] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [note, setNote] = useState({ text: '', tone: '' });
  const [loadError, setLoadError] = useState('');

  async function loadWorkspace() {
    const [config, media] = await Promise.all([loadFieldConfig(), loadMediaIndex()]);
    await Promise.all(ALL_FILES.map(async filePath => store.loadFile(filePath, await loadContentFile(filePath))));
    setFieldConfig(config);
    setMediaIndex(media);
    setMode('app');
  }

  // Workspace load failures are usually transient (a blip on one of the 22
  // content fetches); keep the session and offer a retry instead of signing
  // the user out.
  async function enterWorkspace() {
    try {
      await loadWorkspace();
    } catch (error) {
      setLoadError(error.message || 'Something went wrong while loading the content.');
      setMode('error');
    }
  }

  async function tryEnter(session) {
    accessToken = session.access_token;
    // Auth gate first, in its own try/catch: only a rejected account is
    // signed out. Load failures after this point never revoke the session.
    try {
      const { user: me } = await api.me(); // throws if the account has no CMS role
      setUser(me);
    } catch (error) {
      await supabase.auth.signOut();
      accessToken = '';
      setUser(null);
      setMode('login');
      setNote({ text: error.message || 'That account does not have CMS access.', tone: 'error' });
      return;
    }
    await enterWorkspace();
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void tryEnter(data.session);
      } else {
        setMode('login');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep the bearer token fresh: Supabase rotates it (~hourly) and emits
      // TOKEN_REFRESHED; without this, publishes in long sessions would 401.
      if (session) {
        accessToken = session.access_token;
      }
      if (event === 'SIGNED_OUT') {
        accessToken = '';
        setUser(null);
        setMode('login');
        // Note: do NOT clear the auth note here — tryEnter() sets an
        // explanatory error right before signing a rejected account out, and
        // this callback can fire after it.
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmitLogin = async event => {
    event.preventDefault();
    setLoginPending(true);
    setNote({ text: 'Signing in…', tone: '' });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        throw error;
      }
      setPassword('');
      await tryEnter(data.session);
    } catch (error) {
      setNote({ text: error.message || 'Could not sign in. Check your email and password.', tone: 'error' });
    } finally {
      setLoginPending(false);
    }
  };

  if (mode === 'boot') {
    return <BootScreen />;
  }
  if (mode === 'error') {
    return (
      <LoadErrorScreen
        message={loadError}
        onRetry={() => {
          setMode('boot');
          void enterWorkspace();
        }}
      />
    );
  }
  if (mode === 'login') {
    return (
      <LoginScreen
        email={email} password={password} onEmail={setEmail} onPassword={setPassword}
        onSubmit={onSubmitLogin} pending={loginPending} note={note.text} tone={note.tone}
      />
    );
  }
  return (
    <AdminContext.Provider value={{ user, api, store, fieldConfig, mediaIndex, setMediaIndex, signOut: () => supabase.auth.signOut() }}>
      <Shell />
    </AdminContext.Provider>
  );
}

const mount = document.getElementById('admin-root');
if (mount) {
  createRoot(mount).render(<AdminRoot />);
}
