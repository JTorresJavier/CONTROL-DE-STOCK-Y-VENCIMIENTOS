// src/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Carpeta donde se guarda la base de datos
// En producción: C:\Users\...\AppData\Roaming\Control de Stock EpicFarma\
// En desarrollo: carpeta del proyecto
function getDbPath() {
  try {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'database.db');
  } catch {
    // En desarrollo (sin Electron) guardamos en la carpeta del backend
    return path.join(__dirname, '..', 'database.db');
  }
}

const dbPath = getDbPath();
console.log('Base de datos en:', dbPath);

// Creamos la conexión
const db = new Database(dbPath);

// Activamos WAL para mejor rendimiento
db.pragma('journal_mode = WAL');

// Creamos las tablas si no existen (primera vez)
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

module.exports = db;