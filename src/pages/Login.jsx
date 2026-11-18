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
  const [reg, setReg] = useState({ nombres:'',apellidos:'',email:'',telefono:'',username:'',password:'',confirmar_password:'' });
  const [regErr, setRegErr] = useState(null);
  const [regOk, setRegOk] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [fieldErrs, setFieldErrs] = useState({});

  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await login(u.trim(), p); }
    catch (x) { setErr(x.status===401||x.status===400?{message:'Usuario o contrasena incorrectos.'}:x); setBusy(false); }
  };
  const setField = (k) => (e) => {
    setReg(r=>({...r,[k]:e.target.value}));
    if(fieldErrs[k]) setFieldErrs(prev=>{const n={...prev};delete n[k];return n;});
  };
  const validateReg = () => {
    const errs={};
    if(!reg.nombres.trim()) errs.nombres='Requerido';
    if(!reg.apellidos.trim()) errs.apellidos='Requerido';
    if(!reg.email.trim()) errs.email='Requerido';
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) errs.email='Correo invalido';
    if(reg.telefono&&!/^\d+$/.test(reg.telefono)) errs.telefono='Solo numeros';
    if(!reg.username.trim()) errs.username='Requerido';
    if(!reg.password) errs.password='Requerido';
    else if(reg.password.length<10) errs.password='Minimo 10 caracteres';
    if(!reg.confirmar_password) errs.confirmar_password='Requerido';
    else if(reg.password!==reg.confirmar_password) errs.confirmar_password='Las contrasenas no coinciden';
    return errs;
  };
  const registrar = async (e) => {
    e.preventDefault(); setRegErr(null);
    const errs=validateReg();
    if(Object.keys(errs).length>0){setFieldErrs(errs);return;}
    setFieldErrs({}); setRegBusy(true);
    try {
      await api('/auth/registro/',{method:'POST',body:{
        nombre:reg.nombres.trim(),apellidos:reg.apellidos.trim(),email:reg.email.trim(),
        telefono:reg.telefono.trim(),username:reg.username.trim(),password:reg.password,
      },auth:false});
      setRegOk(true);
      setTimeout(()=>{setModo('login');setRegOk(false);setReg({nombres:'',apellidos:'',email:'',telefono:'',username:'',password:'',confirmar_password:''});},2000);
    } catch(x){setRegErr(x);} finally{setRegBusy(false);}
  };

  return (
    <div className="min-h-screen flex">

      {/* ═══ PANEL IZQUIERDO — Branding ═══════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-5/12 relative overflow-hidden flex-col items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #0f2d0a 0%, #1E3A1A 35%, #2A5520 65%, #3D7A2F 100%)' }}
      >
        {/* Circulos decorativos de fondo */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(106,175,87,0.15) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(106,175,87,0.12) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 right-0 w-32 h-32 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(106,175,87,0.08) 0%, transparent 70%)' }} />

        {/* Lineas decorativas sutiles */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #6AAF57 0, #6AAF57 1px, transparent 0, transparent 50%)',
            backgroundSize: '30px 30px'
          }} />

        <div className="relative z-10 flex flex-col items-center text-center px-12">

          {/* Logo con halo luminoso */}
          <div className="relative mb-10">
            {/* Halo exterior */}
            <div className="absolute inset-0 rounded-full scale-125"
              style={{ background: 'radial-gradient(circle, rgba(106,175,87,0.25) 0%, transparent 70%)' }} />
            {/* Halo interior */}
            <div className="absolute inset-0 rounded-full scale-110"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 65%)' }} />
            {/* Contenedor del logo — forma circular limpia */}
            <div
              className="relative w-52 h-52 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 40% 35%, #ffffff 0%, #f0f7ee 100%)',
                boxShadow: '0 0 0 6px rgba(106,175,87,0.25), 0 0 0 12px rgba(106,175,87,0.10), 0 30px 80px rgba(0,0,0,0.5)',
              }}
            >
              <img
                src="/viveres-stalin.png"
                alt="Viveres Stalin"
                className="w-40 h-40 object-contain"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(42,85,32,0.2))' }}
              />
            </div>
          </div>

          <h1 className="text-4xl font-black text-white tracking-tight leading-tight mb-3"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
            Viveres Stalin
          </h1>
          <p className="text-white/55 text-sm font-medium max-w-xs leading-relaxed mb-10">
            Sistema integral de punto de venta y gestion de pedidos en linea
          </p>

          {/* Stats decorativos */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            {[['Ventas','Cobros rapidos'],['Pedidos','En tiempo real'],['Stock','Siempre al dia']].map(([t,s])=>(
              <div key={t}
                className="rounded-2xl px-3 py-4 text-center"
                style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-white font-black text-sm">{t}</p>
                <p className="text-white/45 text-[10px] mt-0.5 leading-tight">{s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer branding */}
        <div className="absolute bottom-6 text-white/25 text-[11px] font-medium">
          Viveres Stalin &copy; {new Date().getFullYear()}
        </div>
      </div>

      {/* ═══ PANEL DERECHO — Formulario ════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'linear-gradient(145deg, #f4f7f2 0%, #eef4ea 50%, #f4f7f2 100%)' }}>
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center p-1.5"
              style={{ boxShadow: '0 4px 20px rgba(61,122,47,0.2)' }}>
              <img src="/viveres-stalin.png" alt="Viveres Stalin" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-black text-brand-dark text-lg leading-none">Viveres Stalin</p>
              <p className="text-xs text-ink/40 font-medium mt-0.5">Sistema POS</p>
            </div>
          </div>

          {/* Encabezado del formulario */}
          <div className="mb-8">
            <h2 className="text-3xl font-black text-ink leading-tight">
              {modo === 'login' ? 'Bienvenido' : 'Nueva cuenta'}
            </h2>
            <p className="text-sm text-ink/40 mt-1.5 font-medium">
              {modo === 'login'
                ? 'Ingresa tus datos para acceder al sistema'
                : 'Completa el formulario para registrarte'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-7 p-1.5 rounded-2xl"
            style={{ background: 'rgba(61,122,47,0.08)' }}>
            {[['login','Iniciar sesion'],['registro','Crear cuenta']].map(([v,l])=>(
              <button key={v} type="button" onClick={()=>{setModo(v);setErr(null);setRegErr(null);setFieldErrs({});}}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${modo===v
                  ? 'bg-white text-brand shadow-md'
                  : 'text-ink/40 hover:text-ink/70'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* ── LOGIN ── */}
          {modo === 'login' && (
            <form onSubmit={go} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-ink/50 uppercase tracking-widest block">
                  Usuario
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30 group-focus-within:text-brand transition">
                    <IconUser className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-2xl border-2 border-transparent bg-white px-4 py-3.5 pl-11 text-sm font-medium text-ink placeholder-ink/25 focus:border-brand focus:outline-none transition-all duration-200"
                    style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}
                    placeholder="Tu nombre de usuario"
                    value={u}
                    onChange={e=>setU(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-ink/50 uppercase tracking-widest block">
                  Contrasena
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30 group-focus-within:text-brand transition">
                    <IconLock className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-2xl border-2 border-transparent bg-white px-4 py-3.5 pl-11 pr-12 text-sm font-medium text-ink placeholder-ink/25 focus:border-brand focus:outline-none transition-all duration-200"
                    style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}
                    type={showPassword?'text':'password'}
                    placeholder="Tu contrasena"
                    value={p}
                    onChange={e=>setP(e.target.value)}
                    required
                  />
                  <button type="button" tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/30 hover:text-brand transition"
                    onClick={()=>setShowPassword(!showPassword)}>
                    {showPassword?<IconEyeOff className="h-4 w-4"/>:<IconEye className="h-4 w-4"/>}
                  </button>
                </div>
              </div>

              <ErrorBox error={err} />

              <button
                type="submit"
                className="w-full py-4 rounded-2xl text-sm font-black text-white tracking-wide transition-all duration-200 disabled:opacity-60"
                style={{
                  background: busy ? '#2A5520' : 'linear-gradient(135deg, #3D7A2F 0%, #2A5520 100%)',
                  boxShadow: '0 8px 30px rgba(42,85,32,0.35)',
                }}
                disabled={busy}
              >
                {busy ? 'Verificando...' : 'Entrar al sistema'}
              </button>

              <p className="text-center text-[11px] text-ink/30 pt-2">
                Viveres Stalin &copy; {new Date().getFullYear()} &mdash; Todos los derechos reservados
              </p>
            </form>
          )}

          {/* ── REGISTRO ── */}
          {modo === 'registro' && (
            <form onSubmit={registrar} className="space-y-3">
              {regOk && (
                <div className="rounded-2xl p-4 text-sm font-bold text-center"
                  style={{ background: 'linear-gradient(135deg, #E6F0E2, #d4ebcc)', border: '1.5px solid #6AAF57', color: '#1E3A1A' }}>
                  Cuenta creada. Redirigiendo al ingreso...
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {[['nombres','Nombres','Alexander'],['apellidos','Apellidos','Guaman']].map(([k,l,ph])=>(
                  <div key={k}>
                    <label className="text-[10px] font-black text-ink/45 uppercase tracking-wider block mb-1">{l} *</label>
                    <input
                      className={`w-full rounded-xl border-2 bg-white px-3 py-2.5 text-xs font-medium text-ink placeholder-ink/25 focus:outline-none transition-all ${fieldErrs[k]?'border-red-400':'border-transparent focus:border-brand'}`}
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                      placeholder={ph} value={reg[k]} onChange={setField(k)}
                    />
                    {fieldErrs[k]&&<p className="text-[10px] text-red-500 mt-0.5 font-semibold">{fieldErrs[k]}</p>}
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[10px] font-black text-ink/45 uppercase tracking-wider block mb-1">Correo electronico *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30"><IconMail className="h-3.5 w-3.5"/></span>
                  <input
                    className={`w-full rounded-xl border-2 bg-white pl-9 px-3 py-2.5 text-xs font-medium text-ink placeholder-ink/25 focus:outline-none transition-all ${fieldErrs.email?'border-red-400':'border-transparent focus:border-brand'}`}
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                    type="email" placeholder="correo@ejemplo.com" value={reg.email} onChange={setField('email')}
                  />
                </div>
                {fieldErrs.email&&<p className="text-[10px] text-red-500 mt-0.5 font-semibold">{fieldErrs.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black text-ink/45 uppercase tracking-wider block mb-1">Telefono</label>
                  <input
                    className={`w-full rounded-xl border-2 bg-white px-3 py-2.5 text-xs font-medium text-ink placeholder-ink/25 focus:outline-none transition-all ${fieldErrs.telefono?'border-red-400':'border-transparent focus:border-brand'}`}
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                    placeholder="0999000000" value={reg.telefono} onChange={setField('telefono')} inputMode="numeric"
                  />
                  {fieldErrs.telefono&&<p className="text-[10px] text-red-500 mt-0.5 font-semibold">{fieldErrs.telefono}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-black text-ink/45 uppercase tracking-wider block mb-1">Usuario *</label>
                  <input
                    className={`w-full rounded-xl border-2 bg-white px-3 py-2.5 text-xs font-medium text-ink placeholder-ink/25 focus:outline-none transition-all ${fieldErrs.username?'border-red-400':'border-transparent focus:border-brand'}`}
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                    placeholder="usuario123" value={reg.username} onChange={setField('username')} autoComplete="username"
                  />
                  {fieldErrs.username&&<p className="text-[10px] text-red-500 mt-0.5 font-semibold">{fieldErrs.username}</p>}
                </div>
              </div>

              {[
                ['password','Contrasena (min. 10 caracteres)','Al menos 10 caracteres',showRegPassword,setShowRegPassword,'new-password'],
                ['confirmar_password','Confirmar contrasena','Repite la contrasena',showRegConfirm,setShowRegConfirm,'new-password'],
              ].map(([k,l,ph,show,setShow,ac])=>(
                <div key={k}>
                  <label className="text-[10px] font-black text-ink/45 uppercase tracking-wider block mb-1">{l} *</label>
                  <div className="relative">
                    <input
                      className={`w-full rounded-xl border-2 bg-white px-3 py-2.5 pr-9 text-xs font-medium text-ink placeholder-ink/25 focus:outline-none transition-all ${fieldErrs[k]?'border-red-400':'border-transparent focus:border-brand'}`}
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                      type={show?'text':'password'} placeholder={ph} value={reg[k]} onChange={setField(k)} autoComplete={ac}
                    />
                    <button type="button" tabIndex={-1}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/30 hover:text-brand transition"
                      onClick={()=>setShow(!show)}>
                      {show?<IconEyeOff className="h-3.5 w-3.5"/>:<IconEye className="h-3.5 w-3.5"/>}
                    </button>
                  </div>
                  {fieldErrs[k]&&<p className="text-[10px] text-red-500 mt-0.5 font-semibold">{fieldErrs[k]}</p>}
                </div>
              ))}

              <ErrorBox error={regErr} />

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl text-xs font-black text-white tracking-wide transition-all duration-200 disabled:opacity-60 mt-1"
                style={{
                  background: 'linear-gradient(135deg, #3D7A2F 0%, #2A5520 100%)',
                  boxShadow: '0 8px 30px rgba(42,85,32,0.3)',
                }}
                disabled={regBusy||regOk}
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
