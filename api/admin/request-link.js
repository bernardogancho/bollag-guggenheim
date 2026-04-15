const { isCmsEmailApproved, sendCmsLoginLink } = require('../_lib/supabase');

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();

    if (!email) {
      return json(res, 400, { error: 'Email is required.' });
    }

    if (!(await isCmsEmailApproved(email))) {
      return json(res, 403, { error: 'That email is not approved for CMS access.' });
    }

    const { error } = await sendCmsLoginLink(
      email,
      body.redirectTo || `${process.env.PUBLIC_SITE_URL || 'https://bg-murex-three.vercel.app'}/admin/`,
    );

    if (error) {
      return json(res, 500, { error: error.message || 'Could not send the invite link.' });
    }

    return json(res, 200, {
      ok: true,
      message: 'Check your email for the login link.',
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: error.message || 'Could not process the login request.',
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
