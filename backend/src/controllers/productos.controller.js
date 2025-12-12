// src/controllers/productos.controller.js

// Importamos el pool de conexiones a MySQL
const pool = require('../db');

// Controlador para GET /api/productos
const getProductos = async (req, res) => {
  try {
    // Hacemos un SELECT a la tabla productos
    const [rows] = await pool.query('SELECT * FROM productos ORDER BY nombre');
    // Respondemos con el array de productos
    res.json(rows);
  } catch (err) {
    // Si algo falla, lo logueamos en consola
    console.error('Error al obtener productos:', err);
    // Respondemos con error 500
    res.status(500).json({ message: 'Error al obtener productos' });
  }
};

// Controlador para GET /api/productos/by-codigo/:codigoBarra
const getProductoByCodigo = async (req, res) => {
  try {
    // Tomamos el código de barras desde los parámetros de ruta
    const { codigoBarra } = req.params;

    // Buscamos el producto con ese código
    const [rows] = await pool.query(
      'SELECT * FROM productos WHERE codigo_barra = ?',
      [codigoBarra]
    );

    // Si no hay resultados, devolvemos 404
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Si existe, devolvemos el primer producto
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al buscar producto por código:', err);
    res.status(500).json({ message: 'Error al buscar producto' });
  }
};

// Controlador para POST /api/productos
const createProducto = async (req, res) => {
  try {
    // Extraemos datos del body
    const { codigoBarra, nombre, descripcion } = req.body;

    // Validamos que existan los campos requeridos
    if (!codigoBarra || !nombre) {
      return res
        .status(400)
        .json({ message: 'codigoBarra y nombre son obligatorios' });
    }

    // Verificamos si ya hay un producto con ese código
    const [existe] = await pool.query(
      'SELECT id FROM productos WHERE codigo_barra = ?',
      [codigoBarra]
    );

    // Si ya existe, devolvemos 409 (conflict)
    if (existe.length > 0) {
      return res
        .status(409)
        .json({ message: 'Ya existe un producto con ese código de barras' });
    }

    // Insertamos el producto en la tabla
    const [result] = await pool.query(
      'INSERT INTO productos (codigo_barra, nombre, descripcion) VALUES (?, ?, ?)',
      [codigoBarra, nombre, descripcion || null]
    );

    // Armamos el objeto del nuevo producto para devolver
    const nuevoProducto = {
      id: result.insertId,
      codigo_barra: codigoBarra,
      nombre,
      descripcion: descripcion || null
    };

    // Respondemos con 201 (creado) y el producto
    res.status(201).json(nuevoProducto);
  } catch (err) {
    console.error('Error al crear producto:', err);
    res.status(500).json({ message: 'Error al crear producto' });
  }
};

// Buscar productos por texto (código o nombre)
const searchProductos = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    if (!q) {
      return res.json([]);
    }

    const like = `%${q}%`;

    const [rows] = await pool.query(
      `
      SELECT id, codigo_barra, nombre, descripcion
      FROM productos
      WHERE codigo_barra LIKE ? OR nombre LIKE ?
      ORDER BY nombre
      LIMIT 20
      `,
      [like, like]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error al buscar productos:', err);
    res.status(500).json({ message: 'Error al buscar productos' });
  }
};

// Actualizar nombre (y opcionalmente descripción) por código de barras
const updateProductoByCodigo = async (req, res) => {
  try {
    const { codigoBarra } = req.params;
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res
        .status(400)
        .json({ message: 'El nombre es obligatorio para actualizar' });
    }

    const [existe] = await pool.query(
      'SELECT id, codigo_barra, nombre, descripcion FROM productos WHERE codigo_barra = ?',
      [codigoBarra]
    );

    if (existe.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    await pool.query(
      'UPDATE productos SET nombre = ?, descripcion = ? WHERE codigo_barra = ?',
      [nombre, descripcion || null, codigoBarra]
    );

    const actualizado = {
      ...existe[0],
      nombre,
      descripcion: descripcion || null
    };

    res.json(actualizado);
  } catch (err) {
    console.error('Error al actualizar producto:', err);
    res.status(500).json({ message: 'Error al actualizar producto' });
  }
};

// Exportamos los controladores
module.exports = {
  getProductos,
  getProductoByCodigo,
  createProducto,
  searchProductos,
  updateProductoByCodigo
};
