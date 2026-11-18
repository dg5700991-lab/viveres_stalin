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
      if (isNaN(fondo) || fondo < 0) {
        throw new Error('El fondo inicial debe ser un número igual o mayor a $0.00. Ingresa el dinero con el que arranca la caja para dar cambio.');
      }

      await api('/caja/turnos/abrir/', {
        method: 'POST',
        body: { fondo_inicial: fondo },
      });
      setNotif({ ok: '¡Turno de caja abierto con éxito! Ya puedes registrar ventas y cobros en el mostrador.' });
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
      if (isNaN(m) || m <= 0) {
        throw new Error('Ingresa una cantidad de dinero válida (mayor a $0.00) para el movimiento de caja.');
      }
      if (!motivoMov.trim()) {
        throw new Error('Escribe una breve justificación del movimiento (por ejemplo: "Pago a repartidor de pan" o "Ingreso de monedas para cambio").');
      }

      await api('/caja/turnos/movimientos/', {
        method: 'POST',
        body: { tipo: tipoMov, monto: m, motivo: motivoMov.trim() },
      });
      setNotif({
        ok: `Movimiento de ${tipoMov === 'INGRESO' ? 'ingreso de dinero' : 'retiro de dinero'} ($${m.toFixed(2)}) guardado correctamente.`,
      });
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
      `¿Deseas cerrar el turno de caja ahora?\n\n` +
      `Se cerrará la jornada registrando que el dinero está completo:\n` +
      `• Efectivo esperado en caja: ${money(esperadoEf)}\n` +
      `• Transferencias bancarias: ${money(esperadoTr)}\n\n` +
      `¿Confirmar cierre de caja?`
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
          notas: 'Cierre de caja automático: todo el dinero físico y transferencias verificado y completo.',
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
      if (isNaN(ef) || ef < 0) {
        throw new Error('Cuenta los billetes y monedas que tienes físicamente en la caja e ingresa el monto total en efectivo.');
      }

      await api('/caja/turnos/cerrar/', {
        method: 'POST',
        body: {
          contado_efectivo: ef,
          contado_transferencia: tr,
          notas: notasCierre.trim() || 'Cierre manual verificado.',
        },
      });
      setNotif({ ok: 'Turno de caja cerrado correctamente con el conteo manual registrado.' });
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
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      {/* Encabezado */}
      <div className="border-b border-ink/10 pb-3">
        <h1 className="text-xl sm:text-2xl font-black text-ink">
          Gestión y Control de Caja
        </h1>
        <p className="text-xs sm:text-sm text-ink/60 mt-0.5">
          Apertura de turno, control de ingresos o retiros y arqueo de caja en tiempo real.
        </p>
      </div>

      {/* Notificaciones de éxito o error */}
      {notif && (
        <div>
          {notif.ok && <Ok>{notif.ok}</Ok>}
          {notif.err && <ErrorBox error={notif.err} />}
        </div>
      )}

      {/* CASO 1: NO HAY TURNO ABIERTO */}
      {!turnoActivo ? (
        <div className="card space-y-4 border-2 border-brand/20 bg-white p-5 sm:p-6 shadow-md rounded-3xl">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand ring-4 ring-brand-soft/40 flex-shrink-0">
              <IconUnlock className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-ink">
                Iniciar Turno de Caja
              </h2>
              <p className="text-xs text-ink/60">
                Ingresa el dinero en efectivo con el que vas a dar cambio en el mostrador.
              </p>
            </div>
          </div>

          <form onSubmit={handleAbrir} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-ink/70 mb-1">
                Fondo Inicial en Efectivo *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-ink/40">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="inp pl-8 text-xl font-black py-3 rounded-2xl"
                  placeholder="20.00"
                  value={fondoInicial}
                  onChange={(e) => setFondoInicial(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <span className="text-[11px] text-ink/50 mt-1.5 block">
                Ejemplo: $20.00 para cambio, o $0.00 si la caja comienza vacía.
              </span>
            </div>

            <button
              type="submit"
              className="btn-p w-full py-3.5 text-sm sm:text-base font-black shadow-md rounded-2xl"
              disabled={busy}
            >
              {busy ? 'Abriendo turno…' : 'Abrir Turno y Comenzar a Vender'}
            </button>
          </form>
        </div>
      ) : (
        /* CASO 2: HAY UN TURNO ACTIVO */
        <div className="space-y-4 sm:space-y-5">
          {/* Tarjeta de Resumen del Turno */}
          <div className="card border-2 border-brand/20 bg-white p-4 sm:p-5 shadow-md space-y-4 rounded-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink/10 pb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-black text-brand-dark">
                  <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  TURNO DE CAJA ACTIVO
                </span>
                <p className="text-xs text-ink/60 mt-1 font-medium">
                  Cajero responsable: <b>{turnoActivo.cajero_nombre || user?.nombre}</b>
                  {turnoActivo.creado_en && (
                    <span className="text-ink/40 ml-1">
                      (Iniciado a las {new Date(turnoActivo.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  )}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-ink/50 block">Ventas cobradas hoy</span>
                <span className="text-lg font-black text-brand">
                  {cuadre?.num_ventas ?? 0} ventas
                </span>
              </div>
            </div>

            {/* Desglose de Dinero por Canales */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
              <div className="rounded-2xl bg-brand-soft/30 p-3 border border-brand/10">
                <span className="text-ink/60 block text-[11px] font-semibold">Fondo Inicial</span>
                <span className="text-base font-black text-ink">
                  {money(cuadre?.fondo_inicial ?? turnoActivo.fondo_inicial)}
                </span>
              </div>

              <div className="rounded-2xl bg-brand-soft/50 p-3 border border-brand/20">
                <span className="text-brand-dark block text-[11px] font-semibold">Ventas en Efectivo</span>
                <span className="text-base font-black text-brand">
                  +{money(cuadre?.ventas_efectivo ?? 0)}
                </span>
              </div>

              <div className="rounded-2xl bg-gray-50 p-3 border border-ink/10 col-span-2 sm:col-span-1">
                <span className="text-ink/60 block text-[11px] font-semibold">Ventas por Transferencia</span>
                <span className="text-base font-black text-ink">
                  {money(cuadre?.ventas_transferencia ?? 0)}
                </span>
              </div>

              {Number(cuadre?.ingresos_caja || 0) > 0 && (
                <div className="rounded-2xl bg-brand-soft/40 p-3 border border-brand/20">
                  <span className="text-brand-dark block text-[11px] font-semibold">Ingresos adicionales</span>
                  <span className="text-base font-black text-brand">
                    +{money(cuadre.ingresos_caja)}
                  </span>
                </div>
              )}

              {Number(cuadre?.egresos_caja || 0) > 0 && (
                <div className="rounded-2xl bg-red-50 p-3 border border-red-200">
                  <span className="text-red-800 block text-[11px] font-semibold">Retiros de caja</span>
                  <span className="text-base font-black text-red-700">
                    -{money(cuadre.egresos_caja)}
                  </span>
                </div>
              )}
            </div>

            {/* TOTAL QUE DEBE HABER FÍSICAMENTE EN CAJA */}
            <div
              className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm text-white"
              style={{ background: 'linear-gradient(135deg, #2A5520 0%, #3D7A2F 100%)' }}
            >
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-white/80">
                  Total que debe haber en efectivo en el cajón
                </p>
                <p className="text-[11px] text-white/70 mt-0.5">
                  Fondo inicial + cobros en efectivo + ingresos extra − retiros
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-2xl sm:text-3xl font-black">
                  {money(cuadre?.esperado_efectivo ?? turnoActivo.fondo_inicial)}
                </span>
              </div>
            </div>

            {/* BOTÓN DE CIERRE AUTOMÁTICO */}
            <div className="pt-2">
              <button
                type="button"
                className="btn-p w-full py-4 text-sm sm:text-base font-black shadow-lg flex items-center justify-center gap-2 rounded-2xl active:scale-[0.99] transition"
                onClick={handleCierreAutomatico}
                disabled={busy}
              >
                <IconCheck className="h-5 w-5" />
                <span>Confirmar Cierre de Caja (Todo el dinero está completo)</span>
              </button>
              <p className="text-center text-[11px] text-ink/50 mt-1.5 font-medium">
                Cierra la jornada verificando que el dinero coincide con el registro del sistema ({money(cuadre?.esperado_efectivo ?? 0)}).
              </p>
            </div>
          </div>

          {/* Formulario de Cierre Manual si hubo diferencias */}
          <div className="card p-4 bg-white border border-ink/10 rounded-2xl">
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs font-bold text-ink/70 hover:text-ink"
              onClick={() => setMostrarManual(!mostrarManual)}
            >
              <span className="flex items-center gap-1.5">
                <IconGear className="h-4 w-4 text-ink/50" />
                <span>¿Deseas registrar un conteo manual con notas u observaciones?</span>
              </span>
              <span className="text-[11px] bg-brand-soft text-brand px-2 py-0.5 rounded-lg">
                {mostrarManual ? 'Ocultar' : 'Mostrar'}
              </span>
            </button>

            {mostrarManual && (
              <form onSubmit={handleCierreManual} className="mt-4 space-y-3 pt-3 border-t border-ink/10 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-ink/70 mb-1">
                      Efectivo Contado Físicamente *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="inp text-sm font-bold py-2 rounded-xl"
                      placeholder={String(cuadre?.esperado_efectivo || '0.00')}
                      value={contadoEfectivo}
                      onChange={(e) => setContadoEfectivo(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-ink/70 mb-1">
                      Transferencias Verificadas
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="inp text-sm py-2 rounded-xl"
                      placeholder={String(cuadre?.esperado_transferencia || '0.00')}
                      value={contadoTransf}
                      onChange={(e) => setContadoTransf(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-ink/70 mb-1">
                    Observaciones o Notas de Cierre (Opcional)
                  </label>
                  <input
                    className="inp text-sm py-2 rounded-xl"
                    placeholder="Ejemplo: Faltaron $0.25 en monedas / Todo cuadrado a la perfección"
                    value={notasCierre}
                    onChange={(e) => setNotasCierre(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-s w-full py-2.5 font-bold rounded-xl"
                  disabled={busy}
                >
                  {busy ? 'Cerrando turno…' : 'Cerrar Turno con Montos Manuales'}
                </button>
              </form>
            )}
          </div>

          {/* Registro de Movimiento de Efectivo (Ingreso / Retiro) */}
          <div className="card p-4 sm:p-5 bg-white border border-ink/10 space-y-3 rounded-2xl">
            <div>
              <h3 className="font-black text-sm text-ink">
                Registrar Entrada o Salida de Dinero
              </h3>
              <p className="text-xs text-ink/60 mt-0.5">
                Usa esto cuando pagues a un proveedor en efectivo o agregues monedas para cambio durante el día.
              </p>
            </div>

            <form onSubmit={handleMovimiento} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-ink/60 mb-1">Tipo de movimiento</label>
                  <select
                    className="inp text-xs py-2 bg-white font-semibold rounded-xl"
                    value={tipoMov}
                    onChange={(e) => setTipoMov(e.target.value)}
                  >
                    <option value="INGRESO">Ingreso (+ entra dinero)</option>
                    <option value="EGRESO">Retiro (− sale dinero)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink/60 mb-1">Monto en dólares ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="inp text-xs py-2 font-bold rounded-xl"
                    placeholder="0.00"
                    value={montoMov}
                    onChange={(e) => setMontoMov(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink/60 mb-1">Motivo o justificación *</label>
                  <input
                    className="inp text-xs py-2 rounded-xl"
                    placeholder="Ej: Pago de pan, compra de fundas"
                    value={motivoMov}
                    onChange={(e) => setMotivoMov(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-s py-2 px-4 text-xs font-bold rounded-xl hover:bg-brand-soft"
                disabled={busy}
              >
                {busy ? 'Guardando movimiento…' : 'Registrar Movimiento en Caja'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
