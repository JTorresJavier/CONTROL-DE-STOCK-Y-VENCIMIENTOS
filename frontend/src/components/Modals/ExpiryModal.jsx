import { useState } from 'react';
import { formatoAR, parseFechaFlexible } from '../../utils/fechas';

// Fecha de vencimiento: acepta 1226, 12/26, 311226, 31/12/2026, DIC-26...
export function ExpiryModal({ isOpen, productoNombre, error, onConfirm, onCancel }) {
  const [valor, setValor] = useState('');
  const [abiertoPrevio, setAbiertoPrevio] = useState(isOpen);
  if (isOpen !== abiertoPrevio) {
    setAbiertoPrevio(isOpen);
    if (isOpen) setValor('');
  }
  if (!isOpen) return null;

  const iso = parseFechaFlexible(valor);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (valor.trim()) onConfirm(valor.trim());
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Fecha de vencimiento</h3>
        {productoNombre && <p>Producto: <strong>{productoNombre}</strong></p>}
        <form onSubmit={handleSubmit}>
          <input autoFocus type="text" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej: 1226 o 31/12/2026" />
          <small className={valor && !iso ? 'texto-error' : ''}>
            {iso ? `Vence el ${formatoAR(iso)}` : valor ? 'Fecha no válida' : 'MMAA (1226) = último día del mes · DDMMAA (311226) · 31/12/2026'}
          </small>
          {error && <div className="alert-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={!iso}>Aceptar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
