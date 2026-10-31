// src/controllers/stock.controller.js
// Salidas de stock (FEFO) e historial de movimientos.
const db = require('../db');
const { error, entero, texto } = require('../utils/validar');
const { registrarMovimiento } = require('./lotes.controller');
const { esFechaISO } = require('../utils/fechas');

// POST /api/stock/salida  { codigoBarra | productoId, cantidad, origen?, observacion? }
// Descuenta primero de los lotes que vencen antes (FEFO).
const registrarSalidaStock = (req, res) => {
  const { codigoBarra, productoId, origen, observacion } = req.body || {};
  const cantSolicitada = entero(req.body?.cantidad, { min: 1 });

  const producto = productoId
    ? db.prepare('SELECT id, nombre FROM productos WHERE id = ?').get(Number(productoId))
    : db.prepare('SELECT id, nombre FROM productos WHERE codigo_barra = ? OR codigo_interno = ?').get(String(codigoBarra || ''), String(codigoBarra || ''));
  if (!producto) throw error(404, 'Producto no encontrado para la salida de stock');

  const resultado = db.transaction(() => {
    const lotes = db.prepare(`
      SELECT id, cantidad, fecha_vencimiento FROM lotes
      WHERE producto_id = ? AND cantidad > 0
      ORDER BY fecha_vencimiento ASC, id ASC
    `).all(producto.id);

    const disponible = lotes.reduce((acc, l) => acc + l.cantidad, 0);
    if (lotes.length === 0) throw error(400, 'No hay lotes con stock para este producto');
    if (disponible < cantSolicitada) throw error(400, `Stock insuficiente. Disponible: ${disponible}, pedido: ${cantSolicitada}`);

    const actualizar = db.prepare('UPDATE lotes SET cantidad = ? WHERE id = ?');
    const detalle = [];
    let restante = cantSolicitada;
    for (const lote of lotes) {
      if (restante <= 0) break;
      const desc = Math.min(lote.cantidad, restante);
      actualizar.run(lote.cantidad - desc, lote.id);
      registrarMovimiento({
        tipo: 'SALIDA',
        productoId: producto.id,
        loteId: lote.id,
        cantidad: -desc,
        origen: texto(origen, { max: 40 }) || 'DEPOSITO',
        observacion: texto(observacion, { max: 150 }) || 'Salida de stock',
      });
      detalle.push({ loteId: lote.id, fecha_vencimiento: lote.fecha_vencimiento, cantidad: desc });
      restante -= desc;
    }
    return { detalle, restante: disponible - cantSolicitada };
  })();

  res.json({ message: 'Stock descontado correctamente', ...resultado });
};

// GET /api/movimientos?desde=&hasta=&tipo=&q=&limite=
const getMovimientos = (req, res) => {
  const where = [];
  const params = [];
  if (esFechaISO(req.query.desde)) { where.push('m.fecha >= ?'); params.push(req.query.desde); }
  if (esFechaISO(req.query.hasta)) { where.push('m.fecha < date(?, \'+1 day\')'); params.push(req.query.hasta); }
  if (req.query.tipo) { where.push('m.tipo = ?'); params.push(String(req.query.tipo)); }
  const q = texto(req.query.q, { max: 100 });
  if (q) {
    where.push('(p.nombre LIKE ? OR p.codigo_barra LIKE ? OR m.observacion LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const limite = Math.min(Number(req.query.limite) || 500, 5000);
  const rows = db.prepare(`
    SELECT m.id, m.tipo, m.cantidad, m.origen, m.observacion, m.fecha, m.importacion_id, m.lote_id,
           m.producto_id, COALESCE(p.nombre, '(producto eliminado)') AS producto_nombre, p.codigo_barra,
           l.lote, l.fecha_vencimiento
    FROM movimientos_stock m
    LEFT JOIN productos p ON p.id = m.producto_id
    LEFT JOIN lotes l ON l.id = m.lote_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY m.fecha DESC, m.id DESC
    LIMIT ?
  `).all(...params, limite);
  res.json(rows);
};

module.exports = { registrarSalidaStock, getMovimientos };
