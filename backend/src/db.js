// src/db.js
// Conexión a SQLite + migraciones. Cada versión del esquema se aplica una sola vez
// (se guarda en PRAGMA user_version) y nunca borra datos existentes.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Carpeta donde se guarda la base de datos:
// 1) STOCK_DB_PATH (pruebas o instalaciones especiales)
// 2) En la app de escritorio: C:\Users\...\AppData\Roaming\<app>\database.db
// 3) En desarrollo sin Electron: carpeta del backend
function getDbPath() {
  if (process.env.STOCK_DB_PATH) return process.env.STOCK_DB_PATH;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'database.db');
    }
  } catch {
    // sin Electron
  }
  return path.join(__dirname, '..', 'database.db');
}

// Columnas existentes de una tabla (para agregar solo las que falten)
function columnas(db, tabla) {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
}

function agregarColumna(db, tabla, definicion) {
  const nombre = definicion.split(' ')[0];
  if (!columnas(db, tabla).includes(nombre)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`);
  }
}

// Aplica las migraciones pendientes sobre una conexión
function migrar(db) {
  // Versión 1: esquema original de la app
  db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_barra TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      descripcion TEXT
    );

    CREATE TABLE IF NOT EXISTS lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      lote TEXT,
      fecha_vencimiento TEXT NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 0,
      fecha_alta TEXT DEFAULT (date('now')),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    );

    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      producto_id INTEGER NOT NULL,
      lote_id INTEGER,
      cantidad INTEGER NOT NULL,
      origen TEXT,
      observacion TEXT,
      fecha TEXT DEFAULT (datetime('now'))
    );
  `);

  const version = db.pragma('user_version', { simple: true });

  // Versión 2: proveedores, importaciones, stock mínimo, alias de productos y configuración
  if (version < 2) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS proveedores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
          cuit TEXT,
          telefono TEXT,
          email TEXT,
          notas TEXT
        );

        CREATE TABLE IF NOT EXISTS importaciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL,
          archivo TEXT,
          tipo_documento TEXT,
          numero TEXT,
          fecha_documento TEXT,
          proveedor_id INTEGER REFERENCES proveedores(id),
          proveedor_nombre TEXT,
          total_lineas INTEGER NOT NULL DEFAULT 0,
          total_unidades INTEGER NOT NULL DEFAULT 0,
          productos_nuevos INTEGER NOT NULL DEFAULT 0,
          estado TEXT NOT NULL DEFAULT 'CONFIRMADA',
          deshecha_en TEXT
        );

        -- Recuerda cómo nombra cada proveedor a un producto, para reconocerlo en la próxima importación
        CREATE TABLE IF NOT EXISTS producto_alias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
          texto_normalizado TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS config (
          clave TEXT PRIMARY KEY,
          valor TEXT
        );
      `);

      agregarColumna(db, 'productos', 'codigo_interno TEXT');
      agregarColumna(db, 'productos', 'stock_minimo INTEGER NOT NULL DEFAULT 0');
      agregarColumna(db, 'productos', 'proveedor_id INTEGER');
      agregarColumna(db, 'productos', 'laboratorio TEXT');
      agregarColumna(db, 'productos', 'creado_por_importacion INTEGER');

      agregarColumna(db, 'lotes', 'importacion_id INTEGER');
      agregarColumna(db, 'lotes', 'cantidad_inicial INTEGER');

      agregarColumna(db, 'movimientos_stock', 'importacion_id INTEGER');

      // Los lotes viejos toman su cantidad actual como inicial
      db.exec('UPDATE lotes SET cantidad_inicial = cantidad WHERE cantidad_inicial IS NULL');

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lotes_producto ON lotes(producto_id);
        CREATE INDEX IF NOT EXISTS idx_lotes_venc ON lotes(fecha_vencimiento);
        CREATE INDEX IF NOT EXISTS idx_lotes_importacion ON lotes(importacion_id);
        CREATE INDEX IF NOT EXISTS idx_mov_fecha ON movimientos_stock(fecha);
        CREATE INDEX IF NOT EXISTS idx_mov_producto ON movimientos_stock(producto_id);
        CREATE INDEX IF NOT EXISTS idx_productos_interno ON productos(codigo_interno);
        CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
      `);

      db.pragma('user_version = 2');
    })();
  }
}

// Abre una base, la deja lista y la devuelve
function abrir(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrar(db);
  return db;
}

const dbPath = getDbPath();
const db = abrir(dbPath);
if (!process.env.STOCK_DB_PATH) console.log('Base de datos en:', dbPath);

module.exports = db;
module.exports.dbPath = dbPath;
module.exports.migrar = migrar;
module.exports.abrir = abrir;
