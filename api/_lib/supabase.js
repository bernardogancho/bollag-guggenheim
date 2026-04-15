const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OWNER_EMAILS = new Set(['bernardogancho99@gmail.com']);
const CMS_ROLES = new Set(['owner', 'editor']);

let adminClient;
let authClient;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isOwnerEmail(email) {
  return OWNER_EMAILS.has(normalizeEmail(email));
}

function getCmsRole(user) {
  return String(user?.app_metadata?.cmsRole || user?.user_metadata?.cmsRole || '').trim().toLowerCase();
}

function isCmsAccessActive(user) {
  if (!user) {
    return false;
  }

  if (isOwnerEmail(user.email)) {
    return true;
  }

  const active = user?.app_metadata?.cmsAccess;
  if (active === false) {
    return false;
  }

  return CMS_ROLES.has(getCmsRole(user));
}

function normalizeCmsUser(user) {
  const email = normalizeEmail(user?.email);
  const role = isOwnerEmail(email) ? 'owner' : (getCmsRole(user) || 'editor');
  const active = isOwnerEmail(email) ? true : isCmsAccessActive(user);

  return {
    id: user?.id || `email:${email}`,
    email,
    name: String(user?.user_metadata?.name || user?.user_metadata?.full_name || '').trim(),
    role: active ? role : 'disabled',
    active,
    createdAt: user?.created_at || null,
    lastSignInAt: user?.last_sign_in_at || null,
    invitedAt: user?.invited_at || null,
  };
}

async function listAuthUsers() {
  const client = getAdminClient();
  const users = [];
  let page = 1;
  let total = Infinity;

  while (users.length < total) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const nextUsers = Array.isArray(data?.users) ? data.users : [];
    users.push(...nextUsers);

    if (!nextUsers.length) {
      break;
    }

    total = typeof data?.total === 'number' && Number.isFinite(data.total) ? data.total : users.length;
    if (nextUsers.length < 100) {
      break;
    }

    page += 1;
  }

  return users;
}

async function findAuthUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const users = await listAuthUsers();
  return users.find(user => normalizeEmail(user.email) === normalized) || null;
}

async function listCmsAdminRecords() {
  const users = await listAuthUsers();
  const records = users
    .filter(user => isOwnerEmail(user.email) || getCmsRole(user) || user?.app_metadata?.cmsAccess !== undefined)
    .map(normalizeCmsUser);

  for (const ownerEmail of OWNER_EMAILS) {
    if (!records.some(record => record.email === ownerEmail)) {
      records.unshift({
        id: `owner:${ownerEmail}`,
        email: ownerEmail,
        name: '',
        role: 'owner',
        active: true,
        createdAt: null,
        lastSignInAt: null,
        invitedAt: null,
      });
    }
  }

  return records.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') {
      return -1;
    }
    if (b.role === 'owner' && a.role !== 'owner') {
      return 1;
    }

    const statusOrder = Number(b.active) - Number(a.active);
    if (statusOrder !== 0) {
      return statusOrder;
    }

    return a.email.localeCompare(b.email);
  });
}

async function isCmsEmailApproved(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  if (isOwnerEmail(normalized)) {
    return true;
  }

  const users = await listAuthUsers();
  return users.some(user => normalizeEmail(user.email) === normalized && isCmsAccessActive(user));
}

async function sendCmsLoginLink(email, redirectTo) {
  const supabase = getAuthClient();
  return supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: redirectTo || `${process.env.PUBLIC_SITE_URL || 'https://bg-murex-three.vercel.app'}/admin/`,
    },
  });
}

async function requireAdmin(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const error = new Error('Missing Supabase access token.');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.slice(7);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error('Supabase session is not valid.');
    error.statusCode = 401;
    error.details = text;
    throw error;
  }

  const user = JSON.parse(text);
  const email = normalizeEmail(user.email);

  if (isOwnerEmail(email)) {
    return { user, token };
  }

  const adminClient = getAdminClient();
  const { data, error } = await adminClient.auth.admin.getUserById(user.id);
  if (error) {
    const authError = new Error('Could not verify CMS access.');
    authError.statusCode = 500;
    authError.details = error.message || String(error);
    throw authError;
  }

  const detailedUser = data?.user || null;
  if (!isCmsAccessActive(detailedUser || user)) {
    const error = new Error('This email is not approved for CMS publishing.');
    error.statusCode = 403;
    throw error;
  }

  return { user: detailedUser || user, token };
}

