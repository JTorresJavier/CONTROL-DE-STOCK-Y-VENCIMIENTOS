// src/controllers/importaciones.controller.js
// Importación de remitos y facturas:
//   1) POST /analizar  → lee el documento y propone qué producto es cada línea (no guarda nada)
//   2) POST /          → confirma: crea productos nuevos, carga lotes con vencimiento y registra la importación
//   3) POST /:id/deshacer → revierte una importación si su stock no se tocó
const db = require('../db');
const { error, entero, texto, idParam } = require('../utils/validar');
const { parsearTexto, parsearFilas } = require('../import/parser');
const { emparejar } = require('../import/matcher');
const { normalizar } = require('../import/normalizar');
const { ahoraLocal, esFechaISO } = require('../utils/fechas');
const { crearLote, registrarMovimiento, fechaVencimiento } = require('./lotes.controller');
const { crearProductoInterno } = require('./productos.controller');
const { obtenerOCrear } = require('./proveedores.controller');

function buscarDuplicado(numero, proveedor) {
  if (!numero) return null;
  return db.prepare(`
    SELECT id, fecha, numero, proveedor_nombre FROM importaciones
    WHERE estado = 'CONFIRMADA' AND REPLACE(numero, ' ', '') = ?
      AND (? IS NULL OR proveedor_nombre IS NULL OR proveedor_nombre = ? COLLATE NOCASE)
    ORDER BY id DESC LIMIT 1
  `).get(String(numero).replace(/\s/g, ''), proveedor || null, proveedor || null) || null;
}

// POST /api/importaciones/analizar  { texto?, filas?, archivo? }
const analizar = (req, res) => {
  const { texto: contenido, filas } = req.body || {};
  if (!contenido && !Array.isArray(filas)) throw error(400, 'No se recibió contenido para analizar.');
  if (contenido && String(contenido).length > 2_000_000) throw error(400, 'El documento es demasiado grande.');

  const leido = Array.isArray(filas) && filas.length ? parsearFilas(filas.slice(0, 20000)) : parsearTexto(contenido);
  const lineas = emparejar(db, leido.lineas.slice(0, 2000));

  // Si el proveedor ya existe con un nombre parecido, usamos el guardado
  let proveedor = leido.proveedor;
  if (proveedor) {
    const norm = normalizar(proveedor);
    const existente = db.prepare('SELECT nombre FROM proveedores').all().find((p) => normalizar(p.nombre) === norm);
    if (existente) proveedor = existente.nombre;
  }

  res.json({
    documento: {
      tipoDocumento: leido.tipoDocumento,
      numero: leido.numero,
      fechaDocumento: leido.fechaDocumento,
      proveedor,
    },
    duplicado: buscarDuplicado(leido.numero, proveedor),
    lineas,
    resumen: {
      total: lineas.length,
      existentes: lineas.filter((l) => l.estado === 'existe').length,
      sugeridos: lineas.filter((l) => l.estado === 'sugerido').length,
      nuevos: lineas.filter((l) => l.estado === 'nuevo').length,
      sinVencimiento: lineas.filter((l) => !l.vencimiento).length,
    },
  });
};

