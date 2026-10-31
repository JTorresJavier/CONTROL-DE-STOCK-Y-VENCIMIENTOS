// src/components/Modals/QuantityModal.jsx
import { useState } from 'react';

export function QuantityModal({ isOpen, productoNombre, onConfirm, onCancel }) {
  const [cantidad, setCantidad] = useState('');
  const [abiertoPrevio, setAbiertoPrevio] = useState(isOpen);
  if (isOpen !== abiertoPrevio) {
    setAbiertoPrevio(isOpen);
    if (isOpen) setCantidad('');
  }
  if (!isOpen) return null;

  const n = Number(cantidad);
  const valida = Number.isInteger(n) && n > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (valida) onConfirm(n);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Cantidad</h3>
        <p>Producto: <strong>{productoNombre}</strong></p>
        <form onSubmit={handleSubmit}>
          <input autoFocus type="number" min="1" step="1" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad" />
          {cantidad && !valida && <small className="texto-error">Tiene que ser un número entero mayor a 0.</small>}
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!valida}>Aceptar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
