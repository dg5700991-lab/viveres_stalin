import { useState, useMemo, useEffect, useRef } from 'react';
import { api, list, money } from '../api';
import { useAuth } from '../auth';
import { Spinner, Empty, ErrorBox, useLoad, Modal } from '../ui';
import {
  IconSearch, IconCart, IconTag, IconScale, IconPackage,
  IconBolt, IconClose, IconCheck, IconClock, IconBag,
  IconTrash, IconStore, IconMapPin, IconRefresh, IconUser,
  IconCash, IconTransfer,
} from '../icons';

// ─── Badge de estado ───────────────────────────────────────────────────────
const ESTADO_CFG = {
  PENDIENTE:      { label: 'Pendiente',       color: 'bg-amber-100 text-amber-800 border-amber-300' },
  EN_PREPARACION: { label: 'En preparacion',  color: 'bg-blue-100 text-blue-800 border-blue-300' },
  LISTO:          { label: 'Listo para recoger', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  ENTREGADO:      { label: 'Entregado',        color: 'bg-gray-100 text-gray-700 border-gray-300' },
  CANCELADO:      { label: 'Cancelado',        color: 'bg-red-100 text-red-700 border-red-300' },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.PENDIENTE;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.color}`}>
      {estado === 'LISTO' && <IconCheck className="h-3 w-3" />}
      {estado === 'PENDIENTE' && <IconClock className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}

// ─── Sonido de expiración sintetizado (tono de alerta descendente) ──────────
function beepExpiracion(ctx) {
  if (!ctx) return;
  [0, 0.3, 0.6].forEach((t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, ctx.currentTime + t);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + t + 0.25);
    gain.gain.setValueAtTime(0.5, ctx.currentTime + t);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
    osc.start(ctx.currentTime + t);
    osc.stop(ctx.currentTime + t + 0.3);
  });
}

// ─── Temporizador de expiración (1 hora desde creado_en) ────────────────────
function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000); // refresca cada 30s
    return () => clearInterval(id);
  }, []);
}

function TiempoRestante({ creadoEn }) {
  useTick();
  const expira = new Date(new Date(creadoEn).getTime() + 60 * 60 * 1000);
  const diff = expira - Date.now();
  if (diff <= 0) {
    return (
      <span className="text-[11px] font-bold text-red-600 flex items-center gap-1">
        <IconClock className="h-3 w-3" /> Expiro — sera cancelado pronto
      </span>
    );
  }
  const mins = Math.round(diff / 60000);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const label = hh > 0 ? `${hh}h ${mm}m` : `${mm} min`;
  const urgent = mins <= 15;
  return (
    <span className={`text-[11px] font-bold flex items-center gap-1 ${urgent ? 'text-red-500' : 'text-amber-600'}`}>
      <IconClock className="h-3 w-3" /> Expira en {label}
    </span>
  );
}


function fmtStock(n, u) {
  const v = Number(n || 0);
  const unit = (u || 'UND').toUpperCase();
  if (unit === 'UND') return `${v} unid.`;
  if (unit === 'KG') return `${v} kg`;
  if (unit === 'LB') return `${v} lb`;
  if (unit === 'L') return `${v} L`;
  return `${v} ${u}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ClientePanel() {
  const { user, logout } = useAuth();

  // AudioContext para alarmas (se inicializa en primer gesto)
  const audioCtxRef = useRef(null);
  const alertadosRef = useRef(new Set()); // IDs de pedidos ya alertados
  useEffect(() => {
    const init = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
    };
    window.addEventListener('click', init, { once: true });
    return () => window.removeEventListener('click', init);
  }, []);

  // Estado de alarma: pedidos a punto de expirar
  const [alarmaExpiracion, setAlarmaExpiracion] = useState(false);

  // Tabs: 'tienda' | 'pedidos'
  const [tab, setTab] = useState('tienda');

  // ── Catalogo ──────────────────────────────────────────────────────────────
  const prodsLoad = useLoad(() => api('/productos/').then(list), []);
  const catsLoad  = useLoad(() => api('/categorias/').then(list), []);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [cart, setCart] = useState([]);           // { id, nombre, precio, unidad_medida, cantidad, stock }
  const [showCart, setShowCart] = useState(false);

  // ── Checkout ──────────────────────────────────────────────────────────────
  const [metodoPago, setMetodoPago] = useState('EFECTIVO'); // 'EFECTIVO' | 'TRANSFERENCIA'
  const [referenciaTransferencia, setReferenciaTransferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [busy, setBusy] = useState(false);
  const [pedidoOk, setPedidoOk] = useState(null); // objeto pedido confirmado
  const [err, setErr] = useState(null);

  // ── Mis pedidos ───────────────────────────────────────────────────────────
  const pedidosLoad = useLoad(() => api('/pedidos/').then(list), [tab]);

  // Polling: actualiza pedidos cada 20s si hay pedidos activos (para detectar cancelación automática)
  useEffect(() => {
    const hayActivos = (pedidosLoad.data || []).some(
      p => p.estado === 'PENDIENTE' || p.estado === 'EN_PREPARACION' || p.estado === 'LISTO'
    );
    if (!hayActivos && tab !== 'pedidos') return;
    const id = setInterval(() => pedidosLoad.reload(), tab === 'pedidos' ? 15000 : 30000);
    return () => clearInterval(id);
  }, [tab, pedidosLoad, pedidosLoad.data]);

  // Alarma de expiración: detectar pedidos con < 5 min y emitir alerta
  useEffect(() => {
    const pedidos = pedidosLoad.data || [];
    let hayUrgente = false;
    pedidos.forEach(p => {
      if (p.estado !== 'PENDIENTE' && p.estado !== 'EN_PREPARACION') return;
      const diff = new Date(p.creado_en).getTime() + 60 * 60 * 1000 - Date.now();
      const mins = diff / 60000;
      if (mins <= 5 && mins > 0) {
        hayUrgente = true;
        // Solo alertar una vez por pedido
        if (!alertadosRef.current.has(p.id)) {
          alertadosRef.current.add(p.id);
          beepExpiracion(audioCtxRef.current);
        }
      }
    });
    setAlarmaExpiracion(hayUrgente);
  }, [pedidosLoad.data]);

  // ── Filtrado de productos ────────────────────────────────────────────────
  const productos = useMemo(() => {
    const todos = (prodsLoad.data || []).filter(p => p.activo);
    return todos.filter(p => {
      if (cat && String(p.categoria) !== String(cat)) return false;
      if (q.trim()) {
        const lq = q.toLowerCase();
        return p.nombre.toLowerCase().includes(lq) || (p.codigo_barras || '').includes(lq);
      }
      return true;
    });
  }, [prodsLoad.data, cat, q]);

  // ── Carrito ───────────────────────────────────────────────────────────────
  const total = useMemo(() =>
    cart.reduce((s, i) => s + i.cantidad * i.precio, 0), [cart]);

  const addToCart = (p) => {
    setCart(curr => {
      const ex = curr.find(x => x.id === p.id);
      if (ex) {
        return curr.map(x => x.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x);
      }
      return [...curr, {
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio_venta),
        unidad_medida: p.unidad_medida,
        cantidad: 1,
        stock: 999, // el backend no expone stock_actual al cliente
      }];
    });
  };

  const updateCant = (id, v) => {
    const n = Number(v);
    if (isNaN(n) || n <= 0) return removeItem(id);
    setCart(curr => curr.map(x => x.id === id ? { ...x, cantidad: n } : x));
  };

  const removeItem = (id) => setCart(curr => curr.filter(x => x.id !== id));

  const clearCart = () => setCart([]);

  // ── Enviar pedido ─────────────────────────────────────────────────────────
  const enviarPedido = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const prefijoPago = metodoPago === 'TRANSFERENCIA'
        ? `[Pago: TRANSFERENCIA${referenciaTransferencia.trim() ? ` - Ref: ${referenciaTransferencia.trim()}` : ''}]`
        : '[Pago: EFECTIVO]';
      const notasFinales = notas.trim() ? `${prefijoPago} ${notas.trim()}` : prefijoPago;

      const pedido = await api('/pedidos/', {
        method: 'POST',
        body: {
          items: cart.map(c => ({ producto: c.id, cantidad: String(c.cantidad) })),
          notas: notasFinales,
        },
      });
      setPedidoOk(pedido);
      setCart([]);
      setNotas('');
      setMetodoPago('EFECTIVO');
      setReferenciaTransferencia('');
      setShowCart(false);
      setTab('pedidos');
      pedidosLoad.reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  // ── Cancelar pedido ───────────────────────────────────────────────────────
  const cancelarPedido = async (id) => {
    try {
      await api(`/pedidos/${id}/cancelar/`, { method: 'POST' });
      pedidosLoad.reload();
    } catch (e) {
      alert(e.message);
    }
  };

  const cartCount = cart.reduce((s, i) => s + i.cantidad, 0);

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-soft/40 via-paper to-brand-soft/20 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-forest/15 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/viveres-stalin.png" alt="Viveres Stalin" className="h-10 w-10 rounded-xl shadow-sm ring-2 ring-brand/20 object-contain bg-white p-1" />
            <div>
              <p className="font-extrabold text-brand-dark text-sm leading-none">Viveres Stalin</p>
              <p className="text-[11px] text-ink/50 leading-none mt-0.5">Tienda en linea</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-ink/60 font-medium">
              <IconUser className="h-3.5 w-3.5" />
              {user.nombre}
            </span>

            {/* Carrito flotante */}
            <button
              className="relative flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white hover:bg-brand-dark transition shadow-sm"
              onClick={() => setShowCart(true)}
            >
              <IconCart className="h-4 w-4" />
              <span className="hidden sm:inline">Carrito</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              className="rounded-xl border border-ink/15 px-3 py-2 text-xs font-semibold text-ink/70 hover:bg-brand-soft transition"
              onClick={logout}
            >
              Salir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-2 flex gap-1">
          <button
            onClick={() => setTab('tienda')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition ${
              tab === 'tienda' ? 'bg-brand text-white' : 'text-ink/60 hover:bg-brand-soft'
            }`}
          >
            <IconStore className="h-3.5 w-3.5" />
            Tienda
          </button>
          <button
            onClick={() => { setTab('pedidos'); pedidosLoad.reload(); }}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition relative ${
              tab === 'pedidos' ? 'bg-brand text-white' : 'text-ink/60 hover:bg-brand-soft'
            }`}
          >
            <IconBag className="h-3.5 w-3.5" />
            Mis pedidos
            {(pedidosLoad.data || []).some(p => p.estado === 'LISTO') && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
            {alarmaExpiracion && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
            )}
          </button>
        </div>

        {/* Banner alarma de expiración */}
        {alarmaExpiracion && (
          <div className="bg-red-600 py-1.5 px-4 text-center text-xs font-black text-white animate-pulse">
            Tu pedido esta por vencer — ve a la tienda a recogerlo o sera cancelado
          </div>
        )}
      </header>

      {/* ── Confirmacion pedido ─────────────────────────────────────────── */}
      {pedidoOk && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-4">
          <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4 flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <IconCheck className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-emerald-900">Pedido enviado correctamente</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                Total estimado: <strong>{money(pedidoOk.total_estimado)}</strong> — Paga al recoger en tienda.
              </p>
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <IconMapPin className="h-3.5 w-3.5" />
                Te avisaremos cuando este listo. Revisa tus pedidos.
              </p>
            </div>
            <button onClick={() => setPedidoOk(null)} className="text-emerald-400 hover:text-emerald-700">
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Contenido principal ─────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto w-full px-4 py-5 flex-1">

        {/* =========== TAB: TIENDA =========== */}
        {tab === 'tienda' && (
          <div>
            {/* Hero banner */}
            <div className="rounded-2xl bg-gradient-to-r from-brand to-brand-dark p-5 mb-5 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 h-full w-40 opacity-10">
                <svg viewBox="0 0 200 200" className="h-full w-full">
                  <circle cx="150" cy="50" r="80" fill="currentColor"/>
                  <circle cx="50" cy="150" r="60" fill="currentColor"/>
                </svg>
              </div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Hola, {user.nombre}</p>
              <h1 className="text-xl font-black leading-tight">Haz tu pedido y<br/>recogelo en tienda</h1>
              <p className="text-xs opacity-70 mt-1.5 flex items-center gap-1">
                <IconMapPin className="h-3.5 w-3.5" />
                Paga cuando llegues — sin cargos extra
              </p>
            </div>

            {/* Busqueda */}
            <div className="relative mb-3">
              <span className="absolute left-3.5 top-3 text-ink/40"><IconSearch className="h-4 w-4" /></span>
              <input
                className="inp pl-10 py-2.5 rounded-2xl bg-white shadow-sm"
                placeholder="Buscar producto..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
              {q && (
                <button onClick={() => setQ('')} className="absolute right-3.5 top-3 text-ink/40 hover:text-ink">
                  <IconClose className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Categorias */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
              <button
                onClick={() => setCat('')}
                className={`flex-shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  cat === '' ? 'bg-brand text-white shadow-sm' : 'bg-white text-ink/60 border border-ink/10 hover:bg-brand-soft'
                }`}
              >
                Todo
              </button>
              {(catsLoad.data || []).map(c => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`flex-shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    cat === c.id ? 'bg-brand text-white shadow-sm' : 'bg-white text-ink/60 border border-ink/10 hover:bg-brand-soft'
                  }`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>

            {/* Grid de productos */}
            {prodsLoad.loading ? <Spinner /> : productos.length === 0 ? (
              <Empty>No hay productos disponibles con esos filtros.</Empty>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {productos.map(p => {
                  const inCart = cart.find(x => x.id === p.id);
                  const sinStock = p.disponible === false;
                  return (
                    <div
                      key={p.id}
                      className={`bg-white rounded-2xl border p-3 flex flex-col shadow-sm transition ${
                        inCart ? 'border-brand ring-2 ring-brand/20' : 'border-ink/10'
                      } ${sinStock ? 'opacity-50' : ''}`}
                    >
                      {/* Imagen — sin onClick, solo visual */}
                      <div className="relative h-28 w-full mb-2 rounded-xl overflow-hidden bg-brand-soft/20 flex items-center justify-center">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-ink/20">
                            {p.tipo === 'CODIGO' ? <IconTag className="h-10 w-10" /> : <IconScale className="h-10 w-10" />}
                          </span>
                        )}
                        {/* Badge disponibilidad */}
                        <span className={`absolute bottom-1.5 left-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 ${
                          sinStock ? 'bg-red-600 text-white' : 'bg-ink/70 text-white'
                        }`}>
                          <IconPackage className="h-3 w-3" />
                          {sinStock ? 'Sin stock' : 'Disponible'}
                        </span>
                      </div>

                      <p className="font-bold text-ink text-xs line-clamp-2 leading-tight flex-1">{p.nombre}</p>
                      <p className="text-[10px] text-ink/40 mt-0.5 truncate">{p.categoria_nombre || 'General'}</p>

                      <div className="mt-2 pt-2 border-t border-ink/8">
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-base font-black text-brand">{money(p.precio_venta)}</span>
                          <span className="text-[10px] text-ink/40 uppercase">/{p.unidad_medida}</span>
                        </div>

                        {sinStock ? (
                          <div className="text-center text-[10px] text-ink/40 font-bold py-1">Sin stock</div>
                        ) : inCart ? (
                          /* Control de cantidad cuando ya está en carrito */
                          <div className="flex items-center justify-between rounded-xl bg-brand-soft/50 border border-brand/30 p-1">
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded-lg bg-white text-brand font-black text-sm hover:bg-brand-soft"
                              onClick={() => updateCant(p.id, inCart.cantidad - 1)}
                            >-</button>
                            <span className="text-xs font-black text-ink">{inCart.cantidad}</span>
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded-lg bg-brand text-white font-black text-sm hover:bg-brand-dark"
                              onClick={() => addToCart(p)}
                            >+</button>
                          </div>
                        ) : (
                          /* Botón Agregar explícito — el usuario ELIGE agregarlo */
                          <button
                            className="w-full rounded-xl bg-brand py-2 text-[11px] font-bold text-white hover:bg-brand-dark active:scale-95 transition-all text-center"
                            onClick={() => addToCart(p)}
                          >
                            + Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========== TAB: MIS PEDIDOS =========== */}
        {tab === 'pedidos' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-ink">Mis pedidos</h2>
              <button
                onClick={() => pedidosLoad.reload()}
                className="flex items-center gap-1.5 text-xs text-brand font-semibold hover:underline"
              >
                <IconRefresh className="h-3.5 w-3.5" />
                Actualizar
              </button>
            </div>

            {pedidosLoad.loading ? <Spinner /> :
             pedidosLoad.error ? <ErrorBox error={pedidosLoad.error} onRetry={pedidosLoad.reload} /> :
             (pedidosLoad.data || []).length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <IconBag className="h-8 w-8" />
                </span>
                <p className="font-bold text-ink/60">Aun no tienes pedidos</p>
                <p className="text-sm text-ink/40">Ve a la tienda, agrega productos y haz tu primer pedido.</p>
                <button className="btn-p mt-2 px-6" onClick={() => setTab('tienda')}>
                  Ir a la tienda
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {(pedidosLoad.data || []).map(p => (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl border-2 p-4 shadow-sm transition ${
                      p.estado === 'LISTO' ? 'border-emerald-300 bg-emerald-50/50' :
                      p.estado === 'CANCELADO' ? 'border-gray-200 opacity-70' : 'border-ink/10'
                    }`}
                  >
                    {/* Estado + fecha */}
                    <div className="flex items-center justify-between mb-3">
                      <EstadoBadge estado={p.estado} />
                      <span className="text-[11px] text-ink/40">
                        {new Date(p.creado_en).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>

                    {/* Estado LISTO → banner destacado */}
                    {p.estado === 'LISTO' && (
                      <div className="rounded-xl bg-emerald-100 border border-emerald-300 p-3 mb-3 flex items-center gap-2">
                        <IconMapPin className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                        <p className="text-xs font-bold text-emerald-800">
                          Tu pedido esta listo. Acercate a la tienda a recogerlo y pagar.
                        </p>
                      </div>
                    )}

                    {/* Temporizador: solo para pedidos activos */}
                    {(p.estado === 'PENDIENTE' || p.estado === 'EN_PREPARACION') && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 mb-3 flex items-center justify-between gap-2">
                        <TiempoRestante creadoEn={p.creado_en} />
                        <span className="text-[10px] text-amber-700/70">para retirarlo</span>
                      </div>
                    )}

                    {/* Detalles de items */}
                    <div className="space-y-1.5 mb-3">
                      {(p.detalles || []).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-ink/70">
                            <span className="font-bold text-ink">{d.cantidad}</span> x {d.nombre_producto}
                          </span>
                          <span className="font-semibold text-ink">{money(d.subtotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total + notas */}
                    <div className="flex items-center justify-between pt-2 border-t border-ink/10">
                      <div>
                        <p className="text-xs text-ink/50">Total estimado</p>
                        <p className="text-lg font-black text-brand">{money(p.total_estimado)}</p>
                      </div>

                      {/* Cancelar si esta pendiente */}
                      {(p.estado === 'PENDIENTE' || p.estado === 'EN_PREPARACION') && (
                        <button
                          className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 border border-red-200 rounded-xl px-3 py-1.5 hover:bg-red-50 transition"
                          onClick={() => cancelarPedido(p.id)}
                        >
                          Cancelar pedido
                        </button>
                      )}
                    </div>

                    {p.notas && (
                      <div className="mt-2 text-[11px] bg-ink/5 rounded-lg px-2.5 py-1.5 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          {p.notas.includes('[Pago: TRANSFERENCIA') ? (
                            <span className="text-blue-700 flex items-center gap-1">
                              <IconTransfer className="h-3.5 w-3.5" /> Pago previsto: Transferencia bancaria
                            </span>
                          ) : (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <IconCash className="h-3.5 w-3.5" /> Pago previsto: Efectivo en tienda
                            </span>
                          )}
                        </div>
                        {p.notas.replace(/\[Pago:[^\]]+\]/g, '').trim() && (
                          <p className="text-ink/60 italic">
                            Nota: {p.notas.replace(/\[Pago:[^\]]+\]/g, '').trim()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Carrito lateral (drawer) ────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCart(false)}
          />

          {/* Panel del carrito */}
          <div className="relative ml-auto h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
            {/* Header carrito */}
            <div className="flex items-center justify-between p-4 border-b border-ink/10">
              <div className="flex items-center gap-2">
                <IconCart className="h-5 w-5 text-brand" />
                <h2 className="text-base font-black text-ink">Tu pedido</h2>
                {cartCount > 0 && (
                  <span className="rounded-full bg-brand text-white text-[10px] font-black px-2 py-0.5">
                    {cartCount}
                  </span>
                )}
              </div>
              <button onClick={() => setShowCart(false)} className="text-ink/40 hover:text-ink">
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <IconCart className="h-12 w-12 mx-auto text-ink/20" />
                  <p className="text-sm text-ink/40 font-semibold">Tu carrito esta vacio</p>
                  <button
                    className="text-xs text-brand underline"
                    onClick={() => setShowCart(false)}
                  >
                    Explorar productos
                  </button>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-ink truncate">{item.nombre}</p>
                      <p className="text-[11px] text-ink/50">{money(item.precio)}/{item.unidad_medida}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-ink/20 text-ink font-bold text-sm hover:bg-brand-soft"
                        onClick={() => updateCant(item.id, item.cantidad - 1)}
                      >-</button>
                      <span className="w-8 text-center text-sm font-black text-ink">{item.cantidad}</span>
                      <button
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-brand text-white font-bold text-sm hover:bg-brand-dark"
                        onClick={() => addToCart({ id: item.id, nombre: item.nombre, precio_venta: item.precio, unidad_medida: item.unidad_medida, stock_actual: item.stock })}
                      >+</button>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-black text-ink">{money(item.cantidad * item.precio)}</p>
                      <button
                        className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-0.5 ml-auto"
                        onClick={() => removeItem(item.id)}
                      >
                        <IconTrash className="h-3 w-3" /> Quitar
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Método de Pago del Cliente */}
              {cart.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-ink/10">
                  <label className="text-xs font-bold text-ink/60 uppercase tracking-wider block">
                    ¿Como deseas pagar al retirar?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition ${
                        metodoPago === 'EFECTIVO'
                          ? 'border-brand bg-brand-soft/50 ring-2 ring-brand/30'
                          : 'border-ink/15 bg-white hover:border-brand/40'
                      }`}
                      onClick={() => setMetodoPago('EFECTIVO')}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-ink">
                        <IconCash className={`h-4 w-4 ${metodoPago === 'EFECTIVO' ? 'text-brand' : 'text-ink/60'}`} />
                        Efectivo
                      </div>
                      <p className="text-[10px] text-ink/50 leading-tight">
                        Pagas en billetes o monedas al retirar
                      </p>
                    </button>

                    <button
                      type="button"
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition ${
                        metodoPago === 'TRANSFERENCIA'
                          ? 'border-brand bg-brand-soft/50 ring-2 ring-brand/30'
                          : 'border-ink/15 bg-white hover:border-brand/40'
                      }`}
                      onClick={() => setMetodoPago('TRANSFERENCIA')}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-ink">
                        <IconTransfer className={`h-4 w-4 ${metodoPago === 'TRANSFERENCIA' ? 'text-brand' : 'text-ink/60'}`} />
                        Transferencia
                      </div>
                      <p className="text-[10px] text-ink/50 leading-tight">
                        Transferencia bancaria previa o en tienda
                      </p>
                    </button>
                  </div>

                  {metodoPago === 'TRANSFERENCIA' && (
                    <div className="rounded-xl bg-brand-soft/60 border border-brand/20 p-2.5 space-y-1.5">
                      <label className="text-[11px] font-bold text-brand-dark block">
                        N.° comprobante o referencia bancaria (opcional)
                      </label>
                      <input
                        className="inp text-xs bg-white"
                        placeholder="Ej: 987654 (o muestra el comprobante al retirar en el local)"
                        value={referenciaTransferencia}
                        onChange={e => setReferenciaTransferencia(e.target.value)}
                        maxLength={50}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Notas */}
              {cart.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-ink/60 uppercase tracking-wider block mb-1">
                    Notas para la tienda (opcional)
                  </label>
                  <textarea
                    className="inp text-sm resize-none"
                    rows={2}
                    placeholder="Ej: sin cebolla, envuelto para regalo..."
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    maxLength={300}
                  />
                </div>
              )}

              <ErrorBox error={err} />
            </div>

            {/* Footer carrito */}
            {cart.length > 0 && (
              <div className="border-t border-ink/10 p-4 space-y-3 bg-white">
                {/* Info de pago en tienda */}
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2 items-start">
                  <IconBolt className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 font-medium">
                    Pagas cuando recoges en tienda. El total puede variar si algun producto no hay.
                  </p>
                </div>

                {/* Total */}
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-black text-ink/60 uppercase">Total estimado</span>
                  <span className="text-2xl font-black text-brand">{money(total)}</span>
                </div>

                {/* Botones */}
                <div className="flex gap-2">
                  <button
                    className="btn-s flex-1 text-sm"
                    onClick={clearCart}
                  >
                    Vaciar
                  </button>
                  <button
                    className="btn-p flex-1 py-3 text-sm font-black"
                    disabled={busy}
                    onClick={enviarPedido}
                  >
                    {busy ? 'Enviando...' : 'Confirmar pedido'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