// POST /api/importaciones
// { archivo, tipoDocumento, numero, fechaDocumento, proveedor, forzar?,
//   lineas: [{ productoId? , nuevo?: { nombre, codigoBarra?, codigoInterno?, laboratorio? }, cantidad, vencimiento, lote?, descripcionOriginal? }] }
const confirmar = (req, res) => {
  const body = req.body || {};
  const lineasIn = Array.isArray(body.lineas) ? body.lineas : [];
  if (!lineasIn.length) throw error(400, 'No hay líneas para importar.');
  if (lineasIn.length > 2000) throw error(400, 'Demasiadas líneas (máximo 2000).');

  const proveedorNombre = texto(body.proveedor, { max: 80 });
  const numero = texto(body.numero, { max: 40 });
  const duplicado = buscarDuplicado(numero, proveedorNombre);
  if (duplicado && !body.forzar) {
    throw error(409, `Este documento (${duplicado.numero}) ya se importó el ${duplicado.fecha.slice(0, 10)}.`, { duplicado });
  }

  // Validamos todo antes de tocar la base
  const existeProducto = db.prepare('SELECT 1 FROM productos WHERE id = ?');
  const lineas = lineasIn.map((l, i) => {
    const n = i + 1;
    if (!l || typeof l !== 'object') throw error(400, `Línea ${n}: datos inválidos.`);
    const cantidad = entero(l?.cantidad, { min: 1, campo: `cantidad (línea ${n})` });
    let vencimiento;
    try { vencimiento = fechaVencimiento(l.vencimiento); } catch { throw error(400, `Línea ${n}: falta la fecha de vencimiento o no es válida.`); }
    const lote = texto(l.lote, { max: 40 });
    if (l.productoId) {
      const productoId = idParam(l.productoId);
      if (!existeProducto.get(productoId)) throw error(400, `Línea ${n}: el producto elegido ya no existe.`);
      return { productoId, cantidad, vencimiento, lote, descripcionOriginal: texto(l.descripcionOriginal, { max: 200 }) };
    }
    const nombre = texto(l.nuevo?.nombre, { max: 150 });
    if (!nombre) throw error(400, `Línea ${n}: falta el nombre del producto nuevo.`);
    return {
      nuevo: {
        nombre,
        codigoBarra: texto(l.nuevo.codigoBarra, { max: 40 }),
        codigoInterno: texto(l.nuevo.codigoInterno, { max: 40 }),
        laboratorio: texto(l.nuevo.laboratorio, { max: 80 }),
      },
      cantidad, vencimiento, lote,
      descripcionOriginal: texto(l.descripcionOriginal, { max: 200 }),
    };
  });

  const resultado = db.transaction(() => {
    const proveedorId = obtenerOCrear(proveedorNombre);
    const fechaDoc = esFechaISO(body.fechaDocumento) ? body.fechaDocumento : null;
    const imp = db.prepare(`
      INSERT INTO importaciones (fecha, archivo, tipo_documento, numero, fecha_documento, proveedor_id, proveedor_nombre)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ahoraLocal(), texto(body.archivo, { max: 200 }), texto(body.tipoDocumento, { max: 30 }), numero, fechaDoc, proveedorId, proveedorNombre);
    const importacionId = Number(imp.lastInsertRowid);

    const porCodigo = db.prepare('SELECT id FROM productos WHERE codigo_barra = ?');
    const guardarAlias = db.prepare('INSERT INTO producto_alias (producto_id, texto_normalizado) VALUES (?, ?) ON CONFLICT(texto_normalizado) DO UPDATE SET producto_id = excluded.producto_id');
    const asignarProveedor = db.prepare('UPDATE productos SET proveedor_id = COALESCE(proveedor_id, ?) WHERE id = ?');
    const creados = new Map(); // mismo producto nuevo repetido en el documento → se crea una sola vez
    let productosNuevos = 0;
    let unidades = 0;

    for (const l of lineas) {
      let productoId = l.productoId;
      if (!productoId) {
        const clave = l.nuevo.codigoBarra || `nombre:${normalizar(l.nuevo.nombre)}`;
        productoId = creados.get(clave);
        if (!productoId && l.nuevo.codigoBarra) productoId = porCodigo.get(l.nuevo.codigoBarra)?.id;
        if (!productoId) {
          productoId = crearProductoInterno({
            nombre: l.nuevo.nombre,
            descripcion: null,
            codigo_interno: l.nuevo.codigoInterno,
            laboratorio: l.nuevo.laboratorio,
            stock_minimo: 0,
            proveedor_id: proveedorId,
            creado_por_importacion: importacionId,
          }, l.nuevo.codigoBarra);
          productosNuevos++;
        }
        creados.set(clave, productoId);
      }
      if (proveedorId) asignarProveedor.run(proveedorId, productoId);

      // Recordamos cómo llama este proveedor al producto para reconocerlo la próxima vez
      const alias = normalizar(l.descripcionOriginal);
      if (alias && alias.length >= 4) guardarAlias.run(productoId, alias);

      crearLote({
        productoId,
        cantidad: l.cantidad,
        fechaVencimiento: l.vencimiento,
        lote: l.lote,
        importacionId,
        origen: 'IMPORTACION',
        observacion: [texto(body.tipoDocumento, { max: 30 }) || 'Documento', numero, proveedorNombre].filter(Boolean).join(' · '),
      });
      unidades += l.cantidad;
    }

    db.prepare('UPDATE importaciones SET total_lineas = ?, total_unidades = ?, productos_nuevos = ? WHERE id = ?')
      .run(lineas.length, unidades, productosNuevos, importacionId);
    return { importacionId, lineas: lineas.length, unidades, productosNuevos };
  })();

  res.status(201).json({ message: 'Importación guardada', ...resultado });
};

// GET /api/importaciones
const listar = (req, res) => {
  res.json(db.prepare(`
    SELECT i.*,
      (SELECT COUNT(*) FROM lotes l WHERE l.importacion_id = i.id AND l.cantidad <> l.cantidad_inicial) AS lotes_modificados
    FROM importaciones i
    ORDER BY i.id DESC
    LIMIT 500
  `).all());
};

// GET /api/importaciones/:id
const detalle = (req, res) => {
  const id = idParam(req.params.id);
  const imp = db.prepare('SELECT * FROM importaciones WHERE id = ?').get(id);
  if (!imp) throw error(404, 'Importación no encontrada');
  const lotes = db.prepare(`
    SELECT l.*, p.nombre AS producto_nombre, p.codigo_barra, (p.creado_por_importacion = ?) AS producto_nuevo
    FROM lotes l JOIN productos p ON p.id = l.producto_id
    WHERE l.importacion_id = ? ORDER BY l.id
  `).all(id, id);
  const movimientos = imp.estado === 'DESHECHA'
    ? db.prepare(`
        SELECT m.*, COALESCE(p.nombre, '(producto eliminado)') AS producto_nombre
        FROM movimientos_stock m LEFT JOIN productos p ON p.id = m.producto_id
        WHERE m.importacion_id = ? AND m.tipo = 'INGRESO' ORDER BY m.id
      `).all(id)
    : [];
  res.json({ ...imp, lotes, movimientos });
};

// POST /api/importaciones/:id/deshacer
const deshacer = (req, res) => {
  const id = idParam(req.params.id);
  const imp = db.prepare('SELECT * FROM importaciones WHERE id = ?').get(id);
  if (!imp) throw error(404, 'Importación no encontrada');
  if (imp.estado !== 'CONFIRMADA') throw error(400, 'Esta importación ya fue deshecha.');

  const lotes = db.prepare(`
    SELECT l.*, p.nombre AS producto_nombre FROM lotes l JOIN productos p ON p.id = l.producto_id WHERE l.importacion_id = ?
  `).all(id);
  const tocados = lotes.filter((l) => l.cantidad !== l.cantidad_inicial);
  if (tocados.length) {
    throw error(409, `No se puede deshacer: ${tocados.length} lote(s) ya tuvieron movimientos (${tocados.slice(0, 3).map((l) => l.producto_nombre).join(', ')}${tocados.length > 3 ? '…' : ''}). Corregilos desde Vencimientos.`);
  }

  const resultado = db.transaction(() => {
    for (const l of lotes) {
      registrarMovimiento({
        tipo: 'ANULACION',
        productoId: l.producto_id,
        loteId: l.id,
        cantidad: -l.cantidad,
        origen: 'IMPORTACION',
        observacion: `Se deshizo la importación #${id}`,
        importacionId: id,
      });
      db.prepare('DELETE FROM lotes WHERE id = ?').run(l.id);
    }
    // Productos creados por esta importación que quedaron sin ningún lote
    const nuevos = db.prepare(`
      SELECT p.id FROM productos p
      WHERE p.creado_por_importacion = ? AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id)
    `).all(id);
    for (const p of nuevos) {
      db.prepare('DELETE FROM producto_alias WHERE producto_id = ?').run(p.id);
      db.prepare('DELETE FROM productos WHERE id = ?').run(p.id);
    }
    db.prepare("UPDATE importaciones SET estado = 'DESHECHA', deshecha_en = ? WHERE id = ?").run(ahoraLocal(), id);
    return { lotesEliminados: lotes.length, productosEliminados: nuevos.length };
  })();

  res.json({ message: 'Importación deshecha', ...resultado });
};

module.exports = { analizar, confirmar, listar, detalle, deshacer };
