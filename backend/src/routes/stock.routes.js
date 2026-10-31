// src/routes/stock.routes.js
// Salidas, movimientos, proveedores, importaciones, configuración y copias de seguridad.
const express = require('express');
const { manejar } = require('../utils/validar');
const stock = require('../controllers/stock.controller');
const prov = require('../controllers/proveedores.controller');
const imp = require('../controllers/importaciones.controller');
const sis = require('../controllers/sistema.controller');

const router = express.Router();

router.post('/stock/salida', manejar(stock.registrarSalidaStock));
router.get('/movimientos', manejar(stock.getMovimientos));

router.get('/proveedores', manejar(prov.getProveedores));
router.post('/proveedores', manejar(prov.createProveedor));
router.put('/proveedores/:id', manejar(prov.updateProveedor));
router.delete('/proveedores/:id', manejar(prov.deleteProveedor));

router.post('/importaciones/analizar', manejar(imp.analizar));
router.get('/importaciones', manejar(imp.listar));
router.post('/importaciones', manejar(imp.confirmar));
router.get('/importaciones/:id', manejar(imp.detalle));
router.post('/importaciones/:id/deshacer', manejar(imp.deshacer));

router.get('/resumen', manejar(sis.getResumen));
router.get('/config', manejar(sis.getConfig));
router.put('/config', manejar(sis.putConfig));
router.get('/info', manejar(sis.getInfo));
router.post('/demo', manejar(sis.cargarDemo));

router.get('/backup', manejar(sis.descargarBackup));
router.post('/backup/restaurar', express.raw({ type: () => true, limit: '500mb' }), manejar(sis.restaurarBackup));
router.get('/backup/automaticos', manejar(sis.listarAutomaticos));
router.post('/backup/automaticos', manejar(sis.crearRespaldo));
router.post('/backup/automaticos/restaurar', manejar(sis.restaurarAutomatico));

module.exports = router;
