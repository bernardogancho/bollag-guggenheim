const { requireAdmin } = require('./_lib/supabase');
const { createCommit } = require('./_lib/github');

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sanitizeFilename(name) {
  return String(name || 'asset')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    await requireAdmin(req);
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const data = String(body.data || '').trim();

    if (!name || !data) {
      return json(res, 400, { error: 'File name and data are required.' });
    }

    const base64 = data.includes(',') ? data.split(',').pop() : data;
    const safeName = `${Date.now()}-${sanitizeFilename(name)}`;
    const repoPath = `src/assets/media/uploads/${safeName}`;
    const publicPath = `/assets/media/uploads/${safeName}`;

    const commit = await createCommit({
      message: `Upload media asset ${safeName}`,
      files: [
        {
          path: repoPath,
          content: base64,
          encoding: 'base64',
        },
      ],
    });

    return json(res, 200, {
      ok: true,
      commitSha: commit.sha,
      repositoryPath: repoPath,
      publicPath,
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: error.message || 'Could not upload the asset.',
      details: error.details || null,
    });
  }
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
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
