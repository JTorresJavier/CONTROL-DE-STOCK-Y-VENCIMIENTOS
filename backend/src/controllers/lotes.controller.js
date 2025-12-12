// src/controllers/lotes.controller.js

const pool = require('../db');

// GET /api/lotes
const getLotes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        l.id,
        l.producto_id,
        l.fecha_vencimiento,
        l.cantidad,
        l.fecha_alta,
        p.nombre AS producto_nombre,
        p.codigo_barra
      FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      ORDER BY l.fecha_vencimiento ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error al obtener lotes:', err);
    res.status(500).json({ message: 'Error al obtener lotes' });
  }
};

// ✅ GET /api/lotes/vencimientos  -> ahora devuelve TODOS los lotes con cantidad > 0
const getLotesVencimientos = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        l.id,
        l.producto_id,
        l.fecha_vencimiento,
        l.cantidad,
        l.fecha_alta,
        p.nombre AS producto_nombre,
        p.codigo_barra
      FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      WHERE l.cantidad > 0
      ORDER BY l.fecha_vencimiento ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error al obtener vencimientos:', err);
    res.status(500).json({ message: 'Error al obtener vencimientos' });
  }
};

// GET /api/lotes/vencidos
const getLotesVencidos = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        l.id,
        l.producto_id,
        l.fecha_vencimiento,
        l.cantidad,
        l.fecha_alta,
        p.nombre AS producto_nombre,
        p.codigo_barra
      FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      WHERE l.cantidad > 0
        AND l.fecha_vencimiento < CURDATE()
      ORDER BY l.fecha_vencimiento ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error al obtener vencidos:', err);
    res.status(500).json({ message: 'Error al obtener vencidos' });
  }
};

// POST /api/lotes/batch
const createLotesBatch = async (req, res) => {
  const { lotes } = req.body;

  if (!Array.isArray(lotes) || lotes.length === 0) {
    return res
      .status(400)
      .json({ message: 'Se requiere un array de lotes para guardar' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const lote of lotes) {
      const { productoId, fechaVencimiento, cantidad } = lote;

      if (!productoId || !fechaVencimiento || !cantidad) {
        throw new Error('Datos de lote incompletos');
      }

      await conn.query(
        'INSERT INTO lotes (producto_id, fecha_vencimiento, cantidad) VALUES (?, ?, ?)',
        [productoId, fechaVencimiento, cantidad]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Lotes guardados correctamente' });
  } catch (err) {
    await conn.rollback();
    console.error('Error al crear lotes batch:', err);
    res.status(500).json({ message: 'Error al crear lotes batch' });
  } finally {
    conn.release();
  }
};

// GET /api/lotes/producto/:productoId
// Devuelve los lotes activos de UN producto, ordenados por fecha_vencimiento
const getLotesByProducto = async (req, res) => {
  try {
    const { productoId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        l.id,
        l.producto_id,
        l.fecha_vencimiento,
        l.cantidad,
        l.fecha_alta,
        p.nombre AS producto_nombre,
        p.codigo_barra
      FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      WHERE l.producto_id = ? AND l.cantidad > 0
      ORDER BY l.fecha_vencimiento ASC
      `,
      [productoId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error al obtener lotes por producto:', err);
    res.status(500).json({ message: 'Error al obtener lotes por producto' });
  }
};

module.exports = {
  getLotes,
  getLotesVencimientos,
  getLotesVencidos,
  createLotesBatch,
  getLotesByProducto
};
