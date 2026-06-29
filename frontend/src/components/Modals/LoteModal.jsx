import { useEffect, useState } from "react";

export function LoteModal({ isOpen, productoNombre, onConfirm, onCancel }) {
  const [lote, setLote] = useState("");

  useEffect(() => {
    if (isOpen) setLote("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // lote es opcional: confirmamos aunque venga vacío
    onConfirm(lote.trim());
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Lote (opcional)</h3>
        <p>
          Producto: <strong>{productoNombre}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            placeholder="Ej: L123, ABC-22 (opcional)"
          />

          <small>
            Si el producto viene con lote, cargarlo ayuda a identificar y auditar.
          </small>

          <div className="modal-actions">
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit">Aceptar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
