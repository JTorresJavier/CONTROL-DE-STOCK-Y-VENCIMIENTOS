// src/routes/productos.routes.js

// Importamos Router de express para definir rutas
const { Router } = require('express');
// Importamos los controladores relacionados a productos
const {
  getProductos,
  getProductoByCodigo,
  createProducto,
  searchProductos,
  updateProductoByCodigo
} = require('../controllers/productos.controller');

// Creamos un router
const router = Router();

// GET /api/productos/by-codigo/:codigoBarra
// Devuelve un producto por su código de barras
router.get('/search', searchProductos);
router.get('/by-codigo/:codigoBarra', getProductoByCodigo);
router.put('/by-codigo/:codigoBarra', updateProductoByCodigo);

// GET /api/productos
// Devuelve todos los productos
router.get('/', getProductos);

// POST /api/productos
// Crea un nuevo producto
router.post('/', createProducto);

// Exportamos el router para usarlo en server.js
module.exports = router;
