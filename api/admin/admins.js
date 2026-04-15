const {
  listCmsAdminRecords,
  requireAdmin,
  requireOwner,
  revokeCmsAdmin,
  upsertCmsAdmin,
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
      const admins = await listCmsAdminRecords();

      return json(res, 200, {
        ok: true,
        admins,
      });
    }

    if (req.method === 'POST') {
      await requireOwner(req);
      const body = await readJson(req);
      const result = await upsertCmsAdmin({
        email: body.email,
        name: body.name,
        role: body.role,
        redirectTo: body.redirectTo,
      });

      return json(res, 200, {
        ok: true,
        action: result.action,
        admin: normalizeResponseAdmin(result.user),
        message: result.action === 'invited' ? 'Invite sent.' : 'Access updated and login link sent.',
      });
    }

    if (req.method === 'DELETE') {
      await requireOwner(req);
      const body = await readJson(req);
      const result = await revokeCmsAdmin(body.email);

      return json(res, 200, {
        ok: true,
        action: result.action,
        admin: normalizeResponseAdmin(result.user),
        message: 'Access revoked.',
      });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: error.message || 'Could not update CMS access.',
      details: error.details || null,
    });
  }
};

function normalizeResponseAdmin(user) {
  if (!user) {
    return null;
  }

  const email = String(user.email || '').trim().toLowerCase();
  const role = String(user?.app_metadata?.cmsRole || user?.user_metadata?.cmsRole || '').trim().toLowerCase();
  const active = role !== 'disabled' && user?.app_metadata?.cmsAccess !== false;

  return {
    id: user.id || `email:${email}`,
    email,
    name: String(user?.user_metadata?.name || user?.user_metadata?.full_name || '').trim(),
    role: role || (active ? 'editor' : 'disabled'),
    active,
    createdAt: user?.created_at || null,
    lastSignInAt: user?.last_sign_in_at || null,
    invitedAt: user?.invited_at || null,
  };
}

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
