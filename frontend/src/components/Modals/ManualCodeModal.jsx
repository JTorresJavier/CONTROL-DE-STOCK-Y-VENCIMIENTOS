// src/components/Modals/ManualCodeModal.jsx
import { useState } from 'react';

// Código ingresado a mano. Es texto (no número) para no perder ceros adelante ni dígitos de códigos largos.
export function ManualCodeModal({ isOpen, onClose, onConfirm }) {
  const [codigo, setCodigo] = useState('');
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    onConfirm(codigo.trim());
    setCodigo('');
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Ingresar código manual</h3>
        <form onSubmit={handleSubmit}>
          <input autoFocus type="text" inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\s/g, ''))} placeholder="Código de barras o código interno" />
          <div className="modal-actions">
            <button type="button" onClick={() => { setCodigo(''); onClose(); }}>Cancelar</button>
            <button type="submit" className="btn-primary">Aceptar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
