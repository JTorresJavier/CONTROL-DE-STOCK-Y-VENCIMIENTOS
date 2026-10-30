// src/routes/lotes.routes.js
const { Router } = require('express');
const c = require('../controllers/lotes.controller');
const { manejar } = require('../utils/validar');

const router = Router();

router.get('/', manejar(c.getLotes));
router.get('/vencimientos', manejar(c.getLotesVencimientos));
router.get('/vencidos', manejar(c.getLotesVencidos));
router.post('/batch', manejar(c.createLotesBatch));
router.get('/producto/:productoId', manejar(c.getLotesByProducto));
router.put('/:id', manejar(c.updateLote));
router.post('/:id/baja', manejar(c.bajaLote));
router.delete('/:id', manejar(c.deleteLote));

module.exports = router;
