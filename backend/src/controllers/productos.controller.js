// src/controllers/productos.controller.js
const db = require('../db');

const getProductos = (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM productos ORDER BY nombre').all();
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).json({ message: 'Error al obtener productos' });
  }
};

const getProductoByCodigo = (req, res) => {
  try {
    const { codigoBarra } = req.params;
    const row = db.prepare('SELECT * FROM productos WHERE codigo_barra = ?').get(codigoBarra);
    if (!row) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(row);
  } catch (err) {
    console.error('Error al buscar producto:', err);
    res.status(500).json({ message: 'Error al buscar producto' });
  }
};

const createProducto = (req, res) => {
  try {
    const { codigoBarra, nombre, descripcion } = req.body;
    if (!codigoBarra || !nombre) {
      return res.status(400).json({ message: 'codigoBarra y nombre son obligatorios' });
    }

    const existe = db.prepare('SELECT id FROM productos WHERE codigo_barra = ?').get(codigoBarra);
    if (existe) {
      return res.status(409).json({ message: 'Ya existe un producto con ese código de barras' });
    }

    const result = db.prepare(
      'INSERT INTO productos (codigo_barra, nombre, descripcion) VALUES (?, ?, ?)'
    ).run(codigoBarra, nombre, descripcion || null);

    res.status(201).json({
      id: result.lastInsertRowid,
      codigo_barra: codigoBarra,
      nombre,
      descripcion: descripcion || null
    });
  } catch (err) {
    console.error('Error al crear producto:', err);
    res.status(500).json({ message: 'Error al crear producto' });
  }
};

const searchProductos = (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const like = `%${q}%`;
    const rows = db.prepare(`
      SELECT id, codigo_barra, nombre, descripcion
      FROM productos
      WHERE codigo_barra LIKE ? OR nombre LIKE ?
      ORDER BY nombre
      LIMIT 20
    `).all(like, like);

    res.json(rows);
  } catch (err) {
    console.error('Error al buscar productos:', err);
    res.status(500).json({ message: 'Error al buscar productos' });
  }
};

const updateProductoByCodigo = (req, res) => {
  try {
    const { codigoBarra } = req.params;
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es obligatorio para actualizar' });
    }

    const existe = db.prepare('SELECT * FROM productos WHERE codigo_barra = ?').get(codigoBarra);
    if (!existe) return res.status(404).json({ message: 'Producto no encontrado' });

    db.prepare(
      'UPDATE productos SET nombre = ?, descripcion = ? WHERE codigo_barra = ?'
    ).run(nombre, descripcion || null, codigoBarra);

    res.json({ ...existe, nombre, descripcion: descripcion || null });
  } catch (err) {
    console.error('Error al actualizar producto:', err);
    res.status(500).json({ message: 'Error al actualizar producto' });
  }
};

module.exports = {
  getProductos,
  getProductoByCodigo,
  createProducto,
  searchProductos,
  updateProductoByCodigo
};