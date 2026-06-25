// CMS access, one concept: every CMS user is a Supabase Auth account whose
// app_metadata.cms.role is 'admin' or 'editor'. Login is email + password.
// Admins manage people (create with a password, change role, reset password,
// remove). There is no owner env var, no magic links, no invite emails.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ROLES = new Set(['admin', 'editor']);
const MIN_PASSWORD = 6;

let adminClient;

function getAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
    error.statusCode = 500;
    throw error;
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function roleOf(user) {
  const role = String(user?.app_metadata?.cms?.role || '').trim().toLowerCase();
  return ROLES.has(role) ? role : '';
}

function publicUser(user) {
  return {
    id: user?.id || null,
    email: normalizeEmail(user?.email),
    name: String(user?.user_metadata?.name || '').trim(),
    role: roleOf(user),
    createdAt: user?.created_at || null,
    lastSignInAt: user?.last_sign_in_at || null,
  };
}

function httpError(message, statusCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
}

// Verify the caller's access token, then load the authoritative account record
// via the service role (so app_metadata can't be spoofed by the client).
async function authenticate(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw httpError('Not signed in.', 401);
  }

  const token = authHeader.slice(7);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' },
  });

  const text = await response.text();
  if (!response.ok) {
    throw httpError('Your session is not valid. Please sign in again.', 401, text);
  }

  const tokenUser = JSON.parse(text);
  const { data, error } = await getAdminClient().auth.admin.getUserById(tokenUser.id);
  if (error) {
    throw httpError('Could not verify your access.', 500, error.message || String(error));
  }
  return data?.user || tokenUser;
}

// Any CMS user (admin or editor) — used to gate content editing.
async function requireUser(req) {
  const user = await authenticate(req);
  const role = roleOf(user);
  if (!role) {
    throw httpError('This account does not have CMS access.', 403);
  }
  return { user, role };
}

// Admins only — used to gate people management.
async function requireAdmin(req) {
  const result = await requireUser(req);
  if (result.role !== 'admin') {
    throw httpError('Only an admin can manage people.', 403);
  }
  return result;
}

async function eachAuthUser(visit) {
  const client = getAdminClient();
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }
    const batch = data?.users || [];
    for (const user of batch) {
      const stop = visit(user);
      if (stop) {
        return;
      }
    }
    if (batch.length < 200) {
      return;
    }
  }
}

async function listCmsUsers() {
  const users = [];
  await eachAuthUser(user => {
    if (roleOf(user)) {
      users.push(publicUser(user));
    }
  });
  return users.sort((a, b) => {
    if (a.role !== b.role) {
      return a.role === 'admin' ? -1 : 1;
    }
    return a.email.localeCompare(b.email);
  });
}

async function findByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }
  let match = null;
  await eachAuthUser(user => {
    if (normalizeEmail(user.email) === normalized) {
      match = user;
      return true;
    }
    return false;
  });
  return match;
}

// Create a person (or, if the email already exists, set their password/role) so
// they can sign in immediately — no confirmation email needed.
async function createCmsUser({ name = '', email, password, role = 'editor' }) {
  const normalizedEmail = normalizeEmail(email);
  const nextRole = ROLES.has(String(role).toLowerCase()) ? String(role).toLowerCase() : 'editor';

  if (!normalizedEmail) {
    throw httpError('Email is required.', 400);
  }
  if (!password || String(password).length < MIN_PASSWORD) {
    throw httpError(`Password must be at least ${MIN_PASSWORD} characters.`, 400);
  }

  const client = getAdminClient();
  const existing = await findByEmail(normalizedEmail);

  if (existing) {
    const { data, error } = await client.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...(existing.app_metadata || {}), cms: { role: nextRole } },
      ...(name ? { user_metadata: { ...(existing.user_metadata || {}), name } } : {}),
    });
    if (error) {
      throw error;
    }
    return { action: 'updated', user: publicUser(data?.user || existing) };
  }

  const { data, error } = await client.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    app_metadata: { cms: { role: nextRole } },
    user_metadata: name ? { name } : {},
  });
  if (error) {
    throw error;
  }
  return { action: 'created', user: publicUser(data?.user) };
}

async function updateCmsUser(id, { password, role, name } = {}) {
  if (!id) {
    throw httpError('A person id is required.', 400);
  }

  const client = getAdminClient();
  const { data: current, error: lookupError } = await client.auth.admin.getUserById(id);
  if (lookupError) {
    throw lookupError;
  }
  const existing = current?.user;
  if (!existing) {
    throw httpError('That person was not found.', 404);
  }

  const patch = {};
  if (password !== undefined && password !== '') {
    if (String(password).length < MIN_PASSWORD) {
      throw httpError(`Password must be at least ${MIN_PASSWORD} characters.`, 400);
    }
    patch.password = password;
    patch.email_confirm = true;
  }
  if (role && ROLES.has(String(role).toLowerCase())) {
    patch.app_metadata = { ...(existing.app_metadata || {}), cms: { role: String(role).toLowerCase() } };
  }
  if (typeof name === 'string') {
    patch.user_metadata = { ...(existing.user_metadata || {}), name: name.trim() };
  }

  const { data, error } = await client.auth.admin.updateUserById(id, patch);
  if (error) {
    throw error;
  }
  return { user: publicUser(data?.user || existing) };
}

async function removeCmsUser(id) {
  if (!id) {
    throw httpError('A person id is required.', 400);
  }
  const { error } = await getAdminClient().auth.admin.deleteUser(id);
  if (error) {
    throw error;
  }
  return { ok: true };
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  requireUser,
  requireAdmin,
  listCmsUsers,
  findByEmail,
  createCmsUser,
  updateCmsUser,
  removeCmsUser,
  publicUser,
  roleOf,
  normalizeEmail,
};
