// src/components/Modals/ManualCodeModal.jsx
import { useState } from 'react';

export function ManualCodeModal({ isOpen, onClose, onConfirm }) {
  const [codigo, setCodigo] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!codigo.trim()) return;

    // NO lo convertimos a Number, lo usamos como string
    onConfirm (codigo.trim());
    setCodigo('');
    onClose();
  };

  const handleChange = (e) => {
    // Tomamos lo que viene del input
    const value = e.target.value;
    // Permitimos solo dígitos
    const soloNumeros = value.replace(/\D/g, '');
    setCodigo(soloNumeros);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Ingresar código manual</h3>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="number"       // 👈 igual que cantidad
            //inputMode="numeric" // sugiere teclado numérico
            pattern="[0-9]*"
            min="0"
            step="1"
            value={codigo}
            onChange={handleChange}
            placeholder="Código de barras"
          />
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit">Aceptar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
