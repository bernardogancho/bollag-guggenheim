import React, { useEffect, useState } from 'react';
import { useAdmin } from '../lib/context.js';
import { useToast } from '../shell/Toasts.jsx';

export function PeopleScreen() {
  const { api, user: me } = useAdmin();
  const toast = useToast();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'editor' });
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState('');

  const reload = () => {
    setError('');
    api.listUsers().then(payload => setPeople(payload.users || [])).catch(err => { setPeople([]); setError(err.message); });
  };
  useEffect(reload, []);

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.addUser(form);
      toast(`${form.email} can sign in now.`, 'success');
      setForm({ name: '', email: '', password: '', role: 'editor' });
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, action) => {
    setPendingId(id);
    try {
      await action();
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPendingId('');
    }
  };

  return (
    <div>
      <div className="screen-header">
        <div>
          <h2 className="screen-title">People</h2>
          <p className="screen-subtitle">Who can edit the website. Admins can also manage people.</p>
        </div>
      </div>

      <section className="group-card">
        <h3 className="group-card-title">Add a person</h3>
        <form className="field-grid two-col" onSubmit={submit}>
          <label className="field"><span className="field-label">Name</span>
            <input className="input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Full name" /></label>
          <label className="field"><span className="field-label">Email</span>
            <input className="input" type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="person@company.com" autoComplete="off" /></label>
          <label className="field"><span className="field-label">Password</span>
            <input className="input" type="text" required minLength={6} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters" autoComplete="off" /></label>
          <label className="field"><span className="field-label">Role</span>
            <select className="select" value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>
              <option value="editor">Editor — can edit the website</option>
              <option value="admin">Admin — can also manage people</option>
            </select></label>
          <div className="field-span">
            <button className="button button-primary" type="submit" disabled={saving || !form.email || form.password.length < 6}>
              {saving ? 'Saving…' : 'Add person'}
            </button>
          </div>
        </form>
      </section>

      <section className="group-card">
        <h3 className="group-card-title">Current people</h3>
        {people === null ? <div className="skeleton" /> : error ? (
          <div className="empty-state"><div className="empty-state-title">Could not load people</div><div className="empty-state-description">{error}</div></div>
        ) : (
          <div className="section-rows">
            {people.map(person => {
              const isSelf = person.id === me.id;
              const busy = pendingId === person.id;
              return (
                <div key={person.id} className="tray-row">
                  <div>
                    <div className="tray-row-title">{person.email} {isSelf ? '· you' : ''} <span className={`badge ${person.role === 'admin' ? 'badge-warning' : 'badge-neutral'}`}>{person.role === 'admin' ? 'Admin' : 'Editor'}</span></div>
                    <div className="tray-row-sub">{person.name || 'No name'} · {person.lastSignInAt ? `Last sign in ${new Date(person.lastSignInAt).toLocaleString()}` : 'Never signed in'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="button button-ghost" disabled={busy} onClick={() => {
                      const next = window.prompt(`New password for ${person.email} (at least 6 characters):`);
                      if (next === null) return;
                      if (next.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
                      act(person.id, () => api.updateUser({ id: person.id, password: next }).then(() => toast('Password updated.', 'success')));
                    }}>Reset password</button>
                    <button type="button" className="button button-ghost" disabled={busy || isSelf} onClick={() => act(person.id, () => api.updateUser({ id: person.id, role: person.role === 'admin' ? 'editor' : 'admin' }))}>
                      {person.role === 'admin' ? 'Make editor' : 'Make admin'}
                    </button>
                    {!isSelf ? (
                      <button type="button" className="button button-danger" disabled={busy} onClick={() => {
                        if (window.confirm(`Remove ${person.email}? They lose access immediately.`)) {
                          act(person.id, () => api.removeUser(person.id));
                        }
                      }}>Remove</button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
