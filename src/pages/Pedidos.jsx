import { useState, useEffect } from 'react';
import { api, list, money } from '../api';
import { Spinner, Empty, ErrorBox, useLoad, Modal } from '../ui';
import {
  IconCheck, IconClock, IconUser, IconBolt, IconClose,
  IconCart, IconTag, IconBag, IconRefresh,
  IconCash, IconTransfer, IconCredit,
} from '../icons';

// ─── Badge de estado ─────────────────────────────────────────────────────────
const ESTADO_CFG = {
  PENDIENTE: { label: 'Nuevo pedido', color: 'bg-amber-100 text-amber-800 border-amber-400', dot: 'bg-amber-500' },
  EN_PREPARACION: { label: 'En preparacion', color: 'bg-blue-100 text-blue-800 border-blue-400', dot: 'bg-blue-500' },
  LISTO: { label: 'Listo para recoger', color: 'bg-emerald-100 text-emerald-800 border-emerald-400', dot: 'bg-emerald-500' },
  ENTREGADO: { label: 'Entregado', color: 'bg-gray-100 text-gray-600 border-gray-300', dot: 'bg-gray-400' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.PENDIENTE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${cfg.color}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Tiempo transcurrido ──────────────────────────────────────────────────────
function TiempoTranscurrido({ fecha }) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 60000);
  if (diff < 1) return <span className="text-emerald-600 font-bold">Hace un momento</span>;
  if (diff < 60) return <span className={diff > 45 ? 'text-red-600 font-bold' : diff > 20 ? 'text-amber-600 font-semibold' : 'text-ink/60'}>{diff} min atras</span>;
  const h = Math.floor(diff / 60);
  return <span className="text-red-600 font-bold">{h}h {diff % 60}min atras</span>;
}

