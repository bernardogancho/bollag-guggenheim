const { requireAdmin } = require('./_lib/supabase');
const { listCmsDeploys } = require('./_lib/github');

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    await requireAdmin(req);

    const url = new URL(req.url, 'http://localhost');
    const limit = Math.max(1, Math.min(10, Number(url.searchParams.get('limit') || 6) || 6));
    const deploys = await listCmsDeploys({ limit });

    return json(res, 200, {
      ok: true,
      latestSha: deploys[0]?.sha || null,
      deploys,
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      error: error.message || 'Could not load deploy history.',
      details: error.details || null,
    });
  }
};
