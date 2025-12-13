// src/services/api.js

// URL base de la API (backend Node)
//const API_URL = 'http://localhost:4000/api';
//const API_URL = 'http://192.168.1.36:4000/api'

const API_HOST = window.location.hostname;
export const API_URL = `http://${API_HOST}:4000/api`;

// Función para manejar respuestas y errores
async function handleResponse(res) {
  // Si la respuesta no es OK, tiramos error con el JSON devuelto
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.message || 'Error en la petición';
    throw new Error(message);
  }
  // Si tiene contenido, devolvemos JSON
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

// Lotes activos de un producto (para mostrar detalle al descontar)
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
