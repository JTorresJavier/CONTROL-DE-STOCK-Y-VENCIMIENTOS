// src/routes/lotes.routes.js

// Importamos Router de express
const { Router } = require('express');

// Importamos los controladores de lotes
const {
  getLotes,
  getLotesVencimientos,
  getLotesVencidos,
  createLotesBatch,
  getLotesByProducto
} = require('../controllers/lotes.controller');

// Creamos el router
const router = Router();

// GET /api/lotes
// Lista todos los lotes con info del producto
router.get('/', getLotes);

// GET /api/lotes/vencimientos?dias=30
// Lotes que vencen dentro de X días
router.get('/vencimientos', getLotesVencimientos);

// GET /api/lotes/vencidos
// Lotes que ya están vencidos
router.get('/vencidos', getLotesVencidos);

// POST /api/lotes/batch
// Guarda varios lotes a la vez (ingreso de mercadería)
router.post('/batch', createLotesBatch);

// NUEVA ruta para lotes de un producto
router.get('/lotes/producto/:productoId', getLotesByProducto);

// Exportamos el router
module.exports = router;
