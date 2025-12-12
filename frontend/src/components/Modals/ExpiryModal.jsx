import { useState, useEffect } from 'react';

export function ExpiryModal({ isOpen, rawValue, onConfirm, onCancel }) {
  const [valor, setValor] = useState(rawValue || '');

  useEffect(() => {
    if (isOpen) setValor(rawValue || '');
  }, [isOpen, rawValue]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valor.trim()) return;
    onConfirm(valor.trim());
  };

  // Vista previa dinámica
  const renderPreview = () => {
    const v = valor.trim();

    // mmYY
    if (/^\d{4}$/.test(v)) {
      const mm = v.slice(0, 2);
      const yy = v.slice(2, 4);
      return `Se interpretará como 01/${mm}/20${yy}`;
    }

    // ddmmYY
    if (/^\d{6}$/.test(v)) {
      const dd = v.slice(0, 2);
      const mm = v.slice(2, 4);
      const yy = v.slice(4, 6);
      return `Se interpretará como ${dd}/${mm}/20${yy}`;
    }

    return 'Formato: MMYY (1125) o DDMMYY (131225)';
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Fecha de vencimiento</h3>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g,''))}
            placeholder="MMYY o DDMMYY"
          />
          <small>{renderPreview()}</small>

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
