// All server calls in one place. Every endpoint already exists — this file
// only wraps them with auth and error handling. Backend must not change.
export function createApi(getToken, fetcher = (...args) => fetch(...args)) {
  // Network-level rejections (fetcher throwing) intentionally propagate to callers.
  async function request(method, url, body) {
    const response = await fetcher(url, {
      method,
      headers: {
        Authorization: `Bearer ${getToken() || ''}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const raw = await response.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      // HTML error pages must never leak into toasts — sanitize any raw non-JSON body.
      const message = payload.error || payload.message
        || (raw && raw.trim().startsWith('<')
          ? `The server returned an error (${response.status}).`
          : (raw || `The server returned an error (${response.status}).`).slice(0, 200));
      throw new Error(message);
    }
    return payload;
  }

  return {
    me: () => request('GET', '/api/me'),
    listUsers: () => request('GET', '/api/admin/users'),
    addUser: user => request('POST', '/api/admin/users', user),
    updateUser: patch => request('PATCH', '/api/admin/users', patch),
    removeUser: id => request('DELETE', '/api/admin/users', { id }),
    publish: (files, message) => request('POST', '/api/publish', { message, files }),
    upload: payload => request('POST', '/api/upload', payload),
    deploys: (limit = 6) => request('GET', `/api/deploys?limit=${limit}`),
    revert: sha => request('POST', '/api/revert', { sha }),
  };
}