// ─── Modal de cobro ───────────────────────────────────────────────────────────
function ModalCobro({ pedido, onClose, onDone }) {
  // Detección automática del método solicitado por el cliente
  const notasStr = pedido.notas || '';
  const pideTransferencia = notasStr.includes('[Pago: TRANSFERENCIA');
  const matchRef = notasStr.match(/Ref:\s*([^\]]+)/i);
  const refInicial = matchRef ? matchRef[1].trim() : '';

  const [metodo, setMetodo] = useState(pideTransferencia ? 'TRANSFERENCIA' : 'EFECTIVO');
  const [efectivo, setEfectivo] = useState('');
  const [referencia, setReferencia] = useState(refInicial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const total = Number(pedido.total_estimado);
  const efectivoNum = parseFloat(efectivo) || 0;
  const vuelto = efectivoNum - total;

  const confirmar = async () => {
    setBusy(true);
    setErr(null);
    try {
      let bodyPagos = [];
      let efectivoRecibidoParam = null;

      if (metodo === 'EFECTIVO') {
        if (efectivoNum < total) {
          throw new Error(`El efectivo recibido (${money(efectivoNum)}) no cubre el total (${money(total)}).`);
        }
        bodyPagos = [{ metodo: 'EFECTIVO', monto: String(total) }];
        efectivoRecibidoParam = String(efectivoNum);
      } else if (metodo === 'TRANSFERENCIA') {
        if (!referencia.trim() || referencia.trim().length < 3) {
          throw new Error('Ingresa el número de comprobante o referencia (mínimo 3 caracteres).');
        }
        bodyPagos = [{ metodo: 'TRANSFERENCIA', monto: String(total), referencia: referencia.trim() }];
      } else if (metodo === 'FIADO') {
        bodyPagos = [{ metodo: 'FIADO', monto: String(total) }];
      }

      await api(`/pedidos/${pedido.id}/entregar/`, {
        method: 'POST',
        body: {
          pagos: bodyPagos,
          ...(efectivoRecibidoParam ? { efectivo_recibido: efectivoRecibidoParam } : {}),
        },
      });

      const mensajeExito = metodo === 'FIADO'
        ? `Pedido entregado y registrado como FIADO a ${pedido.cliente_nombre || 'Cliente'}.`
        : metodo === 'TRANSFERENCIA'
        ? 'Pedido entregado y cobrado por transferencia.'
        : 'Pedido entregado y cobrado en efectivo.';

      onDone(mensajeExito);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const puedeConfirmar = () => {
    if (busy) return false;
    if (metodo === 'EFECTIVO') return efectivoNum >= total;
    if (metodo === 'TRANSFERENCIA') return referencia.trim().length >= 3;
    if (metodo === 'FIADO') return true;
    return false;
  };

  return (
    <Modal title="Cobrar y entregar pedido" onClose={onClose}>
      <div className="space-y-4">
        {/* Resumen del pedido */}
        <div className="rounded-xl bg-brand-soft/40 border border-brand/20 p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <IconUser className="h-4 w-4 text-brand" />
              <span className="font-bold text-ink">{pedido.cliente_nombre || 'Cliente'}</span>
            </div>
            {pideTransferencia ? (
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                <IconTransfer className="h-3 w-3" /> Pidió transferencia
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                <IconCash className="h-3 w-3" /> Pidió efectivo
              </span>
            )}
          </div>
          {(pedido.detalles || []).map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-ink/70">
                <span className="font-bold text-ink">{Number(d.cantidad)}</span> x {d.nombre_producto}
              </span>
              <span className="font-semibold text-ink">{money(d.subtotal)}</span>
            </div>
          ))}
          <div className="border-t border-brand/20 pt-2 flex items-center justify-between">
            <span className="text-xs font-bold text-ink/60 uppercase tracking-wide">Total a cobrar</span>
            <span className="text-2xl font-black text-brand">{money(total)}</span>
          </div>
        </div>

        {/* Selector de Método de Pago para el Cajero */}
        <div>
          <label className="text-xs font-bold text-ink/60 uppercase tracking-wider block mb-1.5">
            Método de cobro
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition ${
                metodo === 'EFECTIVO'
                  ? 'border-brand bg-brand-soft/70 ring-2 ring-brand/30 font-black text-brand'
                  : 'border-ink/15 bg-white text-ink/70 hover:border-brand/40'
              }`}
              onClick={() => setMetodo('EFECTIVO')}
            >
              <IconCash className="h-4 w-4" />
              <span className="text-xs">Efectivo</span>
            </button>

            <button
              type="button"
              className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition ${
                metodo === 'TRANSFERENCIA'
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-400 font-black text-blue-800'
                  : 'border-ink/15 bg-white text-ink/70 hover:border-blue-300'
              }`}
              onClick={() => setMetodo('TRANSFERENCIA')}
            >
              <IconTransfer className="h-4 w-4" />
              <span className="text-xs">Transferencia</span>
            </button>

            <button
              type="button"
              className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition ${
                metodo === 'FIADO'
                  ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-400 font-black text-purple-800'
                  : 'border-ink/15 bg-white text-ink/70 hover:border-purple-300'
              }`}
              onClick={() => setMetodo('FIADO')}
            >
              <IconCredit className="h-4 w-4" />
              <span className="text-xs">Fiado</span>
            </button>
          </div>
        </div>

        {/* Campos según el método */}
        {metodo === 'EFECTIVO' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-ink/60 uppercase tracking-wider block mb-1">
                Efectivo recibido del cliente
              </label>
              <input
                className="inp text-xl font-black"
                type="number"
                min={total}
                step="0.25"
                placeholder={money(total)}
                value={efectivo}
                onChange={e => setEfectivo(e.target.value)}
                autoFocus
              />
            </div>

            {efectivoNum >= total && (
              <div className={`rounded-xl p-3 text-center ${vuelto > 0 ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-gray-50 border border-gray-200'}`}>
                <p className="text-xs font-bold text-ink/50 uppercase tracking-wider mb-0.5">Vuelto a dar</p>
                <p className={`text-3xl font-black ${vuelto > 0 ? 'text-emerald-700' : 'text-ink/40'}`}>
                  {money(vuelto)}
                </p>
              </div>
            )}
            {efectivoNum > 0 && efectivoNum < total && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-center">
                <p className="text-xs font-bold text-red-700">Faltan {money(total - efectivoNum)}</p>
              </div>
            )}
          </div>
        )}

        {metodo === 'TRANSFERENCIA' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-ink/60 uppercase tracking-wider block">
              N.° de comprobante o referencia bancaria
            </label>
            <input
              className="inp text-base font-semibold"
              placeholder="Ej: 839201"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] text-ink/50">
              Verifica en tu app bancaria que el dinero haya ingresado antes de entregar.
            </p>
          </div>
        )}

        {metodo === 'FIADO' && (
          <div className="rounded-xl bg-purple-50 border border-purple-200 p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <IconCredit className="h-4 w-4 text-purple-700" />
              <p className="text-xs font-bold text-purple-900">
                Venta a crédito (Fiado)
              </p>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed">
              El cliente <strong>{pedido.cliente_nombre || 'Cliente'}</strong> retirará los productos ahora y pagará después. Este valor de <strong>{money(total)}</strong> se cargará automáticamente a su cuenta de fiados.
            </p>
          </div>
        )}

        <ErrorBox error={err} />

        <div className="flex gap-2 pt-1">
          <button className="btn-s flex-1" onClick={onClose}>Cancelar</button>
          <button
            className="btn-p flex-1 py-3 font-black"
            disabled={!puedeConfirmar()}
            onClick={confirmar}
          >
            {busy ? 'Procesando...' : metodo === 'FIADO' ? 'Confirmar fiado y entregar' : 'Confirmar cobro y entregar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Tarjeta de pedido ────────────────────────────────────────────────────────
function TarjetaPedido({ pedido, onAction }) {
  const [cobrando, setCobrando] = useState(false);
  const esNuevo = pedido.estado === 'PENDIENTE';
  const enPrep = pedido.estado === 'EN_PREPARACION';
  const listo = pedido.estado === 'LISTO';
  const terminado = pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO';

  const hora = new Date(pedido.creado_en).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  const fecha = new Date(pedido.creado_en).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });

  return (
    <>
      <div className={`rounded-2xl border-2 bg-white shadow-sm transition ${esNuevo ? 'border-amber-400 shadow-amber-100' :
          listo ? 'border-emerald-400 shadow-emerald-100' :
            enPrep ? 'border-blue-300' :
              terminado ? 'border-gray-200 opacity-60' : 'border-ink/10'
        }`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl border-b ${esNuevo ? 'bg-amber-50 border-amber-200' :
            listo ? 'bg-emerald-50 border-emerald-200' :
              enPrep ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
          }`}>
          <div className="flex items-center gap-3">
            {/* Numero de pedido (últimos 6 chars del UUID) */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-ink/40 uppercase tracking-wider">Pedido</span>
              <span className="text-sm font-black text-ink font-mono">
                #{pedido.id.slice(-6).toUpperCase()}
              </span>
            </div>
            <EstadoBadge estado={pedido.estado} />
            {esNuevo && pedido.alarma_pendiente && (
              <span className="animate-pulse rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5">
                NUEVO
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-ink">{hora}</p>
            <p className="text-[10px] text-ink/40">{fecha}</p>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="px-4 py-3 space-y-3">

          {/* Cliente + tiempo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand font-black text-sm">
                {(pedido.cliente_nombre || 'C')[0].toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{pedido.cliente_nombre || 'Cliente'}</p>
                <p className="text-[11px] text-ink/40">Paga al recoger en tienda</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-ink/50">Hace</p>
              <TiempoTranscurrido fecha={pedido.creado_en} />
            </div>
          </div>

          {/* Items del pedido */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
            {(pedido.detalles || []).map((d, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-soft text-brand text-xs font-black">
                    {Number(d.cantidad)}
                  </span>
                  <span className="text-xs font-semibold text-ink">{d.nombre_producto}</span>
                </div>
                <span className="text-xs font-bold text-ink">{money(d.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Indicador de método de pago del cliente y notas */}
          {pedido.notas && (
            <div className="space-y-1.5">
              {pedido.notas.includes('[Pago: TRANSFERENCIA') ? (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-800 flex items-center gap-1.5">
                    <IconTransfer className="h-4 w-4 text-blue-600" />
                    Cliente indicó: Paga con Transferencia
                  </span>
                  {(() => {
                    const m = pedido.notas.match(/Ref:\s*([^\]]+)/i);
                    return m ? (
                      <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700">
                        Ref: #{m[1].trim()}
                      </span>
                    ) : null;
                  })()}
                </div>
              ) : pedido.notas.includes('[Pago: EFECTIVO') ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-1.5 text-xs">
                  <IconCash className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-emerald-800">Cliente indicó: Paga en Efectivo al recoger</span>
                </div>
              ) : null}

              {pedido.notas.replace(/\[Pago:[^\]]+\]/g, '').trim() && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex gap-2 items-start">
                  <IconBolt className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800 font-medium">
                    {pedido.notas.replace(/\[Pago:[^\]]+\]/g, '').trim()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-1 border-t border-ink/8">
            <div>
              <p className="text-[10px] text-ink/40 uppercase tracking-wider font-bold">Total a cobrar</p>
              <p className="text-2xl font-black text-brand">{money(pedido.total_estimado)}</p>
            </div>

            {/* Acciones según estado */}
            <div className="flex flex-col gap-2 items-end">
              {esNuevo && (
                <>
                  <button
                    className="btn-p text-xs px-4 py-2 flex items-center gap-1.5"
                    onClick={() => onAction(pedido.id, 'estado', 'EN_PREPARACION', 'Pedido aceptado. Preparando...')}
                  >
                    <IconCheck className="h-3.5 w-3.5" />
                    Aceptar y preparar
                  </button>
                  <button
                    className="text-xs text-ink/40 hover:text-ink font-semibold flex items-center gap-1"
                    onClick={() => onAction(pedido.id, 'acusar', null, 'Alarma silenciada.')}
                  >
                    <IconClose className="h-3 w-3" />
                    Solo silenciar alarma
                  </button>
                </>
              )}
              {enPrep && (
                <button
                  className="btn-p text-xs px-4 py-2 flex items-center gap-1.5"
                  onClick={() => onAction(pedido.id, 'estado', 'LISTO', 'Pedido marcado como listo.')}
                >
                  <IconCheck className="h-3.5 w-3.5" />
                  Marcar como listo
                </button>
              )}
              {listo && (
                <button
                  className="btn-p text-xs px-5 py-2.5 flex items-center gap-1.5 font-black"
                  onClick={() => setCobrando(true)}
                >
                  <IconCart className="h-4 w-4" />
                  Cobrar y entregar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {cobrando && (
        <ModalCobro
          pedido={pedido}
          onClose={() => setCobrando(false)}
          onDone={(msg) => { setCobrando(false); onAction(null, null, null, msg); }}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function Pedidos({ alarm }) {
  const pedidosLoad = useLoad(() => api('/pedidos/').then(list));
  const [msg, setMsg] = useState(null);
  const [filtro, setFiltro] = useState('activos'); // 'activos' | 'todos'

  // Recargar cuando llega alarma nueva del cajero
  useEffect(() => { pedidosLoad.reload(); }, [alarm]); // eslint-disable-line

  const onAction = async (id, accion, estado, okMsg) => {
    setMsg(null);
    if (!id) { setMsg({ ok: okMsg }); pedidosLoad.reload(); return; }
    try {
      if (accion === 'estado') {
        await api(`/pedidos/${id}/estado/`, { method: 'POST', body: { estado } });
      } else {
        await api(`/pedidos/${id}/${accion}/`, { method: 'POST' });
      }
      setMsg({ ok: okMsg });
      pedidosLoad.reload();
    } catch (e) {
      setMsg({ err: e });
    }
  };

  const todos = pedidosLoad.data || [];
  const activos = todos.filter(p => !['ENTREGADO', 'CANCELADO'].includes(p.estado));
  const mostrar = filtro === 'activos' ? activos : todos;

  const pendientes = todos.filter(p => p.estado === 'PENDIENTE').length;
  const enPrep = todos.filter(p => p.estado === 'EN_PREPARACION').length;
  const listos = todos.filter(p => p.estado === 'LISTO').length;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header con resumen */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-ink">Pedidos en linea</h1>
          <p className="text-xs text-ink/50 mt-0.5">Los clientes piden y pagan al recoger</p>
        </div>
        <button
          onClick={pedidosLoad.reload}
          className="flex items-center gap-1.5 text-xs text-brand font-semibold hover:underline"
        >
          <IconRefresh className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>

      {/* Contadores rapidos */}
      {!pedidosLoad.loading && todos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-xl border-2 p-3 text-center ${pendientes > 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-white'}`}>
            <p className={`text-2xl font-black ${pendientes > 0 ? 'text-amber-700' : 'text-ink/30'}`}>{pendientes}</p>
            <p className="text-[10px] font-bold text-ink/50 uppercase">Nuevos</p>
          </div>
          <div className={`rounded-xl border-2 p-3 text-center ${enPrep > 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white'}`}>
            <p className={`text-2xl font-black ${enPrep > 0 ? 'text-blue-700' : 'text-ink/30'}`}>{enPrep}</p>
            <p className="text-[10px] font-bold text-ink/50 uppercase">Preparando</p>
          </div>
          <div className={`rounded-xl border-2 p-3 text-center ${listos > 0 ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100 bg-white'}`}>
            <p className={`text-2xl font-black ${listos > 0 ? 'text-emerald-700' : 'text-ink/30'}`}>{listos}</p>
            <p className="text-[10px] font-bold text-ink/50 uppercase">Listos</p>
          </div>
        </div>
      )}

      {/* Filtro */}
      {!pedidosLoad.loading && todos.length > 0 && (
        <div className="flex gap-1">
          <button
            onClick={() => setFiltro('activos')}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${filtro === 'activos' ? 'bg-brand text-white' : 'bg-white text-ink/60 border border-ink/10 hover:bg-brand-soft'}`}
          >
            Solo activos ({activos.length})
          </button>
          <button
            onClick={() => setFiltro('todos')}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${filtro === 'todos' ? 'bg-brand text-white' : 'bg-white text-ink/60 border border-ink/10 hover:bg-brand-soft'}`}
          >
            Todos ({todos.length})
          </button>
        </div>
      )}

      {/* Mensaje de feedback */}
      {msg?.ok && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-3 flex items-center gap-2">
          <IconCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-bold text-emerald-800">{msg.ok}</p>
        </div>
      )}
      {msg?.err && <ErrorBox error={msg.err} />}

      {/* Lista */}
      {pedidosLoad.loading ? <Spinner /> :
        pedidosLoad.error ? <ErrorBox error={pedidosLoad.error} onRetry={pedidosLoad.reload} /> :
          mostrar.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <IconBag className="h-8 w-8" />
              </span>
              <p className="font-bold text-ink/60">No hay pedidos activos</p>
              <p className="text-sm text-ink/40">Cuando un cliente haga un pedido aparecera aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mostrar.map(p => (
                <TarjetaPedido key={p.id} pedido={p} onAction={onAction} />
              ))}
            </div>
          )
      }
    </div>
  );
}
