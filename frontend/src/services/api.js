// src/services/api.js
// Todas las llamadas al backend (Express en el puerto 4000).

// ─── URL base de la API ───────────────────────────────────────────────────────
// - Servida por el propio backend (app de escritorio o celular en la red): misma dirección → "/api"
// - Abierta como archivo (file://): localhost:4000
// - Servidor de desarrollo de Vite (npm run dev): mismo equipo, puerto 4000
function getApiUrl() {
  if (typeof window === 'undefined') return '/api';
  const { protocol, hostname } = window.location;
  if (protocol === 'file:') return 'http://localhost:4000/api';
  if (import.meta.env.DEV) return `${protocol}//${hostname}:4000/api`;
  return '/api';
}

export const API_URL = getApiUrl();

async function request(ruta, { method = 'GET', body, headers, raw } = {}) {
  let res;
  try {
    res = await fetch(API_URL + ruta, {
      method,
      headers: raw ? headers : body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está abierta la aplicación en la PC?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Error en la petición');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return s ? `?${s}` : '';
};

// ─── Productos ────────────────────────────────────────────────────────────────
export const getProductos = (params) => request(`/productos${qs(params)}`);
export const getProducto = (id) => request(`/productos/${id}`);
export const getProductoByCodigo = (codigo) => request(`/productos/by-codigo/${encodeURIComponent(codigo)}`);
export const searchProductos = async (q) => (q && q.trim() ? request(`/productos/search${qs({ q: q.trim() })}`) : []);
export const createProducto = (datos) => request('/productos', { method: 'POST', body: datos });
export const updateProducto = (id, datos) => request(`/productos/${id}`, { method: 'PUT', body: datos });
export const deleteProducto = (id) => request(`/productos/${id}`, { method: 'DELETE' });
export const updateProductoNombre = (codigoBarra, nombre, descripcion) =>
  request(`/productos/by-codigo/${encodeURIComponent(codigoBarra)}`, { method: 'PUT', body: { nombre, descripcion } });

// ─── Lotes ────────────────────────────────────────────────────────────────────
export const createLotesBatch = (lotes) => request('/lotes/batch', { method: 'POST', body: { lotes } });
export const getLotesVencimientos = () => request('/lotes/vencimientos');
export const getTodosLotes = () => request('/lotes');
export const getLotesByProducto = (productoId) => request(`/lotes/producto/${productoId}`);
export const updateLote = (id, datos) => request(`/lotes/${id}`, { method: 'PUT', body: datos });
export const bajaLote = (id, motivo) => request(`/lotes/${id}/baja`, { method: 'POST', body: { motivo } });
export const deleteLote = (id) => request(`/lotes/${id}`, { method: 'DELETE' });

// ─── Stock y movimientos ──────────────────────────────────────────────────────
export const registrarSalidaStock = (datos) => request('/stock/salida', { method: 'POST', body: datos });
export const getMovimientos = (params) => request(`/movimientos${qs(params)}`);

// ─── Proveedores ──────────────────────────────────────────────────────────────
export const getProveedores = () => request('/proveedores');
export const createProveedor = (datos) => request('/proveedores', { method: 'POST', body: datos });
export const updateProveedor = (id, datos) => request(`/proveedores/${id}`, { method: 'PUT', body: datos });
export const deleteProveedor = (id) => request(`/proveedores/${id}`, { method: 'DELETE' });

// ─── Importación de remitos / facturas ────────────────────────────────────────
export const analizarDocumento = (contenido) => request('/importaciones/analizar', { method: 'POST', body: contenido });
export const confirmarImportacion = (datos) => request('/importaciones', { method: 'POST', body: datos });
export const getImportaciones = () => request('/importaciones');
export const getImportacion = (id) => request(`/importaciones/${id}`);
export const deshacerImportacion = (id) => request(`/importaciones/${id}/deshacer`, { method: 'POST' });

// ─── Sistema ──────────────────────────────────────────────────────────────────
export const getResumen = () => request('/resumen');
export const getConfig = () => request('/config');
export const guardarConfig = (datos) => request('/config', { method: 'PUT', body: datos });
export const getInfo = () => request('/info');
export const cargarDemo = () => request('/demo', { method: 'POST' });
export const getRespaldosAutomaticos = () => request('/backup/automaticos');
export const crearRespaldo = () => request('/backup/automaticos', { method: 'POST' });
export const restaurarAutomatico = (nombre) => request('/backup/automaticos/restaurar', { method: 'POST', body: { nombre } });
export const restaurarRespaldo = (archivo) =>
  request('/backup/restaurar', { method: 'POST', raw: true, body: archivo, headers: { 'Content-Type': 'application/octet-stream' } });
export const urlDescargaRespaldo = () => `${API_URL}/backup`;
