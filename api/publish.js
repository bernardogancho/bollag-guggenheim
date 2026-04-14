const { requireAdmin } = require('./_lib/supabase');
const { createCommit } = require('./_lib/github');

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
    await requireAdmin(req);
    const body = await readJson(req);
    const files = Array.isArray(body.files) ? body.files : [];

    if (!files.length) {
      return json(res, 400, { error: 'No files were provided.' });
    }

    const allowedPrefix = 'src/_data/cms/';
    const sanitizedFiles = files.map(file => {
      const path = String(file.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!path.startsWith(allowedPrefix)) {
        const error = new Error(`Publishing is only allowed for CMS content files: ${path}`);
        error.statusCode = 400;
        throw error;
      }

      return {
        path,
        content: String(file.content || ''),
        encoding: file.encoding || 'utf-8',
      };
    });

    const commit = await createCommit({
      message: String(body.message || `Update CMS content (${sanitizedFiles.length} file${sanitizedFiles.length === 1 ? '' : 's'})`),
      files: sanitizedFiles,
    });

    return json(res, 200, {
      ok: true,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: error.message || 'Could not publish content.',
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
