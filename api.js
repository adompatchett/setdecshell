// client/src/api.js
const API = import.meta.env.VITE_API_BASE || '/api';

let productionIdCache = localStorage.getItem('currentProductionId') || '';
export function setProductionId(id) {
  productionIdCache = id || '';
  localStorage.setItem('currentProductionId', productionIdCache);
}

function buildHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const token = localStorage.getItem('token');
  const pid = productionIdCache || localStorage.getItem('currentProductionId') || '';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (pid) headers['x-production-id'] = pid;
  return headers;
}

function redirectToSlugLogin() {
  const { pathname, search } = window.location;
  const segs = pathname.split('/').filter(Boolean);
  const slug = segs[0];
  if (!slug) return; // not in a tenant route
  const r = encodeURIComponent(pathname + search);
  window.location.assign(`/${slug}/login?r=${r}`);
}

async function handle(resp) {
  if (!resp.ok) {
    // Try to parse error
    let body = {};
    try { body = await resp.json(); } catch {}
    if (resp.status === 401 || resp.status === 403) {
      redirectToSlugLogin();
      throw new Error(body.error || `${resp.status} ${resp.statusText}`);
    }
    const err = new Error(body.error || `${resp.status} ${resp.statusText}`);
    err.status = resp.status; err.body = body; throw err;
  }
  return resp.json();
}

export async function apiGet(path, opts = {}) {
  const resp = await fetch(API + path, { ...opts, headers: buildHeaders(opts.headers) });
  return handle(resp);
}

export async function apiPost(path, body, opts = {}) {
  const resp = await fetch(API + path, {
    method: 'POST',
    headers: buildHeaders(opts.headers),
    body: JSON.stringify(body || {}),
  });
  return handle(resp);
}
