import { useState, useMemo } from 'react';
import { api, list, money } from '../api';
import { Spinner, Empty, ErrorBox, Ok, useLoad } from '../ui';
import { IconSearch, IconUser, IconCredit } from '../icons';

export default function Fiados() {
  const deudoresLoad = useLoad(() => api('/clientes/deudores/').then(list));
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [lib, setLib] = useState(null);
  const [libLoading, setLibLoading] = useState(false);
  const [monto, setMonto] = useState('');
  const [met, setMet] = useState('EFECTIVO');
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState({});
  const [abonoOk, setAbonoOk] = useState(null);

  const deudoresFiltrados = useMemo(() => {
    const todos = deudoresLoad.data || [];
    if (!q.trim()) return todos;
    const qLow = q.toLowerCase();
    return todos.filter((c) =>
      (c.nombre || '').toLowerCase().includes(qLow) ||
      (c.telefono || '').toLowerCase().includes(qLow)
    );
  }, [deudoresLoad.data, q]);

  const abrirCliente = async (c) => {
    setSel(c);
    setLib(null);
    setMsg({});
    setAbonoOk(null);
    setLibLoading(true);
    try {
      const data = list(await api(`/clientes/${c.id}/libreta/`));
      setLib(data);
    } catch (x) {
      setMsg({ err: x });
    } finally {
      setLibLoading(false);
    }
  };

  const abonar = async (e) => {
    e.preventDefault();
    setMsg({});
    setAbonoOk(null);
    try {
      await api(`/clientes/${sel.id}/abono/`, {
        method: 'POST',
        body: { monto: Number(monto), metodo_pago: met, referencia: ref },
      });
      setMonto('');
      setRef('');
      setAbonoOk('Abono registrado exitosamente.');
      deudoresLoad.reload();
      await abrirCliente(sel);
    } catch (x) {
      setMsg({ err: x });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr] items-start">
      {/* Panel izquierdo: lista de deudores */}
      <section className="space-y-2">
        <h2 className="text-base font-black text-ink flex items-center gap-2">
          <IconCredit className="h-5 w-5 text-brand" />
          Clientes con Fiado
        </h2>

        {/* Búsqueda */}
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-ink/40">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            className="inp pl-9 text-sm"
            placeholder="Buscar por nombre o teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {deudoresLoad.loading ? (
          <Spinner />
        ) : deudoresLoad.error ? (
          <ErrorBox error={deudoresLoad.error} onRetry={deudoresLoad.reload} />
        ) : deudoresFiltrados.length === 0 ? (
          <Empty>
            {q ? 'Sin resultados para esa búsqueda.' : 'Nadie debe nada por ahora.'}
          </Empty>
        ) : (
          <div className="card divide-y p-0 overflow-hidden">
            {deudoresFiltrados.map((c) => (
              <button
                key={c.id}
                onClick={() => abrirCliente(c)}
                className={`flex w-full justify-between items-center p-3 text-left hover:bg-brand-soft transition ${
                  sel?.id === c.id ? 'bg-brand-soft border-l-4 border-brand' : ''
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <IconUser className="h-4 w-4 text-ink/40 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-ink truncate">{c.nombre}</p>
                    {c.telefono && <p className="text-xs text-ink/50">{c.telefono}</p>}
                  </div>
                </span>
                <span className="font-black text-sm text-red-700 flex-shrink-0 ml-2">
                  {money(c.saldo_fiado)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Panel derecho: detalle del cliente */}
      <section className="space-y-3">
        {!sel ? (
          <Empty>Elige un cliente para ver su libreta.</Empty>
        ) : (
          <>
            {/* Encabezado del cliente */}
            <div className="card flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <IconUser className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-black text-ink">{sel.nombre}</h3>
                  {sel.telefono && <p className="text-xs text-ink/50">{sel.telefono}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-ink/50 uppercase font-bold">Deuda total</p>
                <p className="text-xl font-black text-red-700">{money(sel.saldo_fiado)}</p>
              </div>
            </div>

            {/* Formulario de abono */}
            <form onSubmit={abonar} className="card space-y-3">
              <h4 className="font-bold text-sm text-ink/80 uppercase tracking-wide">Registrar Abono</h4>

              <div className="relative">
                <span className="absolute left-3 top-2 text-base font-bold text-ink/40">$</span>
                <input
                  className="inp pl-7 text-lg font-black"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {['EFECTIVO', 'TRANSFERENCIA'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMet(m)}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      met === m
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-ink/70 border-ink/20 hover:bg-brand-soft'
                    }`}
                  >
                    {m === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'}
                  </button>
                ))}
              </div>

              {met === 'TRANSFERENCIA' && (
                <input
                  className="inp text-sm"
                  placeholder="Número de referencia bancaria"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                />
              )}

              <ErrorBox error={msg.err} />
              {abonoOk && <Ok>{abonoOk}</Ok>}

              <button className="btn-p w-full">Registrar abono</button>
            </form>

            {/* Movimientos / Libreta */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-ink/70 uppercase tracking-wide">Movimientos</h4>
              {libLoading ? (
                <Spinner />
              ) : !lib ? null : lib.length === 0 ? (
                <Empty>Sin movimientos todavía.</Empty>
              ) : (
                <div className="card divide-y p-0 overflow-hidden">
                  {lib.map((x, i) => (
                    <div key={x.id ?? i} className="flex items-center justify-between p-3 text-sm gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink capitalize">{(x.tipo || '').replace(/_/g, ' ').toLowerCase()}</p>
                        <p className="text-xs text-ink/50">
                          {x.fecha ? new Date(x.fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-black text-sm ${x.monto < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {x.monto < 0 ? '-' : '+'}{money(Math.abs(x.monto))}
                        </p>
                        {x.saldo_resultante != null && (
                          <p className="text-xs text-ink/50">Saldo: {money(x.saldo_resultante)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
