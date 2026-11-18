import { useState, useEffect, useCallback } from 'react';
import { IconClose } from './icons';
export const Spinner = () => <div className="flex justify-center py-10"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;
export const Empty = ({ children }) => <div className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">{children}</div>;
export const ErrorBox = ({ error, onRetry }) => error ? (
  <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
    <span>{error.message || String(error)}</span>{onRetry && <button className="btn-s" onClick={onRetry}>Reintentar</button>}
  </div>) : null;
export const Ok = ({ children }) => children ? <div className="rounded-lg bg-brand-soft p-3 text-sm text-brand-dark" role="status">{children}</div> : null;
export function useLoad(fn, deps = []) {
  const [s, set] = useState({ data: null, loading: true, error: null });
  const run = useCallback(() => { set((p) => ({ ...p, loading: true, error: null })); fn().then((data) => set({ data, loading: false, error: null }), (error) => set({ data: null, loading: false, error })); }, deps); // eslint-disable-line
  useEffect(run, [run]);
  return { ...s, reload: run };
}
export const KV = ({ obj }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
    {Object.entries(obj || {}).filter(([, v]) => typeof v !== 'object').map(([k, v]) => <div key={k} className="contents"><dt className="text-ink/60">{k.replace(/_/g, ' ')}</dt><dd className="font-medium">{String(v)}</dd></div>)}
  </dl>);

export function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto my-8">
        <div className="mb-4 flex items-center justify-between border-b border-ink/10 pb-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 hover:bg-brand-soft hover:text-ink transition"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
