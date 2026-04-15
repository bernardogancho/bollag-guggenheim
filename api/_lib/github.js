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

function encodeRepoPath(path) {
  return normalizeRepoPath(path)
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
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

async function getCommitDetails(sha) {
  return githubRequest(`/commits/${sha}`);
}

async function listBranchCommits(limit = 20) {
  const perPage = Math.max(1, Math.min(100, Number(limit) || 20));
  return githubRequest(`/commits?sha=${encodeURIComponent(GITHUB_BRANCH)}&per_page=${perPage}`);
}

async function getFileContentAtRef(path, ref) {
  try {
    return await githubRequest(`/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(ref)}`);
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }
    throw error;
  }
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
    const path = normalizeRepoPath(file.path);

    if (file.delete || file.content === null || file.content === undefined) {
      treeEntries.push({
        path,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
      continue;
    }

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
      path,
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

async function listCmsDeploys({ limit = 6, searchLimit = 25 } = {}) {
  const desiredCount = Math.max(1, Math.min(20, Number(limit) || 6));
  const fetchCount = Math.max(desiredCount * 4, Number(searchLimit) || 25);
  const summaries = await listBranchCommits(fetchCount);
  const deploys = [];
  const cmsPrefix = 'src/_data/cms/';

  for (const summary of summaries) {
    const detail = await getCommitDetails(summary.sha);
    const cmsFiles = (detail.files || []).filter(file => normalizeRepoPath(file.filename).startsWith(cmsPrefix));

    if (!cmsFiles.length) {
      continue;
    }

    const isRevert = /^revert\b/i.test(detail.commit?.message || '');
    const pathsPreview = cmsFiles
      .slice(0, 3)
      .map(file => normalizeRepoPath(file.filename).replace(cmsPrefix, ''))
      .join(', ');

    deploys.push({
      sha: detail.sha,
      message: detail.commit?.message || summary.commit?.message || 'CMS update',
      date: detail.commit?.author?.date || detail.commit?.committer?.date || summary.commit?.author?.date || null,
      author: detail.commit?.author?.name || summary.commit?.author?.name || 'Unknown',
      commitUrl: detail.html_url || summary.html_url || '',
      fileCount: cmsFiles.length,
      pathsPreview,
      isRevert,
      canRevert: true,
      parentSha: detail.parents?.[0]?.sha || null,
      files: cmsFiles.map(file => ({
        path: normalizeRepoPath(file.filename),
      })),
    });

    if (deploys.length >= desiredCount) {
      break;
    }
  }

  return deploys;
}

async function revertCmsDeploy({ sha, message }) {
  if (!sha) {
    throw new Error('A commit SHA is required to revert a deploy.');
  }

  const detail = await getCommitDetails(sha);
  const parentSha = detail.parents?.[0]?.sha;
  if (!parentSha) {
    throw new Error('This commit cannot be reverted because it has no parent.');
  }

  const cmsPrefix = 'src/_data/cms/';
  const cmsFiles = (detail.files || []).filter(file => normalizeRepoPath(file.filename).startsWith(cmsPrefix));

  if (!cmsFiles.length) {
    throw new Error('This commit does not contain CMS files.');
  }

  const files = [];
  for (const file of cmsFiles) {
    const previous = await getFileContentAtRef(file.filename, parentSha);
    if (!previous) {
      files.push({
        path: file.filename,
        delete: true,
      });
      continue;
    }

    files.push({
      path: file.filename,
      content: previous.content,
      encoding: 'base64',
    });
  }

  const commit = await createCommit({
    message: message || `Revert CMS deploy ${sha.slice(0, 7)}`,
    files,
  });

  return {
    commit,
    revertedSha: sha,
    parentSha,
    revertedFiles: cmsFiles.map(file => normalizeRepoPath(file.filename)),
  };
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
  normalizeRepoPath,
  encodeRepoPath,
  getCommitDetails,
  getFileContentAtRef,
  listBranchCommits,
  listCmsDeploys,
  revertCmsDeploy,
  createCommit,
};
