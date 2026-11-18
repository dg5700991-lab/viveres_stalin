import { useState, useMemo, useRef } from 'react';
import { api, list, money } from '../api';
import { useAuth } from '../auth';
import { Spinner, Empty, ErrorBox, Ok, useLoad, Modal } from '../ui';
import {
  IconSearch,
  IconClose,
  IconTag,
  IconScale,
  IconPackage,
  IconCamera,
  IconGrid,
  IconList,
  IconCheck,
} from '../icons';

const UNIDADES = [
  { val: 'UND', label: 'Unidad (unit / und)' },
  { val: 'LB', label: 'Libra (lb)' },
  { val: 'KG', label: 'Kilo (kg)' },
  { val: 'L', label: 'Litro (L)' },
  { val: 'DOC', label: 'Docena (doc)' },
];

export function formatStock(stock, unidad) {
  const n = Number(stock || 0);
  const u = (unidad || 'UND').toUpperCase();
  if (u === 'UND') return `${n} ${n === 1 ? 'unit' : 'units'}`;
  if (u === 'KG') return `${n} kg`;
  if (u === 'LB') return `${n} lb`;
  if (u === 'L') return `${n} L`;
  if (u === 'DOC') return `${n} doc`;
  return `${n} ${unidad}`;
}

export default function Productos() {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';

  // Tabs de la vista
  const [tab, setTab] = useState('productos'); // 'productos' | 'categorias' | 'movimientos'
  const [modoVista, setModoVista] = useState('tarjetas'); // 'tarjetas' | 'tabla'

  // Filtros de productos
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos'); // 'todos' | 'activos' | 'inactivos'
  const [bajo, setBajo] = useState(false);

  // Modales
  const [modalProd, setModalProd] = useState(null); // null | 'nuevo' | { ...producto }
  const [modalCat, setModalCat] = useState(null); // null | 'nueva' | { ...categoria }
  const [modalStock, setModalStock] = useState(null); // null | { producto }

  // Mensajes globales
  const [notif, setNotif] = useState(null);
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState(null);

  // Carga de datos: para ADMIN siempre incluimos inactivos para poder gestionarlos
  const qs = new URLSearchParams({
    ...(q.trim() && { q: q.trim() }),
    ...(tipo && { tipo }),
    ...(bajo && { stock_bajo: '1' }),
    ...(isAdmin && { incluir_inactivos: '1' }),
  }).toString();

  const prods = useLoad(() => api(`/productos/?${qs}`).then(list), [qs]);
  const cats = useLoad(() => api('/categorias/').then(list), []);
  const movs = useLoad(
    () => (isAdmin && tab === 'movimientos' ? api('/inventario/movimientos/').then(list) : Promise.resolve([])),
    [isAdmin, tab]
  );

  // Filtrado local por categoría y por estado
  const productosFiltrados = useMemo(() => {
    if (!prods.data) return [];
    return prods.data.filter((p) => {
      if (catFiltro && String(p.categoria) !== String(catFiltro)) return false;
      if (estadoFiltro === 'activos' && !p.activo) return false;
      if (estadoFiltro === 'inactivos' && p.activo) return false;
      return true;
    });
  }, [prods.data, catFiltro, estadoFiltro]);

  const recargarTodo = () => {
    prods.reload();
    cats.reload();
    if (isAdmin && tab === 'movimientos') movs.reload();
  };

  // Alternar estado activo/inactivo directamente
  const alternarEstado = async (p) => {
    const nuevoEstado = !p.activo;
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Estás seguro de que deseas ${accion} el producto "${p.nombre}"?`)) {
      return;
    }

    setCambiandoEstadoId(p.id);
    setNotif(null);
    try {
      await api(`/productos/${p.id}/`, {
        method: 'PATCH',
        body: { activo: nuevoEstado },
      });
      setNotif({
        ok: `Producto "${p.nombre}" ${nuevoEstado ? 'activado' : 'desactivado'} con éxito.`,
      });
      prods.reload();
    } catch (err) {
      setNotif({ err });
    } finally {
      setCambiandoEstadoId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado y Barra de Acciones */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-ink/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Catálogo e Inventario</h1>
          <p className="text-sm text-ink/60">Gestiona productos en tarjetas, imágenes, categorías y existencias en tiempo real.</p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-p gap-1.5"
              onClick={() => {
                setNotif(null);
                setModalProd('nuevo');
              }}
            >
              <span>+</span> Nuevo Producto
            </button>
            <button
              className="btn-s gap-1.5"
              onClick={() => {
                setNotif(null);
                setModalCat('nueva');
              }}
            >
              <span>+</span> Nueva Categoría
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-ink/10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('productos')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${tab === 'productos'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink/60 hover:text-ink'
              }`}
          >
            Productos {prods.data && `(${prods.data.length})`}
          </button>
          <button
            onClick={() => setTab('categorias')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${tab === 'categorias'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink/60 hover:text-ink'
              }`}
          >
            Categorías {cats.data && `(${cats.data.length})`}
          </button>
          {isAdmin && (
            <button
              onClick={() => setTab('movimientos')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${tab === 'movimientos'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink/60 hover:text-ink'
                }`}
            >
              Historial de Movimientos
            </button>
          )}
        </div>

        {tab === 'productos' && (
          <div className="flex items-center gap-1 pb-1">
            <button
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${modoVista === 'tarjetas'
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white text-ink/70 hover:bg-brand-soft border border-ink/10'
                }`}
              onClick={() => setModoVista('tarjetas')}
              title="Ver como tarjetas"
            >
              <IconGrid className="h-3.5 w-3.5" />
              <span>Tarjetas</span>
            </button>
            <button
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${modoVista === 'tabla'
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white text-ink/70 hover:bg-brand-soft border border-ink/10'
                }`}
              onClick={() => setModoVista('tabla')}
              title="Ver como tabla"
            >
              <IconList className="h-3.5 w-3.5" />
              <span>Tabla</span>
            </button>
          </div>
        )}
      </div>

      {/* Notificación global */}
      {notif && (
        <div>
          {notif.ok && <Ok>{notif.ok}</Ok>}
          {notif.err && <ErrorBox error={notif.err} />}
        </div>
      )}

      {/* ===================== TAB PRODUCTOS ===================== */}
      {tab === 'productos' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="card bg-brand-soft/30 p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <span className="absolute left-3 top-2.5 text-ink/40">
                  <IconSearch className="h-4 w-4" />
                </span>
                <input
                  className="inp bg-white pl-9"
                  placeholder="Buscar por nombre o código de barras..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="w-44">
                <select
                  className="inp bg-white"
                  value={catFiltro}
                  onChange={(e) => setCatFiltro(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {(cats.data || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-36">
                <select
                  className="inp bg-white"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  <option value="">Todos los tipos</option>
                  <option value="CODIGO">Con código</option>
                  <option value="GRANEL">A granel</option>
                </select>
              </div>

              {isAdmin && (
                <div className="w-36">
                  <select
                    className="inp bg-white"
                    value={estadoFiltro}
                    onChange={(e) => setEstadoFiltro(e.target.value)}
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="activos">Solo activos</option>
                    <option value="inactivos">Solo inactivos</option>
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-brand focus:ring-brand"
                  checked={bajo}
                  onChange={(e) => setBajo(e.target.checked)}
                />
                <span className="font-medium text-ink">Solo stock bajo</span>
              </label>
            </div>
          </div>

          {/* Listado de Productos */}
          {prods.loading ? (
            <Spinner />
          ) : prods.error ? (
            <ErrorBox error={prods.error} onRetry={prods.reload} />
          ) : productosFiltrados.length === 0 ? (
            <Empty>
              No se encontraron productos con los filtros seleccionados.{' '}
              {isAdmin && (
                <button
                  className="ml-2 font-semibold text-brand underline"
                  onClick={() => setModalProd('nuevo')}
                >
                  Agregar primer producto
                </button>
              )}
            </Empty>
          ) : modoVista === 'tarjetas' ? (
            /* ================= VISTA EN TARJETAS (CARDS) ================= */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productosFiltrados.map((p) => {
                const isBajo = p.stock_bajo;
                const estaCambiando = cambiandoEstadoId === p.id;
                const stockTexto = formatStock(p.stock_actual, p.unidad_medida);

                return (
                  <div
                    key={p.id}
                    className={`card p-4 flex flex-col justify-between border transition shadow-sm hover:shadow-md ${!p.activo ? 'bg-gray-50/90 border-gray-200 opacity-70' : 'hover:border-brand/40 bg-white'
                      }`}
                  >
                    <div>
                      {/* Imagen con badges superpuestos */}
                      <div className="relative mb-3 h-36 w-full rounded-xl overflow-hidden bg-brand-soft/40 border border-ink/10 flex items-center justify-center">
                        {p.imagen_url ? (
                          <img
                            src={p.imagen_url}
                            alt={p.nombre}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex items-center justify-center text-ink/30">
                            {p.tipo === 'CODIGO' ? (
                              <IconTag className="h-10 w-10" />
                            ) : (
                              <IconScale className="h-10 w-10" />
                            )}
                          </span>
                        )}

                        {/* Badge de Stock en la esquina superior izquierda */}
                        <div className="absolute top-2 left-2">
                          <span
                            className={`rounded-lg px-2 py-1 text-xs font-bold shadow-sm backdrop-blur-md flex items-center gap-1.5 ${isBajo
                                ? 'bg-red-600 text-white'
                                : 'bg-ink/80 text-white'
                              }`}
                          >
                            <IconPackage className="h-3.5 w-3.5" />
                            <span>{stockTexto}</span>
                          </span>
                        </div>

                        {/* Badge de Estado en la esquina superior derecha */}
                        <div className="absolute top-2 right-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${p.activo
                                ? 'bg-brand text-white'
                                : 'bg-gray-400 text-white'
                              }`}
                          >
                            {p.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                      </div>

                      {/* Información del Producto */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-bold text-ink text-base leading-tight line-clamp-2">
                            {p.nombre}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-ink/60">
                          <span className="font-mono">{p.codigo_barras || 'A granel'}</span>
                          <span>·</span>
                          {p.categoria_nombre ? (
                            <span className="text-brand-dark font-medium">{p.categoria_nombre}</span>
                          ) : (
                            <span className="italic text-ink/40">Sin categoría</span>
                          )}
                        </div>

                        {/* Precios */}
                        <div className="mt-2 pt-2 border-t border-ink/10 flex items-baseline justify-between">
                          <div>
                            <span className="text-[11px] text-ink/60 block">Precio Venta</span>
                            <span className="text-lg font-extrabold text-brand">
                              {money(p.precio_venta)}
                              <span className="text-xs font-normal text-ink/50">/{p.unidad_medida}</span>
                            </span>
                          </div>

                          {isAdmin && p.costo !== undefined && (
                            <div className="text-right">
                              <span className="text-[11px] text-ink/60 block">Costo</span>
                              <span className="text-xs font-semibold text-ink/70">{money(p.costo)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Barra de Acciones para Admin y Cajero */}
                    <div className="mt-4 pt-3 border-t border-ink/10 flex items-center justify-between gap-1.5">
                      {isAdmin ? (
                        <button
                          className={`btn py-1 px-2.5 text-xs transition ${p.activo
                              ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                              : 'bg-brand-soft text-brand-dark border border-brand/30 hover:bg-brand-soft/80'
                            }`}
                          title={p.activo ? 'Desactivar producto' : 'Activar producto'}
                          disabled={estaCambiando}
                          onClick={() => alternarEstado(p)}
                        >
                          {estaCambiando ? '…' : p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-ink/40 tracking-wider">
                          Inventario
                        </span>
                      )}

                      <div className="flex items-center gap-1.5">
                        <button
                          className="btn-p py-1 px-3 text-xs font-bold"
                          title="Ingresar o reponer stock del producto"
                          onClick={() => setModalStock(p)}
                        >
                          + Reponer Stock
                        </button>
                        {isAdmin && (
                          <button
                            className="btn-s py-1 px-2.5 text-xs"
                            title="Editar producto e imagen"
                            onClick={() => setModalProd(p)}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================= VISTA EN TABLA ================= */
            <div className="card overflow-x-auto p-0 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-soft/70 text-ink/80 border-b border-ink/10 font-semibold">
                  <tr>
                    <th className="p-3">Foto</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Precio Venta</th>
                    {isAdmin && <th className="p-3">Costo</th>}
                    <th className="p-3">Stock Actual</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {productosFiltrados.map((p) => {
                    const isBajo = p.stock_bajo;
                    const estaCambiando = cambiandoEstadoId === p.id;
                    const stockTexto = formatStock(p.stock_actual, p.unidad_medida);

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-brand-soft/20 transition ${!p.activo ? 'bg-gray-50/80 text-ink/60' : ''
                          }`}
                      >
                        <td className="p-3 w-14">
                          {p.imagen_url ? (
                            <img
                              src={p.imagen_url}
                              alt={p.nombre}
                              className="h-11 w-11 rounded-lg object-cover border border-ink/10 shadow-sm cursor-pointer hover:scale-105 transition"
                              onClick={() => isAdmin && setModalProd(p)}
                              title="Haz clic para editar"
                            />
                          ) : (
                            <div
                              className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft text-brand font-bold text-sm border border-brand/10 cursor-pointer"
                              onClick={() => isAdmin && setModalProd(p)}
                            >
                              {p.tipo === 'CODIGO' ? (
                                <IconTag className="h-4 w-4" />
                              ) : (
                                <IconScale className="h-4 w-4" />
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-3">
                          <p className="font-semibold text-ink flex items-center gap-1.5">
                            {p.nombre}
                            {!p.activo && (
                              <span className="rounded bg-gray-200 px-1.5 py-0.2 text-[10px] font-bold text-gray-700">
                                Inactivo
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-ink/60 mt-0.5">
                            <span>{p.codigo_barras || 'A granel'}</span>
                            <span>·</span>
                            <span className="uppercase font-mono">{p.unidad_medida}</span>
                          </div>
                        </td>

                        <td className="p-3 text-ink/80">
                          {p.categoria_nombre ? (
                            <span className="rounded-full bg-brand-soft/80 px-2.5 py-0.5 text-xs font-medium text-brand-dark">
                              {p.categoria_nombre}
                            </span>
                          ) : (
                            <span className="text-xs text-ink/40">Sin categoría</span>
                          )}
                        </td>

                        <td className="p-3 font-semibold text-ink">
                          {money(p.precio_venta)}
                          <span className="text-xs font-normal text-ink/50">/{p.unidad_medida}</span>
                        </td>

                        {isAdmin && (
                          <td className="p-3 text-ink/70">
                            {p.costo !== undefined ? money(p.costo) : '—'}
                          </td>
                        )}

                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-semibold ${isBajo ? 'text-red-600' : 'text-ink'
                                }`}
                            >
                              {stockTexto}
                            </span>
                            {isBajo && (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                                Bajo (mín: {p.stock_minimo})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.activo
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-200 text-gray-700'
                              }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${p.activo ? 'bg-emerald-600' : 'bg-gray-500'
                                }`}
                            />
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAdmin && (
                              <button
                                className={`btn py-1 px-2.5 text-xs transition ${p.activo
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                    : 'bg-brand-soft text-brand-dark border border-brand/30 hover:bg-brand-soft/80'
                                  }`}
                                disabled={estaCambiando}
                                onClick={() => alternarEstado(p)}
                              >
                                {estaCambiando ? '…' : p.activo ? 'Desactivar' : 'Activar'}
                              </button>
                            )}

                            <button
                              className="btn-p py-1 px-2.5 text-xs font-bold"
                              title="Ingresar o reponer stock"
                              onClick={() => setModalStock(p)}
                            >
                              Stock
                            </button>

                            {isAdmin && (
                              <button
                                className="btn-s py-1 px-2.5 text-xs"
                                onClick={() => setModalProd(p)}
                              >
                                Editar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB CATEGORÍAS ===================== */}
      {tab === 'categorias' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Listado de Categorías</h2>
            {isAdmin && (
              <button className="btn-p text-xs py-1.5" onClick={() => setModalCat('nueva')}>
                + Nueva Categoría
              </button>
            )}
          </div>

          {cats.loading ? (
            <Spinner />
          ) : cats.error ? (
            <ErrorBox error={cats.error} onRetry={cats.reload} />
          ) : cats.data.length === 0 ? (
            <Empty>
              Todavía no se han creado categorías.{' '}
              {isAdmin && (
                <button
                  className="font-semibold text-brand underline ml-1"
                  onClick={() => setModalCat('nueva')}
                >
                  Crear la primera categoría
                </button>
              )}
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cats.data.map((c) => (
                <div
                  key={c.id}
                  className={`card flex flex-col justify-between border transition ${!c.activo ? 'opacity-60 bg-gray-50' : 'hover:border-brand/40 shadow-sm'
                    }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-ink">{c.nombre}</h3>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                          }`}
                      >
                        {c.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink/60 line-clamp-2">
                      {c.descripcion || <span className="italic text-ink/40">Sin descripción</span>}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-ink/10 pt-3">
                      <button
                        className="btn-s py-1 px-3 text-xs"
                        onClick={() => setModalCat(c)}
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB MOVIMIENTOS ===================== */}
      {isAdmin && tab === 'movimientos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Historial de Movimientos de Inventario</h2>
            <button className="btn-s text-xs py-1" onClick={movs.reload}>
              Refrescar
            </button>
          </div>

          {movs.loading ? (
            <Spinner />
          ) : movs.error ? (
            <ErrorBox error={movs.error} onRetry={movs.reload} />
          ) : movs.data.length === 0 ? (
            <Empty>No hay movimientos de inventario registrados.</Empty>
          ) : (
            <div className="card overflow-x-auto p-0 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-soft/70 text-ink/80 border-b border-ink/10 font-semibold">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Cantidad</th>
                    <th className="p-3">Stock Resultante</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {movs.data.map((m) => {
                    const cant = Number(m.cantidad);
                    const esPositivo = cant > 0;
                    return (
                      <tr key={m.id} className="hover:bg-brand-soft/20">
                        <td className="p-3 text-xs text-ink/60 whitespace-nowrap">
                          {m.creado_en ? new Date(m.creado_en).toLocaleString() : '—'}
                        </td>
                        <td className="p-3 font-semibold text-ink">{m.producto_nombre}</td>
                        <td className="p-3">
                          <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-medium">
                            {m.tipo}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-bold ${esPositivo ? 'text-emerald-700' : 'text-red-600'
                              }`}
                          >
                            {esPositivo ? `+${cant}` : cant}
                          </span>
                        </td>
                        <td className="p-3 font-medium">{Number(m.stock_resultante)}</td>
                        <td className="p-3 text-ink/70 text-xs">{m.motivo || '—'}</td>
                        <td className="p-3 text-ink/60 text-xs">{m.usuario_nombre || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================== MODAL PRODUCTO (CREAR / EDITAR) ===================== */}
      {modalProd && (
        <ModalProducto
          producto={modalProd === 'nuevo' ? null : modalProd}
          categorias={cats.data || []}
          onClose={() => setModalProd(null)}
          onGuardado={(msg) => {
            setModalProd(null);
            setNotif({ ok: msg });
            recargarTodo();
          }}
        />
      )}

      {/* ===================== MODAL CATEGORÍA (CREAR / EDITAR) ===================== */}
      {modalCat && (
        <ModalCategoria
          categoria={modalCat === 'nueva' ? null : modalCat}
          onClose={() => setModalCat(null)}
          onGuardado={(msg) => {
            setModalCat(null);
            setNotif({ ok: msg });
            recargarTodo();
          }}
        />
      )}

      {/* ===================== MODAL STOCK (ENTRADA / AJUSTE) ===================== */}
      {modalStock && (
        <ModalStock
          producto={modalStock}
          onClose={() => setModalStock(null)}
          onGuardado={(msg) => {
            setModalStock(null);
            setNotif({ ok: msg });
            recargarTodo();
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MODAL: CREAR / EDITAR PRODUCTO (CON EDICIÓN DE ESTADO E IMAGEN)
// -------------------------------------------------------------
function ModalProducto({ producto, categorias, onClose, onGuardado }) {
  const isEditing = Boolean(producto?.id);

  const [nombre, setNombre] = useState(producto?.nombre || '');
  const [categoria, setCategoria] = useState(producto?.categoria || '');
  const [tipo, setTipo] = useState(producto?.tipo || 'CODIGO');
  const [codigoBarras, setCodigoBarras] = useState(producto?.codigo_barras || '');
  const [unidad, setUnidad] = useState(producto?.unidad_medida || 'UND');
  const [precioVenta, setPrecioVenta] = useState(producto?.precio_venta ?? '');
  const [costo, setCosto] = useState(producto?.costo ?? 0);
  const [stockMinimo, setStockMinimo] = useState(producto?.stock_minimo ?? 0);
  const [stockInicial, setStockInicial] = useState('');

  // Estado activo / inactivo
  const [activo, setActivo] = useState(producto ? Boolean(producto.activo) : true);

  // Gestión de imágenes
  const [imagenActual, setImagenActual] = useState(producto?.imagen_url || null);
  const [imagenFile, setImagenFile] = useState(null);
  const [previewNueva, setPreviewNueva] = useState(null);
  const fileInputRef = useRef();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSeleccionarArchivo = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagenFile(file);
      const url = URL.createObjectURL(file);
      setPreviewNueva(url);
    }
  };

  const descartarNuevaImagen = () => {
    setImagenFile(null);
    if (previewNueva) URL.revokeObjectURL(previewNueva);
    setPreviewNueva(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload = {
        nombre: nombre.trim(),
        categoria: categoria || null,
        unidad_medida: unidad,
        precio_venta: Number(precioVenta),
        costo: Number(costo || 0),
        stock_minimo: Number(stockMinimo || 0),
        activo: Boolean(activo),
      };

      if (!isEditing) {
        payload.tipo = tipo;
      }

      if (tipo === 'CODIGO') {
        const cod = codigoBarras.trim();
        if (!cod) throw new Error('Debes ingresar o escanear el código de barras del producto. Si no tiene código, selecciona el tipo "Por peso / Granel".');
        payload.codigo_barras = cod;
      } else {
        payload.codigo_barras = null;
      }

      let bodyData;
      if (imagenFile) {
        bodyData = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) {
            bodyData.append(k, typeof v === 'boolean' ? (v ? 'true' : 'false') : v);
          }
        });
        bodyData.append('imagen', imagenFile);
      } else {
        bodyData = payload;
      }

      let res;
      if (isEditing) {
        res = await api(`/productos/${producto.id}/`, {
          method: 'PATCH',
          body: bodyData,
        });
      } else {
        res = await api('/productos/', {
          method: 'POST',
          body: bodyData,
        });

        // Registrar entrada de inventario si se especificó stock inicial
        const cantIni = Number(stockInicial);
        if (cantIni > 0 && res?.id) {
          try {
            await api('/inventario/entradas/', {
              method: 'POST',
              body: {
                producto: res.id,
                cantidad: cantIni,
                costo_unitario: Number(costo || 0) || undefined,
                motivo: 'Stock inicial al registrar producto',
              },
            });
          } catch (eStock) {
            console.error('Error al registrar stock inicial:', eStock);
          }
        }
      }

      onGuardado(isEditing ? 'Producto actualizado correctamente.' : 'Producto creado exitosamente.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isEditing ? `Editar Producto: ${producto.nombre}` : 'Nuevo Producto'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Interruptor de Estado Activo / Inactivo */}
        <div className="rounded-xl border border-ink/15 bg-brand-soft/20 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-ink">Estado del Producto</p>
            <p className="text-xs text-ink/60">
              {activo
                ? 'El producto está activo: visible en caja (POS) y catálogo.'
                : 'El producto está inactivo: oculto en ventas y catálogo.'}
            </p>
          </div>
          <button
            type="button"
            className={`btn py-1.5 px-4 text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${activo
                ? 'bg-brand text-white hover:bg-brand-dark'
                : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
              }`}
            onClick={() => setActivo(!activo)}
          >
            {activo ? (
              <>
                <IconCheck className="h-3.5 w-3.5" />
                <span>ACTIVO</span>
              </>
            ) : (
              <>
                <IconClose className="h-3.5 w-3.5" />
                <span>INACTIVO</span>
              </>
            )}
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            Nombre del Producto *
          </label>
          <input
            className="inp mt-1"
            placeholder="Ej: Arroz Flor 1kg, Leche Entera, etc."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Categoría
            </label>
            <select
              className="inp mt-1"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">(Sin categoría)</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Tipo de Producto
            </label>
            <select
              className="inp mt-1"
              value={tipo}
              disabled={isEditing}
              onChange={(e) => {
                setTipo(e.target.value);
                if (e.target.value === 'GRANEL') setCodigoBarras('');
              }}
            >
              <option value="CODIGO">Con código de barras</option>
              <option value="GRANEL">A granel / sin código</option>
            </select>
            {isEditing && (
              <span className="text-[10px] text-ink/40">El tipo no se puede modificar una vez creado.</span>
            )}
          </div>
        </div>

        {tipo === 'CODIGO' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Código de Barras *
            </label>
            <div className="mt-1 flex gap-2">
              <input
                className="inp font-mono"
                placeholder="Escanea o escribe el código (4-32 caracteres)"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Unidad de Medida
            </label>
            <select
              className="inp mt-1 font-medium"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
            >
              {UNIDADES.map((u) => (
                <option key={u.val} value={u.val}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Precio Venta *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="inp mt-1 font-semibold"
              placeholder="0.00"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Costo (Compra)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="inp mt-1"
              placeholder="0.00"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Stock Mínimo (Alerta)
            </label>
            <input
              type="number"
              step={tipo === 'GRANEL' ? '0.001' : '1'}
              min="0"
              className="inp mt-1"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
            />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Stock Inicial (Opcional)
              </label>
              <input
                type="number"
                step={tipo === 'GRANEL' ? '0.001' : '1'}
                min="0"
                className="inp mt-1"
                placeholder="0"
                value={stockInicial}
                onChange={(e) => setStockInicial(e.target.value)}
              />
              <span className="text-[11px] text-ink/50">
                Registra la primera entrada en inventario.
              </span>
            </div>
          )}
        </div>

        {/* Gestión de Imagen */}
        <div className="rounded-xl border border-ink/15 p-3.5 space-y-3 bg-white">
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            Imagen del Producto
          </label>

          <div className="flex items-center gap-4">
            {previewNueva ? (
              <div className="relative">
                <img
                  src={previewNueva}
                  alt="Nueva vista previa"
                  className="h-16 w-16 rounded-xl object-cover border-2 border-brand shadow-sm"
                />
                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-brand text-white text-[9px] px-1 font-bold">
                  Nueva
                </span>
              </div>
            ) : imagenActual ? (
              <div className="relative">
                <img
                  src={imagenActual}
                  alt="Imagen actual"
                  className="h-16 w-16 rounded-xl object-cover border border-ink/15 shadow-sm"
                />
                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-ink/70 text-white text-[9px] px-1 font-bold">
                  Actual
                </span>
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-soft/60 text-ink/40 border border-dashed border-ink/20">
                <IconCamera className="h-6 w-6" />
              </div>
            )}

            <div className="flex-1 space-y-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="block w-full text-xs text-ink/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-soft file:text-brand-dark file:font-semibold hover:file:bg-brand-soft/80 cursor-pointer"
                onChange={handleSeleccionarArchivo}
              />
              {previewNueva && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline flex items-center gap-1 font-medium"
                  onClick={descartarNuevaImagen}
                >
                  <IconClose className="h-3 w-3" />
                  <span>Descartar nueva foto seleccionada</span>
                </button>
              )}
              <p className="text-[11px] text-ink/50">
                Formatos JPG, PNG, WEBP. Se optimizará y convertirá automáticamente.
              </p>
            </div>
          </div>
        </div>

        <ErrorBox error={error} />

        <div className="flex justify-end gap-2 pt-3 border-t border-ink/10">
          <button type="button" className="btn-s" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn-p min-w-[130px]" disabled={busy}>
            {busy ? 'Guardando…' : isEditing ? 'Guardar Cambios' : 'Crear Producto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -------------------------------------------------------------
// MODAL: CREAR / EDITAR CATEGORÍA
// -------------------------------------------------------------
function ModalCategoria({ categoria, onClose, onGuardado }) {
  const isEditing = Boolean(categoria?.id);
  const [nombre, setNombre] = useState(categoria?.nombre || '');
  const [descripcion, setDescripcion] = useState(categoria?.descripcion || '');
  const [activo, setActivo] = useState(categoria ? Boolean(categoria.activo) : true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        activo: Boolean(activo),
      };

      if (isEditing) {
        await api(`/categorias/${categoria.id}/`, {
          method: 'PATCH',
          body: payload,
        });
      } else {
        await api('/categorias/', {
          method: 'POST',
          body: payload,
        });
      }

      onGuardado(isEditing ? 'Categoría actualizada.' : 'Categoría creada con éxito.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleEliminar = async () => {
    if (!window.confirm(`¿Seguro que deseas eliminar la categoría "${categoria.nombre}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/categorias/${categoria.id}/`, { method: 'DELETE' });
      onGuardado('Categoría eliminada.');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isEditing ? `Editar Categoría: ${categoria.nombre}` : 'Nueva Categoría'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Interruptor de Estado Activo / Inactivo */}
        <div className="rounded-xl border border-ink/15 bg-brand-soft/20 p-3.5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-ink">Estado de la Categoría</p>
            <p className="text-xs text-ink/60">
              {activo ? 'Categoría visible y seleccionable' : 'Categoría inactiva (deshabilitada)'}
            </p>
          </div>
          <button
            type="button"
            className={`btn py-1 px-3 text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${activo
                ? 'bg-brand text-white hover:bg-brand-dark'
                : 'bg-gray-300 text-gray-800 hover:bg-gray-400'
              }`}
            onClick={() => setActivo(!activo)}
          >
            {activo ? (
              <>
                <IconCheck className="h-3.5 w-3.5" />
                <span>ACTIVA</span>
              </>
            ) : (
              <>
                <IconClose className="h-3.5 w-3.5" />
                <span>INACTIVA</span>
              </>
            )}
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            Nombre de la Categoría *
          </label>
          <input
            className="inp mt-1"
            placeholder="Ej: Lácteos, Bebidas, Aseo..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            Descripción (Opcional)
          </label>
          <textarea
            rows="3"
            className="inp mt-1"
            placeholder="Breve descripción o notas sobre la categoría"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <ErrorBox error={error} />

        <div className="flex items-center justify-between pt-3 border-t border-ink/10">
          {isEditing ? (
            <button
              type="button"
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
              onClick={handleEliminar}
              disabled={busy}
            >
              Eliminar categoría
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button type="button" className="btn-s" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn-p" disabled={busy}>
              {busy ? 'Guardando…' : isEditing ? 'Guardar Cambios' : 'Crear'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// -------------------------------------------------------------
// MODAL: ENTRADA / AJUSTE DE STOCK
// -------------------------------------------------------------
function ModalStock({ producto, onClose, onGuardado }) {
  const [subTab, setSubTab] = useState('entrada'); // 'entrada' | 'ajuste'
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState(producto?.costo || '');
  const [stockReal, setStockReal] = useState(Number(producto?.stock_actual || 0));
  const [motivo, setMotivo] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleEntrada = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cant = Number(cantidad);
      if (cant <= 0) throw new Error('Indica una cantidad válida mayor a 0 para el ingreso de mercadería.');

      await api('/inventario/entradas/', {
        method: 'POST',
        body: {
          producto: producto.id,
          cantidad: cant,
          costo_unitario: costoUnitario !== '' ? Number(costoUnitario) : undefined,
          motivo: motivo.trim() || 'Compra / reposición',
        },
      });
      onGuardado(`Se agregaron ${formatStock(cant, producto.unidad_medida)} al stock de ${producto.nombre}.`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleAjuste = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const real = Number(stockReal);
      if (real < 0) throw new Error('La cantidad de existencias no puede ser menor a cero.');
      if (!motivo.trim()) throw new Error('Escribe una breve justificación del conteo (por ejemplo: "Conteo mensual de existencias" o "Diferencia por merma").');

      await api('/inventario/ajustes/', {
        method: 'POST',
        body: {
          producto: producto.id,
          stock_real: real,
          motivo: motivo.trim(),
        },
      });
      onGuardado(`Stock de ${producto.nombre} ajustado a ${formatStock(real, producto.unidad_medida)}.`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Gestionar Inventario: ${producto.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Resumen del producto */}
        <div className="rounded-xl bg-brand-soft/40 p-3 text-sm flex items-center justify-between">
          <div>
            <p className="font-semibold text-ink">{producto.nombre}</p>
            <p className="text-xs text-ink/60">
              Unidad: {producto.unidad_medida} · Código: {producto.codigo_barras || 'A granel'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-ink/60">Stock actual:</span>
            <p className="text-lg font-bold text-ink">
              {formatStock(producto.stock_actual, producto.unidad_medida)}
            </p>
          </div>
        </div>

        {/* Tabs internas del modal */}
        <div className="grid grid-cols-2 gap-2 border-b border-ink/10 pb-2">
          <button
            type="button"
            className={`py-2 text-xs font-bold rounded-lg transition ${subTab === 'entrada'
                ? 'bg-brand text-white'
                : 'bg-brand-soft/60 text-ink/70 hover:bg-brand-soft'
              }`}
            onClick={() => {
              setSubTab('entrada');
              setError(null);
            }}
          >
            + Entrada / Reposición
          </button>
          <button
            type="button"
            className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${subTab === 'ajuste'
                ? 'bg-brand text-white'
                : 'bg-brand-soft/60 text-ink/70 hover:bg-brand-soft'
              }`}
            onClick={() => {
              setSubTab('ajuste');
              setError(null);
            }}
          >
            <IconScale className="h-3.5 w-3.5" />
            <span>Ajuste por Conteo</span>
          </button>
        </div>

        {/* FORM ENTRADA */}
        {subTab === 'entrada' && (
          <form onSubmit={handleEntrada} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Cantidad a Ingresar *
              </label>
              <input
                type="number"
                step={producto.tipo === 'GRANEL' ? '0.001' : '1'}
                min={producto.tipo === 'GRANEL' ? '0.001' : '1'}
                className="inp mt-1 text-lg font-bold"
                placeholder={producto.tipo === 'GRANEL' ? 'Ej: 1.500' : 'Ej: 10'}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Costo Unitario de esta compra (Opcional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="inp mt-1"
                placeholder="0.00"
                value={costoUnitario}
                onChange={(e) => setCostoUnitario(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Motivo / Proveedor
              </label>
              <input
                className="inp mt-1"
                placeholder="Ej: Factura #1234 / Compra distribuidora"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <ErrorBox error={error} />

            <div className="flex justify-end gap-2 pt-2 border-t border-ink/10">
              <button type="button" className="btn-s" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="btn-p" disabled={busy}>
                {busy ? 'Registrando…' : 'Registrar Entrada'}
              </button>
            </div>
          </form>
        )}

        {/* FORM AJUSTE */}
        {subTab === 'ajuste' && (
          <form onSubmit={handleAjuste} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Stock Real en Físico *
              </label>
              <input
                type="number"
                step={producto.tipo === 'GRANEL' ? '0.001' : '1'}
                min="0"
                className="inp mt-1 text-lg font-bold"
                value={stockReal}
                onChange={(e) => setStockReal(e.target.value)}
                required
                autoFocus
              />
              <span className="text-[11px] text-ink/50">
                Diferencia con el sistema:{' '}
                <b>
                  {(Number(stockReal) - Number(producto.stock_actual)).toFixed(3)}{' '}
                  {producto.unidad_medida}
                </b>
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Motivo de la corrección *
              </label>
              <input
                className="inp mt-1"
                placeholder="Ej: Conteo físico semanal, producto dañado, etc."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
              />
            </div>

            <ErrorBox error={error} />

            <div className="flex justify-end gap-2 pt-2 border-t border-ink/10">
              <button type="button" className="btn-s" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="btn-p" disabled={busy}>
                {busy ? 'Guardando…' : 'Aplicar Ajuste'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
