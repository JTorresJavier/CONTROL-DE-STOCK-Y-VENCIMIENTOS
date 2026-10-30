// src/controllers/sistema.controller.js
// Resumen para el inicio, configuración, copias de seguridad e información de red.
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const db = require('../db');
const { error, entero, texto } = require('../utils/validar');
const { hoyISO, sumarDias, ahoraLocal } = require('../utils/fechas');

// ─── Configuración ────────────────────────────────────────────────────────────
const CONFIG_DEFECTO = {
  nombreNegocio: 'EpicFarma',
  alertaRoja: 30, // días: vence en 30 días o menos
  alertaNaranja: 60,
  alertaAmarilla: 90,
};

function leerConfig() {
  const out = { ...CONFIG_DEFECTO };
  for (const { clave, valor } of db.prepare('SELECT clave, valor FROM config').all()) {
    if (clave in CONFIG_DEFECTO) out[clave] = typeof CONFIG_DEFECTO[clave] === 'number' ? Number(valor) : valor;
  }
  return out;
}

const getConfig = (req, res) => res.json(leerConfig());

const putConfig = (req, res) => {
  const b = req.body || {};
  const nuevo = { ...leerConfig() };
  if (b.nombreNegocio !== undefined) nuevo.nombreNegocio = texto(b.nombreNegocio, { max: 60 }) || CONFIG_DEFECTO.nombreNegocio;
  for (const k of ['alertaRoja', 'alertaNaranja', 'alertaAmarilla']) {
    if (b[k] !== undefined) nuevo[k] = entero(b[k], { min: 1, max: 3650, campo: 'días de alerta' });
  }
  if (!(nuevo.alertaRoja < nuevo.alertaNaranja && nuevo.alertaNaranja < nuevo.alertaAmarilla)) {
    throw error(400, 'Los días de alerta tienen que ir de menor a mayor (rojo < naranja < amarillo).');
  }
  const guardar = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  db.transaction(() => { for (const [k, v] of Object.entries(nuevo)) guardar.run(k, String(v)); })();
  res.json(nuevo);
};

