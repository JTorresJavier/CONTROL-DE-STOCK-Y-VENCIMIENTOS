// src/controllers/stock.controller.js
const db = require('../db');

const registrarSalidaStock = (req, res) => {
  const { codigoBarra, cantidad, origen, observacion } = req.body;

  const cantSolicitada = Number(cantidad);
  if (!codigoBarra || !cantSolicitada || cantSolicitada <= 0) {
    return res.status(400).json({ message: 'Datos inválidos para salida de stock' });
  }

  try {
    // 1) Buscar producto
    const producto = db.prepare(
      'SELECT id FROM productos WHERE codigo_barra = ?'
    ).get(codigoBarra);

    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado para la salida de stock' });
    }

    const productoId = producto.id;

    // 2) Obtener lotes activos ordenados por FEFO
    const lotes = db.prepare(`
      SELECT id, cantidad
      FROM lotes
      WHERE producto_id = ? AND cantidad > 0
      ORDER BY fecha_vencimiento ASC, id ASC
    `).all(productoId);

    if (lotes.length === 0) {
      return res.status(400).json({ message: 'No hay lotes con stock para este producto' });
    }

    const totalDisponible = lotes.reduce((acc, l) => acc + Number(l.cantidad), 0);
    if (totalDisponible < cantSolicitada) {
      return res.status(400).json({
        message: `Stock insuficiente. Disponible: ${totalDisponible}, pedido: ${cantSolicitada}`
      });
    }

    // 3) Descontar lote por lote en una transacción
    const updateLote = db.prepare('UPDATE lotes SET cantidad = ? WHERE id = ?');
    const insertMovimiento = db.prepare(`
      INSERT INTO movimientos_stock (tipo, producto_id, lote_id, cantidad, origen, observacion)
      VALUES ('SALIDA', ?, ?, ?, ?, ?)
    `);

    const descontar = db.transaction((lotes, cantSolicitada) => {
      let restante = cantSolicitada;
      for (const lote of lotes) {
        if (restante <= 0) break;
        const stockLote = Number(lote.cantidad);
        const desc = Math.min(stockLote, restante);
        updateLote.run(stockLote - desc, lote.id);
        insertMovimiento.run(
          productoId,
          lote.id,
          desc,
          origen || 'DEPOSITO',
          observacion || 'Salida de stock desde app'
        );
        restante -= desc;
      }
    });

    descontar(lotes, cantSolicitada);

    res.json({ message: 'Stock descontado correctamente' });
  } catch (err) {
    console.error('Error al registrar salida de stock:', err);
    res.status(500).json({ message: err.message || 'Error al registrar salida de stock' });
  }
};

module.exports = { registrarSalidaStock };