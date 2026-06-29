// src/components/ProductSearchInput.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { searchProductos } from "../services/api";

// Helpers
const esPosibleCodigoBarra = (txt) => /^\d{8,14}$/.test(txt); // EAN8..EAN14 aprox

export function ProductSearchInput({
  onSelectCodigo,      // (codigoBarra) => void
  onManualRequest,     // () => void (opcional)
  placeholder = "Escaneá o escribí código / nombre...",
}) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // inputMode dinámico: si estás escribiendo SOLO números, forzamos teclado numérico en móvil
  const inputMode = useMemo(() => {
    if (!isMobile) return "text";
    const v = query.trim();
    if (/^\d+$/.test(v)) return "numeric";
    return "text";
  }, [isMobile, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce simple para no spamear el backend
  useEffect(() => {
    const v = query.trim();
    setActiveIdx(-1);

    if (v.length < 2) {
      setSugerencias([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await searchProductos(v);
        setSugerencias(res || []);
      } catch {
        setSugerencias([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [query]);

  const seleccionar = (prod) => {
    if (!prod?.codigo_barra) return;
    setQuery("");
    setSugerencias([]);
    setActiveIdx(-1);
    onSelectCodigo(prod.codigo_barra);
  };

  const handleKeyDown = async (e) => {
    // Insert -> abrir modal manual (en PC)
    if (e.key === "Insert" && onManualRequest) {
      e.preventDefault();
      setQuery("");
      setSugerencias([]);
      onManualRequest();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (sugerencias.length === 0) return;
      setActiveIdx((p) => Math.min(p + 1, sugerencias.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (sugerencias.length === 0) return;
      setActiveIdx((p) => Math.max(p - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const v = query.trim();
      if (!v) return;

      // 1) Si hay una sugerencia seleccionada con flechas -> elegirla
      if (activeIdx >= 0 && sugerencias[activeIdx]) {
        seleccionar(sugerencias[activeIdx]);
        return;
      }

      // 2) Si hay 1 sola sugerencia -> elegirla directo
      if (sugerencias.length === 1) {
        seleccionar(sugerencias[0]);
        return;
      }

      // 3) Si parece código de barras -> tratar como código
      if (esPosibleCodigoBarra(v)) {
        setQuery("");
        setSugerencias([]);
        onSelectCodigo(v);
        return;
      }

      // 4) Si no es código y hay muchas sugerencias, no adivinamos:
      // que elija tocando/click.
    }

    if (e.key === "Escape") {
      setSugerencias([]);
      setActiveIdx(-1);
    }
  };

  return (
    <div className="scanner-input-wrapper" style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />

      <small style={{ display: "block", marginTop: 6 }}>
        {loading
          ? "Buscando..."
          : "Enter: selecciona / busca. Flechas: navegar. (Insert: manual en PC)"}
      </small>

      {sugerencias.length > 0 && (
        <ul className="admin-suggestions" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20 }}>
          {sugerencias.map((prod, idx) => (
            <li
              key={prod.id}
              onClick={() => seleccionar(prod)}
              className={idx === activeIdx ? "admin-suggestion active" : "admin-suggestion"}
            >
              <div className="admin-suggestion-main">
                <span className="admin-suggestion-name">{prod.nombre}</span>
                <span className="admin-suggestion-code">{prod.codigo_barra}</span>
              </div>
              {prod.descripcion && (
                <small className="admin-suggestion-desc">{prod.descripcion}</small>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
