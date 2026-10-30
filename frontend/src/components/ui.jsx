// src/components/ui.jsx
// Piezas de interfaz reutilizables.
import { useEffect, useState } from 'react';
import { estadoVencimiento, formatoAR, parseFechaFlexible } from '../utils/fechas';
import { useConfig } from '../context/ConfigContext';

export function Modal({ titulo, children, onClose, ancho = 460 }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: ancho, width: '100%' }} role="dialog" aria-label={titulo}>
        <h3>{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

// Etiqueta de color según el vencimiento
export function Semaforo({ fecha }) {
  const { config } = useConfig();
  const e = estadoVencimiento(fecha, config);
  return <span className={`badge badge-${e.nivel}`}>{e.texto}</span>;
}

export function Mensajes({ error, ok }) {
  return (
    <>
      {error && <div className="alert-error" role="alert">{error}</div>}
      {ok && <div className="alert-ok" role="status">{ok}</div>}
    </>
  );
}

export function Vacio({ children }) {
  return <p className="vacio">{children}</p>;
}

// Campo de fecha de vencimiento rápido: acepta 1226, 12/26, 311226, 31/12/2026...
// Muestra cómo se interpretó y avisa si no es válida. onEnter permite saltar al siguiente.
export function FechaInput({ valor, onChange, onEnter, autoFocus, placeholder = 'MM/AA', inputRef, compacto }) {
  const [texto, setTexto] = useState(valor ? formatoAR(valor) : '');
  const [valorPrevio, setValorPrevio] = useState(valor);

  // Si el valor cambia desde afuera (por ejemplo "aplicar a todas"), lo mostramos
  if (valor !== valorPrevio) {
    setValorPrevio(valor);
    if (parseFechaFlexible(texto) !== valor) setTexto(valor ? formatoAR(valor) : '');
  }

  const iso = parseFechaFlexible(texto);
  const invalido = texto.trim() && !iso;

  const cambiar = (t) => {
    setTexto(t);
    onChange(parseFechaFlexible(t));
  };

  return (
    <div className={`fecha-input ${compacto ? 'compacto' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={texto}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={!!invalido}
        className={invalido ? 'invalido' : ''}
        onChange={(e) => cambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (iso) onEnter?.(iso);
          }
        }}
      />
      <small className={invalido ? 'texto-error' : ''}>
        {invalido ? 'Fecha no válida' : iso ? (texto.trim() === formatoAR(iso) ? '' : `= ${formatoAR(iso)}`) : compacto ? '' : 'Ej: 1226 · 12/26 · 31/12/2026'}
      </small>
    </div>
  );
}

// Tarjeta de número grande para el inicio
export function Tarjeta({ titulo, valor, detalle, nivel = 'azul', onClick, icono }) {
  return (
    <button type="button" className={`tarjeta tarjeta-${nivel}`} onClick={onClick} disabled={!onClick}>
      <span className="tarjeta-icono">{icono}</span>
      <span className="tarjeta-valor">{valor}</span>
      <span className="tarjeta-titulo">{titulo}</span>
      {detalle && <span className="tarjeta-detalle">{detalle}</span>}
    </button>
  );
}
