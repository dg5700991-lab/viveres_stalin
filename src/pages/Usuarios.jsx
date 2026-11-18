import { useState } from 'react';
import { api, list } from '../api';
import { useAuth } from '../auth';
import { Spinner, Empty, ErrorBox, Ok, useLoad, Modal } from '../ui';
import { IconInfo, IconMail, IconSearch, IconUser } from '../icons';

const ROLES = [
  { val: 'CAJERO', label: 'Cajero (Atención y Cobro en Mostrador)', badge: 'bg-blue-100 text-blue-800' },
  { val: 'CLIENTE', label: 'Cliente (App móvil y pedidos)', badge: 'bg-amber-100 text-amber-800' },
  { val: 'ADMIN', label: 'Administrador (Control total del sistema)', badge: 'bg-purple-100 text-purple-800' },
];

export default function Usuarios() {
  const { user: usuarioActual } = useAuth();
  const [filtroRol, setFiltroRol] = useState('');
  const [busqueda, setBusqueda] = useState('');
  
  // Modales
  const [modalUsuario, setModalUsuario] = useState(null); // null | 'nuevo' | { ...usuario }
  const [notif, setNotif] = useState(null);

  // Carga de usuarios desde el backend
  const usuariosLoad = useLoad(() => api('/usuarios/').then(list), []);

  const usuariosFiltrados = (usuariosLoad.data || []).filter((u) => {
    if (filtroRol && u.rol !== filtroRol) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const matchName = (u.nombre || '').toLowerCase().includes(q);
      const matchUser = (u.username || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      if (!matchName && !matchUser && !matchEmail) return false;
    }
    return true;
  });

  const alternarEstado = async (u) => {
    if (u.id === usuarioActual?.id) {
      setNotif({ err: { message: 'Por seguridad, no puedes desactivar tu propio usuario mientras tienes la sesión iniciada.' } });
      return;
    }
    const nuevoEstado = !u.is_active;
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Estás seguro de que deseas ${accion} al usuario "${u.username}"?`)) return;

    try {
      await api(`/usuarios/${u.id}/`, {
        method: 'PATCH',
        body: { is_active: nuevoEstado },
      });
      setNotif({ ok: `Usuario ${u.username} ${nuevoEstado ? 'activado' : 'desactivado'} con éxito.` });
      usuariosLoad.reload();
    } catch (err) {
      setNotif({ err });
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-ink/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Gestión de Usuarios</h1>
          <p className="text-sm text-ink/60">
            Crea cajeros, clientes y administradores para probar y delegar funciones en el POS.
          </p>
        </div>

        <button
          className="btn-p gap-1.5"
          onClick={() => {
            setNotif(null);
            setModalUsuario('nuevo');
          }}
        >
          <span>+</span> Nuevo Usuario
        </button>
      </div>

      {/* Notificación global */}
      {notif && (
        <div>
          {notif.ok && <Ok>{notif.ok}</Ok>}
          {notif.err && <ErrorBox error={notif.err} />}
        </div>
      )}

      {/* Banner de ayuda para pruebas */}
      <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-4 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="font-bold text-brand-dark flex items-center gap-1.5">
            <IconInfo className="h-4 w-4 text-brand flex-shrink-0" />
            ¿Cómo probar la interfaz de Cajero o Cliente?
          </p>
          <p className="text-xs text-ink/70 mt-0.5">
            Crea un usuario con rol <b>Cajero</b> o <b>Cliente</b>. Luego haz clic en <i>"Cerrar sesión"</i> arriba a la derecha e inicia sesión con el usuario y contraseña creados para ver exactamente cómo lo ve ese rol.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card bg-brand-soft/30 p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <span className="absolute left-3 top-2.5 text-ink/40">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              className="inp bg-white pl-9"
              placeholder="Buscar por nombre, usuario o email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="w-48">
            <select
              className="inp bg-white"
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
            >
              <option value="">Todos los roles</option>
              <option value="CAJERO">Solo Cajeros</option>
              <option value="CLIENTE">Solo Clientes</option>
              <option value="ADMIN">Solo Administradores</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Usuarios */}
      {usuariosLoad.loading ? (
        <Spinner />
      ) : usuariosLoad.error ? (
        <ErrorBox error={usuariosLoad.error} onRetry={usuariosLoad.reload} />
      ) : usuariosFiltrados.length === 0 ? (
        <Empty>
          No hay usuarios que coincidan con la búsqueda.{' '}
          <button
            className="font-semibold text-brand underline ml-1"
            onClick={() => setModalUsuario('nuevo')}
          >
            Crear nuevo usuario
          </button>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {usuariosFiltrados.map((u) => {
            const rolInfo = ROLES.find((r) => r.val === u.rol) || { label: u.rol, badge: 'bg-gray-100 text-gray-800' };
            const esUsuarioActual = u.id === usuarioActual?.id;

            return (
              <div
                key={u.id}
                className={`card flex flex-col justify-between border transition ${
                  !u.is_active ? 'opacity-60 bg-gray-50' : 'hover:border-brand/40 shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-ink flex items-center gap-1.5">
                        {u.nombre || u.username}
                        {esUsuarioActual && (
                          <span className="rounded bg-brand text-white text-[10px] px-1.5 py-0.5 font-bold">
                            Tú
                          </span>
                        )}
                      </h3>
                      <p className="text-xs font-mono text-ink/60">@{u.username}</p>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${rolInfo.badge}`}
                    >
                      {u.rol}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-ink/70">
                    {u.email && (
                      <p className="flex items-center gap-1.5">
                        <IconMail className="h-3.5 w-3.5 text-ink/50 flex-shrink-0" />
                        {u.email}
                      </p>
                    )}
                    <p className="flex items-center gap-1">
                      <span>Estado:</span>
                      <span className={`font-semibold ${u.is_active ? 'text-emerald-700' : 'text-red-600'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </p>
                    <p className="text-[11px] text-ink/50">
                      Registrado: {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-ink/10 pt-3">
                  {!esUsuarioActual && (
                    <button
                      className={`btn py-1 px-2.5 text-xs ${
                        u.is_active
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                      }`}
                      onClick={() => alternarEstado(u)}
                    >
                      {u.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  )}

                  <button
                    className="btn-s py-1 px-3 text-xs"
                    onClick={() => {
                      setNotif(null);
                      setModalUsuario(u);
                    }}
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Usuario */}
      {modalUsuario && (
        <ModalUsuario
          usuario={modalUsuario === 'nuevo' ? null : modalUsuario}
          onClose={() => setModalUsuario(null)}
          onGuardado={(msg) => {
            setModalUsuario(null);
            setNotif({ ok: msg });
            usuariosLoad.reload();
          }}
        />
      )}
    </div>
  );
}

function ModalUsuario({ usuario, onClose, onGuardado }) {
  const isEditing = Boolean(usuario?.id);
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [username, setUsername] = useState(usuario?.username || '');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState(usuario?.rol || 'CAJERO');
  const [email, setEmail] = useState(usuario?.email || '');
  const [telefono, setTelefono] = useState('');
  const [isActive, setIsActive] = useState(usuario ? usuario.is_active : true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload = {
        nombre: nombre.trim(),
        username: username.trim(),
        rol,
        email: email.trim(),
        is_active: isActive,
      };

      if (!isEditing || password.trim()) {
        if (!isEditing && !password.trim()) {
          throw new Error('Debes ingresar una contraseña de acceso para la cuenta del nuevo usuario (mínimo 10 caracteres).');
        }
        if (password.trim() && password.trim().length < 10) {
          throw new Error('La contraseña debe tener al menos 10 caracteres para garantizar la seguridad de la cuenta.');
        }
        if (password.trim()) {
          payload.password = password.trim();
        }
      }

      if (rol === 'CLIENTE' && telefono.trim()) {
        payload.telefono = telefono.trim();
      }

      if (isEditing) {
        await api(`/usuarios/${usuario.id}/`, {
          method: 'PATCH',
          body: payload,
        });
      } else {
        await api('/usuarios/', {
          method: 'POST',
          body: payload,
        });
      }

      onGuardado(isEditing ? 'Usuario actualizado con éxito.' : 'Usuario creado exitosamente.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isEditing ? `Editar Usuario: ${usuario.username}` : 'Nuevo Usuario'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            Nombre Completo *
          </label>
          <input
            className="inp mt-1"
            placeholder="Ej: Danny Guamán, Carlos Pérez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Nombre de Usuario (Login) *
            </label>
            <input
              className="inp mt-1 font-mono"
              placeholder="cajero1, danny99"
              value={username}
              disabled={isEditing}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            {isEditing && (
              <span className="text-[10px] text-ink/40">El usuario no se puede cambiar.</span>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Rol del Usuario *
            </label>
            <select
              className="inp mt-1 font-semibold"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
            >
              <option value="CAJERO">Cajero (Caja & POS)</option>
              <option value="CLIENTE">Cliente (App y Pedidos)</option>
              <option value="ADMIN">Administrador (Total)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            {isEditing ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'}
          </label>
          <input
            type="password"
            className="inp mt-1 font-mono"
            placeholder={isEditing ? '••••••••' : 'Mínimo 6 caracteres'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEditing}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
              Correo Electrónico (Opcional)
            </label>
            <input
              type="email"
              className="inp mt-1"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {rol === 'CLIENTE' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Teléfono Celular
              </label>
              <input
                className="inp mt-1"
                placeholder="0991234567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
          )}
        </div>

        {isEditing && (
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm pt-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-brand focus:ring-brand h-4 w-4"
            />
            <span className="font-semibold text-ink">Usuario Activo (Permitir acceso)</span>
          </label>
        )}

        <ErrorBox error={error} />

        <div className="flex justify-end gap-2 pt-3 border-t border-ink/10">
          <button type="button" className="btn-s" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn-p min-w-[130px]" disabled={busy}>
            {busy ? 'Guardando…' : isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
