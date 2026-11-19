import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playBeepSuccess, playBeepError } from '../utils/scannerAudio';
import { IconClose, IconCart, IconBarcode, IconCameraSwitch, IconFlash } from '../icons';
import { money } from '../api';

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ''
  );
}

export default function ScannerModal({
  isOpen,
  onClose,
  onScanProduct,
  cartCount = 0,
  cartTotal = 0,
  onGoToCobrar,
}) {
  const [iniciado, setIniciado] = useState(false);
  const [errorCamara, setErrorCamara] = useState(null);
  const [torchDisponible, setTorchDisponible] = useState(false);
  const [torchEncendido, setTorchEncendido] = useState(false);
  const [camarasDisponibles, setCamarasDisponibles] = useState([]);
  const [camaraIndex, setCamaraIndex] = useState(0);
  const [cambiandoCamara, setCambiandoCamara] = useState(false);
  const [esPC, setEsPC] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null);

  const scannerRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const ultimoCodigoRef = useRef(null);
  const ultimoTiempoRef = useRef(0);
  const isMountedRef = useRef(true);

  // Detener el escáner y liberar la cámara
  const detenerCamara = useCallback(async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop().catch(() => {});
        }
        await scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    } catch (e) {
      console.warn('Error al detener cámara:', e);
    } finally {
      if (isMountedRef.current) {
        setIniciado(false);
        setTorchEncendido(false);
      }
      isTransitioningRef.current = false;
    }
  }, []);

  // Iniciar el lector con una configuración específica
  const iniciarLector = useCallback(
    async (cameraConfig) => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      if (isMountedRef.current) {
        setErrorCamara(null);
        setTorchEncendido(false);
      }

      try {
        // Detener scanner previo si existía
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop().catch(() => {});
            }
            await scannerRef.current.clear().catch(() => {});
          } catch (_) {}
          scannerRef.current = null;
        }

        // Formatos de retail y abarrotes
        const formats = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ];

        const html5Qr = new Html5Qrcode('pos-barcode-scanner', {
          formatsToSupport: formats,
          verbose: false,
        });
        scannerRef.current = html5Qr;

        const config = {
          fps: 26,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const w = Math.min(viewfinderWidth * 0.88, 340);
            const h = Math.min(minEdge * 0.48, 175);
            return { width: Math.round(w), height: Math.max(Math.round(h), 120) };
          },
          aspectRatio: 1.0,
          disableFlip: false,
        };

        await html5Qr.start(
          cameraConfig,
          config,
          (decodedText) => {
            const ahora = Date.now();
            const codigo = decodedText.trim();
            if (!codigo) return;

            // Cooldown de 1.3s para evitar duplicados del mismo artículo
            if (codigo === ultimoCodigoRef.current && ahora - ultimoTiempoRef.current < 1300) {
              return;
            }

            ultimoCodigoRef.current = codigo;
            ultimoTiempoRef.current = ahora;

            if (onScanProduct) {
              const res = onScanProduct(codigo);
              if (res && res.then) {
                res
                  .then((p) => {
                    playBeepSuccess();
                    setUltimoResultado({
                      ok: true,
                      texto: codigo,
                      nombre: p.nombre,
                      precio: p.precio_venta,
                    });
                  })
                  .catch((err) => {
                    playBeepError();
                    setUltimoResultado({
                      ok: false,
                      texto: codigo,
                      error: err?.message || 'Producto no encontrado',
                    });
                  });
              } else if (res && res.encontrado) {
                playBeepSuccess();
                setUltimoResultado({
                  ok: true,
                  texto: codigo,
                  nombre: res.producto.nombre,
                  precio: res.producto.precio_venta,
                });
              } else {
                playBeepError();
                setUltimoResultado({
                  ok: false,
                  texto: codigo,
                  error: 'Código no registrado',
                });
              }
            }
          },
          () => {}
        );

        if (isMountedRef.current) {
          setIniciado(true);
          try {
            const track = html5Qr.getRunningTrackCameraCapabilities();
            if (track && track.torchFeature && track.torchFeature().isSupported()) {
              setTorchDisponible(true);
            } else {
              setTorchDisponible(false);
            }
          } catch (_) {
            setTorchDisponible(false);
          }
        }
      } catch (err) {
        if (isMountedRef.current) {
          console.error('Error al iniciar cámara:', err);
          const msg = String(err?.message || err || '');
          if (msg.includes('NotReadableError') || msg.includes('Could not start video source')) {
            setErrorCamara(
              'La cámara no se puede abrir porque otra ventana o programa la está usando. Cierra otras pestañas y reintenta.'
            );
          } else if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
            setErrorCamara('Permiso de cámara denegado. Permite el acceso a la cámara en el navegador.');
          } else {
            setErrorCamara('No se pudo iniciar la cámara en este dispositivo.');
          }
        }
      } finally {
        isTransitioningRef.current = false;
        if (isMountedRef.current) {
          setCambiandoCamara(false);
        }
      }
    },
    [onScanProduct]
  );

  // Ciclo de vida cuando se abre o cierra el modal
  useEffect(() => {
    isMountedRef.current = true;

    if (!isOpen) {
      detenerCamara();
      return;
    }

    const dispositivoEsPC = !isMobileDevice();
    setEsPC(dispositivoEsPC);

    const arrancar = async () => {
      try {
        let cameras = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch (e) {
          console.warn('No se pudieron listar cámaras explícitamente:', e);
        }

        if (isMountedRef.current) {
          setCamarasDisponibles(cameras);
        }

        let configToUse;

        if (dispositivoEsPC) {
          // EN COMPUTADORA (PC / LAPTOP):
          // Las PCs no tienen cámara trasera; usar la cámara web frontal directamente
          if (cameras.length > 0) {
            configToUse = cameras[0].id;
            if (isMountedRef.current) setCamaraIndex(0);
          } else {
            configToUse = { facingMode: 'user' };
          }
        } else {
          // EN TELÉFONO MÓVIL / TABLET:
          // Priorizar la cámara trasera principal
          if (cameras.length > 0) {
            const idxBack = cameras.findIndex((c) =>
              /back|rear|trasera|environment|posterior|camera2\s*0/i.test(c.label || '')
            );
            const targetIdx = idxBack !== -1 ? idxBack : cameras.length - 1;
            if (isMountedRef.current) setCamaraIndex(targetIdx);
            configToUse = cameras[targetIdx].id;
          } else {
            configToUse = { facingMode: 'environment' };
          }
        }

        await iniciarLector(configToUse);
      } catch (err) {
        console.error('Error general en inicio:', err);
      }
    };

    arrancar();

    return () => {
      isMountedRef.current = false;
      detenerCamara();
    };
  }, [isOpen, iniciarLector, detenerCamara]);

  // Cambiar cámara si hay más de una (o en móvil)
  const cambiarCamara = async () => {
    if (cambiandoCamara || isTransitioningRef.current) return;
    setCambiandoCamara(true);

    if (camarasDisponibles.length > 1) {
      const nuevoIndex = (camaraIndex + 1) % camarasDisponibles.length;
      setCamaraIndex(nuevoIndex);
      await iniciarLector(camarasDisponibles[nuevoIndex].id);
    } else {
      const modoAlterno = camaraIndex === 0 ? 'user' : 'environment';
      setCamaraIndex(camaraIndex === 0 ? 1 : 0);
      await iniciarLector({ facingMode: modoAlterno });
    }
  };

  // Linterna / Flash
  const toggleTorch = async () => {
    if (!scannerRef.current || !torchDisponible) return;
    try {
      const nuevoEstado = !torchEncendido;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nuevoEstado }],
      });
      setTorchEncendido(nuevoEstado);
    } catch (e) {
      console.warn('No se pudo activar linterna:', e);
    }
  };

  if (!isOpen) return null;

  // Etiqueta legible de la cámara actual
  const camaraActualLabel = esPC
    ? 'Cámara Web (PC)'
    : camarasDisponibles.length > 0
    ? /back|rear|trasera|environment/i.test(camarasDisponibles[camaraIndex]?.label || '')
      ? 'Cámara Trasera'
      : 'Cámara Frontal'
    : camaraIndex === 0
    ? 'Cámara Trasera'
    : 'Cámara Frontal';

  // Mostrar botón de voltear cámara si hay múltiples cámaras o si es móvil
  const mostrarBotonVoltear = !esPC || camarasDisponibles.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-neutral-950 rounded-[28px] overflow-hidden shadow-2xl border border-white/15 flex flex-col max-h-[94vh]">
        
        {/* ── CABECERA DEL ESCÁNER ── */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-neutral-900/90 border-b border-white/10 text-white flex-shrink-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight leading-none text-white">
                Escáner de Código de Barras
              </h3>
              <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                {camaraActualLabel} · {iniciado ? 'Lectura activa' : 'Iniciando…'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Botón para cambiar cámara (sólo si hay opciones disponibles) */}
            {mostrarBotonVoltear && (
              <button
                type="button"
                className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border active:scale-95 ${
                  cambiandoCamara
                    ? 'bg-white/20 text-white/50 border-white/10'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                }`}
                onClick={cambiarCamara}
                disabled={cambiandoCamara}
                title="Cambiar de Cámara"
              >
                <IconCameraSwitch className="h-4 w-4 text-emerald-400" />
                <span className="hidden sm:inline text-[11px]">Voltear</span>
              </button>
            )}

            {/* Botón Flash / Linterna en teléfonos con soporte */}
            {torchDisponible && (
              <button
                type="button"
                className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 border active:scale-95 ${
                  torchEncendido
                    ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                }`}
                onClick={toggleTorch}
                title="Encender / Apagar Linterna"
              >
                <IconFlash className="h-4 w-4" />
                <span className="hidden sm:inline text-[11px]">{torchEncendido ? 'ON' : 'Flash'}</span>
              </button>
            )}

            {/* Botón Cerrar */}
            <button
              type="button"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10 transition active:scale-95"
              onClick={onClose}
              aria-label="Cerrar escáner"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── VISOR DE CÁMARA ── */}
        <div className="relative flex-1 min-h-[340px] max-h-[480px] bg-black flex items-center justify-center overflow-hidden">
          {/* Contenedor del video html5-qrcode */}
          <div id="pos-barcode-scanner" className="w-full h-full object-cover" />

          {/* Animación del visor y retícula de escaneo */}
          {iniciado && !errorCamara && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative w-[86%] max-w-[340px] h-[175px] rounded-3xl border-2 border-emerald-400/90 shadow-[0_0_25px_rgba(16,185,129,0.35)] overflow-hidden bg-emerald-500/5">
                {/* Esquinas guía */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                
                {/* Láser de escaneo animado */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-bounce" />
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-white/90 bg-neutral-900/80 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
                <IconBarcode className="h-4 w-4 text-emerald-400" />
                <span>Apunta al código de barras del producto</span>
              </div>
            </div>
          )}

          {/* Mensaje de error si la cámara falla */}
          {errorCamara && (
            <div className="p-6 text-center text-white space-y-3 z-20 max-w-sm mx-auto">
              <div className="h-14 w-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl font-black border border-red-500/30">
                !
              </div>
              <p className="text-sm font-bold text-red-200 leading-snug">{errorCamara}</p>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  className="btn-p py-2.5 px-4 text-xs font-black shadow-lg"
                  onClick={() => {
                    const cfg = esPC
                      ? (camarasDisponibles[0]?.id || { facingMode: 'user' })
                      : (camarasDisponibles[camaraIndex]?.id || { facingMode: 'environment' });
                    iniciarLector(cfg);
                  }}
                >
                  Reintentar Cámara
                </button>
                <button
                  type="button"
                  className="py-2.5 px-4 rounded-xl text-xs font-bold bg-neutral-800 text-white hover:bg-neutral-700 border border-white/20 transition active:scale-95"
                  onClick={onClose}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Banner de producto escaneado (HUD) */}
          {ultimoResultado && (
            <div
              className={`absolute top-3 left-3 right-3 z-30 p-3 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all animate-fadeIn flex items-center justify-between gap-3 ${
                ultimoResultado.ok
                  ? 'bg-neutral-900/95 border-emerald-500/60 shadow-[0_10px_25px_rgba(16,185,129,0.25)] text-emerald-300'
                  : 'bg-neutral-900/95 border-red-500/60 shadow-[0_10px_25px_rgba(239,68,68,0.25)] text-red-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0 ${
                    ultimoResultado.ok
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {ultimoResultado.ok ? '✓' : '✗'}
                </div>

                <div className="min-w-0 text-left">
                  {ultimoResultado.ok ? (
                    <>
                      <p className="text-sm font-black text-white truncate leading-tight">
                        {ultimoResultado.nombre}
                      </p>
                      <p className="text-xs text-emerald-400 font-extrabold mt-0.5">
                        {money(ultimoResultado.precio)}{' '}
                        <span className="text-[10px] text-white/50 font-normal font-mono">
                          · {ultimoResultado.texto}
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-black text-white truncate leading-tight">
                        Código no encontrado
                      </p>
                      <p className="text-[11px] text-red-300 font-mono mt-0.5">
                        {ultimoResultado.texto}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl flex-shrink-0 shadow-sm ${
                  ultimoResultado.ok
                    ? 'bg-emerald-500 text-neutral-950 font-black'
                    : 'bg-red-500/30 text-red-200 border border-red-500/40'
                }`}
              >
                {ultimoResultado.ok ? '+1 en Ticket' : 'Sin registro'}
              </span>
            </div>
          )}
        </div>

        {/* ── BARRA INFERIOR DE ACCIONES Y TOTAL ── */}
        <div className="p-3.5 bg-neutral-900 border-t border-white/10 flex items-center justify-between gap-3 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white border border-white/10 shadow-sm">
              <IconCart className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <p className="text-[10px] text-white/60 uppercase font-black tracking-wider leading-none">
                Ticket ({cartCount} {cartCount === 1 ? 'item' : 'items'})
              </p>
              <p className="text-lg font-black text-emerald-400 leading-tight mt-0.5">
                {money(cartTotal)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition border border-white/10 active:scale-95"
              onClick={onClose}
            >
              Seguir
            </button>
            <button
              type="button"
              className="py-2.5 px-4 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xs font-black text-white shadow-lg flex items-center gap-1.5 transition border border-emerald-400/40"
              onClick={() => {
                onClose();
                if (onGoToCobrar) onGoToCobrar();
              }}
            >
              <span>Cobrar →</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
