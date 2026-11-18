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
      {/* Header fijo con identidad de marca Víveres Stalin */}
      <header
        className="flex-shrink-0 z-20 text-white shadow-md border-b border-black/15"
        style={{ background: 'linear-gradient(90deg, #163C19 0%, #1E4E23 45%, #2E7234 100%)' }}
      >
        <div className="mx-auto flex max-w-full items-center gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar">
          <div className="mr-4 flex items-center gap-2.5 flex-shrink-0">
            <div className="h-10 w-10 rounded-2xl bg-white p-1 shadow-md ring-2 ring-white/30 flex items-center justify-center flex-shrink-0">
              <img src="/viveres-stalin.png" alt="Víveres Stalin" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="font-black text-white tracking-tight text-base leading-none block">Víveres Stalin</span>
              <span className="text-[10px] text-brand-light font-bold uppercase tracking-wider leading-none block mt-1">
                {user.rol === 'ADMIN' ? 'Administración' : 'Caja POS'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {tabs.map(([to, l]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition flex-shrink-0 flex items-center gap-1 ${
                    isActive
                      ? 'bg-white text-forest shadow-md'
                      : 'text-white/85 hover:bg-white/15 hover:text-white'
                  }`
                }
              >
                <span>{l}</span>
                {to === '/pedidos' && alarm > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 text-white px-1.5 py-0.5 text-[10px] font-black animate-bounce">
                    {alarm}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            <span className="text-xs font-semibold text-white/90 hidden sm:flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/15">
              <IconUser className="h-3.5 w-3.5 text-brand-light" />
              {user.nombre}
            </span>
            <button
              className="text-xs py-1.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold transition border border-white/20 active:scale-95"
              onClick={logout}
            >
              Cerrar sesión
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
