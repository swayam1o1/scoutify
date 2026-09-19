export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001/api';

// Single entry point for backend calls so the JWT header stays consistent everywhere.
export async function authFetch(path, { token, method = 'GET', body, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';

  return fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}
