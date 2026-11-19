import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playBeepSuccess, playBeepError } from '../utils/scannerAudio';
import { IconClose, IconCart } from '../icons';
import { money } from '../api';

export default function ScannerModal({ isOpen, onClose, onScanProduct, cartCount = 0, cartTotal = 0, onGoToCobrar }) {
  const [iniciado, setIniciado] = useState(false);
  const [errorCamara, setErrorCamara] = useState(null);
  const [torchDisponible, setTorchDisponible] = useState(false);
  const [torchEncendido, setTorchEncendido] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null); // { ok: bool, texto: string, nombre?: string, precio?: number }
  
  const qrCodeRef = useRef(null);
  const ultimoCodigoRef = useRef(null);
  const ultimoTiempoRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      detenerCamara();
      return;
    }

    let isMounted = true;
    setErrorCamara(null);
    setUltimoResultado(null);

    const iniciarCamara = async () => {
      try {
        // Formatos estándar de retail y abarrotes
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

        const html5QrCode = new Html5Qrcode('pos-barcode-scanner', {
          formatsToSupport: formats,
          verbose: false,
        });
        qrCodeRef.current = html5QrCode;

        const config = {
          fps: 25, // 25 fps para lectura instantánea ultra veloz
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Rectángulo horizontal ideal para códigos de barras de empaques
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const w = Math.min(viewfinderWidth * 0.85, 320);
            const h = Math.min(minEdge * 0.45, 170);
            return { width: Math.round(w), height: Math.max(Math.round(h), 120) };
          },
          aspectRatio: 1.0,
          disableFlip: false,
        };

        await html5QrCode.start(
          { facingMode: 'environment' }, // Cámara trasera del teléfono
          config,
          (decodedText) => {
            const ahora = Date.now();
            const codigo = decodedText.trim();
            if (!codigo) return;

            // Evitar escaneo duplicado del mismo producto si ocurre dentro de 1.4 segundos
            if (codigo === ultimoCodigoRef.current && ahora - ultimoTiempoRef.current < 1400) {
              return;
            }

            ultimoCodigoRef.current = codigo;
            ultimoTiempoRef.current = ahora;

            // Procesar el código escaneado
            if (onScanProduct) {
              const res = onScanProduct(codigo);
              if (res && res.then) {
                // Si retorna una promesa (búsqueda en backend)
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
          () => {
            // Callback de frame no detectado (silencioso para máxima velocidad)
          }
        );

        if (isMounted) {
          setIniciado(true);
          // Verificar si el teléfono soporta flash/torch
          try {
            const track = html5QrCode.getRunningTrackCameraCapabilities();
            if (track && track.torchFeature && track.torchFeature().isSupported()) {
              setTorchDisponible(true);
            }
          } catch (_) {
            // Torch no soportado en este dispositivo
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error al inicializar cámara:', err);
          setErrorCamara(
            'No se pudo acceder a la cámara. Asegúrate de otorgar los permisos de cámara en tu navegador.'
          );
        }
      }
    };

    iniciarCamara();

    return () => {
      isMounted = false;
      detenerCamara();
    };
  }, [isOpen]);

  const detenerCamara = () => {
    if (qrCodeRef.current) {
      try {
        if (qrCodeRef.current.isScanning) {
          qrCodeRef.current.stop().catch(() => {});
        }
        qrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error al detener cámara:', e);
      }
      qrCodeRef.current = null;
    }
    setIniciado(false);
    setTorchEncendido(false);
  };

  const toggleTorch = async () => {
    if (!qrCodeRef.current || !torchDisponible) return;
    try {
      const nuevoEstado = !torchEncendido;
      await qrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nuevoEstado }],
      });
      setTorchEncendido(nuevoEstado);
    } catch (e) {
      console.warn('No se pudo activar la linterna:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-ink rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[92vh]">
        
        {/* Cabecera del Escáner */}
        <div className="flex items-center justify-between px-4 py-3 bg-ink/90 border-b border-white/10 text-white flex-shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="font-bold text-sm tracking-tight">Escáner de Código de Barras</h3>
          </div>

          <div className="flex items-center gap-2">
            {torchDisponible && (
              <button
                type="button"
                className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  torchEncendido
                    ? 'bg-amber-400 text-ink shadow-md'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                onClick={toggleTorch}
                title="Encender / Apagar Linterna"
              >
                <span>{torchEncendido ? '🔦 Linterna ON' : '🔦 Flash'}</span>
              </button>
            )}

            <button
              type="button"
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
              onClick={onClose}
              aria-label="Cerrar escáner"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Visor de Cámara con Marco Guía */}
        <div className="relative flex-1 min-h-[320px] max-h-[460px] bg-black flex items-center justify-center overflow-hidden">
          {/* Contenedor del video html5-qrcode */}
          <div id="pos-barcode-scanner" className="w-full h-full object-cover" />

          {/* Animación de línea láser de escaneo */}
          {iniciado && !errorCamara && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative w-[85%] max-w-[320px] h-[160px] rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.35)] overflow-hidden">
                {/* Esquinas guía reforzadas */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
                
                {/* Línea láser animada */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-bounce" />
              </div>

              <p className="mt-3 text-xs font-semibold text-white/80 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                Apunta al código de barras del producto
              </p>
            </div>
          )}

          {/* Mensaje de error si la cámara falla */}
          {errorCamara && (
            <div className="p-6 text-center text-white space-y-3 z-10">
              <div className="h-12 w-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-xl font-black">
                !
              </div>
              <p className="text-sm font-bold text-red-300">{errorCamara}</p>
              <button
                type="button"
                className="btn-p py-2 px-4 text-xs font-bold mt-2"
                onClick={onClose}
              >
                Cerrar y usar teclado
              </button>
            </div>
          )}

          {/* Banner de feedback del último producto escaneado */}
          {ultimoResultado && (
            <div
              className={`absolute top-3 left-3 right-3 z-20 p-2.5 rounded-2xl shadow-xl backdrop-blur-md border animate-fadeIn transition flex items-center justify-between gap-2 ${
                ultimoResultado.ok
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                  : 'bg-red-950/90 border-red-500/50 text-red-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base flex-shrink-0">
                  {ultimoResultado.ok ? '✓' : '✗'}
                </span>
                <div className="min-w-0 text-left">
                  {ultimoResultado.ok ? (
                    <>
                      <p className="text-xs font-black text-white truncate">
                        {ultimoResultado.nombre}
                      </p>
                      <p className="text-[10px] text-emerald-300 font-mono">
                        {money(ultimoResultado.precio)} · Código: {ultimoResultado.texto}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-black text-white truncate">
                        Código no encontrado
                      </p>
                      <p className="text-[10px] text-red-300 font-mono">
                        {ultimoResultado.texto}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-white/20 text-white flex-shrink-0">
                {ultimoResultado.ok ? '+1 en Ticket' : 'No registrado'}
              </span>
            </div>
          )}
        </div>

        {/* Barra inferior con Total acumulado y botón de Cobro */}
        <div className="p-3 bg-ink/95 border-t border-white/10 flex items-center justify-between gap-2 text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
              <IconCart className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider">
                Total acumulado
              </p>
              <p className="text-base font-black text-emerald-400 leading-none">
                {money(cartTotal)}{' '}
                <span className="text-xs font-semibold text-white/70">
                  ({cartCount} {cartCount === 1 ? 'item' : 'items'})
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition"
              onClick={onClose}
            >
              Seguir
            </button>
            <button
              type="button"
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-xs font-black text-white shadow-lg flex items-center gap-1.5 transition"
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
