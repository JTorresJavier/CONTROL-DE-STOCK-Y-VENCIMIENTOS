// src/routes/stock.routes.js
const express = require('express');
const router = express.Router();
const { registrarSalidaStock } = require('../controllers/stock.controller');

// POST /api/stock/salida
router.post('/stock/salida', registrarSalidaStock);

module.exports = router;