// ─── Resumen para la pantalla de inicio ───────────────────────────────────────
const getResumen = (req, res) => {
  const cfg = leerConfig();
  const hoy = hoyISO();
  const hasta = (dias) => sumarDias(hoy, dias);

  const contar = (desde, hastaFecha) => db.prepare(`
    SELECT COUNT(*) AS lotes, COALESCE(SUM(cantidad), 0) AS unidades FROM lotes
    WHERE cantidad > 0 AND fecha_vencimiento >= ? AND fecha_vencimiento <= ?
  `).get(desde, hastaFecha);

  const vencidos = db.prepare(`
    SELECT COUNT(*) AS lotes, COALESCE(SUM(cantidad), 0) AS unidades FROM lotes WHERE cantidad > 0 AND fecha_vencimiento < ?
  `).get(hoy);

  const faltantes = db.prepare(`
    SELECT p.id, p.nombre, p.codigo_barra, p.stock_minimo, COALESCE(SUM(l.cantidad), 0) AS stock
    FROM productos p LEFT JOIN lotes l ON l.producto_id = p.id
    WHERE p.stock_minimo > 0
    GROUP BY p.id HAVING stock < p.stock_minimo
    ORDER BY (stock * 1.0 / p.stock_minimo), p.nombre
  `).all();

  const urgentes = db.prepare(`
    SELECT l.id, l.producto_id, l.fecha_vencimiento, l.lote, l.cantidad, p.nombre AS producto_nombre, p.codigo_barra
    FROM lotes l JOIN productos p ON p.id = l.producto_id
    WHERE l.cantidad > 0 AND l.fecha_vencimiento <= ?
    ORDER BY l.fecha_vencimiento ASC, p.nombre LIMIT 15
  `).all(hasta(cfg.alertaAmarilla));

  const totales = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM productos) AS productos,
      (SELECT COUNT(*) FROM lotes WHERE cantidad > 0) AS lotes,
      (SELECT COALESCE(SUM(cantidad), 0) FROM lotes WHERE cantidad > 0) AS unidades,
      (SELECT COUNT(*) FROM productos p WHERE NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id AND l.cantidad > 0)) AS sin_stock
  `).get();

  const ultimasImportaciones = db.prepare(`
    SELECT id, fecha, tipo_documento, numero, proveedor_nombre, total_lineas, total_unidades, estado
    FROM importaciones ORDER BY id DESC LIMIT 5
  `).all();

  res.json({
    config: cfg,
    hoy,
    totales,
    vencidos,
    rangos: {
      rojo: contar(hoy, hasta(cfg.alertaRoja)),
      naranja: contar(hasta(cfg.alertaRoja + 1), hasta(cfg.alertaNaranja)),
      amarillo: contar(hasta(cfg.alertaNaranja + 1), hasta(cfg.alertaAmarilla)),
    },
    faltantes: { total: faltantes.length, lista: faltantes.slice(0, 20) },
    urgentes,
    ultimasImportaciones,
  });
};

// ─── Copias de seguridad ──────────────────────────────────────────────────────
const carpetaRespaldos = () => {
  const dir = path.join(path.dirname(db.dbPath), 'respaldos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const nombreRespaldo = (prefijo) => `${prefijo}-${ahoraLocal().replace(/[: ]/g, '-').slice(0, 16)}.db`;

async function respaldoAutomatico(prefijo = 'auto') {
  const dir = carpetaRespaldos();
  const destino = path.join(dir, nombreRespaldo(prefijo));
  await db.backup(destino);
  // Conservamos los 20 más nuevos
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const { f } of archivos.slice(20)) fs.rmSync(path.join(dir, f), { force: true });
  return destino;
}

// GET /api/backup  → descarga una copia de la base
const descargarBackup = async (req, res) => {
  const tmp = path.join(os.tmpdir(), `stock-${process.pid}-${Date.now()}.db`);
  await db.backup(tmp);
  res.download(tmp, nombreRespaldo('respaldo-stock'), () => fs.rm(tmp, { force: true }, () => {}));
};

// GET /api/backup/automaticos
const listarAutomaticos = (req, res) => {
  const dir = carpetaRespaldos();
  const lista = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => { const st = fs.statSync(path.join(dir, f)); return { nombre: f, tamano: st.size, fecha: st.mtime }; })
    .sort((a, b) => b.fecha - a.fecha);
  res.json({ carpeta: dir, lista });
};

const TABLAS = ['proveedores', 'productos', 'importaciones', 'lotes', 'movimientos_stock', 'producto_alias', 'config'];

// Reemplaza el contenido de la base actual con el de otro archivo (validado y migrado)
async function restaurarDesdeArchivo(archivo) {
  const cabecera = Buffer.alloc(16);
  const fd = fs.openSync(archivo, 'r');
  fs.readSync(fd, cabecera, 0, 16, 0);
  fs.closeSync(fd);
  if (cabecera.toString('latin1') !== 'SQLite format 3\u0000') throw error(400, 'El archivo no es una copia de seguridad válida.');

  // Trabajamos sobre una copia para no tocar el original
  const copia = path.join(os.tmpdir(), `restaurar-${process.pid}-${Date.now()}.db`);
  fs.copyFileSync(archivo, copia);
  try {
    const otra = new Database(copia);
    try {
      const tablas = otra.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
      if (!tablas.includes('productos') || !tablas.includes('lotes')) throw error(400, 'El archivo no tiene datos de esta aplicación.');
      db.migrar(otra);
    } finally {
      otra.close();
    }

    await respaldoAutomatico('antes-de-restaurar');

    db.pragma('foreign_keys = OFF');
    db.prepare('ATTACH DATABASE ? AS origen').run(copia);
    try {
      db.transaction(() => {
        for (const t of [...TABLAS].reverse()) db.exec(`DELETE FROM main.${t}`);
        for (const t of TABLAS) {
          const cols = db.prepare(`PRAGMA main.table_info(${t})`).all().map((c) => c.name);
          const colsOrigen = new Set(db.prepare(`PRAGMA origen.table_info(${t})`).all().map((c) => c.name));
          const comunes = cols.filter((c) => colsOrigen.has(c)).join(', ');
          db.exec(`INSERT INTO main.${t} (${comunes}) SELECT ${comunes} FROM origen.${t}`);
        }
      })();
    } finally {
      db.exec('DETACH DATABASE origen');
      db.pragma('foreign_keys = ON');
    }
  } finally {
    fs.rm(copia, { force: true }, () => {});
  }
}

// POST /api/backup/restaurar  (cuerpo: el archivo .db)
const restaurarBackup = async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length < 100) throw error(400, 'No se recibió ningún archivo.');
  const tmp = path.join(os.tmpdir(), `subido-${process.pid}-${Date.now()}.db`);
  fs.writeFileSync(tmp, req.body);
  try {
    await restaurarDesdeArchivo(tmp);
  } finally {
    fs.rm(tmp, { force: true }, () => {});
  }
  res.json({ message: 'Copia restaurada. Se guardó un respaldo de los datos anteriores.' });
};

// POST /api/backup/automaticos/restaurar  { nombre }
const restaurarAutomatico = async (req, res) => {
  const nombre = path.basename(String(req.body?.nombre || ''));
  const archivo = path.join(carpetaRespaldos(), nombre);
  if (!nombre.endsWith('.db') || !fs.existsSync(archivo)) throw error(404, 'Respaldo no encontrado.');
  await restaurarDesdeArchivo(archivo);
  res.json({ message: `Se restauró ${nombre}.` });
};

// POST /api/backup/automaticos  → crea un respaldo ahora
const crearRespaldo = async (req, res) => {
  const destino = await respaldoAutomatico('manual');
  res.status(201).json({ message: 'Respaldo creado', nombre: path.basename(destino) });
};

// POST /api/demo  → carga productos de ejemplo (solo con la base vacía)
const cargarDemo = (req, res) => {
  const { productos } = db.prepare('SELECT COUNT(*) AS productos FROM productos').get();
  if (productos > 0) throw error(409, 'Los datos de demostración solo se pueden cargar con la base vacía.');
  const fechas = require('../utils/fechas');
  const r = require('../demo').cargarDemo(db, fechas);
  res.status(201).json({ message: `Se cargaron ${r.productos} productos y ${r.lotes} lotes de ejemplo.`, ...r });
};

// ─── Información (para conectar el celular) ───────────────────────────────────
const getInfo = (req, res) => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  res.json({ ips, puerto: Number(process.env.PORT) || 4000, baseDeDatos: db.dbPath, version: process.env.APP_VERSION || '2.0.0' });
};

module.exports = {
  getConfig, putConfig, getResumen, leerConfig,
  descargarBackup, listarAutomaticos, restaurarBackup, restaurarAutomatico, crearRespaldo, respaldoAutomatico,
  getInfo, cargarDemo,
};