async function requireOwner(req) {
  const result = await requireAdmin(req);
  if (!isOwnerEmail(result.user?.email)) {
    const error = new Error('Only the owner can manage CMS access.');
    error.statusCode = 403;
    throw error;
  }

  return result;
}

async function upsertCmsAdmin({ email, name = '', redirectTo, role = 'editor' }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const error = new Error('Email is required.');
    error.statusCode = 400;
    throw error;
  }

  if (isOwnerEmail(normalizedEmail)) {
    const error = new Error('The owner account is already granted access.');
    error.statusCode = 400;
    throw error;
  }

  const adminClient = getAdminClient();
  const existing = await findAuthUserByEmail(normalizedEmail);
  const nextRole = CMS_ROLES.has(String(role || '').toLowerCase()) ? String(role || '').toLowerCase() : 'editor';
  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, {
      app_metadata: {
        ...(existing.app_metadata || {}),
        cmsRole: nextRole,
        cmsAccess: true,
        cmsGrantedAt: now,
        cmsRevokedAt: null,
      },
      ...(name
        ? {
            user_metadata: {
              ...(existing.user_metadata || {}),
              name,
            },
          }
        : {}),
    });

    if (error) {
      throw error;
    }

    const user = data?.user || existing;
    if (name && !data?.user) {
      user.user_metadata = {
        ...(user.user_metadata || {}),
        name,
      };
    }

    await sendCmsLoginLink(normalizedEmail, redirectTo);

    return {
      action: 'updated',
      user,
    };
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: name ? { name } : undefined,
    redirectTo,
  });

  if (error) {
    throw error;
  }

  const invitedUser = data?.user || null;
  if (invitedUser?.id) {
    const { data: updatedData, error: updateError } = await adminClient.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: {
        ...(invitedUser.app_metadata || {}),
        cmsRole: nextRole,
        cmsAccess: true,
        cmsGrantedAt: now,
        cmsRevokedAt: null,
      },
      ...(name
        ? {
            user_metadata: {
              ...(invitedUser.user_metadata || {}),
              name,
            },
          }
        : {}),
    });

    if (updateError) {
      throw updateError;
    }

    return {
      action: 'invited',
      user: updatedData?.user || invitedUser,
    };
  }

  return {
    action: 'invited',
    user: invitedUser,
  };
}

async function revokeCmsAdmin(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const error = new Error('Email is required.');
    error.statusCode = 400;
    throw error;
  }

  if (isOwnerEmail(normalizedEmail)) {
    const error = new Error('The owner account cannot be revoked.');
    error.statusCode = 400;
    throw error;
  }

  const adminClient = getAdminClient();
  const existing = await findAuthUserByEmail(normalizedEmail);
  if (!existing?.id) {
    const error = new Error('That email is not in the CMS roster.');
    error.statusCode = 404;
    throw error;
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, {
    app_metadata: {
      ...(existing.app_metadata || {}),
      cmsRole: 'disabled',
      cmsAccess: false,
      cmsRevokedAt: new Date().toISOString(),
    },
  });

  if (error) {
    throw error;
  }

  return {
    action: 'revoked',
    user: data?.user || existing,
  };
}

function getAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
    error.statusCode = 500;
    throw error;
  }

  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

function getAuthClient() {
  if (!authClient) {
    authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return authClient;
}

module.exports = {
  requireAdmin,
  requireOwner,
  getAdminClient,
  getAuthClient,
  listCmsAdminRecords,
  isCmsEmailApproved,
  sendCmsLoginLink,
  upsertCmsAdmin,
  revokeCmsAdmin,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  OWNER_EMAILS,
};
