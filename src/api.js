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

// ─── Traducción de mensajes técnicos a lenguaje cotidiano ───────────────────
const FIELD_LABELS = {
  monto: 'el monto',
  total: 'el total',
  productos: 'los productos',
  password: 'la contrasena',
  username: 'el usuario',
  email: 'el correo',
  stock: 'el stock',
  precio: 'el precio',
  cantidad: 'la cantidad',
  pagos: 'el pago',
  fondo_inicial: 'el fondo inicial',
  metodo_pago: 'el metodo de pago',
  referencia: 'la referencia',
  nombre: 'el nombre',
};

const HTTP_MSGS = {
  400: 'Revisa los datos ingresados e intenta de nuevo.',
  401: 'Tu sesion vencio. Inicia sesion nuevamente.',
  403: 'No tienes permiso para realizar esta accion.',
  404: 'No se encontro lo que buscabas.',
  405: 'Esta accion no esta disponible en este momento.',
  409: 'Hay un conflicto con los datos. Recarga la pagina e intenta de nuevo.',
  422: 'Algunos datos no son validos. Revisalos e intenta de nuevo.',
  429: 'Demasiados intentos. Espera un momento e intenta de nuevo.',
  500: 'El servidor tuvo un problema interno. Intenta de nuevo en un momento.',
  502: 'El servidor no esta disponible en este momento. Intenta mas tarde.',
  503: 'El servicio esta temporalmente fuera de linea. Intenta en unos minutos.',
};

function humanizeField(key) {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

function humanizeValue(val) {
  if (!val) return '';
  if (Array.isArray(val)) return val.map(humanizeValue).join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  const v = String(val);
  // Reemplazos de mensajes técnicos comunes del backend Django
  const replacements = [
    [/This field (is required|may not be blank)\./i, 'Este campo es obligatorio.'],
    [/Ensure this value is (greater|less) than or equal to ([0-9.]+)\./i, (_, dir, n) =>
      `El valor debe ser ${dir === 'greater' ? 'mayor o igual a' : 'menor o igual a'} ${n}.`],
    [/This field must be unique\./i, 'Ya existe un registro con este valor.'],
    [/Enter a valid email address\./i, 'Ingresa un correo electronico valido.'],
    [/Ensure this field has no more than ([0-9]+) characters\./i, (_, n) =>
      `Maximo ${n} caracteres permitidos.`],
    [/Invalid pk .* object does not exist\./i, 'El elemento seleccionado no existe.'],
    [/No active account found with the given credentials/i,
      'Usuario o contrasena incorrectos.'],
    [/Token is invalid or expired/i, 'Tu sesion vencio. Vuelve a iniciar sesion.'],
    [/This password is too short\./i, 'La contrasena es muy corta (minimo 10 caracteres).'],
    [/This password is too common\./i, 'Esa contrasena es muy comun. Elige una mas segura.'],
    [/No tienes permiso/i, 'No tienes permiso para realizar esta accion.'],
    [/Authentication credentials were not provided/i, 'Debes iniciar sesion para continuar.'],
    [/stock insuficiente/i, 'No hay suficiente stock disponible.'],
    [/los pagos deben sumar exactamente el total/i,
      'El monto ingresado no coincide con el total de la venta.'],
  ];
  for (const [pattern, replacement] of replacements) {
    if (typeof replacement === 'function') {
      const m = v.match(pattern);
      if (m) return replacement(...m);
    } else if (pattern.test(v)) {
      return v.replace(pattern, replacement);
    }
  }
  return v;
}

function msg(d, s) {
  if (s === 0) return 'Sin conexion al servidor. Revisa tu internet o que el sistema este encendido.';
  if (!d) return HTTP_MSGS[s] || `Error inesperado (codigo ${s}).`;
  if (typeof d === 'string') {
    if (d.startsWith('<')) return HTTP_MSGS[s] || `Error inesperado (codigo ${s}).`;
    return humanizeValue(d);
  }
  // Mensajes específicos del backend
  if (d.detail) return humanizeValue(d.detail);
  if (d.error) return humanizeValue(d.error);
  if (d.non_field_errors) {
    const errs = Array.isArray(d.non_field_errors) ? d.non_field_errors : [d.non_field_errors];
    return errs.map(humanizeValue).join(' ');
  }
  // Errores de campo específicos — mostrar el primero con contexto
  const k = Object.keys(d)[0];
  if (k) {
    const v = d[k];
    const label = humanizeField(k);
    const detail = Array.isArray(v) ? v.map(humanizeValue).join(', ') :
      typeof v === 'object' ? humanizeValue(v) : humanizeValue(String(v));
    return `Problema con ${label}: ${detail}`;
  }
  return HTTP_MSGS[s] || `Error inesperado (codigo ${s}).`;
}

export class ApiError extends Error {
  constructor(status, data) {
    super(msg(data, status));
    this.status = status;
    this.data = data;
    this.technical = data ? JSON.stringify(data) : `HTTP ${status}`;
  }
}

let refreshing = null;
function refresh() {
  if (!refreshing) {
    refreshing = (async () => {
      const a = store.get();
      if (!a?.refresh) throw new ApiError(401);
      let r;
      try {
        r = await fetch(BASE + '/auth/refresh/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: a.refresh }),
        });
      } catch { throw new ApiError(0); }
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
  } catch { throw new ApiError(0); }

  if (r.status === 401 && auth && retry) {
    try { await refresh(); }
    catch (e) {
      if (e.status === 0) throw e;
      store.clear(); onLogout();
      throw new ApiError(401, { detail: 'Tu sesion vencio. Ingresa de nuevo.' });
    }
    return api(path, { method, body, auth, retry: false });
  }
  const t = await r.text();
  let d = null;
  try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  if (!r.ok) throw new ApiError(r.status, d);
  return d;
}
