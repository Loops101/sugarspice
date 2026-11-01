// Thin fetch wrapper. Errors carry a friendly message plus the offending field name when the server gives one.
export class ApiError extends Error {
  constructor(message, status, field) { super(message); this.status = status; this.field = field; }
}

export async function api(path, { method = 'GET', body, raw, headers } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('You seem to be offline. Check your connection and try again.', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON */ }
  if (!res.ok) throw new ApiError((data && data.error) || 'Something went wrong. Please try again.', res.status, data && data.field);
  return data;
}
