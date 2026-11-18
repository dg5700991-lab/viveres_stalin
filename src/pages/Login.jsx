import { useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { ErrorBox } from '../ui';
import { IconUser, IconMail, IconLock, IconEye, IconEyeOff } from '../icons';

export default function Login() {
  const { login } = useAuth();
  const [modo, setModo] = useState('login'); // 'login' | 'registro'

  // Visibilidad de contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Login state
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // Register state
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
        ? { message: 'Usuario o contraseña incorrectos.' } : x);
      setBusy(false);
    }
  };

  const setField = (k) => (e) => {
    setReg((r) => ({ ...r, [k]: e.target.value }));
    if (fieldErrs[k]) {
      setFieldErrs((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };

  const validateReg = () => {
    const errs = {};
    if (!reg.nombres.trim()) errs.nombres = 'Requerido';
    if (!reg.apellidos.trim()) errs.apellidos = 'Requerido';
    if (!reg.email.trim()) errs.email = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) errs.email = 'Correo inválido';
    if (reg.telefono && !/^\d+$/.test(reg.telefono)) errs.telefono = 'Solo números';
    if (!reg.username.trim()) errs.username = 'Requerido';
    if (!reg.password) errs.password = 'Requerido';
    else if (reg.password.length < 10) errs.password = 'Mínimo 10 caracteres';
    if (!reg.confirmar_password) errs.confirmar_password = 'Requerido';
    else if (reg.password !== reg.confirmar_password) errs.confirmar_password = 'Las contraseñas no coinciden';
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
    <div className="min-h-screen bg-gradient-to-br from-brand/10 via-paper to-brand-soft/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-ink/10 shadow-xl overflow-hidden">

        {/* Cabecera / Banner con Logo */}
        <div className="bg-gradient-to-r from-brand to-brand-dark px-6 py-7 text-center text-white relative">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-2 ring-white/25 shadow-inner mb-3">
            <span className="text-xl font-black tracking-tight text-white">VS</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Víveres Stalin</h1>
          <p className="text-xs text-white/80 mt-1 font-medium">
            {modo === 'login' ? 'Sistema POS & Punto de Venta' : 'Registro de clientes y personal'}
          </p>
        </div>

        {/* Selector de modo */}
        <div className="grid grid-cols-2 p-2 bg-gray-50/80 border-b border-ink/5">
          <button
            type="button"
            className={`py-2 text-xs font-bold rounded-xl transition ${modo === 'login'
                ? 'bg-white text-brand shadow-sm'
                : 'text-ink/50 hover:text-ink'
              }`}
            onClick={() => { setModo('login'); setErr(null); }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`py-2 text-xs font-bold rounded-xl transition ${modo === 'registro'
                ? 'bg-white text-brand shadow-sm'
                : 'text-ink/50 hover:text-ink'
              }`}
            onClick={() => { setModo('registro'); setRegErr(null); setFieldErrs({}); }}
          >
            Crear cuenta
          </button>
        </div>

        {/* Contenido Formulario */}
        <div className="p-6">
          {modo === 'login' ? (
            <form onSubmit={go} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-ink/70 block mb-1 uppercase tracking-wider">
                  Usuario
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-ink/40">
                    <IconUser className="h-4 w-4" />
                  </span>
                  <input
                    className="inp pl-10 py-2.5 text-sm"
                    placeholder="Tu nombre de usuario"
                    value={u}
                    onChange={(e) => setU(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink/70 block mb-1 uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-ink/40">
                    <IconLock className="h-4 w-4" />
                  </span>
                  <input
                    className="inp pl-10 pr-10 py-2.5 text-sm"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ingresa tu contraseña"
                    value={p}
                    onChange={(e) => setP(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-3 text-ink/40 hover:text-ink transition"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Ver u ocultar contraseña"
                  >
                    {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <ErrorBox error={err} />

              <button
                type="submit"
                className="btn-p w-full py-3 text-sm font-bold shadow-md hover:shadow-lg transition-all"
                disabled={busy}
              >
                {busy ? 'Ingresando...' : 'Entrar al sistema'}
              </button>
            </form>
          ) : (
            <form onSubmit={registrar} className="space-y-3">
              {regOk && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-800 text-center font-bold animate-pulse">
                  Cuenta creada exitosamente. Redirigiendo al ingreso...
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-ink/60 block mb-0.5">Nombres *</label>
                  <input
                    className={`inp text-xs py-2 ${fieldErrs.nombres ? 'border-red-400 bg-red-50/30' : ''}`}
                    placeholder="Ej: Alexander"
                    value={reg.nombres}
                    onChange={setField('nombres')}
                  />
                  {fieldErrs.nombres && <p className="text-[10px] text-red-600 mt-0.5">{fieldErrs.nombres}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-ink/60 block mb-0.5">Apellidos *</label>
                  <input
                    className={`inp text-xs py-2 ${fieldErrs.apellidos ? 'border-red-400 bg-red-50/30' : ''}`}
                    placeholder="Ej: Guamán"
                    value={reg.apellidos}
                    onChange={setField('apellidos')}
                  />
                  {fieldErrs.apellidos && <p className="text-[10px] text-red-600 mt-0.5">{fieldErrs.apellidos}</p>}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink/60 block mb-0.5">Correo electrónico *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-ink/40"><IconMail className="h-3.5 w-3.5" /></span>
                  <input
                    className={`inp pl-9 text-xs py-2 ${fieldErrs.email ? 'border-red-400 bg-red-50/30' : ''}`}
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={reg.email}
                    onChange={setField('email')}
                  />
                </div>
                {fieldErrs.email && <p className="text-[10px] text-red-600 mt-0.5">{fieldErrs.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-ink/60 block mb-0.5">Teléfono (opcional)</label>
                  <input
                    className={`inp text-xs py-2 ${fieldErrs.telefono ? 'border-red-400 bg-red-50/30' : ''}`}
                    placeholder="0999000000"
                    value={reg.telefono}
                    onChange={setField('telefono')}
                    inputMode="numeric"
                  />
                  {fieldErrs.telefono && <p className="text-[10px] text-red-600 mt-0.5">{fieldErrs.telefono}</p>}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-ink/60 block mb-0.5">Usuario de acceso *</label>
                  <input
                    className={`inp text-xs py-2 ${fieldErrs.username ? 'border-red-400 bg-red-50/30' : ''}`}
                    placeholder="usuario123"
                    value={reg.username}
                    onChange={setField('username')}
                    autoComplete="username"
                  />
                  {fieldErrs.username && <p className="text-[10px] text-red-600 mt-0.5">{fieldErrs.username}</p>}
                </div>
              </div>

              {/* Contraseña con Ojo */}
              <div>
                <label className="text-[11px] font-bold text-ink/60 block mb-0.5">
                  Contraseña (mín. 10 caracteres) *
                </label>
                <div className="relative">
                  <input
                    className={`inp pr-9 text-xs py-2 ${fieldErrs.password ? 'border-red-400 bg-red-50/30' : ''}`}
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Al menos 10 caracteres"
                    value={reg.password}
                    onChange={setField('password')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-2.5 top-2 text-ink/40 hover:text-ink transition"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    aria-label="Ver u ocultar contraseña"
                  >
                    {showRegPassword ? <IconEyeOff className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {fieldErrs.password && <p className="text-[10px] text-red-600 mt-0.5">{fieldErrs.password}</p>}
              </div>

              {/* Confirmar Contraseña con Ojo */}
              <div>
                <label className="text-[11px] font-bold text-ink/60 block mb-0.5">
                  Confirmar contraseña *
                </label>
                <div className="relative">
                  <input
                    className={`inp pr-9 text-xs py-2 ${fieldErrs.confirmar_password ? 'border-red-400 bg-red-50/30' : ''}`}
                    type={showRegConfirm ? 'text' : 'password'}
                    placeholder="Repite la contraseña"
                    value={reg.confirmar_password}
                    onChange={setField('confirmar_password')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-2.5 top-2 text-ink/40 hover:text-ink transition"
                    onClick={() => setShowRegConfirm(!showRegConfirm)}
                    aria-label="Ver u ocultar contraseña"
                  >
                    {showRegConfirm ? <IconEyeOff className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {fieldErrs.confirmar_password && <p className="text-[10px] text-red-600 mt-0.5">{fieldErrs.confirmar_password}</p>}
              </div>

              <ErrorBox error={regErr} />

              <button
                type="submit"
                className="btn-p w-full py-2.5 text-xs font-bold shadow-md"
                disabled={regBusy || regOk}
              >
                {regBusy ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
          )}

          {/* Footer del card */}
          <div className="mt-4 pt-3 border-t border-ink/10 text-center">
            <p className="text-[11px] text-ink/50">
              Víveres Stalin &copy; {new Date().getFullYear()} • Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
