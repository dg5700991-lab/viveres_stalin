const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
const K = 'pos_auth';
export const store = {
  get() { try { return JSON.parse(localStorage.getItem(K)); } catch { return null; } },
  set(v) { localStorage.setItem(K, JSON.stringify(v)); },
  clear() { localStorage.removeItem(K); },
};
let onLogout = () => {};
export const setOnLogout = (f) => (onLogout = f);
export const list = (d) => (Array.isArray(d) ? d : d?.results ?? []);
export const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function msg(d, s) {
  if (s === 0) return 'No hay conexión con el servidor. Revisa que el backend esté encendido.';
  if (!d) return `Error ${s}`;
  if (typeof d === 'string') return d.startsWith('<') ? `Error ${s}` : d;
  if (d.detail) return d.detail;
  if (d.error) return d.error;
  const k = Object.keys(d)[0];
  if (k) { const v = d[k]; return `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`; }
  return `Error ${s}`;
}
export class ApiError extends Error {
  constructor(status, data) { super(msg(data, status)); this.status = status; this.data = data; }
}

let refreshing = null;
function refresh() {
  if (!refreshing) {
    refreshing = (async () => {
      const a = store.get();
      if (!a?.refresh) throw new ApiError(401);
      let r;
      try { r = await fetch(BASE + '/auth/refresh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: a.refresh }) }); }
      catch { throw new ApiError(0); }           // sin red: NO cerrar sesión
      if (!r.ok) throw new ApiError(401);
      const d = await r.json();
      store.set({ ...a, access: d.access, ...(d.refresh ? { refresh: d.refresh } : {}) });
    })().finally(() => (refreshing = null));
  }
  return refreshing;
}

export async function api(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const h = isForm ? {} : { 'Content-Type': 'application/json' };
  const a = store.get();
  if (auth && a?.access) h.Authorization = 'Bearer ' + a.access;
  let r;
  try {
    r = await fetch(BASE + path, {
      method,
      headers: h,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  }
  catch { throw new ApiError(0); }
  if (r.status === 401 && auth && retry) {
    try { await refresh(); }
    catch (e) {
      if (e.status === 0) throw e;
      store.clear(); onLogout();
      throw new ApiError(401, { detail: 'Tu sesión venció. Ingresa de nuevo.' });
    }
    return api(path, { method, body, auth, retry: false });
  }
  const t = await r.text();
  let d = null;
  try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  if (!r.ok) throw new ApiError(r.status, d);
  return d;
}
