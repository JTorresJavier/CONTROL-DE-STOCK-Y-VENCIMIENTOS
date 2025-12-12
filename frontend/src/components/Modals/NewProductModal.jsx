// src/components/Modals/NewProductModal.jsx
import { useState, useEffect } from 'react';

export function NewProductModal({ isOpen, codigo, onConfirm, onCancel }) {
  const [nombre, setNombre] = useState('');

  // Cuando se abre el modal, limpiamos el nombre
  useEffect(() => {
    if (isOpen) setNombre('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    onConfirm(nombre.trim());
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Nuevo producto</h3>
        <p>Código de barras: <strong>{codigo}</strong></p>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del producto"
          />
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
