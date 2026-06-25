// Returns the signed-in CMS user and their role (admin/editor), or 401/403.
// The admin app calls this right after login to confirm access and decide
// whether to show the People screen.
const { requireUser, publicUser } = require('./_lib/supabase');

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  try {
    const { user } = await requireUser(req);
    return json(res, 200, { ok: true, user: publicUser(user) });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Could not verify access.' });
  }
};
