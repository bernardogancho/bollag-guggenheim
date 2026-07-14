import React from 'react';

export function LoginScreen({ email, password, onEmail, onPassword, onSubmit, pending, note, tone }) {
  return (
    <div className="auth-shell">
      <section className="card auth-card">
        <div className="auth-kicker">Admin access</div>
        <h1 className="auth-title">Bollag CMS</h1>
        <p className="auth-copy">Sign in with your email and password to edit the website.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">Email address</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={event => onEmail(event.target.value)} placeholder="you@company.com" required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={event => onPassword(event.target.value)} placeholder="Your password" required />
          </label>
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={`status-line ${note ? `status-${tone || 'neutral'}` : ''}`}>
          {note || 'Forgot your password? Ask an admin to reset it for you.'}
        </div>
      </section>
    </div>
  );
}
