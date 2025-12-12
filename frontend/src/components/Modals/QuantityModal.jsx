// src/components/Modals/QuantityModal.jsx
import { useState, useEffect } from 'react';

export function QuantityModal({ isOpen, productoNombre, onConfirm, onCancel }) {
  const [cantidad, setCantidad] = useState('');

  useEffect(() => {
    if (isOpen) setCantidad('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cantidad.trim()) return;
    const n = Number(cantidad);
    if (isNaN(n) || n <= 0) return;
    onConfirm(n);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Cantidad</h3>
        <p>Producto: <strong>{productoNombre}</strong></p>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="number"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="Cantidad"
          />
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
