// src/controllers/lotes.controller.js
// Controlador que maneja toda la lógica de negocio relacionada a lotes
// Un lote es una unidad de stock con fecha de vencimiento y cantidad

const db = require('../db');

// ─── GET /api/lotes ───────────────────────────────────────────────────────────
// Devuelve TODOS los lotes de la base de datos, incluyendo info del producto
// Ordenados por fecha de vencimiento (los más próximos primero)
const getLotes = (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        l.id,
        l.producto_id,
        l.fecha_vencimiento,
        l.lote,
        l.cantidad,
        l.fecha_alta,
        p.nombre AS producto_nombre,
        p.codigo_barra
      FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      ORDER BY l.fecha_vencimiento ASC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener lotes:', err);
    res.status(500).json({ message: 'Error al obtener lotes' });
  }
};

// ─── GET /api/lotes/vencimientos ──────────────────────────────────────────────
// Devuelve todos los lotes con cantidad > 0 (lotes activos)
// Ordenados por fecha de vencimiento para ver cuáles vencen antes
const getLotesVencimientos = (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        l.id,
        l.producto_id,
        l.fecha_vencimiento,
        l.lote,
        l.cantidad,
        l.fecha_alta,
        p.nombre AS producto_nombre,
        p.codigo_barra
      FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      WHERE l.cantidad > 0
      ORDER BY l.fecha_vencimiento ASC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener vencimientos:', err);
    res.status(500).json({ message: 'Error al obtener vencimientos' });
  }
};

// ─── GET /api/lotes/vencidos ──────────────────────────────────────────────────
// Devuelve solo los lotes que ya están vencidos (fecha < hoy) y tienen stock
const getLotesVencidos = (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        l.id,
        l.producto_id,
        l.fecha_vencimiento,
        l.lote,
        l.cantidad,
        l.fecha_alta,
        p.nombre AS producto_nombre,
        p.codigo_barra
      FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      WHERE l.cantidad > 0
        AND l.fecha_vencimiento < date('now')
      ORDER BY l.fecha_vencimiento ASC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener vencidos:', err);
    res.status(500).json({ message: 'Error al obtener vencidos' });
  }
};

// ─── POST /api/lotes/batch ────────────────────────────────────────────────────
// Guarda varios lotes a la vez en una sola transacción
// Si alguno falla, no se guarda ninguno (todo o nada)
const createLotesBatch = (req, res) => {
  const { lotes } = req.body;

  // Validamos que venga un array con al menos un lote
  if (!Array.isArray(lotes) || lotes.length === 0) {
    return res.status(400).json({ message: 'Se requiere un array de lotes para guardar' });
  }

  try {
    // Preparamos el INSERT una sola vez para mayor eficiencia
    const insert = db.prepare(
      `INSERT INTO lotes (producto_id, lote, fecha_vencimiento, cantidad) VALUES (?, ?, ?, ?)`
    );

    // Usamos una transacción para que si falla uno, se revierta todo
    const insertMany = db.transaction((lotes) => {
      for (const lote of lotes) {
        const { productoId, fechaVencimiento, cantidad, lote: nroLote } = lote;

        // Validamos que cada lote tenga los campos obligatorios
        if (!productoId || !fechaVencimiento || !cantidad) {
          throw new Error('Datos de lote incompletos');
        }

        insert.run(productoId, nroLote || null, fechaVencimiento, cantidad);
      }
    });

    insertMany(lotes);
    res.status(201).json({ message: 'Lotes guardados correctamente' });
  } catch (err) {
    console.error('Error al crear lotes batch:', err);
    res.status(500).json({ message: 'Error al crear lotes batch' });
  }
};

// ─── GET /api/lotes/producto/:productoId ──────────────────────────────────────
// Devuelve los lotes activos de UN producto específico
// Ordenados por fecha de vencimiento (FEFO - primero vence, primero sale)
const getLotesByProducto = (req, res) => {
  try {
    const { productoId } = req.params;
    const rows = db.prepare(`
      SELECT
        l.id,
        l.producto_id,
        l.fecha_vencimiento,
        l.lote,
        l.cantidad,
        l.fecha_alta,
        p.nombre AS producto_nombre,
        p.codigo_barra
      FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      WHERE l.producto_id = ? AND l.cantidad > 0
      ORDER BY l.fecha_vencimiento ASC
    `).all(productoId);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener lotes por producto:', err);
    res.status(500).json({ message: 'Error al obtener lotes por producto' });
  }
};

// ─── PUT /api/lotes/:id ───────────────────────────────────────────────────────
// Edita un lote existente: cantidad y/o fecha de vencimiento
// Se usa desde la pestaña Vencimientos para corregir errores de carga
const updateLote = (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad, fecha_vencimiento, lote } = req.body;

    // Verificamos que el lote exista
    const existe = db.prepare('SELECT * FROM lotes WHERE id = ?').get(id);
    if (!existe) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }

    // Usamos los valores nuevos o mantenemos los actuales si no vienen
    const nuevaCantidad = cantidad !== undefined ? Number(cantidad) : existe.cantidad;
    const nuevaFecha = fecha_vencimiento || existe.fecha_vencimiento;
    const nuevoLote = lote !== undefined ? lote : existe.lote;

    // Validamos que la cantidad sea positiva
    if (nuevaCantidad < 0) {
      return res.status(400).json({ message: 'La cantidad no puede ser negativa' });
    }

    db.prepare(`
      UPDATE lotes
      SET cantidad = ?, fecha_vencimiento = ?, lote = ?
      WHERE id = ?
    `).run(nuevaCantidad, nuevaFecha, nuevoLote, id);

    // Devolvemos el lote actualizado
    const actualizado = db.prepare('SELECT * FROM lotes WHERE id = ?').get(id);
    res.json(actualizado);
  } catch (err) {
    console.error('Error al actualizar lote:', err);
    res.status(500).json({ message: 'Error al actualizar lote' });
  }
};

// ─── DELETE /api/lotes/:id ────────────────────────────────────────────────────
// Elimina un lote de la base de datos
// Se usa para borrar lotes cargados por error
const deleteLote = (req, res) => {
  try {
    const { id } = req.params;

    // Verificamos que el lote exista antes de borrar
    const existe = db.prepare('SELECT * FROM lotes WHERE id = ?').get(id);
    if (!existe) {
      return res.status(404).json({ message: 'Lote no encontrado' });
    }

    db.prepare('DELETE FROM lotes WHERE id = ?').run(id);
    res.json({ message: 'Lote eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar lote:', err);
    res.status(500).json({ message: 'Error al eliminar lote' });
  }
};

// Exportamos todos los controladores para usarlos en las rutas
module.exports = {
  getLotes,
  getLotesVencimientos,
  getLotesVencidos,
  createLotesBatch,
  getLotesByProducto,
  updateLote,
  deleteLote
};