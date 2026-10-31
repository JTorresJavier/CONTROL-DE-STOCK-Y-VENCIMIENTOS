// src/routes/productos.routes.js
const { Router } = require('express');
const c = require('../controllers/productos.controller');
const { manejar } = require('../utils/validar');

const router = Router();

router.get('/search', manejar(c.searchProductos));
router.get('/by-codigo/:codigoBarra', manejar(c.getProductoByCodigo));
router.put('/by-codigo/:codigoBarra', manejar(c.updateProductoByCodigo));
router.get('/', manejar(c.getProductos));
router.post('/', manejar(c.createProducto));
router.get('/:id', manejar(c.getProducto));
router.put('/:id', manejar(c.updateProducto));
router.delete('/:id', manejar(c.deleteProducto));

module.exports = router;
