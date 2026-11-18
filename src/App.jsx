import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import Login from './pages/Login';
import POS from './pages/POS';
import Productos from './pages/Productos';
import Caja from './pages/Caja';
import Fiados from './pages/Fiados';
import Pedidos from './pages/Pedidos';
import Usuarios from './pages/Usuarios';
import ClientePanel from './pages/ClientePanel';
import { IconUser, IconMenu, IconClose } from './icons';

const baseTabs = [
  ['/', 'Cobrar'],
  ['/productos', 'Productos'],
  ['/caja', 'Caja'],
  ['/fiados', 'Fiados'],
  ['/pedidos', 'Pedidos'],
];

// ─── Sonido de alarma sintetizado con Web Audio API ─────────────────────────
function beepAlarma(ctx) {
  if (!ctx) return;
  // Tres pitidos cortos tipo "ding-dong" de caja
  [0, 0.25, 0.5].forEach((t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime + t);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + t + 0.15);
    gain.gain.setValueAtTime(0.6, ctx.currentTime + t);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
    osc.start(ctx.currentTime + t);
    osc.stop(ctx.currentTime + t + 0.2);
  });
}

function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isPOS = location.pathname === '/';
  const [alarm, setAlarm] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const audioCtxRef = useRef(null);
  const prevAlarmRef = useRef(0);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  // Inicializar AudioContext en primer gesto del usuario
  useEffect(() => {
    const init = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
    };
    window.addEventListener('click', init, { once: true });
    return () => window.removeEventListener('click', init);
  }, []);

  useEffect(() => {
    let on = true;
    const poll = async () => {
      try {
        const d = await api('/pedidos/alarma/');
        if (!on) return;
        const cantidad = d.hay_alarma ? d.cantidad : 0;
        // Sonido solo cuando aparece un pedido nuevo (sube el contador)
        if (cantidad > prevAlarmRef.current) {
          beepAlarma(audioCtxRef.current);
        }
        prevAlarmRef.current = cantidad;
        setAlarm(cantidad);
      } catch { }
    };
    poll();
    const i = setInterval(poll, 10000);
    return () => { on = false; clearInterval(i); };
  }, []);

  if (user.rol === 'CLIENTE') {
    return (
    <div className="p-8 flex flex-col items-center justify-center min-h-screen bg-paper">
        <div className="card max-w-sm w-full text-center space-y-4">
          <img src="/viveres-stalin.png" alt="Viveres Stalin" className="h-16 w-16 mx-auto object-contain" />
          <p className="text-sm text-ink/70 font-medium">Esta cuenta es de cliente. El panel de cliente esta disponible solo en la app movil.</p>
          <button className="btn-p w-full" onClick={logout}>Cerrar sesion</button>
        </div>
      </div>
    );
  }

  const tabs = user.rol === 'ADMIN' ? [...baseTabs, ['/usuarios', 'Usuarios']] : baseTabs;

  return (
    <div className="h-screen bg-paper flex flex-col overflow-hidden">
      {/* Header limpio y moderno (fondo blanco, sutil y descansado) */}
      <header className="flex-shrink-0 z-30 bg-white border-b border-ink/10 shadow-xs relative">
        <div className="mx-auto flex max-w-full items-center justify-between px-3 sm:px-5 py-2.5">
          {/* Logo y Marca */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img
              src="/viveres-stalin.png"
              alt="Víveres Stalin"
              className="h-9 w-9 object-contain rounded-xl p-0.5 border border-ink/10 shadow-xs"
            />
            <div>
              <span className="font-black text-ink tracking-tight text-base leading-none block">
                Víveres Stalin
              </span>
              <span className="text-[10px] text-brand font-bold uppercase tracking-wider leading-none block mt-0.5">
                {user.rol === 'ADMIN' ? 'Administración' : 'Caja POS'}
              </span>
            </div>
          </div>

          {/* Navegación para pantallas Medianas y Grandes (Desktop/Tablet) */}
          <nav className="hidden md:flex items-center gap-1.5">
            {tabs.map(([to, l]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-ink/70 hover:bg-brand-soft hover:text-brand-dark'
                  }`
                }
              >
                <span>{l}</span>
                {to === '/pedidos' && alarm > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 text-white px-1.5 py-0.2 text-[10px] font-black">
                    {alarm}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Área de Usuario en Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-xs font-semibold text-ink/75 flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-ink/10">
              <IconUser className="h-3.5 w-3.5 text-brand" />
              {user.nombre}
            </span>
            <button
              className="btn-s text-xs py-1.5 px-3 font-bold hover:border-red-300 hover:text-red-700 transition"
              onClick={logout}
            >
              Salir
            </button>
          </div>

          {/* Botones de acción en Teléfonos Móviles (< md) */}
          <div className="flex md:hidden items-center gap-2">
            {alarm > 0 && (
              <NavLink
                to="/pedidos"
                className="flex items-center gap-1 bg-red-500 text-white text-[11px] font-black px-2.5 py-1 rounded-xl animate-pulse"
              >
                <span>Pedidos:</span>
                <span>{alarm}</span>
              </NavLink>
            )}

            <button
              type="button"
              className="p-2 rounded-xl border border-ink/15 text-ink hover:bg-brand-soft transition flex items-center justify-center"
              onClick={() => setMenuAbierto(!menuAbierto)}
              aria-label="Abrir menú de navegación"
            >
              {menuAbierto ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* MENÚ MÓVIL DESPLEGABLE (< md) */}
        {menuAbierto && (
          <div className="md:hidden border-t border-ink/10 bg-white px-4 py-3 shadow-xl space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-ink/5 text-xs text-ink/60">
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <IconUser className="h-3.5 w-3.5 text-brand" /> {user.nombre}
              </span>
              <span className="text-[10px] uppercase font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-md">
                {user.rol}
              </span>
            </div>

            <p className="text-[10px] font-black text-ink/40 uppercase tracking-widest pt-1">
              Menú de Secciones
            </p>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {tabs.map(([to, l]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between border ${
                      isActive
                        ? 'bg-brand text-white border-brand shadow-xs'
                        : 'bg-white text-ink/80 border-ink/10 hover:bg-brand-soft'
                    }`
                  }
                  onClick={() => setMenuAbierto(false)}
                >
                  <span>{l}</span>
                  {to === '/pedidos' && alarm > 0 && (
                    <span className="rounded-full bg-red-500 text-white px-1.5 py-0.2 text-[9px] font-black">
                      {alarm}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="pt-2 border-t border-ink/10">
              <button
                className="w-full py-2.5 rounded-xl bg-red-50 text-red-700 font-bold text-xs border border-red-200 hover:bg-red-100 transition text-center"
                onClick={logout}
              >
                Cerrar sesión de {user.nombre}
              </button>
            </div>
          </div>
        )}

        {/* Alerta de pedidos nuevos */}
        {alarm > 0 && !menuAbierto && (
          <div className="bg-red-600 py-1 text-center text-xs font-bold text-white tracking-wide">
            🔔 {alarm} pedido{alarm > 1 ? 's' : ''} nuevo{alarm > 1 ? 's' : ''} en línea esperando en mostrador
          </div>
        )}
      </header>

      {/* Contenido principal */}
      <main
        className={`flex-1 ${isPOS ? 'overflow-hidden p-2 sm:p-3' : 'overflow-y-auto p-3 sm:p-5'}`}
        style={{ maxWidth: '100%' }}
      >
        <div className={isPOS ? 'h-full w-full' : 'mx-auto max-w-7xl'}>
          <Routes>
            <Route path="/" element={<POS />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/caja" element={<Caja />} />
            <Route path="/fiados" element={<Fiados />} />
            <Route path="/pedidos" element={<Pedidos alarm={alarm} />} />
            <Route path="/usuarios" element={user.rol === 'ADMIN' ? <Usuarios /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  if (!user) return <Login />;
  if (user.rol === 'CLIENTE') return <ClientePanel />;
  return <Shell />;
}
