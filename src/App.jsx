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
import { IconUser } from './icons';

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
  const audioCtxRef = useRef(null);
  const prevAlarmRef = useRef(0);

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
      <div className="p-8">
        <p className="mb-4">Esta cuenta es de cliente. El panel web es para caja y administracion.</p>
        <button className="btn-p" onClick={logout}>Cerrar sesion</button>
      </div>
    );
  }

  const tabs = user.rol === 'ADMIN' ? [...baseTabs, ['/usuarios', 'Usuarios']] : baseTabs;

  return (
    <div className="h-screen bg-paper flex flex-col overflow-hidden">
      {/* Header fijo */}
      <header className="flex-shrink-0 z-20 border-b border-ink/10 bg-white/95 backdrop-blur-sm shadow-xs">
        <div className="mx-auto flex max-w-full items-center gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar">
          <div className="mr-4 flex items-center gap-2.5 flex-shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white font-black text-xs shadow-sm ring-1 ring-brand/30">
              VS
            </span>
            <div>
              <span className="font-black text-brand tracking-tight text-base leading-none block">Víveres Stalin</span>
              <span className="text-[10px] text-ink/50 font-bold uppercase tracking-wider leading-none block mt-0.5">
                {user.rol === 'ADMIN' ? 'Administración' : 'Caja POS'}
              </span>
            </div>
          </div>

          {tabs.map(([to, l]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex-shrink-0 ${isActive ? 'bg-brand text-white shadow-sm' : 'text-ink/70 hover:bg-brand-soft hover:text-ink'
                }`
              }
            >
              {l}
              {to === '/pedidos' && alarm > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 text-white px-1.5 py-0.5 text-[10px] font-black">
                  {alarm}
                </span>
              )}
            </NavLink>
          ))}

          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            <span className="text-xs font-semibold text-ink/70 hidden sm:flex items-center gap-1.5">
              <IconUser className="h-3.5 w-3.5" />
              {user.nombre}
            </span>
            <button className="btn-s text-xs py-1.5 px-3" onClick={logout}>
              Cerrar sesion
            </button>
          </div>
        </div>
        {alarm > 0 && (
          <div className="bg-red-600 py-1.5 text-center text-xs font-black text-white animate-pulse tracking-wide">
            {alarm} pedido{alarm > 1 ? 's' : ''} nuevo{alarm > 1 ? 's' : ''} esperando — ve a Pedidos
          </div>
        )}
      </header>

      {/* Contenido principal */}
      <main
        className={`flex-1 overflow-hidden ${isPOS ? 'p-3' : 'overflow-y-auto p-4'}`}
        style={isPOS ? { maxWidth: '100%' } : { maxWidth: '100%' }}
      >
        <div className={isPOS ? 'h-full' : 'mx-auto max-w-7xl'}>
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
