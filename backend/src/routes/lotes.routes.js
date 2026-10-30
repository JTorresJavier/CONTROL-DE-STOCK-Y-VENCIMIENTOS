// src/routes/lotes.routes.js
const { Router } = require('express');
const {
  getLotes,
  getLotesVencimientos,
  getLotesVencidos,
  createLotesBatch,
  getLotesByProducto,
  updateLote,
  deleteLote
} = require('../controllers/lotes.controller');

const router = Router();

router.get('/', getLotes);
router.get('/vencimientos', getLotesVencimientos);
router.get('/vencidos', getLotesVencidos);
router.post('/batch', createLotesBatch);
router.get('/producto/:productoId', getLotesByProducto);
router.put('/:id', updateLote);
router.delete('/:id', deleteLote);

module.exports = router;