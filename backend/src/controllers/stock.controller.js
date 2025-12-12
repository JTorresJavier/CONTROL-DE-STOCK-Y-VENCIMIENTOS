// src/controllers/stock.controller.js
const pool = require('../db');

const registrarSalidaStock = async (req, res) => {
  const { codigoBarra, cantidad, origen, observacion } = req.body;

  const cantSolicitada = Number(cantidad);
  if (!codigoBarra || !cantSolicitada || cantSolicitada <= 0) {
    return res.status(400).json({ message: 'Datos inválidos para salida de stock' });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) Buscar producto por código de barras
    const [prodRows] = await conn.query(
      'SELECT id FROM productos WHERE codigo_barra = ?',
      [codigoBarra]
    );

    if (prodRows.length === 0) {
      throw new Error('Producto no encontrado para la salida de stock');
    }

    const productoId = prodRows[0].id;

    // 2) Obtener lotes activos ordenados por fecha de vencimiento (FEFO)
    const [lotes] = await conn.query(
      `
      SELECT id, cantidad
      FROM lotes
      WHERE producto_id = ? AND cantidad > 0
      ORDER BY fecha_vencimiento ASC
      `,
      [productoId]
    );

    if (lotes.length === 0) {
      throw new Error('No hay lotes con stock para este producto');
    }

    let restante = cantSolicitada;
    let totalDisponible = 0;

    for (const lote of lotes) {
      totalDisponible += Number(lote.cantidad) || 0;
    }

    if (totalDisponible < cantSolicitada) {
      throw new Error(`Stock insuficiente. Disponible: ${totalDisponible}, pedido: ${cantSolicitada}`);
    }

    // 3) Descontar lote por lote
    for (const lote of lotes) {
      if (restante <= 0) break;

      const stockLote = Number(lote.cantidad) || 0;
      if (stockLote <= 0) continue;

      const desc = Math.min(stockLote, restante); // cuánto le saco a este lote
      const nuevaCantidad = stockLote - desc;

      // Actualizar lote
      await conn.query(
        'UPDATE lotes SET cantidad = ? WHERE id = ?',
        [nuevaCantidad, lote.id]
      );

      // Registrar movimiento
      await conn.query(
        `
        INSERT INTO movimientos_stock
          (tipo, producto_id, lote_id, cantidad, origen, observacion)
        VALUES ('SALIDA', ?, ?, ?, ?, ?)
        `,
        [
          productoId,
          lote.id,
          desc,
          origen || 'DEPOSITO',
          observacion || 'Salida de stock desde app'
        ]
      );

      restante -= desc;
    }

    await conn.commit();
    res.json({ message: 'Stock descontado correctamente' });

  } catch (err) {
    await conn.rollback();
    console.error('Error al registrar salida de stock:', err);
    res.status(500).json({ message: err.message || 'Error al registrar salida de stock' });
  } finally {
    conn.release();
  }
};

module.exports = { registrarSalidaStock };
