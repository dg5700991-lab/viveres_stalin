import { useState, useEffect, useCallback } from 'react';
import { IconClose, IconAlert, IconCheck } from './icons';

export const Spinner = () => (
  <div className="flex justify-center py-10">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
  </div>
);

export const Empty = ({ children }) => (
  <div className="rounded-2xl border-2 border-dashed border-ink/15 p-10 text-center text-sm text-ink/50 bg-white/50">
    {children}
  </div>
);

// ─── ErrorBox mejorado: mensaje claro + detalle técnico oculto ───────────────
export const ErrorBox = ({ error, onRetry }) => {
  const [showTech, setShowTech] = useState(false);
  if (!error) return null;
  const message = error.message || String(error);
  const technical = error.technical || null;
  return (
    <div
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm"
      role="alert"
      style={{ boxShadow: '0 2px 12px rgba(220,38,38,0.08)' }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-shrink-0 text-red-500">
          <IconAlert className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-800 leading-snug">{message}</p>
          {technical && (
            <div className="mt-2">
              <button
                type="button"
                className="text-[11px] text-red-400 hover:text-red-600 underline underline-offset-2 transition"
                onClick={() => setShowTech(v => !v)}
              >
                {showTech ? 'Ocultar detalle tecnico' : 'Ver detalle tecnico'}
              </button>
              {showTech && (
                <pre className="mt-1.5 rounded-lg bg-red-100/70 px-3 py-2 text-[10px] text-red-700 overflow-auto max-h-28 whitespace-pre-wrap break-all font-mono">
                  {technical}
                </pre>
              )}
            </div>
          )}
        </div>
        {onRetry && (
          <button
            className="flex-shrink-0 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 transition"
            onClick={onRetry}
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
};

// ─── OkBox: confirmación de éxito ───────────────────────────────────────────
export const Ok = ({ children }) => children ? (
  <div
    className="flex items-center gap-3 rounded-2xl border border-brand/20 p-4 text-sm"
    role="status"
    style={{ background: 'linear-gradient(135deg, #E6F0E2, #d4ebcc)' }}
  >
    <span className="text-brand flex-shrink-0"><IconCheck className="h-4 w-4" /></span>
    <span className="font-semibold text-brand-dark">{children}</span>
  </div>
) : null;

// ─── useLoad ────────────────────────────────────────────────────────────────
export function useLoad(fn, deps = []) {
  const [s, set] = useState({ data: null, loading: true, error: null });
  const run = useCallback(() => {
    set(p => ({ ...p, loading: true, error: null }));
    fn().then(
      data => set({ data, loading: false, error: null }),
      error => set({ data: null, loading: false, error }),
    );
  }, deps); // eslint-disable-line
  useEffect(run, [run]);
  return { ...s, reload: run };
}

export const KV = ({ obj }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
    {Object.entries(obj || {}).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
      <div key={k} className="contents">
        <dt className="text-ink/60 capitalize">{k.replace(/_/g, ' ')}</dt>
        <dd className="font-medium">{String(v)}</dd>
      </div>
    ))}
  </dl>
);

// ─── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm overflow-y-auto">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto my-8"
        style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.18)' }}
      >
        <div className="mb-5 flex items-center justify-between border-b border-ink/10 pb-4">
          <h3 className="text-base font-black text-ink">{title}</h3>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 hover:bg-brand-soft hover:text-brand transition"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
