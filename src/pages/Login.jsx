import { useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { ErrorBox } from '../ui';
import { IconUser, IconMail, IconLock, IconEye, IconEyeOff } from '../icons';

export default function Login() {
  const { login } = useAuth();
  const [modo, setModo] = useState('login');

  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const [reg, setReg] = useState({
    nombres: '', apellidos: '', email: '', telefono: '',
    username: '', password: '', confirmar_password: '',
  });
  const [regErr, setRegErr] = useState(null);
  const [regOk, setRegOk] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [fieldErrs, setFieldErrs] = useState({});

  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(u.trim(), p);
    } catch (x) {
      setErr(x.status === 401 || x.status === 400
        ? { message: 'Usuario o contrasena incorrectos.' } : x);
      setBusy(false);
    }
  };

  const setField = (k) => (e) => {
    setReg((r) => ({ ...r, [k]: e.target.value }));
    if (fieldErrs[k]) setFieldErrs((prev) => { const n = { ...prev }; delete n[k]; return n; });
  };

  const validateReg = () => {
    const errs = {};
    if (!reg.nombres.trim()) errs.nombres = 'Requerido';
    if (!reg.apellidos.trim()) errs.apellidos = 'Requerido';
    if (!reg.email.trim()) errs.email = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) errs.email = 'Correo invalido';
    if (reg.telefono && !/^\d+$/.test(reg.telefono)) errs.telefono = 'Solo numeros';
    if (!reg.username.trim()) errs.username = 'Requerido';
    if (!reg.password) errs.password = 'Requerido';
    else if (reg.password.length < 10) errs.password = 'Minimo 10 caracteres';
    if (!reg.confirmar_password) errs.confirmar_password = 'Requerido';
    else if (reg.password !== reg.confirmar_password) errs.confirmar_password = 'Las contrasenas no coinciden';
    return errs;
  };

  const registrar = async (e) => {
    e.preventDefault();
    setRegErr(null);
    const errs = validateReg();
    if (Object.keys(errs).length > 0) { setFieldErrs(errs); return; }
    setFieldErrs({});
    setRegBusy(true);
    try {
      await api('/auth/registro/', {
        method: 'POST',
        body: {
          nombre: reg.nombres.trim(),
          apellidos: reg.apellidos.trim(),
          email: reg.email.trim(),
          telefono: reg.telefono.trim(),
          username: reg.username.trim(),
          password: reg.password,
        },
        auth: false,
      });
      setRegOk(true);
      setTimeout(() => {
        setModo('login');
        setRegOk(false);
        setReg({ nombres: '', apellidos: '', email: '', telefono: '', username: '', password: '', confirmar_password: '' });
      }, 2000);
    } catch (x) {
      setRegErr(x);
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* Panel izquierdo — Marca (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center"
        style={{ background: 'linear-gradient(145deg, #1E3A1A 0%, #2A5520 50%, #3D7A2F 100%)' }}>
        {/* patron de fondo */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, #6AAF57 0%, transparent 50%),
                              radial-gradient(circle at 80% 70%, #6AAF57 0%, transparent 50%)`,
          }} />
        {/* Hexagonos decorativos */}
        <div className="absolute top-10 right-10 w-24 h-24 rounded-3xl border border-white/10 rotate-12" />
        <div className="absolute bottom-20 left-10 w-16 h-16 rounded-2xl border border-white/10 -rotate-12" />
        <div className="absolute top-1/3 right-6 w-8 h-8 rounded-xl bg-white/5" />

        <div className="relative z-10 text-center px-10">
          <div className="mb-8 inline-block">
            <div className="w-44 h-44 mx-auto rounded-3xl bg-white shadow-2xl ring-4 ring-white/40 flex items-center justify-center p-3">
              <img src="/viveres-stalin.png" alt="Viveres Stalin" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-tight mb-3">
            Viveres Stalin
          </h1>
          <p className="text-white/60 text-sm font-medium max-w-xs mx-auto leading-relaxed">
            Sistema integral de punto de venta y gestion de pedidos en linea
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              ['Ventas', 'Cobros rapidos'],
              ['Pedidos', 'En tiempo real'],
              ['Inventario', 'Siempre al dia'],
            ].map(([title, sub]) => (
              <div key={title} className="rounded-2xl bg-white/10 backdrop-blur px-3 py-4 ring-1 ring-white/10">
                <p className="text-white font-black text-sm">{title}</p>
                <p className="text-white/50 text-[11px] mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — Formulario */}
      <div className="flex-1 flex items-center justify-center p-6 bg-paper">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/viveres-stalin.png" alt="Viveres Stalin" className="h-12 w-12 object-contain rounded-2xl bg-white shadow-md p-1" />
            <div>
              <p className="font-black text-brand-dark text-lg leading-none">Viveres Stalin</p>
              <p className="text-xs text-ink/50 font-medium">Sistema POS</p>
            </div>
          </div>

          {/* Titulo */}
          <div className="mb-7">
            <h2 className="text-2xl font-black text-ink leading-tight">
              {modo === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta'}
            </h2>
            <p className="text-sm text-ink/50 mt-1">
              {modo === 'login'
                ? 'Ingresa tus credenciales para continuar'
                : 'Completa los datos para registrarte'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-brand-soft rounded-2xl">
            <button
              type="button"
              onClick={() => { setModo('login'); setErr(null); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${modo === 'login'
                ? 'bg-white text-brand shadow-sm'
                : 'text-ink/50 hover:text-ink'}`}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => { setModo('registro'); setRegErr(null); setFieldErrs({}); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${modo === 'registro'
                ? 'bg-white text-brand shadow-sm'
                : 'text-ink/50 hover:text-ink'}`}
            >
              Crear cuenta
            </button>
          </div>

          {/* FORMULARIO LOGIN */}
          {modo === 'login' && (
            <form onSubmit={go} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-ink/60 block mb-1.5 uppercase tracking-wider">Usuario</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35">
                    <IconUser className="h-4 w-4" />
                  </span>
                  <input
                    className="inp pl-10 py-3 text-sm font-medium"
                    placeholder="Tu nombre de usuario"
                    value={u}
                    onChange={(e) => setU(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink/60 block mb-1.5 uppercase tracking-wider">Contrasena</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/35">
                    <IconLock className="h-4 w-4" />
                  </span>
                  <input
                    className="inp pl-10 pr-10 py-3 text-sm font-medium"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tu contrasena"
                    value={p}
                    onChange={(e) => setP(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/35 hover:text-brand transition"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <ErrorBox error={err} />

              <button
                type="submit"
                className="btn-p w-full py-3.5 text-sm font-black tracking-wide shadow-lg shadow-brand/25 hover:shadow-brand/40 transition-all"
                disabled={busy}
              >
                {busy ? 'Verificando...' : 'Entrar al sistema'}
              </button>

              <p className="text-center text-[11px] text-ink/40 mt-2">
                Viveres Stalin &copy; {new Date().getFullYear()} &mdash; Todos los derechos reservados
              </p>
            </form>
          )}

          {/* FORMULARIO REGISTRO */}
          {modo === 'registro' && (
            <form onSubmit={registrar} className="space-y-3.5">
              {regOk && (
                <div className="rounded-2xl bg-brand-soft border border-brand/30 p-3.5 text-xs text-brand-dark text-center font-bold">
                  Cuenta creada. Redirigiendo al ingreso...
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-ink/55 block mb-1">Nombres *</label>
                  <input
                    className={`inp text-xs py-2.5 ${fieldErrs.nombres ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                    placeholder="Alexander"
                    value={reg.nombres}
                    onChange={setField('nombres')}
                  />
                  {fieldErrs.nombres && <p className="text-[10px] text-red-500 mt-0.5 font-medium">{fieldErrs.nombres}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ink/55 block mb-1">Apellidos *</label>
                  <input
                    className={`inp text-xs py-2.5 ${fieldErrs.apellidos ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                    placeholder="Guaman"
                    value={reg.apellidos}
                    onChange={setField('apellidos')}
                  />
                  {fieldErrs.apellidos && <p className="text-[10px] text-red-500 mt-0.5 font-medium">{fieldErrs.apellidos}</p>}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink/55 block mb-1">Correo electronico *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35"><IconMail className="h-3.5 w-3.5" /></span>
                  <input
                    className={`inp pl-9 text-xs py-2.5 ${fieldErrs.email ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={reg.email}
                    onChange={setField('email')}
                  />
                </div>
                {fieldErrs.email && <p className="text-[10px] text-red-500 mt-0.5 font-medium">{fieldErrs.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-ink/55 block mb-1">Telefono</label>
                  <input
                    className={`inp text-xs py-2.5 ${fieldErrs.telefono ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                    placeholder="0999000000"
                    value={reg.telefono}
                    onChange={setField('telefono')}
                    inputMode="numeric"
                  />
                  {fieldErrs.telefono && <p className="text-[10px] text-red-500 mt-0.5 font-medium">{fieldErrs.telefono}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ink/55 block mb-1">Usuario de acceso *</label>
                  <input
                    className={`inp text-xs py-2.5 ${fieldErrs.username ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                    placeholder="usuario123"
                    value={reg.username}
                    onChange={setField('username')}
                    autoComplete="username"
                  />
                  {fieldErrs.username && <p className="text-[10px] text-red-500 mt-0.5 font-medium">{fieldErrs.username}</p>}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink/55 block mb-1">Contrasena (min. 10 caracteres) *</label>
                <div className="relative">
                  <input
                    className={`inp pr-9 text-xs py-2.5 ${fieldErrs.password ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Al menos 10 caracteres"
                    value={reg.password}
                    onChange={setField('password')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/35 hover:text-brand transition"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                  >
                    {showRegPassword ? <IconEyeOff className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {fieldErrs.password && <p className="text-[10px] text-red-500 mt-0.5 font-medium">{fieldErrs.password}</p>}
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink/55 block mb-1">Confirmar contrasena *</label>
                <div className="relative">
                  <input
                    className={`inp pr-9 text-xs py-2.5 ${fieldErrs.confirmar_password ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                    type={showRegConfirm ? 'text' : 'password'}
                    placeholder="Repite la contrasena"
                    value={reg.confirmar_password}
                    onChange={setField('confirmar_password')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/35 hover:text-brand transition"
                    onClick={() => setShowRegConfirm(!showRegConfirm)}
                  >
                    {showRegConfirm ? <IconEyeOff className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {fieldErrs.confirmar_password && <p className="text-[10px] text-red-500 mt-0.5 font-medium">{fieldErrs.confirmar_password}</p>}
              </div>

              <ErrorBox error={regErr} />

              <button
                type="submit"
                className="btn-p w-full py-3 text-xs font-black shadow-lg shadow-brand/25 hover:shadow-brand/40 transition-all"
                disabled={regBusy || regOk}
              >
                {regBusy ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
