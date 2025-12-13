// src/routes/AdminPage.jsx

// Importamos hooks de React
import { useEffect, useMemo, useState } from 'react';

// Importamos funciones de nuestra API
import { getProductos, searchProductos, updateProductoNombre } from '../services/api';

export function AdminPage() {
  // =========================
  // ESTADOS PRINCIPALES
  // =========================

  // Texto del input de búsqueda
  const [query, setQuery] = useState('');

  // Lista de sugerencias (autocompletado) que devuelve /productos/search
  const [sugerencias, setSugerencias] = useState([]);

  // Producto seleccionado para editar (objeto)
  const [seleccionado, setSeleccionado] = useState(null);

  // Campos del formulario de edición
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');

  // Mensajes para UI
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  // Loading para guardar cambios
  const [loading, setLoading] = useState(false);

  // =========================
  // TABLA GENERAL
  // =========================

  // Todos los productos de la BD (tabla)
  const [productos, setProductos] = useState([]);

  // Loading para cargar/refrescar tabla
  const [loadingTabla, setLoadingTabla] = useState(false);

  // Orden de la tabla
  const [sortKey, setSortKey] = useState('nombre'); // 'nombre' | 'codigo_barra' | 'id'
  const [sortDir, setSortDir] = useState('asc');    // 'asc' | 'desc'

  // Paginación simple
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // =========================
  // CARGA INICIAL DE TABLA
  // =========================
  useEffect(() => {
    // Función async dentro del effect para poder usar await
    const load = async () => {
      try {
        setError(null);
        setLoadingTabla(true);

        // Traemos todos los productos
        const data = await getProductos();

        // Guardamos el resultado en estado
        setProductos(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingTabla(false);
      }
    };

    load();
  }, []);

  // Botón para refrescar tabla sin recargar la página
  const refrescarTabla = async () => {
    try {
      setError(null);
      setLoadingTabla(true);
      const data = await getProductos();
      setProductos(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTabla(false);
    }
  };

  // =========================
  // BUSCAR MIENTRAS ESCRIBE
  // =========================
  const handleChangeQuery = async (e) => {
    const value = e.target.value;        // leemos lo que escribió
    setQuery(value);                      // actualizamos el input
    setMensaje(null);                     // limpiamos mensaje
    setError(null);                       // limpiamos error

    // Si hay menos de 2 caracteres, no buscamos
    if (!value || value.trim().length < 2) {
      setSugerencias([]);                 // borramos sugerencias
      return;
    }

    try {
      // Llamamos al endpoint /productos/search
      const results = await searchProductos(value);

      // Guardamos sugerencias en estado
      setSugerencias(results || []);
    } catch (err) {
      setError(err.message);
      setSugerencias([]);
    }
  };

  // Enter (útil para lector USB) -> busca y si hay 1 resultado lo selecciona
  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // Si está vacío, no hacemos nada
      if (!query.trim()) return;

      try {
        const results = await searchProductos(query);
        setSugerencias(results || []);

        // Si hay un solo resultado, lo seleccionamos
        if (results && results.length === 1) {
          seleccionarProducto(results[0]);
        }
      } catch (err) {
        setError(err.message);
      }
    }
  };

  // =========================
  // SELECCIONAR PRODUCTO
  // =========================
  const seleccionarProducto = (prod) => {
    setSeleccionado(prod);                       // guardamos el producto seleccionado
    setNuevoNombre(prod.nombre || '');           // precargamos nombre
    setNuevaDescripcion(prod.descripcion || ''); // precargamos descripción
    setMensaje(null);
    setError(null);
  };

  // =========================
  // GUARDAR CAMBIOS (UPDATE)
  // =========================
  const handleGuardar = async () => {
    if (!seleccionado) return;

    // Validación simple
    if (!nuevoNombre.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }

    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      // Llamamos PUT /productos/by-codigo/:codigoBarra
      const actualizado = await updateProductoNombre(
        seleccionado.codigo_barra,
        nuevoNombre.trim(),
        nuevaDescripcion.trim()
      );

      // Actualizamos el seleccionado
      setSeleccionado(actualizado);

      // Mensaje OK
      setMensaje('Producto actualizado correctamente.');

      // Actualizamos sugerencias (si estaban visibles)
      setSugerencias((prev) =>
        prev.map((p) =>
          p.codigo_barra === actualizado.codigo_barra ? actualizado : p
        )
      );

      // Actualizamos la tabla general
      setProductos((prev) =>
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

  // =========================
  // ORDENAR TABLA
  // =========================
  const toggleSort = (key) => {
    // Si clickean la misma columna, invertimos asc/desc
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      // Si es otra columna, cambiamos key y volvemos asc
      setSortKey(key);
      setSortDir('asc');
    }

    // volvemos a la página 1 para evitar “página vacía”
    setPage(1);
  };

  // Productos ordenados (memo para no recalcular todo siempre)
  const productosOrdenados = useMemo(() => {
    const arr = [...productos];

    arr.sort((a, b) => {
      const va = (a?.[sortKey] ?? '').toString().toLowerCase();
      const vb = (b?.[sortKey] ?? '').toString().toLowerCase();

      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return arr;
  }, [productos, sortKey, sortDir]);

  // Paginación: total de páginas
  const totalPages = Math.max(1, Math.ceil(productosOrdenados.length / pageSize));

  // Productos que se ven en la página actual
  const productosPagina = useMemo(() => {
    const start = (page - 1) * pageSize;
    return productosOrdenados.slice(start, start + pageSize);
  }, [productosOrdenados, page]);

  // =========================
  // RENDER
  // =========================
  return (
    <div className="page page-ingreso">
      <div className="page-ingreso-inner card">
        <h2>Admin de productos</h2>

        {/* Errores y mensajes */}
        {error && <div className="alert-error">{error}</div>}
        {mensaje && <div className="alert-info">{mensaje}</div>}

        {/* =========================
            BUSCADOR + SUGERENCIAS
        ========================== */}
        <div className="admin-search">
          <label htmlFor="admin-query">Buscar producto por código o nombre</label>

          <input
            id="admin-query"
            type="text"
            placeholder="Escaneá el código o escribí el nombre..."
            value={query}
            onChange={handleChangeQuery}
            onKeyDown={handleKeyDown}
          />

          <small>
            Si escaneás con lector, el código entra acá y al presionar Enter se buscan coincidencias.
          </small>

          {/* Lista de sugerencias */}
          {sugerencias.length > 0 && (
            <ul className="admin-suggestions">
              {sugerencias.map((prod) => (
                <li
                  key={prod.id}
                  onClick={() => seleccionarProducto(prod)}
                  className={
                    seleccionado && seleccionado.codigo_barra === prod.codigo_barra
                      ? 'admin-suggestion active'
                      : 'admin-suggestion'
                  }
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

        {/* =========================
            FORMULARIO DE EDICIÓN
        ========================== */}
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setSeleccionado(null)}>
                Cancelar
              </button>

              <button className="btn-primary" onClick={handleGuardar} disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {/* =========================
            TABLA GENERAL DE PRODUCTOS
        ========================== */}
        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0 }}>Todos los productos</h3>

            <button type="button" onClick={refrescarTabla} disabled={loadingTabla}>
              {loadingTabla ? 'Cargando...' : 'Refrescar'}
            </button>
          </div>

          <p style={{ color: '#9ca3af', marginTop: '8px' }}>
            Total: <strong>{productos.length}</strong>
          </p>

          <table className="table-venc" style={{ marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('codigo_barra')}>
                  Código {sortKey === 'codigo_barra' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('nombre')}>
                  Nombre {sortKey === 'nombre' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th>Descripción</th>

                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('id')}>
                  ID {sortKey === 'id' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th>Acción</th>
              </tr>
            </thead>

            <tbody>
              {productosPagina.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '12px', color: '#9ca3af' }}>
                    No hay productos para mostrar.
                  </td>
                </tr>
              ) : (
                productosPagina.map((p) => (
                  <tr key={p.id}>
                    <td>{p.codigo_barra}</td>
                    <td>{p.nombre}</td>
                    <td>{p.descripcion || '—'}</td>
                    <td>{p.id}</td>
                    <td>
                      <button type="button" onClick={() => seleccionarProducto(p)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Paginación */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <small style={{ color: '#9ca3af' }}>
              Página {page} de {totalPages}
            </small>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Anterior
              </button>

              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
