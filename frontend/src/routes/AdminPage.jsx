// src/routes/AdminPage.jsx
import { useEffect, useState } from 'react';
import { searchProductos, updateProductoNombre } from '../services/api';

export function AdminPage() {
  const [query, setQuery] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Buscar mientras escribe
  const handleChangeQuery = async (e) => {
    const value = e.target.value;
    setQuery(value);
    setMensaje(null);
    setError(null);

    if (!value || value.trim().length < 2) {
      setSugerencias([]);
      setSeleccionado(null);
      return;
    }

    try {
      const results = await searchProductos(value);
      setSugerencias(results);
    } catch (err) {
      setError(err.message);
      setSugerencias([]);
    }
  };

  // Manejar Enter (útil para escáner de código barras)
  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!query.trim()) return;

      try {
        const results = await searchProductos(query);
        setSugerencias(results);
        if (results.length === 1) {
          // Si hay un solo resultado, lo seleccionamos directo
          seleccionarProducto(results[0]);
        }
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const seleccionarProducto = (prod) => {
    setSeleccionado(prod);
    setNuevoNombre(prod.nombre || '');
    setNuevaDescripcion(prod.descripcion || '');
    setMensaje(null);
    setError(null);
  };

  const handleGuardar = async () => {
    if (!seleccionado) return;
    if (!nuevoNombre.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }

    setLoading(true);
    setMensaje(null);
    setError(null);
    try {
      const actualizado = await updateProductoNombre(
        seleccionado.codigo_barra,
        nuevoNombre.trim(),
        nuevaDescripcion.trim()
      );
      setSeleccionado(actualizado);
      setMensaje('Producto actualizado correctamente.');
      // Actualizamos también la lista de sugerencias
      setSugerencias((prev) =>
        prev.map((p) =>
          p.codigo_barra === actualizado.codigo_barra ? actualizado : p
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-ingreso">
      <div className="page-ingreso-inner card">
        <h2>Admin de productos</h2>

        {error && <div className="alert-error">{error}</div>}
        {mensaje && <div className="alert-info">{mensaje}</div>}

        {/* Buscador */}
        <div className="admin-search">
          <label htmlFor="admin-query">
            Buscar producto por código o nombre
          </label>
          <input
            id="admin-query"
            type="text"
            placeholder="Escaneá el código o escribí el nombre..."
            value={query}
            onChange={handleChangeQuery}
            onKeyDown={handleKeyDown}
          />
          <small>
            Si escaneás con lector, el código entra acá y al presionar Enter se
            buscan coincidencias.
          </small>
        </div>

        {/* Lista de sugerencias */}
        {sugerencias.length > 0 && (
          <ul className="admin-suggestions">
            {sugerencias.map((prod) => (
              <li
                key={prod.id}
                onClick={() => seleccionarProducto(prod)}
                className={
                  seleccionado &&
                  seleccionado.codigo_barra === prod.codigo_barra
                    ? 'admin-suggestion active'
                    : 'admin-suggestion'
                }
              >
                <div className="admin-suggestion-main">
                  <span className="admin-suggestion-name">{prod.nombre}</span>
                  <span className="admin-suggestion-code">
                    {prod.codigo_barra}
                  </span>
                </div>
                {prod.descripcion && (
                  <small className="admin-suggestion-desc">
                    {prod.descripcion}
                  </small>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Formulario de edición */}
        {seleccionado && (
          <div className="admin-edit card" style={{ marginTop: '16px' }}>
            <h3>Editar producto seleccionado</h3>
            <p>
              <strong>Código:</strong> {seleccionado.codigo_barra}
            </p>

            <div className="admin-field">
              <label>Nombre</label>
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
            </div>

            <div className="admin-field">
              <label>Descripción (opcional)</label>
              <input
                type="text"
                value={nuevaDescripcion}
                onChange={(e) => setNuevaDescripcion(e.target.value)}
              />
            </div>

            <div style={{ textAlign: 'right', marginTop: '10px' }}>
              <button
                className="btn-primary"
                onClick={handleGuardar}
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
