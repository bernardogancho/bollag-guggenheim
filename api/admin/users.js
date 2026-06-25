// People management (admins only).
//   GET    → list all CMS people
//   POST   → add a person { name, email, password, role }
//   PATCH  → update a person { id, password?, role?, name? }  (reset password / change role)
//   DELETE → remove a person { id }
const {
  requireAdmin,
  listCmsUsers,
  createCmsUser,
  updateCmsUser,
  removeCmsUser,
} = require('../_lib/supabase');

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      await requireAdmin(req);
      return json(res, 200, { ok: true, users: await listCmsUsers() });
    }

    if (req.method === 'POST') {
      await requireAdmin(req);
      const body = await readJson(req);
      const result = await createCmsUser(body);
      return json(res, 200, {
        ok: true,
        action: result.action,
        user: result.user,
        message: result.action === 'created' ? 'Person added.' : 'Person updated.',
      });
    }

    if (req.method === 'PATCH') {
      await requireAdmin(req);
      const body = await readJson(req);
      const result = await updateCmsUser(body.id, body);
      return json(res, 200, { ok: true, user: result.user, message: 'Saved.' });
    }

    if (req.method === 'DELETE') {
      const { user } = await requireAdmin(req);
      const body = await readJson(req);
      if (body.id && body.id === user.id) {
        return json(res, 400, { error: 'You cannot remove your own account.' });
      }
      await removeCmsUser(body.id);
      return json(res, 200, { ok: true, message: 'Removed.' });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: error.message || 'Could not update people.',
      details: error.details || null,
    });
  }
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}
