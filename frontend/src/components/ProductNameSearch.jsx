// src/components/ProductNameSearch.jsx
import { useEffect, useState, useRef } from 'react';
import { searchProductos } from '../services/api';

/**
 * Buscador de productos por nombre/código con sugerencias.
 *
 * Props:
 * - onProductSelected(prod): función que se llama al elegir un producto
 * - label (opcional): texto arriba del input
 * - placeholder (opcional): placeholder del input
 */
export function ProductNameSearch({
  onProductSelected,
  label = 'Buscar producto por nombre',
  placeholder = 'Ej: COCA, MONSTER, SHAMPOO...'
}) {
  const [query, setQuery] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarLista, setMostrarLista] = useState(false);

  const containerRef = useRef(null);

  // Buscar mientras escribe (con pequeño debounce)
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSugerencias([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const results = await searchProductos(query.trim());
        setSugerencias(results || []);
        setMostrarLista(true);
      } catch (err) {
        setError(err.message || 'Error al buscar productos');
        setSugerencias([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300 ms de espera

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Cerrar lista si hago click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target)
      ) {
        setMostrarLista(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    setQuery(e.target.value);
    setError(null);
  };

  const handleSelect = (prod) => {
    // Avisamos al padre
    onProductSelected && onProductSelected(prod);
    // Dejamos el nombre en el input
    setQuery(prod.nombre);
    // Cerramos la lista
    setMostrarLista(false);
  };

  return (
    <div className="admin-search" ref={containerRef}>
      <label>{label}</label>

      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => {
          if (sugerencias.length > 0) setMostrarLista(true);
        }}
        placeholder={placeholder}
      />

      {loading && (
        <small style={{ color: '#9ca3af' }}>Buscando...</small>
      )}
      {error && (
        <small style={{ color: '#fca5a5' }}>{error}</small>
      )}

      {mostrarLista && sugerencias.length > 0 && (
        <ul className="admin-suggestions">
          {sugerencias.map((p) => (
            <li
              key={p.id}
              className="admin-suggestion"
              onClick={() => handleSelect(p)}
            >
              <div className="admin-suggestion-main">
                <span className="admin-suggestion-name">{p.nombre}</span>
                <span className="admin-suggestion-code">
                  {p.codigo_barra}
                </span>
              </div>
              {p.descripcion && (
                <div className="admin-suggestion-desc">
                  {p.descripcion}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {mostrarLista && !loading && sugerencias.length === 0 && query.trim().length >= 2 && (
        <small style={{ color: '#9ca3af' }}>
          No se encontraron productos para “{query.trim()}”.
        </small>
      )}
    </div>
  );
}
