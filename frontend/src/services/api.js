// src/services/api.js
// Archivo central que maneja todas las llamadas al backend (Express en puerto 4000)
// Detecta si está corriendo dentro de Electron o en navegador normal

// ─── URL base de la API ───────────────────────────────────────────────────────
function getApiUrl() {
  // En Electron la página se carga como archivo local (file://)
  // En navegador normal usamos el hostname dinámico
  const isElectron =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      navigator.userAgent.toLowerCase().includes('electron'));

  if (isElectron) {
    return 'http://localhost:4000/api';
  }

  const API_HOST = window.location.hostname;
  return `http://${API_HOST}:4000/api`;
}

export const API_URL = getApiUrl();

// ─── Helper para manejar respuestas ──────────────────────────────────────────
// Si la respuesta no es OK, lanza un error con el mensaje del backend
async function handleResponse(res) {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.message || 'Error en la petición';
    throw new Error(message);
  }
  return res.json().catch(() => ({}));
}

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

// Buscar producto por código de barras (usado al escanear)
export async function getProductoByCodigo(codigoBarra) {
  const res = await fetch(
    `${API_URL}/productos/by-codigo/${encodeURIComponent(codigoBarra)}`
  );
  return handleResponse(res);
}

// Crear un nuevo producto (cuando se escanea uno que no existe)
export async function createProducto({ codigoBarra, nombre, descripcion }) {
  const res = await fetch(`${API_URL}/productos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigoBarra, nombre, descripcion })
  });
  return handleResponse(res);
}

// Buscar productos por texto (código o nombre) para el autocompletado
export async function searchProductos(q) {
  if (!q || !q.trim()) return [];
  const res = await fetch(
    `${API_URL}/productos/search?q=${encodeURIComponent(q.trim())}`
  );
  return handleResponse(res);
}

// Actualizar nombre y descripción de un producto por código de barras
export async function updateProductoNombre(codigoBarra, nombre, descripcion) {
  const res = await fetch(
    `${API_URL}/productos/by-codigo/${encodeURIComponent(codigoBarra)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    }
  );
  return handleResponse(res);
}

// Obtener todos los productos (para la tabla de admin)
export async function getProductos() {
  const res = await fetch(`${API_URL}/productos`);
  return handleResponse(res);
}

// ─── LOTES ────────────────────────────────────────────────────────────────────

// Guardar varios lotes a la vez (al terminar el ingreso de mercadería)
export async function createLotesBatch(lotes) {
  const res = await fetch(`${API_URL}/lotes/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lotes })
  });
  return handleResponse(res);
}

// Obtener todos los lotes activos con info de vencimiento
export async function getLotesVencimientos() {
  const res = await fetch(`${API_URL}/lotes/vencimientos`);
  return handleResponse(res);
}

// Obtener todos los lotes (sin filtro de cantidad)
export async function getTodosLotes() {
  const res = await fetch(`${API_URL}/lotes`);
  return handleResponse(res);
}

// Obtener lotes activos de un producto específico
export async function getLotesByProducto(productoId) {
  const res = await fetch(`${API_URL}/lotes/producto/${productoId}`);
  return handleResponse(res);
}

// Editar cantidad, fecha de vencimiento o número de lote
export async function updateLote(id, datos) {
  const res = await fetch(`${API_URL}/lotes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  return handleResponse(res);
}

// Eliminar un lote por ID (para corregir errores de carga)
export async function deleteLote(id) {
  const res = await fetch(`${API_URL}/lotes/${id}`, {
    method: 'DELETE'
  });
  return handleResponse(res);
}

// ─── STOCK ────────────────────────────────────────────────────────────────────

// Registrar salida de stock usando lógica FEFO (primero vence, primero sale)
export async function registrarSalidaStock({
  codigoBarra,
  cantidad,
  origen,
  observacion
}) {
  const res = await fetch(`${API_URL}/stock/salida`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigoBarra, cantidad, origen, observacion })
  });
  return handleResponse(res);
}