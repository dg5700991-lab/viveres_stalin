import { useState } from 'react';
import { api, money } from '../api';
import { useAuth } from '../auth';
import { Spinner, ErrorBox, Ok, useLoad } from '../ui';
import { IconUnlock, IconGear, IconCheck, IconAlert } from '../icons';

export default function Caja() {
  const { user } = useAuth();

  // Carga del turno actual
  const turnoLoad = useLoad(async () => {
    try {
      const data = await api('/caja/turnos/actual/');
      return {
        turno: data.turno || data,
        cuadre: data.cuadre_parcial || null,
      };
    } catch (e) {
      if (e.status === 404 || e.status === 400) return null;
      throw e;
    }
  });

  const [fondoInicial, setFondoInicial] = useState('');
  const [tipoMov, setTipoMov] = useState('INGRESO');
  const [montoMov, setMontoMov] = useState('');
  const [motivoMov, setMotivoMov] = useState('');

  // Cierre manual opcional
  const [mostrarManual, setMostrarManual] = useState(false);
  const [contadoEfectivo, setContadoEfectivo] = useState('');
  const [contadoTransf, setContadoTransf] = useState('');
  const [notasCierre, setNotasCierre] = useState('');

  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState(null);

  // ABRIR TURNO
  const handleAbrir = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotif(null);
    try {
      const fondo = Number(fondoInicial);
      if (isNaN(fondo) || fondo < 0) throw new Error('Ingresa un fondo inicial válido (0 o mayor).');

      await api('/caja/turnos/abrir/', {
        method: 'POST',
        body: { fondo_inicial: fondo },
      });
      setNotif({ ok: 'Turno de caja abierto correctamente. ¡Buenas ventas!' });
      setFondoInicial('');
      turnoLoad.reload();
    } catch (err) {
      setNotif({ err });
    } finally {
      setBusy(false);
    }
  };

  // REGISTRAR MOVIMIENTO (INGRESO / RETIRO)
  const handleMovimiento = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotif(null);
    try {
      const m = Number(montoMov);
      if (isNaN(m) || m <= 0) throw new Error('El monto debe ser mayor a 0.');
      if (!motivoMov.trim()) throw new Error('Debes ingresar el motivo del movimiento.');

      await api('/caja/turnos/movimientos/', {
        method: 'POST',
        body: { tipo: tipoMov, monto: m, motivo: motivoMov.trim() },
      });
      setNotif({ ok: `Movimiento de ${tipoMov.toLowerCase()} registrado con éxito.` });
      setMontoMov('');
      setMotivoMov('');
      turnoLoad.reload();
    } catch (err) {
      setNotif({ err });
    } finally {
      setBusy(false);
    }
  };

  // CIERRE DE CAJA AUTOMÁTICO (TODO COMPLETO)
  const handleCierreAutomatico = async () => {
    const cuadre = turnoLoad.data?.cuadre;
    const esperadoEf = Number(cuadre?.esperado_efectivo ?? 0);
    const esperadoTr = Number(cuadre?.esperado_transferencia ?? 0);

    const confirmar = window.confirm(
      `¿Confirmar cierre de caja?\n\n` +
      `Se cerrará el turno registrando que todo el dinero está completo:\n` +
      `• Efectivo esperado: ${money(esperadoEf)}\n` +
      `• Transferencias: ${money(esperadoTr)}\n\n` +
      `¿Deseas finalizar el turno ahora?`
    );
    if (!confirmar) return;

    setBusy(true);
    setNotif(null);
    try {
      await api('/caja/turnos/cerrar/', {
        method: 'POST',
        body: {
          contado_efectivo: esperadoEf,
          contado_transferencia: esperadoTr,
          notas: 'Cierre de caja automático: todo el dinero verificado y completo.',
        },
      });
      setNotif({ ok: 'Turno de caja cerrado exitosamente con cuentas cuadradas.' });
      turnoLoad.reload();
    } catch (err) {
      setNotif({ err });
    } finally {
      setBusy(false);
    }
  };

  // CIERRE MANUAL
  const handleCierreManual = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotif(null);
    try {
      const ef = Number(contadoEfectivo);
      const tr = Number(contadoTransf || 0);
      if (isNaN(ef) || ef < 0) throw new Error('Ingresa un monto de efectivo contado válido.');

      await api('/caja/turnos/cerrar/', {
        method: 'POST',
        body: {
          contado_efectivo: ef,
          contado_transferencia: tr,
          notas: notasCierre.trim() || 'Cierre manual verificado.',
        },
      });
      setNotif({ ok: 'Turno cerrado correctamente.' });
      turnoLoad.reload();
    } catch (err) {
      setNotif({ err });
    } finally {
      setBusy(false);
    }
  };

  if (turnoLoad.loading) return <Spinner />;
  if (turnoLoad.error) return <ErrorBox error={turnoLoad.error} onRetry={turnoLoad.reload} />;

  const turnoActivo = turnoLoad.data?.turno;
  const cuadre = turnoLoad.data?.cuadre;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Encabezado */}
      <div className="border-b border-ink/10 pb-3">
        <h1 className="text-2xl font-bold text-ink">Gestión y Control de Caja</h1>
        <p className="text-sm text-ink/60">
          Apertura diaria, registro de ingresos/retiros y cierre automático con cuadre en tiempo real.
        </p>
      </div>

      {/* Notificaciones */}
      {notif && (
        <div>
          {notif.ok && <Ok>{notif.ok}</Ok>}
          {notif.err && <ErrorBox error={notif.err} />}
        </div>
      )}

      {/* 1. CASO: NO HAY TURNO ABIERTO */}
      {!turnoActivo ? (
        <div className="card space-y-4 border-2 border-brand/20 bg-white p-6 shadow-md">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <IconUnlock className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">Abrir Turno de Caja</h2>
              <p className="text-xs text-ink/60">
                Ingresa el fondo de dinero base con el que vas a dar cambio en el día.
              </p>
            </div>
          </div>

          <form onSubmit={handleAbrir} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                Fondo Inicial en Efectivo *
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-base font-bold text-ink/50">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="inp pl-8 text-xl font-bold"
                  placeholder="20.00"
                  value={fondoInicial}
                  onChange={(e) => setFondoInicial(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <span className="text-[11px] text-ink/50 mt-1 block">
                Ej: $20.00, $50.00 o $0 si la caja inicia vacía.
              </span>
            </div>

            <button type="submit" className="btn-p w-full py-3.5 text-base font-bold shadow-md" disabled={busy}>
              {busy ? 'Abriendo turno…' : 'Abrir Turno y Comenzar a Vender'}
            </button>
          </form>
        </div>
      ) : (
        /* 2. CASO: HAY UN TURNO ABIERTO */
        <div className="space-y-5">
          {/* Tarjeta de Resumen Automático del Turno */}
          <div className="card border-2 border-brand/30 bg-white p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-ink/10 pb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  TURNO ABIERTO
                </span>
                <p className="text-xs text-ink/60 mt-1">
                  Cajero: <b>{turnoActivo.cajero_nombre || user?.nombre}</b> · Inicio:{' '}
                  {turnoActivo.creado_en ? new Date(turnoActivo.creado_en).toLocaleTimeString() : '—'}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-ink/60 block">Ventas Realizadas</span>
                <span className="text-lg font-black text-brand">
                  {cuadre?.num_ventas ?? 0} ventas
                </span>
              </div>
            </div>

            {/* Desglose de Dinero en Caja */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-brand-soft/40 p-3">
                <span className="text-ink/60 block text-[11px]">Fondo Inicial</span>
                <span className="text-base font-bold text-ink">
                  {money(cuadre?.fondo_inicial ?? turnoActivo.fondo_inicial)}
                </span>
              </div>

              <div className="rounded-xl bg-brand-soft/40 p-3">
                <span className="text-ink/60 block text-[11px]">Ventas en Efectivo</span>
                <span className="text-base font-bold text-emerald-700">
                  +{money(cuadre?.ventas_efectivo ?? 0)}
                </span>
              </div>

              <div className="rounded-xl bg-brand-soft/40 p-3">
                <span className="text-ink/60 block text-[11px]">Ventas Transferencia</span>
                <span className="text-base font-bold text-blue-700">
                  {money(cuadre?.ventas_transferencia ?? 0)}
                </span>
              </div>

              {Number(cuadre?.ingresos_caja || 0) > 0 && (
                <div className="rounded-xl bg-emerald-50 p-3">
                  <span className="text-emerald-800 block text-[11px]">Ingresos extra</span>
                  <span className="text-base font-bold text-emerald-800">
                    +{money(cuadre.ingresos_caja)}
                  </span>
                </div>
              )}

              {Number(cuadre?.egresos_caja || 0) > 0 && (
                <div className="rounded-xl bg-red-50 p-3">
                  <span className="text-red-800 block text-[11px]">Retiros de caja</span>
                  <span className="text-base font-bold text-red-800">
                    -{money(cuadre.egresos_caja)}
                  </span>
                </div>
              )}
            </div>

            {/* TOTAL QUE DEBE HABER EN CAJA */}
            <div className="rounded-2xl bg-brand text-white p-4.5 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Total que debe haber en caja (Efectivo)
                </p>
                <p className="text-xs text-white/60">
                  Fondo inicial + ventas en efectivo + ingresos − retiros
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black">
                  {money(cuadre?.esperado_efectivo ?? turnoActivo.fondo_inicial)}
                </span>
              </div>
            </div>

            {/* BOTÓN DE CIERRE AUTOMÁTICO RECOMENDADO */}
            <div className="pt-2">
              <button
                type="button"
                className="btn-p w-full py-4 text-base font-black shadow-lg flex items-center justify-center gap-2"
                onClick={handleCierreAutomatico}
                disabled={busy}
              >
                <IconCheck className="h-5 w-5" /> Confirmar Cierre de Caja (Todo el dinero está completo)
              </button>
              <p className="text-center text-[11px] text-ink/50 mt-1.5">
                Cierra la caja automáticamente cuadrando el total exacto de ventas ({money(cuadre?.esperado_efectivo ?? 0)}).
              </p>
            </div>
          </div>

          {/* Opción de Cierre Manual (Acordeón Opcional) */}
          <div className="card p-4 bg-white border border-ink/10">
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs font-bold text-ink/70 hover:text-ink"
              onClick={() => setMostrarManual(!mostrarManual)}
            >
              <span className="flex items-center gap-1.5">
                <IconGear className="h-4 w-4 text-ink/60" />
                ¿Deseas ingresar un conteo manual con observaciones?
              </span>
              <span>{mostrarManual ? '▲ Ocultar' : '▼ Mostrar'}</span>
            </button>

            {mostrarManual && (
              <form onSubmit={handleCierreManual} className="mt-4 space-y-3 pt-3 border-t border-ink/10 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-ink/70">Efectivo Contado Físico *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="inp mt-1 text-sm font-bold"
                      placeholder={String(cuadre?.esperado_efectivo || '0.00')}
                      value={contadoEfectivo}
                      onChange={(e) => setContadoEfectivo(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-ink/70">Transferencias Verificadas</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="inp mt-1 text-sm"
                      placeholder={String(cuadre?.esperado_transferencia || '0.00')}
                      value={contadoTransf}
                      onChange={(e) => setContadoTransf(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-ink/70">Observaciones o Notas de Cierre</label>
                  <input
                    className="inp mt-1 text-sm"
                    placeholder="Ej: Faltó $0.50 en monedas / Todo cuadrado"
                    value={notasCierre}
                    onChange={(e) => setNotasCierre(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-s w-full py-2.5 font-bold" disabled={busy}>
                  {busy ? 'Cerrando turno…' : 'Cerrar Turno con Montos Manuales'}
                </button>
              </form>
            )}
          </div>

          {/* Ingresos / Retiros de Efectivo de Caja */}
          <div className="card p-4 bg-white border border-ink/10 space-y-3">
            <h3 className="font-bold text-sm text-ink">Entrada o Salida de Efectivo</h3>
            <p className="text-xs text-ink/60">
              Registra pagos a proveedores en efectivo o reposiciones de dinero durante el turno.
            </p>

            <form onSubmit={handleMovimiento} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <select
                    className="inp text-xs py-2 bg-white font-semibold"
                    value={tipoMov}
                    onChange={(e) => setTipoMov(e.target.value)}
                  >
                    <option value="INGRESO">Ingreso (+)</option>
                    <option value="EGRESO">Retiro (−)</option>
                  </select>
                </div>

                <div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="inp text-xs py-2 font-bold"
                    placeholder="Monto ($)"
                    value={montoMov}
                    onChange={(e) => setMontoMov(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <input
                    className="inp text-xs py-2"
                    placeholder="Motivo (ej: Compra fundas)"
                    value={motivoMov}
                    onChange={(e) => setMotivoMov(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-s py-2 px-4 text-xs font-bold" disabled={busy}>
                {busy ? 'Registrando…' : 'Registrar Movimiento de Caja'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
