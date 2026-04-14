const settings = require('../../src/admin/admin-settings.json');
const GITHUB_OWNER = settings.githubOwner || process.env.GITHUB_OWNER || 'bernardogancho';
const GITHUB_REPO = settings.githubRepo || process.env.GITHUB_REPO || 'bollag-guggenheim';
const GITHUB_BRANCH = settings.githubBranch || process.env.GITHUB_BRANCH || 'main';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

function githubToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('Missing GITHUB_TOKEN environment variable.');
  }
  return token;
}

function normalizeRepoPath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

async function githubRequest(path, options = {}) {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${githubToken()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`GitHub API request failed (${response.status}).`);
    error.statusCode = response.status;
    error.details = text;
    throw error;
  }

  return text ? JSON.parse(text) : null;
}

async function createCommit({ message, files }) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('No files were provided for commit.');
  }

  const ref = await githubRequest(`/git/ref/heads/${GITHUB_BRANCH}`);
  const parentSha = ref.object.sha;
  const parentCommit = await githubRequest(`/git/commits/${parentSha}`);

  const treeEntries = [];
  for (const file of files) {
    const blob = await githubRequest('/git/blobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: file.content,
        encoding: file.encoding || 'utf-8',
      }),
    });

    treeEntries.push({
      path: normalizeRepoPath(file.path),
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  const tree = await githubRequest('/git/trees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base_tree: parentCommit.tree.sha,
      tree: treeEntries,
    }),
  });

  const commit = await githubRequest('/git/commits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [parentSha],
    }),
  });

  await githubRequest(`/git/refs/heads/${GITHUB_BRANCH}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sha: commit.sha,
      force: false,
    }),
  });

  return commit;
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
  normalizeRepoPath,
  createCommit,
};
