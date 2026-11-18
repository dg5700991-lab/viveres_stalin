import { useState, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, list, money } from '../api';
import { Spinner, Empty, ErrorBox, useLoad, Modal } from '../ui';
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
} from '../icons';

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

  const [q, setQ] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [cart, setCart] = useState([]);
  const [productoParaCantidad, setProductoParaCantidad] = useState(null);
  const [cantidadInput, setCantidadInput] = useState('1');

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

  const numRecibido = Number(recibido || 0);
  const vuelto = numRecibido > total ? numRecibido - total : 0;
  const falta = numRecibido < total ? total - numRecibido : 0;

  const agregarAlCarrito = (p, e) => {
    e?.stopPropagation();
    setErr(null);
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
    setCart((curr) =>
      curr
        .map((x) => {
          if (x.id !== id) return x;
          const nueva = +(x.cantidad + delta).toFixed(3);
          return nueva > 0 ? { ...x, cantidad: nueva } : null;
        })
        .filter(Boolean)
    );
  };

  const quitarItem = (id, e) => {
    e?.stopPropagation();
    setCart((curr) => curr.filter((x) => x.id !== id));
  };

  const abrirModalCantidad = (p, e) => {
    e?.stopPropagation();
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
    try {
      const p = await api(`/productos/por-codigo/${encodeURIComponent(q.trim())}/`);
      agregarAlCarrito(p);
      setQ('');
    } catch (x) {
      setErr(x.status === 404 ? { message: `Codigo ${q.trim()} no registrado en el sistema.` } : x);
    }
  };

  const cobrar = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    setErr(null);

    const pagos = [];
    if (metodoPago === 'EFECTIVO') {
      pagos.push({ metodo: 'EFECTIVO', monto: total.toFixed(2) });
    } else if (metodoPago === 'TRANSFERENCIA') {
      pagos.push({
        metodo: 'TRANSFERENCIA',
        monto: total.toFixed(2),
        referencia: ref.trim() || 'Transf. mostrador',
      });
    } else if (metodoPago === 'FIADO') {
      if (!clienteSeleccionadoId && !nombreFiado.trim()) {
        setErr({ message: 'Para registrar a credito / fiado selecciona un cliente o escribe el nombre.' });
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
      <div className="card text-center p-8 space-y-4 max-w-md mx-auto my-12 border-2 border-brand/20 shadow-lg">
        <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-brand-soft text-brand mb-2">
          <IconLock className="h-8 w-8" />
        </span>
        <h2 className="text-xl font-bold text-ink">Turno de Caja Cerrado</h2>
        <p className="text-sm text-ink/60">
          Para realizar ventas necesitas tener un turno de caja abierto.
        </p>
        <Link className="btn-p block w-full py-3 font-bold" to="/caja">
          Abrir Turno de Caja
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full" style={{ height: 'calc(100vh - 68px)', overflow: 'hidden' }}>

      {/* ===== COLUMNA IZQUIERDA: CATALOGO ===== */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Busqueda */}
        <div className="relative w-full mb-3 flex-shrink-0">
          <span className="absolute left-3.5 top-3 text-ink/40">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            ref={inp}
            autoFocus
            className="inp text-sm pl-10 pr-9 py-2.5 rounded-2xl border-ink/15 shadow-xs w-full bg-white"
            placeholder="Escanea el codigo de barras o escribe para buscar producto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={scan}
          />
          {q && (
            <button
              type="button"
              className="absolute right-3.5 top-2.5 text-ink/40 hover:text-ink flex items-center justify-center h-5 w-5"
              onClick={() => setQ('')}
            >
              <IconClose className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Chips de categorias */}
        <div className="mb-3 flex-shrink-0 overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex-shrink-0 ${categoriaSeleccionada === ''
                  ? 'bg-brand text-white'
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
                    ? 'bg-brand text-white'
                    : 'bg-white text-ink/70 hover:bg-brand-soft border border-ink/10'
                  }`}
                onClick={() => setCategoriaSeleccionada(c.id)}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de productos con scroll propio */}
        <div className="flex-1 overflow-y-auto pr-1 pb-4">
          {prodsLoad.loading ? (
            <Spinner />
          ) : productosMostrador.length === 0 ? (
            <Empty>No hay productos activos con esos filtros.</Empty>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {productosMostrador.map((p) => {
                const enCarro = cart.find((x) => x.id === p.id);
                const isBajo = p.stock_bajo;
                const stockTexto = formatStock(p.stock_actual, p.unidad_medida);

                return (
                  <div
                    key={p.id}
                    onClick={(e) => agregarAlCarrito(p, e)}
                    className={`group relative flex flex-col justify-between rounded-2xl p-3 text-left transition border cursor-pointer select-none bg-white ${enCarro
                        ? 'border-brand ring-2 ring-brand/30 shadow-md'
                        : 'border-ink/10 hover:border-brand/40 hover:shadow-md'
                      }`}
                  >
                    <div>
                      {/* Miniatura */}
                      <div className="relative mb-2 h-28 w-full overflow-hidden rounded-xl bg-brand-soft/30 flex items-center justify-center border border-ink/5">
                        {p.imagen_url ? (
                          <img
                            src={p.imagen_url}
                            alt={p.nombre}
                            className="h-full w-full object-cover group-hover:scale-105 transition"
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

                        {/* Badge de stock */}
                        <span
                          className={`absolute bottom-1.5 left-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 ${isBajo ? 'bg-red-600 text-white' : 'bg-ink/80 text-white'
                            }`}
                        >
                          <IconPackage className="h-3 w-3" />
                          {stockTexto}
                        </span>

                        {/* Boton cantidad personalizada */}
                        <button
                          type="button"
                          className="absolute top-1.5 right-1.5 rounded-lg bg-white/90 p-1.5 text-ink/70 hover:bg-white hover:text-brand shadow-sm flex items-center justify-center"
                          title="Ingresar cantidad"
                          onClick={(e) => abrirModalCantidad(p, e)}
                        >
                          <IconCalculator className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <p className="font-bold text-ink text-sm line-clamp-2 leading-tight">{p.nombre}</p>
                      <p className="text-[11px] text-ink/50 mt-0.5 truncate">{p.categoria_nombre || 'General'}</p>
                    </div>

                    {/* Precio y botones */}
                    <div className="mt-2 pt-2 border-t border-ink/10">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-lg font-black text-brand">{money(p.precio_venta)}</span>
                        <span className="text-[11px] text-ink/50 uppercase font-mono">/{p.unidad_medida}</span>
                      </div>

                      {enCarro ? (
                        <div
                          className="flex items-center justify-between rounded-xl bg-brand-soft/40 border border-brand/30 p-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brand font-black hover:bg-brand-soft text-sm"
                            onClick={(e) => cambiarCantidad(p.id, -1, e)}
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
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white font-black hover:bg-brand-dark text-sm"
                            onClick={(e) => cambiarCantidad(p.id, 1, e)}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded-xl bg-brand py-2 text-xs font-bold text-white hover:bg-brand-dark transition text-center flex items-center justify-center gap-1"
                          onClick={(e) => agregarAlCarrito(p, e)}
                        >
                          <span>+</span> Agregar al ticket
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== COLUMNA DERECHA: TICKET (siempre visible, scroll interno) ===== */}
      <aside
        className="w-full lg:w-[380px] xl:w-[410px] flex-shrink-0 flex flex-col overflow-hidden bg-white border-2 border-brand/20 rounded-2xl shadow-xl"
        style={{ height: '100%' }}
      >
        {/* Scroll interno del ticket */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* Encabezado */}
          <div className="flex items-center justify-between border-b border-ink/10 pb-2.5 flex-shrink-0">
            <div>
              <h2 className="text-base font-black text-ink flex items-center gap-2">
                <IconCart className="h-4 w-4 text-brand" />
                Ticket de Venta
              </h2>
              <p className="text-xs text-ink/50">{cart.length} producto{cart.length !== 1 ? 's' : ''}</p>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                className="text-xs text-red-500 hover:text-red-700 font-bold"
                onClick={() => setCart([])}
              >
                Vaciar
              </button>
            )}
          </div>

          {/* Items del carrito */}
          {cart.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-ink/15 rounded-xl text-ink/50 text-xs space-y-2 bg-brand-soft/10">
              <span className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-brand-soft/60 text-ink/40">
                <IconCart className="h-6 w-6" />
              </span>
              <p className="font-bold text-ink/60">Ticket vacio</p>
              <p className="text-[11px]">Toca un producto para agregarlo al ticket</p>
            </div>
          ) : (
            <div className="divide-y divide-ink/10 border border-ink/10 rounded-xl bg-gray-50/50">
              {cart.map((c) => {
                const subtotalItem = Number(c.cantidad) * Number(c.precio);
                const esPeso = ['KG', 'LB', 'L'].includes((c.unidad_medida || '').toUpperCase());
                return (
                  <div key={c.id} className="p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-ink truncate">{c.nombre}</p>
                      <p className="text-[10px] text-ink/60">{money(c.precio)}/{c.unidad_medida}</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-ink/20 text-ink font-bold hover:bg-brand-soft text-xs"
                        onClick={() => cambiarCantidad(c.id, -1)}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step={esPeso ? '0.1' : '1'}
                        min={esPeso ? '0.1' : '1'}
                        className="w-11 rounded-md border border-ink/20 py-0.5 text-center text-xs font-bold bg-white"
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
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right flex-shrink-0 w-14">
                      <span className="font-extrabold text-xs text-ink block">{money(subtotalItem)}</span>
                      <button
                        type="button"
                        className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5 justify-end w-full"
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

          {/* Facturacion */}
          <div className="rounded-xl border border-ink/15 bg-brand-soft/20 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink/70">Facturacion</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg flex items-center gap-1 ${tipoComprobante === 'CONSUMIDOR_FINAL'
                      ? 'bg-brand text-white'
                      : 'bg-white text-ink/70 border border-ink/15'
                    }`}
                  onClick={() => setTipoComprobante('CONSUMIDOR_FINAL')}
                >
                  <IconBolt className="h-3 w-3" />
                  Rapido
                </button>
                <button
                  type="button"
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg flex items-center gap-1 ${tipoComprobante === 'FACTURA'
                      ? 'bg-brand text-white'
                      : 'bg-white text-ink/70 border border-ink/15'
                    }`}
                  onClick={() => setTipoComprobante('FACTURA')}
                >
                  <IconFileText className="h-3 w-3" />
                  Con RUC
                </button>
              </div>
            </div>

            {tipoComprobante === 'CONSUMIDOR_FINAL' && (
              <div className="pt-1 border-t border-ink/10">
                <input
                  className="inp text-xs py-1 bg-white"
                  placeholder="Nombre del cliente (opcional)"
                  value={nombreFiado}
                  onChange={(e) => setNombreFiado(e.target.value)}
                />
              </div>
            )}

            {tipoComprobante === 'FACTURA' && (
              <div className="space-y-1.5 pt-1 border-t border-ink/10">
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-ink/40">
                    <IconSearch className="h-3.5 w-3.5" />
                  </span>
                  <input
                    className="inp text-xs py-1 pl-7 bg-white"
                    placeholder="Buscar cliente por nombre o documento..."
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
                              <span className="ml-auto text-ink/50 font-mono flex-shrink-0">{cl.documento}</span>
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
                          <p className="px-3 py-2 text-xs text-ink/50 italic">Sin resultados</p>
                        )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    className="inp text-xs py-1 font-mono bg-white"
                    placeholder="RUC / Cedula *"
                    value={clienteRuc}
                    onChange={(e) => setClienteRuc(e.target.value)}
                  />
                  <input
                    className="inp text-xs py-1 bg-white"
                    placeholder="Razon Social *"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                  />
                </div>
                <input
                  type="email"
                  className="inp text-xs py-1 bg-white"
                  placeholder="Correo (envio de factura electronica)"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Seccion FIADO */}
          {metodoPago === 'FIADO' && (
            <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-2.5 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                <IconCredit className="h-3.5 w-3.5" />
                Cliente para el Fiado
              </span>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-ink/40">
                  <IconSearch className="h-3.5 w-3.5" />
                </span>
                <input
                  className="inp text-xs py-1 pl-7 bg-white"
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
                        <p className="px-3 py-2 text-xs text-ink/50 italic">Sin resultados</p>
                      )}
                  </div>
                )}
              </div>
              {!clienteSeleccionadoId && (
                <input
                  className="inp text-xs py-1 bg-white"
                  placeholder="O escribe el nombre del deudor (si no esta registrado)"
                  value={nombreFiado}
                  onChange={(e) => setNombreFiado(e.target.value)}
                />
              )}
              {clienteSeleccionadoId && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-brand font-semibold flex items-center gap-1">
                    <IconUser className="h-3.5 w-3.5" />
                    {clienteNombre}
                  </span>
                  <button
                    type="button"
                    className="text-ink/40 hover:text-ink text-[10px]"
                    onClick={() => handleSeleccionarCliente('')}
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Metodos de pago */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              {['EFECTIVO', 'TRANSFERENCIA', 'FIADO'].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`py-2 text-xs font-bold rounded-xl border transition flex flex-col items-center gap-1 ${metodoPago === m
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-ink/70 border-ink/20 hover:bg-brand-soft'
                    }`}
                  onClick={() => setMetodoPago(m)}
                >
                  {m === 'EFECTIVO' ? (
                    <><IconCash className="h-4 w-4" /><span>Efectivo</span></>
                  ) : m === 'TRANSFERENCIA' ? (
                    <><IconTransfer className="h-4 w-4" /><span>Transf.</span></>
                  ) : (
                    <><IconCredit className="h-4 w-4" /><span>Fiado</span></>
                  )}
                </button>
              ))}
            </div>

            {metodoPago === 'TRANSFERENCIA' && (
              <input
                className="inp text-xs py-1.5"
                placeholder="N. Referencia o comprobante bancario *"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
            )}

            {metodoPago === 'EFECTIVO' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-ink/70">
                  <span>Efectivo recibido:</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <button
                      type="button"
                      className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-black text-brand hover:bg-brand-soft/80"
                      onClick={() => setRecibido(total > 0 ? total.toFixed(2) : '')}
                    >
                      Exacto
                    </button>
                    {[1, 5, 10, 20, 50].map((b) => (
                      <button
                        key={b}
                        type="button"
                        className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand hover:bg-brand-soft/80"
                        onClick={() => setRecibido(String(b))}
                      >
                        ${b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2 text-base font-bold text-ink/40">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="inp pl-7 text-xl font-black"
                    placeholder={total > 0 ? total.toFixed(2) : '0.00'}
                    value={recibido}
                    onChange={(e) => setRecibido(e.target.value)}
                  />
                </div>

                {numRecibido > 0 && total > 0 && (
                  <div
                    className={`rounded-xl p-3 text-center ${numRecibido >= total
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                  >
                    <span className="text-[11px] uppercase font-black tracking-wider flex items-center justify-center gap-1 mb-1">
                      {numRecibido >= total ? (
                        <><IconCash className="h-3.5 w-3.5" /><span>Vuelto</span></>
                      ) : (
                        <><IconAlert className="h-3.5 w-3.5" /><span>Falta</span></>
                      )}
                    </span>
                    <span className="text-2xl font-black">
                      {numRecibido >= total ? money(vuelto) : money(falta)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="pt-2 border-t-2 border-ink/10 flex items-baseline justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-ink/60">TOTAL</span>
            <span className="text-3xl font-black text-brand">{money(total)}</span>
          </div>

          <ErrorBox error={err} />
        </div>

        {/* Boton COBRAR fijo al fondo */}
        <div className="p-3 border-t border-ink/10 bg-white flex-shrink-0">
          <button
            type="button"
            className="btn-p w-full py-4 text-base font-black shadow-lg flex items-center justify-center gap-2 rounded-xl"
            disabled={
              cart.length === 0 ||
              busy ||
              (metodoPago === 'EFECTIVO' && numRecibido > 0 && numRecibido < total)
            }
            onClick={cobrar}
          >
            {busy ? (
              <span>Procesando...</span>
            ) : cart.length === 0 ? (
              <span className="text-sm opacity-80">Agrega productos al ticket</span>
            ) : (
              <>
                <IconBolt className="h-5 w-5" />
                <span>COBRAR {total > 0 ? money(total) : ''}</span>
              </>
            )}
          </button>
        </div>
      </aside>
      {/* Modales */}
      {productoParaCantidad && (
        <ModalCantidadInterna
          productoParaCantidad={productoParaCantidad}
          cantidadInput={cantidadInput}
          setCantidadInput={setCantidadInput}
          guardarCantidadModal={guardarCantidadModal}
          onClose={() => setProductoParaCantidad(null)}
        />
      )}
      {facturaEmitida && (
        <ModalFactura
          factura={facturaEmitida}
          onClose={() => setFacturaEmitida(null)}
        />
      )}
    </div>
  );
}

// =====================================================
// MODAL: CANTIDAD MANUAL
// =====================================================
function ModalCantidadInterna({ productoParaCantidad, cantidadInput, setCantidadInput, guardarCantidadModal, onClose }) {
  const esPeso = ['KG', 'LB', 'L'].includes((productoParaCantidad.unidad_medida || '').toUpperCase());
  return (
    <Modal
      title={`Seleccionar cantidad: ${productoParaCantidad.nombre}`}
      onClose={onClose}
    >
      <form onSubmit={guardarCantidadModal} className="space-y-4">
        <div className="rounded-xl bg-brand-soft/40 p-3 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-ink">{productoParaCantidad.nombre}</p>
            <p className="text-ink/60">
              Precio: {money(productoParaCantidad.precio_venta)}/{productoParaCantidad.unidad_medida}
            </p>
          </div>
          <div className="text-right">
            <span className="text-ink/60 block">Stock disponible:</span>
            <span className="font-bold text-ink">
              {formatStock(productoParaCantidad.stock_actual, productoParaCantidad.unidad_medida)}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70 mb-2">
            Cantidad a vender *
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-s h-12 w-12 text-lg font-bold"
              onClick={() =>
                setCantidadInput((curr) => {
                  const v = parseFloat(curr) || 1;
                  const step = esPeso ? 0.1 : 1;
                  return String(Math.max(step, parseFloat((v - step).toFixed(1))));
                })
              }
            >
              -
            </button>
            <input
              type="number"
              step={esPeso ? '0.1' : '1'}
              min={esPeso ? '0.1' : '1'}
              className="inp text-center text-2xl font-black h-12"
              value={cantidadInput}
              onChange={(e) => setCantidadInput(e.target.value)}
              autoFocus
              required
            />
            <button
              type="button"
              className="btn-s h-12 w-12 text-lg font-bold"
              onClick={() =>
                setCantidadInput((curr) => {
                  const v = parseFloat(curr) || 0;
                  const step = esPeso ? 0.1 : 1;
                  return String(parseFloat((v + step).toFixed(1)));
                })
              }
            >
              +
            </button>
          </div>

          <div className="flex gap-2 mt-3">
            {(esPeso ? [0.1, 0.25, 0.5, 1, 2, 5] : [1, 2, 3, 5, 10, 12, 24]).map((n) => (
              <button
                key={n}
                type="button"
                className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-brand-soft text-brand hover:bg-brand-soft/80"
                onClick={() => setCantidadInput(String(n))}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 p-3 border border-ink/10 flex items-center justify-between">
          <span className="text-xs font-semibold text-ink/70">Total por este producto:</span>
          <span className="text-lg font-black text-brand">
            {money((parseFloat(cantidadInput) || 0) * Number(productoParaCantidad.precio_venta))}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-ink/10">
          <button type="button" className="btn-s" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-p min-w-[140px]">
            Agregar al Ticket
          </button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================
// MODAL: FACTURA / TICKET IMPRIMIBLE
// =====================================================
function ModalFactura({ factura, onClose }) {
  const imprimir = () => {
    const win = window.open('', '_blank', 'width=350,height=600');
    if (!win) return;
    const f = factura;
    const lineas = f.itemsComprados
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
<div class="center" style="font-size:10px">R.U.C.: 1799999999001</div>
<div class="center" style="font-size:10px">Ticket #${f.venta?.id || ''}</div>
<div class="center" style="font-size:10px">${new Date(f.fecha).toLocaleString('es-EC')}</div>
<div class="sep"></div>
<div>Cliente: ${clienteNombreTicket}</div>
<div class="sep"></div>
<table>
  <thead><tr><th>Cant</th><th>Descripcion</th><th>Total</th></tr></thead>
  <tbody>${lineas}</tbody>
</table>
<div class="sep"></div>
<div class="total">TOTAL: ${money(f.total)}</div>
${f.vuelto > 0 ? `<div style="text-align:right">Vuelto: ${money(f.vuelto)}</div>` : ''}
<div class="footer">Gracias por su compra!</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const v = factura.venta;
  const numFactura = `001-001-${String(v.id).padStart(9, '0')}`;

  return (
    <Modal title="Comprobante Emitido" onClose={onClose}>
      <div className="space-y-4">
        <div id="area-impresion" className="border border-ink/20 rounded-xl p-4 bg-white text-ink text-xs font-mono space-y-3 shadow-inner max-h-96 overflow-y-auto">
          <div className="text-center border-b border-dashed border-ink/20 pb-3">
            <h2 className="text-base font-black uppercase tracking-wider text-brand">VÍVERES STALIN</h2>
            <p className="text-[10px] text-ink/70">R.U.C.: 1799999999001</p>
            <p className="text-[10px] font-bold text-ink mt-1">COMPROBANTE ELECTRONICO</p>
            <p className="text-xs font-extrabold text-ink">FACTURA N.: {numFactura}</p>
            <p className="text-[10px] text-ink/50">Fecha: {new Date(factura.fecha).toLocaleString()}</p>
          </div>

          <div className="border-b border-dashed border-ink/20 pb-2 space-y-0.5 text-[11px]">
            <p><b>Cliente:</b> {factura.cliente.nombre}</p>
            <p><b>RUC / C.I.:</b> {factura.cliente.ruc}</p>
            <p><b>Correo:</b> {factura.cliente.email}</p>
          </div>

          <table className="w-full text-left text-[11px] border-b border-dashed border-ink/20 pb-2">
            <thead>
              <tr className="border-b border-ink/10 text-ink/70">
                <th className="py-1">Cant.</th>
                <th className="py-1">Descripcion</th>
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
              <p className="text-[11px] font-bold text-brand">VUELTO: {money(factura.vuelto)}</p>
            )}
          </div>

          <div className="text-center pt-3 border-t border-dashed border-ink/20 text-[10px] text-ink/60">
            <p>Gracias por su compra!</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button type="button" className="btn-s" onClick={onClose}>
            Cerrar / Nueva Venta
          </button>
          <button
            type="button"
            className="btn-p gap-2 px-6 font-bold flex items-center"
            onClick={imprimir}
          >
            <IconPrinter className="h-4 w-4" />
            <span>Imprimir Ticket</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

