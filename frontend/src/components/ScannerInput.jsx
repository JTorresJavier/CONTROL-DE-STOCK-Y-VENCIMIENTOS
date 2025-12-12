// src/components/ScannerInput.jsx
import { useEffect, useRef } from 'react';

// Props:
// onCodeRead(codigo) -> se llama cuando tenemos un código completo (enter)
// onManualRequest() -> se llama cuando se presiona tecla Insert
export function ScannerInput({ onCodeRead, onManualRequest }) {
  const inputRef = useRef(null);

  // Detectamos "mobile" simple por ancho de pantalla
  const isMobile =
    typeof window !== 'undefined' && window.innerWidth < 768;

  // Elegimos el type según el dispositivo
  const inputType = isMobile ? 'number' : 'text';
  const inputMode = isMobile ? 'numeric' : 'text';

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleChange = () => {
    // No hacemos nada acá, solo acumulamos el texto
  };

  const handleKeyDown = (e) => {
    // Tecla Insert → carga manual
    if (e.key === 'Insert') {
      e.preventDefault();
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      onManualRequest();
      return;
    }

    // Enter → disparamos código
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = inputRef.current ? inputRef.current.value.trim() : '';
      if (value) {
        inputRef.current.value = '';
        onCodeRead(value);
      }
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type={inputType}      /* text en PC, number en celu */
        inputMode={inputMode} /* numeric en celu, text en PC */
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Escanear código aquí (o usar Insert para manual)"
        style={{ width: '100%', padding: '8px' }}
      />
      <small>
        Consejito: dejá este campo siempre seleccionado para que el escáner
        escriba acá.
      </small>
    </div>
  );
}
