import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

/**
 * Escaneo automático desde cámara (video live).
 * - No saca foto.
 * - Apenas detecta un código, llama onResult(codigo) y se cierra.
 */
export function CameraScannerZXing({ onResult, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const closedRef = useRef(false);

  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    closedRef.current = false;

    const start = async () => {
      try {
        setError(null);
        setScanning(true);

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        // Preferimos cámara trasera si existe
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();

        // intenta elegir una “back” si aparece en label (a veces label viene vacío hasta dar permisos)
        const backDevice =
          devices.find((d) => /back|rear|trasera/i.test(d.label)) || devices[0];

        const deviceId = backDevice?.deviceId || undefined;

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            // err es normal mientras “busca”, no lo muestres como error
            if (result && !closedRef.current) {
                closedRef.current = true;

                const code = result.getText();

                if (navigator.vibrate) navigator.vibrate(100);

                // apagamos la lectura y cámara ANTES de cualquier otra cosa
                try {
                    reader.reset();
                } catch {}

                // cerramos UI ya mismo
                setScanning(false);

                // devolvemos el resultado sin bloquear cierre
                try {
                    onResult(code);
                } finally {
                    onClose();
                }
            }
          }
        );
      } catch (e) {
        setScanning(false);
        setError(
          e?.message ||
            "No se pudo iniciar la cámara. Revisá permisos del navegador."
        );
      }
    };

    start();

    return () => {
      closedRef.current = true;
      try {
        readerRef.current?.reset();
      } catch {}
    };
  }, [onResult, onClose]);

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 520 }}>
        <h3>Escanear con cámara</h3>

        {error ? (
          <div className="alert-error">{error}</div>
        ) : (
          <small style={{ color: "#9ca3af" }}>
            {scanning ? "Apuntá al código… se detecta automáticamente." : "Código detectado ✔"}
          </small>
        )}

        <div style={{ marginTop: 10 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: "100%",
              borderRadius: 12,
              background: "#000",
              border: "1px solid rgba(255,255,255,0.08)"
            }}
          />
        </div>

        <div className="modal-actions" style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              try {
                readerRef.current?.reset();
              } catch {}
              onClose();
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
