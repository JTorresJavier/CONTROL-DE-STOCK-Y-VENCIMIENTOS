// src/components/CameraScanner.jsx
import { useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export function CameraScanner({ onResult, onClose }) {
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const img = new Image();
        img.onload = async () => {
          try {
            const codeReader = new BrowserMultiFormatReader();
            const result = await codeReader.decodeFromImageElement(img);
            if (result && result.getText) {
              onResult(result.getText());
              onClose();
            } else {
              alert("No se pudo leer el código, intentá de nuevo.");
            }
          } catch (err) {
            console.error("Error decodificando imagen:", err);
            alert("No se pudo leer el código, intentá de nuevo.");
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error leyendo archivo:", err);
      alert("Error al procesar la imagen.");
    }
  };

  const handleOpenCamera = () => {
    // abre la cámara nativa del celu
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ textAlign: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Escanear código</h3>
        <p style={{ fontSize: "14px" }}>
          Tocá el botón de abajo para abrir la cámara, sacá una foto al código
          de barras y vamos a leerlo automáticamente.
        </p>

        <button
          className="btn-primary"
          style={{ width: "100%", marginTop: "10px" }}
          onClick={handleOpenCamera}
        >
          📷 Abrir cámara
        </button>

        {/* input oculto que dispara la cámara */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <div className="modal-actions" style={{ marginTop: "10px" }}>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
