// src/controllers/lotes.controller.js
// Lotes: cada ingreso de un producto con su vencimiento y cantidad.
// Todo cambio de cantidad queda registrado en movimientos_stock.

const db = require('../db');
const { error, entero, texto, idParam } = require('../utils/validar');
const { hoyISO, ahoraLocal, esFechaISO, parseFechaFlexible } = require('../utils/fechas');

const SELECT_LOTES = `
  SELECT
    l.id, l.producto_id, l.fecha_vencimiento, l.lote, l.cantidad, l.cantidad_inicial,
    l.fecha_alta, l.importacion_id,
    p.nombre AS producto_nombre, p.codigo_barra, p.codigo_interno
  FROM lotes l
  JOIN productos p ON p.id = l.producto_id
`;

const insertMovimiento = () => db.prepare(`
  INSERT INTO movimientos_stock (tipo, producto_id, lote_id, cantidad, origen, observacion, fecha, importacion_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

function registrarMovimiento({ tipo, productoId, loteId = null, cantidad, origen = null, observacion = null, importacionId = null }) {
  insertMovimiento().run(tipo, productoId, loteId, cantidad, origen, observacion, ahoraLocal(), importacionId);
}

// Acepta "2026-12-31", "31/12/2026", "12/26", "1226"...
function fechaVencimiento(valor) {
  const iso = esFechaISO(valor) ? valor : parseFechaFlexible(valor);
  if (!iso) throw error(400, 'Fecha de vencimiento inválida. Ejemplos: 12/26, 31/12/2026, 1226.');
  return iso;
}

// Crea un lote y su movimiento de ingreso (usar dentro de una transacción)
function crearLote({ productoId, cantidad, fechaVencimiento: fv, lote, importacionId = null, origen = 'INGRESO MANUAL', observacion = null }) {
  const r = db.prepare(`
    INSERT INTO lotes (producto_id, lote, fecha_vencimiento, cantidad, cantidad_inicial, fecha_alta, importacion_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(productoId, lote || null, fv, cantidad, cantidad, hoyISO(), importacionId);
  const loteId = Number(r.lastInsertRowid);
  registrarMovimiento({ tipo: 'INGRESO', productoId, loteId, cantidad, origen, observacion, importacionId });
  return loteId;
}

// GET /api/lotes
const getLotes = (req, res) => {
  res.json(db.prepare(`${SELECT_LOTES} ORDER BY l.fecha_vencimiento ASC`).all());
};

// GET /api/lotes/vencimientos  (lotes con stock)
const getLotesVencimientos = (req, res) => {
  res.json(db.prepare(`${SELECT_LOTES} WHERE l.cantidad > 0 ORDER BY l.fecha_vencimiento ASC, p.nombre`).all());
};

// GET /api/lotes/vencidos
const getLotesVencidos = (req, res) => {
  res.json(db.prepare(`${SELECT_LOTES} WHERE l.cantidad > 0 AND l.fecha_vencimiento < ? ORDER BY l.fecha_vencimiento ASC`).all(hoyISO()));
};

// POST /api/lotes/batch  { lotes: [{ productoId, fechaVencimiento, cantidad, lote? }] }
const createLotesBatch = (req, res) => {
  const { lotes } = req.body || {};
  if (!Array.isArray(lotes) || lotes.length === 0) throw error(400, 'Se requiere un array de lotes para guardar');
  if (lotes.length > 2000) throw error(400, 'Demasiados lotes en una sola carga (máximo 2000).');

  const existeProducto = db.prepare('SELECT 1 FROM productos WHERE id = ?');
  const datos = lotes.map((l, i) => {
    const productoId = idParam(l?.productoId);
    if (!existeProducto.get(productoId)) throw error(400, `Línea ${i + 1}: el producto no existe.`);
    return {
      productoId,
      cantidad: entero(l.cantidad, { min: 1, campo: `cantidad (línea ${i + 1})` }),
      fechaVencimiento: fechaVencimiento(l.fechaVencimiento),
      lote: texto(l.lote, { max: 40 }),
    };
  });

  const ids = db.transaction(() => datos.map((d) => crearLote(d)))();
  res.status(201).json({ message: 'Lotes guardados correctamente', ids });
};

// GET /api/lotes/producto/:productoId  (FEFO: primero vence, primero sale)
const getLotesByProducto = (req, res) => {
  const id = idParam(req.params.productoId);
  res.json(db.prepare(`${SELECT_LOTES} WHERE l.producto_id = ? AND l.cantidad > 0 ORDER BY l.fecha_vencimiento ASC, l.id ASC`).all(id));
};

// PUT /api/lotes/:id  { cantidad?, fecha_vencimiento?, lote?, motivo? }
const updateLote = (req, res) => {
  const id = idParam(req.params.id);
  const actual = db.prepare('SELECT * FROM lotes WHERE id = ?').get(id);
  if (!actual) throw error(404, 'Lote no encontrado');
  const body = req.body || {};

  const cantidad = body.cantidad !== undefined && body.cantidad !== '' ? entero(body.cantidad) : actual.cantidad;
  const fv = body.fecha_vencimiento ? fechaVencimiento(body.fecha_vencimiento) : actual.fecha_vencimiento;
  const lote = body.lote !== undefined ? texto(body.lote, { max: 40 }) : actual.lote;
  const motivo = texto(body.motivo, { max: 150 });

  db.transaction(() => {
    db.prepare('UPDATE lotes SET cantidad = ?, fecha_vencimiento = ?, lote = ? WHERE id = ?').run(cantidad, fv, lote, id);
    const diferencia = cantidad - actual.cantidad;
    if (diferencia !== 0) {
      registrarMovimiento({
        tipo: diferencia < 0 && body.tipo === 'SALIDA' ? 'SALIDA' : 'AJUSTE',
        productoId: actual.producto_id,
        loteId: id,
        cantidad: diferencia,
        origen: 'VENCIMIENTOS',
        observacion: motivo || (diferencia < 0 ? 'Descuento manual' : 'Corrección de cantidad'),
      });
    }
  })();

  res.json(db.prepare(`${SELECT_LOTES} WHERE l.id = ?`).get(id));
};

// POST /api/lotes/:id/baja  { motivo? }  Descarta el stock de un lote (vencido, roto, etc.)
const bajaLote = (req, res) => {
  const id = idParam(req.params.id);
  const actual = db.prepare('SELECT * FROM lotes WHERE id = ?').get(id);
  if (!actual) throw error(404, 'Lote no encontrado');
  if (actual.cantidad <= 0) throw error(400, 'El lote ya no tiene stock.');
  db.transaction(() => {
    db.prepare('UPDATE lotes SET cantidad = 0 WHERE id = ?').run(id);
    registrarMovimiento({
      tipo: 'BAJA',
      productoId: actual.producto_id,
      loteId: id,
      cantidad: -actual.cantidad,
      origen: 'VENCIMIENTOS',
      observacion: texto(req.body?.motivo, { max: 150 }) || (actual.fecha_vencimiento < hoyISO() ? 'Baja por vencimiento' : 'Baja de stock'),
    });
  })();
  res.json({ message: `Se dieron de baja ${actual.cantidad} unidades` });
};

// DELETE /api/lotes/:id  (para lotes cargados por error)
const deleteLote = (req, res) => {
  const id = idParam(req.params.id);
  const actual = db.prepare('SELECT * FROM lotes WHERE id = ?').get(id);
  if (!actual) throw error(404, 'Lote no encontrado');
  db.transaction(() => {
    if (actual.cantidad > 0) {
      registrarMovimiento({
        tipo: 'AJUSTE',
        productoId: actual.producto_id,
        loteId: id,
        cantidad: -actual.cantidad,
        origen: 'VENCIMIENTOS',
        observacion: 'Lote eliminado (carga por error)',
      });
    }
    db.prepare('DELETE FROM lotes WHERE id = ?').run(id);
  })();
  res.json({ message: 'Lote eliminado correctamente' });
};

module.exports = {
  getLotes,
  getLotesVencimientos,
  getLotesVencidos,
  createLotesBatch,
  getLotesByProducto,
  updateLote,
  bajaLote,
  deleteLote,
  crearLote,
  registrarMovimiento,
  fechaVencimiento,
};
