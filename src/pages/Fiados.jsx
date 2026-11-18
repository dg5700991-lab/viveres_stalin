import { useState, useMemo } from 'react';
import { api, list, money } from '../api';
import { Spinner, Empty, ErrorBox, Ok, useLoad } from '../ui';
import { IconSearch, IconUser, IconCredit, IconCash, IconTransfer } from '../icons';

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
  const [busy, setBusy] = useState(false);

  const deudoresFiltrados = useMemo(() => {
    const todos = deudoresLoad.data || [];
    if (!q.trim()) return todos;
    const qLow = q.toLowerCase();
    return todos.filter((c) =>
      (c.nombre || '').toLowerCase().includes(qLow) ||
      (c.telefono || '').toLowerCase().includes(qLow)
    );
  }, [deudoresLoad.data, q]);

  const totalDeudas = useMemo(() => {
    return (deudoresLoad.data || []).reduce((acc, c) => acc + Number(c.saldo_fiado || 0), 0);
  }, [deudoresLoad.data]);

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

    const valMonto = Number(monto);
    if (isNaN(valMonto) || valMonto <= 0) {
      setMsg({
        err: {
          message: 'Ingresa una cantidad de dinero válida (mayor a $0.00) para el abono.',
        },
      });
      return;
    }

    if (met === 'TRANSFERENCIA' && !ref.trim()) {
      setMsg({
        err: {
          message: 'Por favor escribe el número de comprobante o referencia de la transferencia para verificar el pago.',
        },
      });
      return;
    }

    setBusy(true);
    try {
      await api(`/clientes/${sel.id}/abono/`, {
        method: 'POST',
        body: { monto: valMonto, metodo_pago: met, referencia: ref.trim() },
      });
      setMonto('');
      setRef('');
      setAbonoOk(`¡Abono de ${money(valMonto)} registrado con éxito! La deuda del cliente ha sido actualizada.`);
      deudoresLoad.reload();
      await abrirCliente(sel);
    } catch (x) {
      setMsg({ err: x });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumen general de cuentas por cobrar */}
      <div className="rounded-2xl bg-white border border-ink/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
            <IconCredit className="h-6 w-6 text-brand" />
            Cuentas por Cobrar y Fiados
          </h1>
          <p className="text-xs sm:text-sm text-ink/60 mt-0.5">
            Registro de clientes con crédito pendiente, historial de compras fiadas y cobro de abonos.
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2 text-left sm:text-right">
          <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block">
            Total pendiente por cobrar
          </span>
          <span className="text-xl font-black text-red-700">{money(totalDeudas)}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr] items-start">
        {/* Panel izquierdo: lista de deudores */}
        <section
          className={`space-y-3 ${sel ? 'hidden lg:block' : 'block'}`}
        >
          {/* Búsqueda */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              className="inp pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-white border-ink/15 focus:border-brand shadow-sm"
              placeholder="Buscar cliente por nombre o teléfono…"
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
              {q
                ? `No encontramos ningún cliente que coincida con "${q}".`
                : 'No hay clientes con saldos pendientes de pago en este momento.'}
            </Empty>
          ) : (
            <div className="card divide-y divide-ink/5 p-0 overflow-hidden rounded-2xl bg-white border border-ink/10 shadow-sm max-h-[600px] overflow-y-auto">
              {deudoresFiltrados.map((c) => (
                <button
                  key={c.id}
                  onClick={() => abrirCliente(c)}
                  className={`flex w-full justify-between items-center p-3.5 text-left hover:bg-brand-soft/50 transition ${
                    sel?.id === c.id ? 'bg-brand-soft/70 border-l-4 border-brand font-bold' : ''
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand flex-shrink-0">
                      <IconUser className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-ink truncate">{c.nombre}</p>
                      <p className="text-[11px] text-ink/50 mt-0.5">
                        {c.telefono ? `Telf: ${c.telefono}` : 'Sin teléfono registrado'}
                      </p>
                    </div>
                  </span>
                  <div className="text-right flex-shrink-0 ml-2">
                    <span className="text-[10px] text-red-600 uppercase font-black tracking-wider block">
                      Debe
                    </span>
                    <span className="font-black text-sm text-red-700">
                      {money(c.saldo_fiado)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Panel derecho: detalle del cliente y libreta */}
        <section className={`space-y-4 ${!sel ? 'hidden lg:block' : 'block'}`}>
          {!sel ? (
            <div className="card p-12 text-center text-ink/50 space-y-2 border-2 border-dashed border-ink/15 rounded-3xl bg-white/70">
              <span className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <IconCredit className="h-6 w-6" />
              </span>
              <p className="font-bold text-sm text-ink/70">Ningún cliente seleccionado</p>
              <p className="text-xs text-ink/50">
                Toca a un cliente de la lista de la izquierda para ver su libreta de fiados y registrar un abono.
              </p>
            </div>
          ) : (
            <>
              {/* Botón para volver a la lista en móviles */}
              <button
                type="button"
                className="lg:hidden btn-s text-xs py-2 px-3 flex items-center gap-1.5 font-bold"
                onClick={() => setSel(null)}
              >
                ← Volver a la lista de clientes
              </button>

              {/* Encabezado del cliente */}
              <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-white border border-brand/20 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand ring-4 ring-brand-soft/40 flex-shrink-0">
                    <IconUser className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-ink leading-tight">
                      {sel.nombre}
                    </h3>
                    <p className="text-xs text-ink/50 mt-0.5">
                      {sel.telefono ? `Teléfono de contacto: ${sel.telefono}` : 'Sin teléfono'}
                      {sel.documento ? ` • Doc: ${sel.documento}` : ''}
                    </p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-left sm:text-right">
                  <p className="text-[10px] text-red-800 uppercase font-black tracking-wider">
                    Saldo Total Adeudado
                  </p>
                  <p className="text-2xl font-black text-red-700">{money(sel.saldo_fiado)}</p>
                </div>
              </div>

              {/* Formulario para registrar abono */}
              <form onSubmit={abonar} className="card space-y-3.5 p-4 sm:p-5 rounded-2xl bg-white border border-ink/10 shadow-sm">
                <div>
                  <h4 className="font-black text-sm text-ink">
                    Registrar Abono o Pago de Deuda
                  </h4>
                  <p className="text-xs text-ink/60 mt-0.5">
                    Indica cuánto dinero está entregando el cliente para reducir su saldo adeudado.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-ink/70 mb-1">
                    Cantidad a Abonar ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-ink/40">
                      $
                    </span>
                    <input
                      className="inp pl-8 text-xl font-black py-2.5 rounded-xl"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-ink/70">
                    Método de Pago del Abono
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['EFECTIVO', 'Efectivo', IconCash],
                      ['TRANSFERENCIA', 'Transferencia Bancaria', IconTransfer],
                    ].map(([m, label, Icon]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMet(m)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-2 ${
                          met === m
                            ? 'bg-brand text-white border-brand shadow-sm'
                            : 'bg-white text-ink/70 border-ink/20 hover:bg-brand-soft'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {met === 'TRANSFERENCIA' && (
                  <div>
                    <label className="block text-[11px] font-bold text-ink/70 mb-1">
                      Número de comprobante bancario *
                    </label>
                    <input
                      className="inp text-xs py-2 rounded-xl"
                      placeholder="Ingresa el código o número de transacción"
                      value={ref}
                      onChange={(e) => setRef(e.target.value)}
                      required
                    />
                  </div>
                )}

                <ErrorBox error={msg.err} />
                {abonoOk && <Ok>{abonoOk}</Ok>}

                <button
                  type="submit"
                  className="btn-p w-full py-3 text-sm font-black shadow-md rounded-xl"
                  disabled={busy}
                >
                  {busy ? 'Guardando abono…' : `Confirmar Abono ${monto ? money(monto) : ''}`}
                </button>
              </form>

              {/* Movimientos de la Libreta */}
              <div className="space-y-2">
                <h4 className="font-black text-xs uppercase tracking-wider text-ink/70">
                  Historial de Movimientos de la Libreta
                </h4>
                {libLoading ? (
                  <Spinner />
                ) : !lib || lib.length === 0 ? (
                  <Empty>Este cliente aún no registra movimientos en su libreta.</Empty>
                ) : (
                  <div className="card divide-y divide-ink/5 p-0 overflow-hidden rounded-2xl bg-white border border-ink/10 shadow-sm">
                    {lib.map((x, i) => {
                      const esAbono = Number(x.monto) < 0;
                      return (
                        <div key={x.id ?? i} className="flex items-center justify-between p-3.5 text-xs sm:text-sm gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-ink">
                              {esAbono ? 'Abono realizado a la cuenta' : 'Compra fiada registrada'}
                            </p>
                            <p className="text-[11px] text-ink/50 mt-0.5">
                              {x.fecha
                                ? new Date(x.fecha).toLocaleDateString('es-EC', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Fecha no registrada'}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p
                              className={`font-black text-sm ${
                                esAbono ? 'text-brand' : 'text-red-700'
                              }`}
                            >
                              {esAbono ? '-' : '+'}{money(Math.abs(x.monto))}
                            </p>
                            {x.saldo_resultante != null && (
                              <p className="text-[11px] text-ink/50 mt-0.5">
                                Saldo: {money(x.saldo_resultante)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
