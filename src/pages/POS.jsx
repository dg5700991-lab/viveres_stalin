import { useState, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, list, money } from '../api';
import { Spinner, Empty, ErrorBox, Ok, useLoad, Modal } from '../ui';
import { formatStock } from './Productos';
import {
  IconSearch,
  IconClose,
  IconTag,
  IconScale,
  IconPackage,
  IconCalculator,
  IconCart,
  IconBolt,
  IconFileText,
  IconCash,
  IconTransfer,
  IconCredit,
  IconAlert,
  IconPrinter,
  IconLock,
  IconUser,
  IconCheck,
  IconCamera,
} from '../icons';
import ScannerModal from '../components/ScannerModal';

export default function POS() {
  const turno = useLoad(async () => {
    try {
      const data = await api('/caja/turnos/actual/');
      return data.turno || data;
    } catch (e) {
      if (e.status === 404 || e.status === 400) return null;
      throw e;
    }
  });

  const prodsLoad = useLoad(() => api('/productos/').then(list), []);
  const catsLoad = useLoad(() => api('/categorias/').then(list), []);
  const clientesLoad = useLoad(() => api('/clientes/').then(list), []);

  // Vista para pantallas móviles y tablets: 'catalogo' | 'ticket'
  const [vistaMovil, setVistaMovil] = useState('catalogo');

  const [q, setQ] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [cart, setCart] = useState([]);
  const [productoParaCantidad, setProductoParaCantidad] = useState(null);
  const [cantidadInput, setCantidadInput] = useState('1');
  const [productoParaStock, setProductoParaStock] = useState(null);
  const [notifStock, setNotifStock] = useState(null);
  const [escanerAbierto, setEscanerAbierto] = useState(false);

  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [ref, setRef] = useState('');
  const [recibido, setRecibido] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const [tipoComprobante, setTipoComprobante] = useState('CONSUMIDOR_FINAL');
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState('');
  const [clienteRuc, setClienteRuc] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [facturaEmitida, setFacturaEmitida] = useState(null);
  const [qCliente, setQCliente] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [nombreFiado, setNombreFiado] = useState('');

  const key = useRef(crypto.randomUUID());
  const inp = useRef();

  const productosMostrador = useMemo(() => {
    const todos = prodsLoad.data || [];
    return todos.filter((p) => {
      if (!p.activo) return false;
      if (categoriaSeleccionada && String(p.categoria) !== String(categoriaSeleccionada)) return false;
      if (q.trim()) {
        const query = q.toLowerCase();
        const matchNom = p.nombre.toLowerCase().includes(query);
        const matchCod = (p.codigo_barras || '').toLowerCase().includes(query);
        if (!matchNom && !matchCod) return false;
      }
      return true;
    });
  }, [prodsLoad.data, categoriaSeleccionada, q]);

  const handleSeleccionarCliente = useCallback((id) => {
    setClienteSeleccionadoId(id);
    if (!id) {
      setClienteRuc('');
      setClienteNombre('');
      setClienteEmail('');
      setClienteTelefono('');
      setClienteDireccion('');
      setQCliente('');
      return;
    }
    const c = (clientesLoad.data || []).find((x) => x.id === id);
    if (c) {
      setClienteRuc(c.documento || '');
      setClienteNombre(c.nombre || '');
      setClienteTelefono(c.telefono || '');
      setClienteEmail(c.email || '');
      setClienteDireccion(c.direccion || '');
      setQCliente(c.nombre || '');
    }
    setDropdownVisible(false);
  }, [clientesLoad.data]);

  const total = useMemo(() => {
    return cart.reduce((acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio || 0), 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
  }, [cart]);

  const numRecibido = Number(recibido || 0);
  const vuelto = numRecibido > total ? numRecibido - total : 0;
  const falta = numRecibido < total ? total - numRecibido : 0;

  const agregarAlCarrito = (p, e) => {
    e?.stopPropagation();
    setErr(null);

    // Validación amigable de stock
    const stockNum = Number(p.stock_actual || 0);
    const enCarroActual = cart.find((x) => x.id === p.id);
    const cantActual = enCarroActual ? Number(enCarroActual.cantidad) : 0;

    if (stockNum <= 0) {
      setErr({
        message: `El producto "${p.nombre}" está agotado en el inventario. Ingresa mercadería en la sección de Productos antes de venderlo.`,
      });
      return;
    }

    if (cantActual + 1 > stockNum) {
      setErr({
        message: `No puedes agregar más unidades de "${p.nombre}". El inventario actual solo tiene ${formatStock(stockNum, p.unidad_medida)}.`,
      });
      return;
    }

    setCart((curr) => {
      const existe = curr.find((x) => x.id === p.id);
      if (existe) {
        return curr.map((x) =>
          x.id === p.id ? { ...x, cantidad: +(x.cantidad + 1).toFixed(3) } : x
        );
      }
      return [
        ...curr,
        {
          id: p.id,
          nombre: p.nombre,
          precio: p.precio_venta,
          tipo: p.tipo,
          unidad_medida: p.unidad_medida,
          stock_actual: p.stock_actual,
          cantidad: 1,
        },
      ];
    });
  };

  const cambiarCantidad = (id, delta, e) => {
    e?.stopPropagation();
    setErr(null);
    setCart((curr) => {
      const item = curr.find((x) => x.id === id);
      if (!item) return curr;

      const nueva = +(item.cantidad + delta).toFixed(3);
      if (nueva <= 0) {
        return curr.filter((x) => x.id !== id);
      }

      const stockNum = Number(item.stock_actual || 0);
      if (delta > 0 && nueva > stockNum) {
        setErr({
          message: `El stock disponible de "${item.nombre}" es de solo ${formatStock(stockNum, item.unidad_medida)}.`,
        });
        return curr;
      }

      return curr.map((x) => (x.id === id ? { ...x, cantidad: nueva } : x));
    });
  };

  const quitarItem = (id, e) => {
    e?.stopPropagation();
    setCart((curr) => curr.filter((x) => x.id !== id));
  };

  const abrirModalCantidad = (p, e) => {
    e?.stopPropagation();
    setErr(null);
    const enCarro = cart.find((x) => x.id === p.id);
    const esPeso = ['KG', 'LB', 'L'].includes((p.unidad_medida || '').toUpperCase());
    setCantidadInput(enCarro ? String(enCarro.cantidad) : esPeso ? '0.5' : '1');
    setProductoParaCantidad(p);
  };

  const guardarCantidadModal = (e) => {
    e.preventDefault();
    const cant = Number(cantidadInput);
    if (isNaN(cant) || cant <= 0) return;
    const p = productoParaCantidad;

    const stockNum = Number(p.stock_actual || 0);
    if (cant > stockNum) {
      setErr({
        message: `No es posible agregar ${cant} ${p.unidad_medida} de "${p.nombre}". El stock actual disponible es ${formatStock(stockNum, p.unidad_medida)}.`,
      });
      setProductoParaCantidad(null);
      return;
    }

    setCart((curr) => {
      const existe = curr.find((x) => x.id === p.id);
      if (existe) {
        return curr.map((x) => (x.id === p.id ? { ...x, cantidad: cant } : x));
      }
      return [
        ...curr,
        {
          id: p.id,
          nombre: p.nombre,
          precio: p.precio_venta,
          tipo: p.tipo,
          unidad_medida: p.unidad_medida,
          stock_actual: p.stock_actual,
          cantidad: cant,
        },
      ];
    });

    setProductoParaCantidad(null);
  };

  const scan = async (e) => {
    if (e.key !== 'Enter' || !q.trim()) return;
    const codigoIngresado = q.trim();
    try {
      const p = await api(`/productos/por-codigo/${encodeURIComponent(codigoIngresado)}/`);
      agregarAlCarrito(p);
      setQ('');
    } catch (x) {
      setErr({
        message: `El producto con código "${codigoIngresado}" no está registrado en el catálogo. Verifica que lo hayas escaneado bien o regístralo desde el menú Productos.`,
      });
    }
  };

  const handleScanProductFromCamera = (codigo) => {
    const codigoLimpio = String(codigo || '').trim();
    if (!codigoLimpio) return { encontrado: false };

    // 1. Búsqueda instantánea en memoria (0 ms) entre productos cargados
    const enMemoria = (prodsLoad.data || []).find(
      (p) => String(p.codigo_barras || '').trim() === codigoLimpio
    );

    if (enMemoria) {
      agregarAlCarrito(enMemoria);
      return { encontrado: true, producto: enMemoria };
    }

    // 2. Si no estaba en memoria, consultar backend
    return api(`/productos/por-codigo/${encodeURIComponent(codigoLimpio)}/`).then((p) => {
      agregarAlCarrito(p);
      return p;
    });
  };

  const cobrar = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    setErr(null);

    const pagos = [];
    if (metodoPago === 'EFECTIVO') {
      if (numRecibido > 0 && numRecibido < total) {
        setErr({
          message: `El efectivo recibido ($${numRecibido.toFixed(2)}) es menor que el total de la venta ($${total.toFixed(2)}). Pídele al cliente los $${falta.toFixed(2)} restantes antes de cobrar.`,
        });
        setBusy(false);
        return;
      }
      pagos.push({ metodo: 'EFECTIVO', monto: total.toFixed(2) });
    } else if (metodoPago === 'TRANSFERENCIA') {
      pagos.push({
        metodo: 'TRANSFERENCIA',
        monto: total.toFixed(2),
        referencia: ref.trim() || 'Transferencia mostrador',
      });
    } else if (metodoPago === 'FIADO') {
      if (!clienteSeleccionadoId && !nombreFiado.trim()) {
        setErr({
          message: 'Para registrar una venta a crédito o fiado debes seleccionar un cliente registrado o escribir el nombre de la persona que se lleva el fiado.',
        });
        setBusy(false);
        return;
      }
      pagos.push({ metodo: 'FIADO', monto: total.toFixed(2) });
    }

    try {
      const itemsPayload = cart.map((c) => ({
        producto: c.id,
        cantidad: String(c.cantidad),
      }));

      const payload = {
        idempotency_key: key.current,
        items: itemsPayload,
        pagos,
        ...(clienteSeleccionadoId ? { cliente: clienteSeleccionadoId } : {}),
        ...(recibido && metodoPago === 'EFECTIVO' ? { efectivo_recibido: Number(recibido) } : {}),
        ...(nombreFiado.trim() ? { nombre_fiado: nombreFiado.trim() } : {}),
      };

      const v = await api('/ventas/', {
        method: 'POST',
        body: payload,
      });

      const clienteDisplayName =
        tipoComprobante === 'CONSUMIDOR_FINAL'
          ? (nombreFiado.trim() || 'CONSUMIDOR FINAL')
          : (clienteNombre || nombreFiado.trim() || 'CONSUMIDOR FINAL');

      setFacturaEmitida({
        venta: v,
        itemsComprados: [...cart],
        tipoComprobante,
        nombreFiado: nombreFiado.trim(),
        metodoPago,
        cliente: {
          ruc: tipoComprobante === 'CONSUMIDOR_FINAL' ? '9999999999999' : (clienteRuc || '9999999999999'),
          nombre: clienteDisplayName,
          email: clienteEmail || '-',
          direccion: clienteDireccion || 'Ciudad',
          telefono: clienteTelefono || '-',
        },
        fecha: new Date(),
        subtotal: total / 1.15,
        iva: total - total / 1.15,
        total,
        vuelto: Number(v.vuelto || vuelto || 0),
        efectivoRecibido: Number(recibido || total),
      });

      setCart([]);
      setRef('');
      setRecibido('');
      setNombreFiado('');
      setQCliente('');
      key.current = crypto.randomUUID();
      prodsLoad.reload();
      // En móvil, regresar a catálogo después de cobrar
      setVistaMovil('catalogo');
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  if (turno.loading) return <Spinner />;
  if (turno.error) return <ErrorBox error={turno.error} onRetry={turno.reload} />;
  if (!turno.data) {
    return (
      <div className="card text-center p-8 space-y-4 max-w-md mx-auto my-12 border-2 border-brand/20 shadow-xl bg-white rounded-3xl">
        <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-brand-soft text-brand mb-2 ring-8 ring-brand-soft/50">
          <IconLock className="h-8 w-8" />
        </span>
        <h2 className="text-2xl font-black text-ink">Turno de Caja Cerrado</h2>
        <p className="text-sm text-ink/70 leading-relaxed">
          Para comenzar a registrar ventas y cobros en el mostrador, primero necesitas abrir el turno de caja del día con tu fondo inicial.
        </p>
        <Link className="btn-p block w-full py-3.5 text-base font-black shadow-lg" to="/caja">
          Abrir Turno de Caja Ahora
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 lg:gap-4 w-full h-full min-h-0 overflow-hidden">

      {/* ── SELECTOR EN PANTALLAS MÓVILES / TABLETS (< lg) ── */}
      <div className="lg:hidden flex items-center gap-2 p-1 bg-white rounded-2xl border border-ink/10 shadow-sm flex-shrink-0">
        <button
          type="button"
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${vistaMovil === 'catalogo'
              ? 'bg-brand text-white shadow-sm'
              : 'text-ink/60 hover:text-ink'
            }`}
          onClick={() => setVistaMovil('catalogo')}
        >
          <IconTag className="h-3.5 w-3.5" />
          <span>Catálogo ({productosMostrador.length})</span>
        </button>

        <button
          type="button"
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${vistaMovil === 'ticket'
              ? 'bg-brand text-white shadow-sm'
              : 'text-ink/60 hover:text-ink'
            }`}
          onClick={() => setVistaMovil('ticket')}
        >
          <IconCart className="h-3.5 w-3.5" />
          <span>Ticket {cart.length > 0 ? `(${cart.length} • ${money(total)})` : '(Vacío)'}</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          COLUMNA IZQUIERDA: CATÁLOGO DE PRODUCTOS
          Visible siempre en desktop (lg:), en móvil solo si vistaMovil === 'catalogo'
         ══════════════════════════════════════════════════════════════════════ */}
      <div
        className={`flex-1 min-w-0 flex flex-col overflow-hidden ${vistaMovil === 'catalogo' ? 'flex' : 'hidden lg:flex'
          }`}
      >
        {/* Barra de Búsqueda rápida y botón de escáner con cámara */}
        <div className="flex items-center gap-2 mb-2.5 flex-shrink-0">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              ref={inp}
              autoFocus
              className="inp text-sm pl-10 pr-10 py-2.5 rounded-2xl border-ink/15 shadow-sm w-full bg-white focus:border-brand"
              placeholder="Escanear código de barras o escribir producto..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={scan}
            />
            {q && (
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink flex items-center justify-center h-6 w-6 rounded-full hover:bg-gray-100"
                onClick={() => setQ('')}
                aria-label="Limpiar búsqueda"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn-p py-2.5 px-3 sm:px-4 rounded-2xl flex items-center gap-1.5 text-xs font-black shadow-sm whitespace-nowrap active:scale-95 transition"
            onClick={() => setEscanerAbierto(true)}
            title="Abrir cámara del teléfono para escanear códigos de barras rápido"
          >
            <IconCamera className="h-4 w-4" />
            <span className="hidden sm:inline">Escanear</span>
            <span className="sm:hidden">Cámara</span>
          </button>
        </div>

        {/* Píldoras de Categorías */}
        <div className="mb-2.5 flex-shrink-0 overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex-shrink-0 ${categoriaSeleccionada === ''
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white text-ink/70 hover:bg-brand-soft border border-ink/10'
                }`}
              onClick={() => setCategoriaSeleccionada('')}
            >
              Todos ({prodsLoad.data?.length || 0})
            </button>
            {(catsLoad.data || []).map((c) => (
              <button
                key={c.id}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex-shrink-0 ${categoriaSeleccionada === c.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-white text-ink/70 hover:bg-brand-soft border border-ink/10'
                  }`}
                onClick={() => setCategoriaSeleccionada(c.id)}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Mensaje de reposición de stock exitosa */}
        {notifStock && (
          <div className="mb-2.5 flex-shrink-0">
            <Ok>{notifStock}</Ok>
          </div>
        )}

        {/* Mensaje de error general si ocurre */}
        {err && (
          <div className="mb-2.5 flex-shrink-0">
            <ErrorBox error={err} onRetry={() => setErr(null)} />
          </div>
        )}

        {/* Cuadrícula de Productos */}
        <div className="flex-1 overflow-y-auto pr-1 pb-20 lg:pb-3">
          {prodsLoad.loading ? (
            <Spinner />
          ) : productosMostrador.length === 0 ? (
            <Empty>
              No se encontraron productos disponibles con el criterio de búsqueda.
            </Empty>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
              {productosMostrador.map((p) => {
                const enCarro = cart.find((x) => x.id === p.id);
                const stockNum = Number(p.stock_actual || 0);
                const isAgotado = stockNum <= 0;
                const isBajo = !isAgotado && stockNum <= 5;
                const stockTexto = formatStock(stockNum, p.unidad_medida);

                return (
                  <div
                    key={p.id}
                    onClick={(e) => agregarAlCarrito(p, e)}
                    className={`group relative flex flex-col justify-between rounded-2xl p-2.5 sm:p-3 text-left transition select-none bg-white border ${isAgotado
                        ? 'opacity-65 border-gray-200 cursor-not-allowed bg-gray-50/50'
                        : enCarro
                          ? 'border-brand ring-2 ring-brand/30 shadow-md cursor-pointer'
                          : 'border-ink/10 hover:border-brand/40 hover:shadow-md cursor-pointer'
                      }`}
                  >
                    <div>
                      {/* Imagen o Ícono del producto con proporción responsiva completa */}
                      <div className="relative mb-2 h-28 sm:h-32 md:h-36 w-full overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center border border-ink/5 p-2">
                        {p.imagen_url ? (
                          <img
                            src={p.imagen_url}
                            alt={p.nombre}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex items-center justify-center text-ink/30">
                            {p.tipo === 'CODIGO' ? (
                              <IconTag className="h-8 w-8" />
                            ) : (
                              <IconScale className="h-8 w-8" />
                            )}
                          </span>
                        )}

                        {/* Badge de Stock semántico */}
                        <span
                          className={`absolute bottom-1.5 left-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 shadow-sm ${isAgotado
                              ? 'bg-red-600 text-white'
                              : isBajo
                                ? 'bg-amber-600 text-white'
                                : 'bg-emerald-700 text-white'
                            }`}
                        >
                          <IconPackage className="h-3 w-3" />
                          {isAgotado ? 'Agotado' : stockTexto}
                        </span>

                        {/* Botones de acción rápida: Stock y Calculadora */}
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-lg bg-white/95 px-2 py-1 text-[10px] font-black text-brand hover:bg-white hover:text-brand-dark shadow-sm flex items-center gap-0.5 transition border border-brand/20 active:scale-95"
                            title="Aumentar o reponer existencias en tienda"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductoParaStock(p);
                            }}
                          >
                            <span>+</span> Stock
                          </button>
                          {!isAgotado && (
                            <button
                              type="button"
                              className="rounded-lg bg-white/95 p-1 text-ink/70 hover:bg-white hover:text-brand shadow-sm flex items-center justify-center transition border border-ink/10 active:scale-95"
                              title="Indicar cantidad personalizada o peso"
                              onClick={(e) => abrirModalCantidad(p, e)}
                            >
                              <IconCalculator className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="font-bold text-ink text-xs sm:text-sm line-clamp-2 leading-tight">
                        {p.nombre}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-ink/50 mt-0.5 truncate">
                        {p.categoria_nombre || 'General'}
                      </p>
                    </div>

                    {/* Precio y Controles */}
                    <div className="mt-2 pt-2 border-t border-ink/10">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-base sm:text-lg font-black text-brand">
                          {money(p.precio_venta)}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-ink/50 uppercase font-mono">
                          /{p.unidad_medida}
                        </span>
                      </div>

                      {isAgotado ? (
                        <button
                          type="button"
                          className="w-full py-1.5 px-2 text-center text-xs font-bold text-white bg-brand rounded-xl hover:bg-brand-dark transition shadow-sm flex items-center justify-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProductoParaStock(p);
                          }}
                        >
                          <span>+</span> Reponer Stock
                        </button>
                      ) : enCarro ? (
                        <div
                          className="flex items-center justify-between rounded-xl bg-brand-soft/50 border border-brand/30 p-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brand font-black hover:bg-brand-soft text-sm transition shadow-sm"
                            onClick={(e) => cambiarCantidad(p.id, -1, e)}
                            aria-label="Restar uno"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className="font-black text-xs text-ink px-1 hover:underline"
                            onClick={(e) => abrirModalCantidad(p, e)}
                          >
                            {enCarro.cantidad} {p.unidad_medida}
                          </button>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white font-black hover:bg-brand-dark text-sm transition shadow-sm"
                            onClick={(e) => cambiarCantidad(p.id, 1, e)}
                            aria-label="Sumar uno"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded-xl bg-brand py-1.5 sm:py-2 text-xs font-bold text-white hover:bg-brand-dark transition text-center flex items-center justify-center gap-1 shadow-sm"
                          onClick={(e) => agregarAlCarrito(p, e)}
                        >
                          <span>+</span> Agregar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── BARRA FLOTANTE INFERIOR EN MÓVIL SI HAY ITEMS ── */}
        {cart.length > 0 && vistaMovil === 'catalogo' && (
          <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30">
            <button
              type="button"
              className="w-full py-3.5 px-4 rounded-2xl bg-brand text-white font-black text-sm shadow-2xl flex items-center justify-between gap-2 border border-white/20 active:scale-[0.99] transition"
              onClick={() => setVistaMovil('ticket')}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                  {cart.length}
                </span>
                <span>Ver ticket de venta</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold">{money(total)}</span>
                <span className="text-xs bg-white text-brand px-2 py-0.5 rounded-lg font-black">
                  Cobrar →
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          COLUMNA DERECHA: TICKET DE VENTA Y COBRO
          Visible siempre en desktop (lg:), en móvil solo si vistaMovil === 'ticket'
         ══════════════════════════════════════════════════════════════════════ */}
      <aside
        className={`w-full lg:w-[350px] xl:w-[380px] lg:flex-none flex-shrink-0 flex flex-col overflow-hidden bg-white border border-brand/20 rounded-2xl sm:rounded-3xl shadow-xl flex-1 min-h-0 lg:h-full ${vistaMovil === 'ticket' ? 'flex' : 'hidden lg:flex'
          }`}
      >
        {/* Encabezado del ticket */}
        <div className="p-3 sm:p-4 border-b border-ink/10 flex items-center justify-between flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <IconCart className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-ink leading-tight">
                Ticket de Venta
              </h2>
              <p className="text-[11px] text-ink/50">
                {cart.length === 0
                  ? 'Sin productos seleccionados'
                  : `${cart.length} producto${cart.length !== 1 ? 's' : ''} (${totalItemsCount} u.)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="text-xs bg-brand text-white font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm hover:bg-brand-dark transition"
              onClick={() => setEscanerAbierto(true)}
              title="Escanear con cámara"
            >
              <IconCamera className="h-3.5 w-3.5" />
              <span>Escanear</span>
            </button>

            {cart.length > 0 && (
              <button
                type="button"
                className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded-lg hover:bg-red-50 transition"
                onClick={() => setCart([])}
              >
                Vaciar
              </button>
            )}

            {/* Botón para volver al catálogo en móvil */}
            <button
              type="button"
              className="lg:hidden text-xs bg-brand-soft text-brand font-bold px-2.5 py-1.5 rounded-xl hover:bg-brand-soft/80"
              onClick={() => setVistaMovil('catalogo')}
            >
              + Catálogo
            </button>
          </div>
        </div>

        {/* Scroll interno con los items y formularios de cobro */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">

          {/* Listado de items del ticket */}
          {cart.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-ink/15 rounded-2xl text-ink/50 text-xs space-y-2 bg-brand-soft/10">
              <span className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-brand-soft/60 text-ink/40">
                <IconCart className="h-6 w-6" />
              </span>
              <p className="font-bold text-ink/70 text-sm">El ticket está vacío</p>
              <p className="text-[11px] text-ink/50 max-w-[220px] mx-auto">
                Selecciona productos del catálogo o escanea con el lector de código de barras.
              </p>
              <button
                type="button"
                className="lg:hidden mt-2 btn-s text-xs py-1.5 px-3 font-bold"
                onClick={() => setVistaMovil('catalogo')}
              >
                Abrir Catálogo
              </button>
            </div>
          ) : (
            <div className="divide-y divide-ink/5 border border-ink/10 rounded-2xl bg-gray-50/50 overflow-hidden">
              {cart.map((c) => {
                const subtotalItem = Number(c.cantidad) * Number(c.precio);
                const esPeso = ['KG', 'LB', 'L'].includes((c.unidad_medida || '').toUpperCase());
                return (
                  <div key={c.id} className="p-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-ink truncate">{c.nombre}</p>
                      <p className="text-[10px] text-ink/60">
                        {money(c.precio)} / {c.unidad_medida}
                      </p>
                    </div>

                    {/* Controles de cantidad */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-ink/20 text-ink font-bold hover:bg-brand-soft text-xs"
                        onClick={() => cambiarCantidad(c.id, -1)}
                        aria-label="Disminuir"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step={esPeso ? '0.1' : '1'}
                        min={esPeso ? '0.1' : '1'}
                        className="w-12 rounded-md border border-ink/20 py-0.5 text-center text-xs font-bold bg-white"
                        value={c.cantidad}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) {
                            setCart((curr) =>
                              curr.map((x) => (x.id === c.id ? { ...x, cantidad: v } : x))
                            );
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-white font-bold hover:bg-brand-dark text-xs"
                        onClick={() => cambiarCantidad(c.id, 1)}
                        aria-label="Aumentar"
                      >
                        +
                      </button>
                    </div>

                    {/* Subtotal y botón quitar */}
                    <div className="text-right flex-shrink-0 w-16">
                      <span className="font-black text-xs text-ink block">
                        {money(subtotalItem)}
                      </span>
                      <button
                        type="button"
                        className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5 justify-end w-full font-medium"
                        onClick={() => quitarItem(c.id)}
                      >
                        <IconClose className="h-2.5 w-2.5" /> Quitar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tipo de Comprobante / Datos de Facturación */}
          <div className="rounded-2xl border border-ink/10 bg-brand-soft/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-ink/70">
                Datos del Comprobante
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 transition ${tipoComprobante === 'CONSUMIDOR_FINAL'
                      ? 'bg-brand text-white shadow-sm'
                      : 'bg-white text-ink/70 border border-ink/15'
                    }`}
                  onClick={() => setTipoComprobante('CONSUMIDOR_FINAL')}
                >
                  <IconBolt className="h-3 w-3" />
                  Consumidor Final
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 transition ${tipoComprobante === 'FACTURA'
                      ? 'bg-brand text-white shadow-sm'
                      : 'bg-white text-ink/70 border border-ink/15'
                    }`}
                  onClick={() => setTipoComprobante('FACTURA')}
                >
                  <IconFileText className="h-3 w-3" />
                  Con RUC / Cédula
                </button>
              </div>
            </div>

            {tipoComprobante === 'CONSUMIDOR_FINAL' && (
              <div className="pt-1 border-t border-ink/10">
                <input
                  className="inp text-xs py-1.5 bg-white placeholder-ink/40"
                  placeholder="Nombre o apodo del cliente (opcional)"
                  value={nombreFiado}
                  onChange={(e) => setNombreFiado(e.target.value)}
                />
              </div>
            )}

            {tipoComprobante === 'FACTURA' && (
              <div className="space-y-2 pt-1 border-t border-ink/10">
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-ink/40">
                    <IconSearch className="h-3.5 w-3.5" />
                  </span>
                  <input
                    className="inp text-xs py-1.5 pl-8 bg-white placeholder-ink/40"
                    placeholder="Buscar cliente registrado por nombre o documento..."
                    value={qCliente}
                    onChange={(e) => {
                      setQCliente(e.target.value);
                      setDropdownVisible(true);
                      if (!e.target.value) handleSeleccionarCliente('');
                    }}
                    onFocus={() => setDropdownVisible(true)}
                    onBlur={() => setTimeout(() => setDropdownVisible(false), 150)}
                  />
                  {dropdownVisible && qCliente.length >= 1 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-ink/15 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      {(clientesLoad.data || [])
                        .filter((cl) => {
                          const lq = qCliente.toLowerCase();
                          return (
                            (cl.nombre || '').toLowerCase().includes(lq) ||
                            (cl.documento || '').toLowerCase().includes(lq)
                          );
                        })
                        .slice(0, 8)
                        .map((cl) => (
                          <button
                            key={cl.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-brand-soft text-left"
                            onMouseDown={() => handleSeleccionarCliente(cl.id)}
                          >
                            <IconUser className="h-3.5 w-3.5 text-ink/40 flex-shrink-0" />
                            <span className="font-semibold truncate">{cl.nombre}</span>
                            {cl.documento && (
                              <span className="ml-auto text-ink/50 font-mono flex-shrink-0">
                                {cl.documento}
                              </span>
                            )}
                          </button>
                        ))}
                      {(clientesLoad.data || []).filter((cl) => {
                        const lq = qCliente.toLowerCase();
                        return (
                          (cl.nombre || '').toLowerCase().includes(lq) ||
                          (cl.documento || '').toLowerCase().includes(lq)
                        );
                      }).length === 0 && (
                          <p className="px-3 py-2 text-xs text-ink/50 italic">
                            No hay clientes registrados con ese nombre o número.
                          </p>
                        )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    className="inp text-xs py-1.5 font-mono bg-white"
                    placeholder="RUC / Cédula *"
                    value={clienteRuc}
                    onChange={(e) => setClienteRuc(e.target.value)}
                  />
                  <input
                    className="inp text-xs py-1.5 bg-white"
                    placeholder="Razón Social / Nombre *"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                  />
                </div>
                <input
                  type="email"
                  className="inp text-xs py-1.5 bg-white"
                  placeholder="Correo electrónico para enviar la factura"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Sección de Selección de Cliente si el método es FIADO */}
          {metodoPago === 'FIADO' && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-3 space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <IconCredit className="h-4 w-4" />
                Cliente Responsable del Fiado
              </span>
              <p className="text-[11px] text-amber-800 leading-snug">
                El monto total quedará anotado en la cuenta por cobrar de esta persona.
              </p>

              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-ink/40">
                  <IconSearch className="h-3.5 w-3.5" />
                </span>
                <input
                  className="inp text-xs py-1.5 pl-8 bg-white"
                  placeholder="Buscar cliente registrado..."
                  value={qCliente}
                  onChange={(e) => {
                    setQCliente(e.target.value);
                    setDropdownVisible(true);
                    if (!e.target.value) handleSeleccionarCliente('');
                  }}
                  onFocus={() => setDropdownVisible(true)}
                  onBlur={() => setTimeout(() => setDropdownVisible(false), 150)}
                />
                {dropdownVisible && qCliente.length >= 1 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-ink/15 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                    {(clientesLoad.data || [])
                      .filter((cl) => {
                        const lq = qCliente.toLowerCase();
                        return (
                          (cl.nombre || '').toLowerCase().includes(lq) ||
                          (cl.documento || '').toLowerCase().includes(lq)
                        );
                      })
                      .slice(0, 8)
                      .map((cl) => (
                        <button
                          key={cl.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-brand-soft text-left"
                          onMouseDown={() => handleSeleccionarCliente(cl.id)}
                        >
                          <IconUser className="h-3.5 w-3.5 text-ink/40 flex-shrink-0" />
                          <span className="font-semibold truncate">{cl.nombre}</span>
                        </button>
                      ))}
                    {(clientesLoad.data || []).filter((cl) => {
                      const lq = qCliente.toLowerCase();
                      return (
                        (cl.nombre || '').toLowerCase().includes(lq) ||
                        (cl.documento || '').toLowerCase().includes(lq)
                      );
                    }).length === 0 && (
                        <p className="px-3 py-2 text-xs text-ink/50 italic">
                          Cliente no encontrado. Puedes escribir su nombre abajo.
                        </p>
                      )}
                  </div>
                )}
              </div>

              {!clienteSeleccionadoId && (
                <input
                  className="inp text-xs py-1.5 bg-white"
                  placeholder="O escribe el nombre completo del cliente a quien se fía *"
                  value={nombreFiado}
                  onChange={(e) => setNombreFiado(e.target.value)}
                />
              )}

              {clienteSeleccionadoId && (
                <div className="flex items-center justify-between text-xs bg-white rounded-xl p-2 border border-amber-200">
                  <span className="text-amber-950 font-bold flex items-center gap-1.5">
                    <IconUser className="h-4 w-4 text-amber-700" />
                    {clienteNombre}
                  </span>
                  <button
                    type="button"
                    className="text-amber-700 hover:text-amber-900 font-bold text-[11px] underline"
                    onClick={() => handleSeleccionarCliente('')}
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Selector de Método de Pago */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-ink/70 block">
              Forma de Pago del Cliente
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                ['EFECTIVO', 'Efectivo', IconCash],
                ['TRANSFERENCIA', 'Transferencia', IconTransfer],
                ['FIADO', 'Fiado / Crédito', IconCredit],
              ].map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  className={`py-2 px-1 text-xs font-bold rounded-xl border transition flex flex-col items-center gap-1 text-center ${metodoPago === m
                      ? 'bg-brand text-white border-brand shadow-sm'
                      : 'bg-white text-ink/70 border-ink/20 hover:bg-brand-soft'
                    }`}
                  onClick={() => setMetodoPago(m)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>

            {/* Campos condicionales según el método */}
            {metodoPago === 'TRANSFERENCIA' && (
              <div className="pt-1">
                <input
                  className="inp text-xs py-2 bg-white"
                  placeholder="Número de comprobante bancario o referencia *"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                />
                <p className="text-[10px] text-ink/50 mt-1">
                  Ingresa el código o número de transacción de la app bancaria para verificar el pago.
                </p>
              </div>
            )}

            {metodoPago === 'EFECTIVO' && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-bold text-ink/70">
                  <span>Dinero entregado por el cliente:</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <button
                      type="button"
                      className="rounded-lg bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand hover:bg-brand-soft/80"
                      onClick={() => setRecibido(total > 0 ? total.toFixed(2) : '')}
                    >
                      Exacto
                    </button>
                    {[1, 5, 10, 20, 50].map((b) => (
                      <button
                        key={b}
                        type="button"
                        className="rounded-lg bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand hover:bg-brand-soft/80"
                        onClick={() => setRecibido(String(b))}
                      >
                        ${b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-ink/40">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="inp pl-8 text-xl font-black py-2.5"
                    placeholder={total > 0 ? total.toFixed(2) : '0.00'}
                    value={recibido}
                    onChange={(e) => setRecibido(e.target.value)}
                  />
                </div>

                {/* Banner de Vuelto o Dinero Faltante con alta visibilidad */}
                {numRecibido > 0 && total > 0 && (
                  <div
                    className={`rounded-2xl p-3 text-center border-2 transition ${numRecibido >= total
                        ? 'bg-brand-soft/70 text-brand-dark border-brand/40'
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                  >
                    <span className="text-[11px] uppercase font-black tracking-wider flex items-center justify-center gap-1.5 mb-1">
                      {numRecibido >= total ? (
                        <>
                          <IconCash className="h-4 w-4 text-brand" />
                          <span>Cambio / Vuelto a Entregar</span>
                        </>
                      ) : (
                        <>
                          <IconAlert className="h-4 w-4 text-amber-600" />
                          <span>Dinero Faltante</span>
                        </>
                      )}
                    </span>
                    <span className="text-2xl font-black block">
                      {numRecibido >= total ? money(vuelto) : money(falta)}
                    </span>
                    {numRecibido < total && (
                      <p className="text-[11px] text-amber-800 mt-1 font-medium">
                        El monto entregado no cubre el valor total. Solicita los {money(falta)} que faltan.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desglose y Total */}
          <div className="pt-2 border-t-2 border-ink/10 space-y-1">
            <div className="flex items-center justify-between text-xs text-ink/60">
              <span>Subtotal (sin impuestos):</span>
              <span>{money(total / 1.15)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-ink/60">
              <span>IVA (15%):</span>
              <span>{money(total - total / 1.15)}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1 border-t border-ink/5">
              <span className="text-xs font-black uppercase tracking-wider text-ink/70">
                TOTAL A COBRAR
              </span>
              <span className="text-2xl sm:text-3xl font-black text-brand">
                {money(total)}
              </span>
            </div>
          </div>

          <ErrorBox error={err} />
        </div>

        {/* Botón de Acción Principal de Cobro (fijo al pie del panel) */}
        <div className="p-3 sm:p-4 border-t border-ink/10 bg-white flex-shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            className="btn-p w-full py-3.5 sm:py-4 text-sm sm:text-base font-black shadow-lg flex items-center justify-center gap-2 rounded-2xl active:scale-[0.99] transition"
            disabled={
              cart.length === 0 ||
              busy ||
              (metodoPago === 'EFECTIVO' && numRecibido > 0 && numRecibido < total)
            }
            onClick={cobrar}
          >
            {busy ? (
              <span>Registrando venta...</span>
            ) : cart.length === 0 ? (
              <span className="opacity-80">Agrega productos al ticket</span>
            ) : metodoPago === 'EFECTIVO' && numRecibido > 0 && numRecibido < total ? (
              <span>Falta dinero para cobrar</span>
            ) : (
              <>
                <IconBolt className="h-5 w-5" />
                <span>
                  {metodoPago === 'EFECTIVO'
                    ? `COBRAR EN EFECTIVO ${money(total)}`
                    : metodoPago === 'TRANSFERENCIA'
                      ? `REGISTRAR TRANSFERENCIA ${money(total)}`
                      : `REGISTRAR FIADO ${money(total)}`}
                </span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Modal para indicar cantidad manual o peso */}
      {productoParaCantidad && (
        <ModalCantidadInterna
          productoParaCantidad={productoParaCantidad}
          cantidadInput={cantidadInput}
          setCantidadInput={setCantidadInput}
          guardarCantidadModal={guardarCantidadModal}
          onClose={() => setProductoParaCantidad(null)}
        />
      )}

      {/* Modal con Comprobante / Factura emitida */}
      {facturaEmitida && (
        <ModalFactura
          factura={facturaEmitida}
          onClose={() => setFacturaEmitida(null)}
        />
      )}

      {/* Modal para Reponer Stock rápido desde mostrador/caja */}
      {productoParaStock && (
        <ModalReponerStockPOS
          producto={productoParaStock}
          onClose={() => setProductoParaStock(null)}
          onDone={(cant, pagadoCaja) => {
            setProductoParaStock(null);
            const msgCaja = pagadoCaja > 0
              ? ` y se registró una salida de $${pagadoCaja.toFixed(2)} en la caja por pago a distribuidor (cuadre sin desbalance)`
              : '';
            setNotifStock(`¡Se agregaron ${cant} ${productoParaStock.unidad_medida} al stock de ${productoParaStock.nombre}${msgCaja}!`);
            prodsLoad.reload();
            setTimeout(() => setNotifStock(null), 6000);
          }}
        />
      )}

      {/* Escáner de código de barras con cámara del teléfono (super rápido) */}
      <ScannerModal
        isOpen={escanerAbierto}
        onClose={() => setEscanerAbierto(false)}
        onScanProduct={handleScanProductFromCamera}
        cartCount={cart.length}
        cartTotal={total}
        onGoToCobrar={() => {
          setEscanerAbierto(false);
          setVistaMovil('ticket');
        }}
      />
    </div>
  );
}

// ─── Modal para Reposición Rápida de Stock desde POS ───────────────────────
function ModalReponerStockPOS({ producto, onClose, onDone }) {
  const [cantidad, setCantidad] = useState('');
  const [montoPago, setMontoPago] = useState('');
  const [descontarCaja, setDescontarCaja] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const guardar = async (e) => {
    e.preventDefault();
    const c = Number(cantidad);
    if (isNaN(c) || c <= 0) {
      setErr({ message: 'Indica una cantidad de productos válida mayor a 0.' });
      return;
    }

    const valorPagado = Number(montoPago || 0);
    if (descontarCaja && isNaN(valorPagado)) {
      setErr({ message: 'Ingresa un valor monetario válido para el pago al distribuidor.' });
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      // 1. Registrar entrada en inventario
      await api('/inventario/entradas/', {
        method: 'POST',
        body: {
          producto: producto.id,
          cantidad: c,
          costo_unitario: valorPagado > 0 ? Number((valorPagado / c).toFixed(4)) : undefined,
          motivo: `Reposición desde mostrador (${c} ${producto.unidad_medida})`,
        },
      });

      // 2. Si se pagó con dinero de caja, registrar salida de caja para evitar desbalance
      let dineroDescontado = 0;
      if (descontarCaja && valorPagado > 0) {
        try {
          await api('/caja/turnos/movimientos/', {
            method: 'POST',
            body: {
              tipo: 'EGRESO',
              monto: valorPagado,
              motivo: `Pago a distribuidor por reposición de ${producto.nombre} (${c} ${producto.unidad_medida})`,
            },
          });
          dineroDescontado = valorPagado;
        } catch (eCaja) {
          console.warn('No se pudo registrar egreso de caja (posiblemente no hay turno abierto):', eCaja);
        }
      }

      onDone(c, dineroDescontado);
    } catch (x) {
      setErr(x);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Reponer Stock: ${producto.nombre}`} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        {/* Ficha del producto */}
        <div className="rounded-2xl bg-brand-soft/50 p-3.5 flex items-center justify-between text-xs border border-brand/20">
          <div>
            <p className="font-bold text-ink">{producto.nombre}</p>
            <p className="text-ink/60 text-[11px]">
              Unidad: {producto.unidad_medida} · Código: {producto.codigo_barras || 'Sin código'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-ink/50 block">Stock actual:</span>
            <span className="font-black text-brand text-sm">
              {formatStock(producto.stock_actual, producto.unidad_medida)}
            </span>
          </div>
        </div>

        {/* Cantidad recibida */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-ink/70 mb-1">
            Cantidad recibida del distribuidor ({producto.unidad_medida}) *
          </label>
          <input
            type="number"
            step={producto.tipo === 'GRANEL' ? '0.01' : '1'}
            min={producto.tipo === 'GRANEL' ? '0.01' : '1'}
            className="inp text-2xl font-black py-2.5 rounded-2xl"
            placeholder={producto.tipo === 'GRANEL' ? 'Ej: 2.50' : 'Ej: 12'}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Pago al distribuidor y control de cuadre de caja */}
        <div className="rounded-2xl border border-ink/15 bg-gray-50/70 p-3.5 space-y-3">
          <div>
            <label className="block text-xs font-black text-ink/80 mb-1">
              ¿Cuánto le pagaste al distribuidor en total? (Opcional)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-ink/40">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="inp pl-8 text-lg font-black py-2 rounded-xl bg-white"
                placeholder="0.00 (deja en 0 si no se pagó con dinero de caja)"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded text-brand focus:ring-brand"
              checked={descontarCaja}
              onChange={(e) => setDescontarCaja(e.target.checked)}
            />
            <div className="text-xs">
              <p className="font-bold text-ink">
                Descontar este pago del dinero de la Caja (Efectivo de ventas)
              </p>
              <p className="text-[11px] text-ink/55 leading-snug mt-0.5">
                Registra automáticamente una salida de efectivo en la caja del turno activo para que el cuadre y arqueo final no tengan desbalance.
              </p>
            </div>
          </label>
        </div>

        <ErrorBox error={err} />

        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-s flex-1" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn-p flex-1 py-3 font-black" disabled={busy}>
            {busy ? 'Registrando…' : 'Sumar al Inventario y Cuadrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal para Cantidad personalizada ──────────────────────────────────────
function ModalCantidadInterna({
  productoParaCantidad,
  cantidadInput,
  setCantidadInput,
  guardarCantidadModal,
  onClose,
}) {
  const esPeso = ['KG', 'LB', 'L'].includes((productoParaCantidad.unidad_medida || '').toUpperCase());

  return (
    <Modal
      title={`Seleccionar cantidad: ${productoParaCantidad.nombre}`}
      onClose={onClose}
    >
      <form onSubmit={guardarCantidadModal} className="space-y-4">
        <div className="rounded-2xl bg-brand-soft/40 p-3.5 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-ink">{productoParaCantidad.nombre}</p>
            <p className="text-ink/60">
              Precio: {money(productoParaCantidad.precio_venta)} / {productoParaCantidad.unidad_medida}
            </p>
          </div>
          <div className="text-right">
            <span className="text-ink/60 block text-[11px]">Inventario disponible:</span>
            <span className="font-black text-brand text-sm">
              {formatStock(productoParaCantidad.stock_actual, productoParaCantidad.unidad_medida)}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70 mb-2">
            Cantidad a vender ({productoParaCantidad.unidad_medida}) *
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-s h-12 w-12 text-xl font-black rounded-xl"
              onClick={() =>
                setCantidadInput((curr) => {
                  const v = parseFloat(curr) || 1;
                  const step = esPeso ? 0.1 : 1;
                  return String(Math.max(step, parseFloat((v - step).toFixed(2))));
                })
              }
            >
              -
            </button>
            <input
              type="number"
              step={esPeso ? '0.01' : '1'}
              min={esPeso ? '0.01' : '1'}
              className="inp text-center text-2xl font-black h-12 rounded-xl"
              value={cantidadInput}
              onChange={(e) => setCantidadInput(e.target.value)}
              autoFocus
              required
            />
            <button
              type="button"
              className="btn-s h-12 w-12 text-xl font-black rounded-xl"
              onClick={() =>
                setCantidadInput((curr) => {
                  const v = parseFloat(curr) || 0;
                  const step = esPeso ? 0.1 : 1;
                  return String(parseFloat((v + step).toFixed(2)));
                })
              }
            >
              +
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-s flex-1" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-p flex-1 py-3 font-black">
            Confirmar e Incluir al Ticket
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal para Comprobante y Ticket ────────────────────────────────────────
function ModalFactura({ factura, onClose }) {
  const numFactura = factura.venta?.numero || '001-001-' + String(factura.venta?.id || '1').padStart(9, '0');

  const imprimir = () => {
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) {
      window.print();
      return;
    }
    const f = factura;
    const itemsHtml = f.itemsComprados
      .map(
        (it) =>
          `<tr><td style="padding:2px 4px">${it.cantidad} ${it.unidad_medida}</td><td style="padding:2px 4px">${it.nombre}</td><td style="padding:2px 4px;text-align:right">${money(it.cantidad * it.precio)}</td></tr>`
      )
      .join('');
    const clienteNombreTicket = f.cliente?.nombre || f.venta?.nombre_fiado || 'CONSUMIDOR FINAL';
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; }
  h1 { font-size: 14px; text-align: center; margin-bottom: 2px; }
  .center { text-align: center; }
  .sep { border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 1px 3px; vertical-align: top; font-size: 11px; }
  th { font-weight: bold; }
  .total { font-size: 15px; font-weight: bold; text-align: right; margin-top: 4px; }
  .footer { text-align: center; margin-top: 8px; font-size: 10px; }
</style>
</head><body>
  <h1>VÍVERES STALIN</h1>
  <p class="center">R.U.C.: 1799999999001</p>
  <p class="center">COMPROBANTE ELECTRÓNICO</p>
  <p class="center"><b>FAC N°: ${numFactura}</b></p>
  <p class="center">${new Date(f.fecha).toLocaleString()}</p>
  <div class="sep"></div>
  <p><b>Cliente:</b> ${clienteNombreTicket}</p>
  <p><b>RUC/C.I.:</b> ${f.cliente.ruc}</p>
  <p><b>Método:</b> ${f.metodoPago}</p>
  <div class="sep"></div>
  <table>
    <thead><tr><th>Cant</th><th>Desc</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="sep"></div>
  <p style="text-align:right">Subtotal: ${money(f.subtotal)}</p>
  <p style="text-align:right">IVA 15%: ${money(f.iva)}</p>
  <p class="total">TOTAL: ${money(f.total)}</p>
  ${f.vuelto > 0
        ? `<p style="text-align:right">Recibido: ${money(f.efectivoRecibido)}</p><p style="text-align:right;font-weight:bold">Vuelto: ${money(f.vuelto)}</p>`
        : ''
      }
  <div class="sep"></div>
  <p class="footer">¡Gracias por preferir Víveres Stalin!<br>Vuelva pronto.</p>
  <script>window.onload = function() { window.print(); window.close(); };<\/script>
</body></html>`);
    win.document.close();
  };

  return (
    <Modal title="Venta Realizada con Éxito" onClose={onClose}>
      <div className="space-y-4">
        {/* Vista previa del comprobante */}
        <div id="area-impresion" className="border border-ink/20 rounded-2xl p-4 bg-white text-ink text-xs font-mono space-y-3 shadow-inner max-h-96 overflow-y-auto">
          <div className="text-center border-b border-dashed border-ink/20 pb-3">
            <h2 className="text-base font-black uppercase tracking-wider text-brand">VÍVERES STALIN</h2>
            <p className="text-[10px] text-ink/70">R.U.C.: 1799999999001</p>
            <p className="text-[10px] font-bold text-ink mt-1">COMPROBANTE ELECTRÓNICO</p>
            <p className="text-xs font-extrabold text-ink">FACTURA N°: {numFactura}</p>
            <p className="text-[10px] text-ink/50">Fecha: {new Date(factura.fecha).toLocaleString()}</p>
          </div>

          <div className="border-b border-dashed border-ink/20 pb-2 space-y-0.5 text-[11px]">
            <p><b>Cliente:</b> {factura.cliente.nombre}</p>
            <p><b>RUC / C.I.:</b> {factura.cliente.ruc}</p>
            <p><b>Forma de Pago:</b> {factura.metodoPago}</p>
          </div>

          <table className="w-full text-left text-[11px] border-b border-dashed border-ink/20 pb-2">
            <thead>
              <tr className="border-b border-ink/10 text-ink/70">
                <th className="py-1">Cant.</th>
                <th className="py-1">Descripción</th>
                <th className="py-1 text-right">P.Unit</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {factura.itemsComprados.map((it) => (
                <tr key={it.id}>
                  <td className="py-1 font-bold">{it.cantidad} {it.unidad_medida}</td>
                  <td className="py-1">{it.nombre}</td>
                  <td className="py-1 text-right">{money(it.precio)}</td>
                  <td className="py-1 text-right font-semibold">{money(it.cantidad * it.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-right text-[11px] pt-1">
            <p>Subtotal: {money(factura.subtotal)}</p>
            <p>IVA 15%: {money(factura.iva)}</p>
            <p className="text-sm font-black text-ink pt-1 border-t border-ink/10">TOTAL: {money(factura.total)}</p>
            {factura.vuelto > 0 && (
              <p className="text-[11px] font-bold text-brand">VUELTO ENTREGADO: {money(factura.vuelto)}</p>
            )}
          </div>

          <div className="text-center pt-3 border-t border-dashed border-ink/20 text-[10px] text-ink/60">
            <p>¡Gracias por su compra en Víveres Stalin!</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-p flex-1 py-3 font-bold flex items-center justify-center gap-2"
            onClick={imprimir}
          >
            <IconPrinter className="h-4 w-4" /> Imprimir Ticket
          </button>
          <button type="button" className="btn-s flex-1 py-3 font-bold" onClick={onClose}>
            Nueva Venta
          </button>
        </div>
      </div>
    </Modal>
  );
}
