// src/services/api.js

// Detectamos si estamos corriendo dentro de Electron (cargado como archivo)
// o en el navegador normal (dev con Vite o build servido desde web)
function getApiUrl() {
  // En Electron el protocolo es "file:" o la URL tiene electron en el user agent
  const isElectron =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      navigator.userAgent.toLowerCase().includes('electron'));

  if (isElectron) {
    // Dentro de Electron el backend Express corre en localhost:4000
    return 'http://localhost:4000/api';
  }

  // En navegador normal (dev o deploy web) usamos el hostname dinámico
  const API_HOST = window.location.hostname;
  return `http://${API_HOST}:4000/api`;
}

export const API_URL = getApiUrl();

// Función para manejar respuestas y errores
async function handleResponse(res) {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.message || 'Error en la petición';
    throw new Error(message);
  }
  return res.json().catch(() => ({}));
}

// Buscar producto por código de barras
export async function getProductoByCodigo(codigoBarra) {
  const res = await fetch(
    `${API_URL}/productos/by-codigo/${encodeURIComponent(codigoBarra)}`
  );
  return handleResponse(res);
}

// Crear un nuevo producto
export async function createProducto({ codigoBarra, nombre, descripcion }) {
  const res = await fetch(`${API_URL}/productos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigoBarra, nombre, descripcion })
  });
  return handleResponse(res);
}

// Guardar varios lotes en batch
export async function createLotesBatch(lotes) {
  const res = await fetch(`${API_URL}/lotes/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lotes })
  });
  return handleResponse(res);
}

// Obtener lotes por vencer en X días
export async function getLotesVencimientos(dias = 30) {
  const res = await fetch(`${API_URL}/lotes/vencimientos?dias=${dias}`);
  return handleResponse(res);
}

// Obtener TODOS los lotes (sin límite de días)
export async function getTodosLotes() {
  const res = await fetch(`${API_URL}/lotes`);
  return handleResponse(res);
}

// Buscar productos por texto (código o nombre)
export async function searchProductos(q) {
  if (!q || !q.trim()) return [];
  const res = await fetch(
    `${API_URL}/productos/search?q=${encodeURIComponent(q.trim())}`
  );
  return handleResponse(res);
}

// Actualizar nombre (y opcionalmente descripción) por código
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

// Lotes activos de un producto
export async function getLotesByProducto(productoId) {
  const res = await fetch(`${API_URL}/lotes/producto/${productoId}`);
  return handleResponse(res);
}

// Registrar salida de stock
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

// Obtener TODOS los productos
export async function getProductos() {
  const res = await fetch(`${API_URL}/productos`);
  return handleResponse(res);
}
