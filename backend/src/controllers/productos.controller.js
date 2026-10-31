// src/controllers/productos.controller.js
// Productos: alta, edición, búsqueda, stock total y faltantes (stock por debajo del mínimo).
const db = require('../db');
const { error, entero, texto, idParam } = require('../utils/validar');

const SELECT_CON_STOCK = `
  SELECT
    p.id, p.codigo_barra, p.codigo_interno, p.nombre, p.descripcion, p.laboratorio,
    p.stock_minimo, p.proveedor_id, pr.nombre AS proveedor_nombre,
    COALESCE(SUM(l.cantidad), 0) AS stock,
    MIN(CASE WHEN l.cantidad > 0 THEN l.fecha_vencimiento END) AS proximo_vencimiento,
    COUNT(CASE WHEN l.cantidad > 0 THEN 1 END) AS lotes_activos
  FROM productos p
  LEFT JOIN lotes l ON l.producto_id = p.id
  LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
`;

function porId(id) {
  return db.prepare(`${SELECT_CON_STOCK} WHERE p.id = ? GROUP BY p.id`).get(id);
}

// Escapa % y _ para que se busquen como texto en LIKE
const likeSeguro = (q) => `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;

// GET /api/productos?q=&faltantes=1
const getProductos = (req, res) => {
  const q = texto(req.query.q, { max: 100 });
  const where = [];
  const params = [];
  if (q) {
    where.push("(p.nombre LIKE ? ESCAPE '\\' OR p.codigo_barra LIKE ? ESCAPE '\\' OR p.codigo_interno LIKE ? ESCAPE '\\')");
    params.push(likeSeguro(q), likeSeguro(q), likeSeguro(q));
  }
  let sql = `${SELECT_CON_STOCK} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} GROUP BY p.id`;
  if (req.query.faltantes === '1') sql += ' HAVING p.stock_minimo > 0 AND stock < p.stock_minimo';
  sql += ' ORDER BY p.nombre COLLATE NOCASE';
  res.json(db.prepare(sql).all(...params));
};

// GET /api/productos/by-codigo/:codigoBarra (también acepta el código interno)
const getProductoByCodigo = (req, res) => {
  const codigo = String(req.params.codigoBarra || '').trim();
  const row = db.prepare('SELECT id FROM productos WHERE codigo_barra = ? OR (codigo_interno IS NOT NULL AND codigo_interno = ?) ORDER BY codigo_barra = ? DESC LIMIT 1').get(codigo, codigo, codigo);
  if (!row) throw error(404, 'Producto no encontrado');
  res.json(porId(row.id));
};

// GET /api/productos/:id
const getProducto = (req, res) => {
  const p = porId(idParam(req.params.id));
  if (!p) throw error(404, 'Producto no encontrado');
  res.json(p);
};

function datosProducto(body, actual = {}) {
  return {
    nombre: texto(body.nombre ?? actual.nombre, { max: 150, requerido: true, campo: 'el nombre' }),
    descripcion: texto(body.descripcion !== undefined ? body.descripcion : actual.descripcion, { max: 300 }),
    codigo_interno: texto(body.codigoInterno !== undefined ? body.codigoInterno : actual.codigo_interno, { max: 40 }),
    laboratorio: texto(body.laboratorio !== undefined ? body.laboratorio : actual.laboratorio, { max: 80 }),
    stock_minimo: body.stockMinimo !== undefined && body.stockMinimo !== '' ? entero(body.stockMinimo, { campo: 'stock mínimo' }) : actual.stock_minimo ?? 0,
    proveedor_id: body.proveedorId !== undefined ? (body.proveedorId ? idParam(body.proveedorId) : null) : actual.proveedor_id ?? null,
  };
}

// Código para productos que llegan sin código de barras
function codigoGenerado(id) {
  return `INT-${String(id).padStart(6, '0')}`;
}

function crearProductoInterno(datos, codigoBarra) {
  const codigo = texto(codigoBarra, { max: 40 });
  if (codigo && db.prepare('SELECT 1 FROM productos WHERE codigo_barra = ?').get(codigo)) {
    throw error(409, `Ya existe un producto con el código ${codigo}.`);
  }
  const temporal = codigo || `TMP-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const r = db.prepare(`
    INSERT INTO productos (codigo_barra, nombre, descripcion, codigo_interno, laboratorio, stock_minimo, proveedor_id, creado_por_importacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(temporal, datos.nombre, datos.descripcion, datos.codigo_interno, datos.laboratorio, datos.stock_minimo, datos.proveedor_id, datos.creado_por_importacion ?? null);
  const id = Number(r.lastInsertRowid);
  if (!codigo) db.prepare('UPDATE productos SET codigo_barra = ? WHERE id = ?').run(codigoGenerado(id), id);
  return id;
}

// POST /api/productos  { codigoBarra?, nombre, descripcion?, codigoInterno?, stockMinimo?, proveedorId?, laboratorio? }
const createProducto = (req, res) => {
  const datos = datosProducto(req.body || {});
  const id = db.transaction(() => crearProductoInterno(datos, req.body?.codigoBarra))();
  res.status(201).json(porId(id));
};

// PUT /api/productos/:id
const updateProducto = (req, res) => {
  const id = idParam(req.params.id);
  const actual = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!actual) throw error(404, 'Producto no encontrado');
  const datos = datosProducto(req.body || {}, actual);
  const nuevoCodigo = texto(req.body?.codigoBarra, { max: 40 }) || actual.codigo_barra;
  if (nuevoCodigo !== actual.codigo_barra && db.prepare('SELECT 1 FROM productos WHERE codigo_barra = ? AND id <> ?').get(nuevoCodigo, id)) {
    throw error(409, `Ya existe otro producto con el código ${nuevoCodigo}.`);
  }
  db.prepare(`
    UPDATE productos SET codigo_barra = ?, nombre = ?, descripcion = ?, codigo_interno = ?, laboratorio = ?, stock_minimo = ?, proveedor_id = ?
    WHERE id = ?
  `).run(nuevoCodigo, datos.nombre, datos.descripcion, datos.codigo_interno, datos.laboratorio, datos.stock_minimo, datos.proveedor_id, id);
  res.json(porId(id));
};

// PUT /api/productos/by-codigo/:codigoBarra (compatibilidad con la pantalla de vencimientos)
const updateProductoByCodigo = (req, res) => {
  const p = db.prepare('SELECT id FROM productos WHERE codigo_barra = ?').get(req.params.codigoBarra);
  if (!p) throw error(404, 'Producto no encontrado');
  req.params.id = String(p.id);
  return updateProducto(req, res);
};

// DELETE /api/productos/:id (solo si no tiene stock)
const deleteProducto = (req, res) => {
  const id = idParam(req.params.id);
  const p = porId(id);
  if (!p) throw error(404, 'Producto no encontrado');
  if (p.stock > 0) throw error(409, `No se puede eliminar: todavía tiene ${p.stock} unidades en stock.`);
  db.transaction(() => {
    db.prepare('DELETE FROM lotes WHERE producto_id = ?').run(id);
    db.prepare('DELETE FROM producto_alias WHERE producto_id = ?').run(id);
    db.prepare('DELETE FROM productos WHERE id = ?').run(id);
  })();
  res.json({ message: 'Producto eliminado' });
};

// GET /api/productos/search?q=  (autocompletado rápido)
const searchProductos = (req, res) => {
  const q = texto(req.query.q, { max: 100 });
  if (!q) return res.json([]);
  const rows = db.prepare(`
    SELECT id, codigo_barra, codigo_interno, nombre, descripcion
    FROM productos
    WHERE codigo_barra LIKE ? ESCAPE '\\' OR nombre LIKE ? ESCAPE '\\' OR codigo_interno LIKE ? ESCAPE '\\'
    ORDER BY (codigo_barra = ?) DESC, (nombre LIKE ? ESCAPE '\\') DESC, nombre COLLATE NOCASE
    LIMIT 20
  `).all(likeSeguro(q), likeSeguro(q), likeSeguro(q), q, `${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
  res.json(rows);
};

module.exports = {
  getProductos,
  getProducto,
  getProductoByCodigo,
  createProducto,
  updateProducto,
  updateProductoByCodigo,
  deleteProducto,
  searchProductos,
  crearProductoInterno,
  porId,
};
