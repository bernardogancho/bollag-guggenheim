// Daily keep-alive: pings Supabase so the free-tier project never pauses
// from inactivity (paused projects break CMS login entirely). Invoked by the
// Vercel cron declared in vercel.json. Harmless by design: one outbound GET
// to the public auth health endpoint; no data, no auth state.
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  let status = 0;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    status = response.status;
  } catch {
    status = -1; // unreachable (e.g. project paused) — still report 200 so the cron itself doesn't alarm
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: status >= 200 && status < 300, supabaseStatus: status, at: new Date().toISOString() }));
};
