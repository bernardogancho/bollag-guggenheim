const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://zttbkscbtvgeteawycsi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wJ-U3kVqV3ej7RJywW8iAA_hUbFQ3Z-';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ALLOWED_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || 'bernardogancho99@gmail.com')
    .split(',')
    .map(email => String(email).trim().toLowerCase())
    .filter(Boolean),
);

let adminClient;
let authClient;

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
  const email = String(user.email || '').toLowerCase();
  if (!ALLOWED_EMAILS.has(email)) {
    const error = new Error('This email is not approved for CMS publishing.');
    error.statusCode = 403;
    throw error;
  }

  return { user, token };
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
  getAdminClient,
  getAuthClient,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  ALLOWED_EMAILS,
};
