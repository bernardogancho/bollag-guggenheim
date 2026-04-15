const { requireAdmin } = require('./_lib/supabase');
const { listCmsDeploys, revertCmsDeploy } = require('./_lib/github');

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
    const requestedSha = String(body.sha || '').trim();
    const message = String(body.message || '').trim();
    const deploys = requestedSha ? [] : await listCmsDeploys({ limit: 1 });
    const sha = requestedSha || deploys[0]?.sha;

    if (!sha) {
      return json(res, 400, { error: 'No deploy was found to revert.' });
    }

    const result = await revertCmsDeploy({ sha, message: message || `Revert CMS deploy ${sha.slice(0, 7)}` });

    return json(res, 200, {
      ok: true,
      commitSha: result.commit.sha,
      commitUrl: result.commit.html_url,
      revertedSha: result.revertedSha,
      revertedFiles: result.revertedFiles,
      deployMessage: `Reverted ${result.revertedSha.slice(0, 7)}.`,
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: error.message || 'Could not revert the deploy.',
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
