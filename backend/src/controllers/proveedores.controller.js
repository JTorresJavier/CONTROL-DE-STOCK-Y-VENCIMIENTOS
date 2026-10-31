// src/controllers/proveedores.controller.js
const db = require('../db');
const { error, texto, idParam } = require('../utils/validar');

const getProveedores = (req, res) => {
  res.json(db.prepare(`
    SELECT pr.*,
      (SELECT COUNT(*) FROM productos p WHERE p.proveedor_id = pr.id) AS productos,
      (SELECT COUNT(*) FROM importaciones i WHERE i.proveedor_id = pr.id AND i.estado = 'CONFIRMADA') AS importaciones,
      (SELECT MAX(i.fecha) FROM importaciones i WHERE i.proveedor_id = pr.id AND i.estado = 'CONFIRMADA') AS ultima_importacion
    FROM proveedores pr
    ORDER BY pr.nombre COLLATE NOCASE
  `).all());
};

function datos(body) {
  return {
    nombre: texto(body.nombre, { max: 80, requerido: true, campo: 'el nombre' }),
    cuit: texto(body.cuit, { max: 20 }),
    telefono: texto(body.telefono, { max: 40 }),
    email: texto(body.email, { max: 80 }),
    notas: texto(body.notas, { max: 300 }),
  };
}

// Busca un proveedor por nombre (sin distinguir mayúsculas) o lo crea
function obtenerOCrear(nombre) {
  const n = texto(nombre, { max: 80 });
  if (!n) return null;
  const existente = db.prepare('SELECT id FROM proveedores WHERE nombre = ? COLLATE NOCASE').get(n);
  if (existente) return existente.id;
  return Number(db.prepare('INSERT INTO proveedores (nombre) VALUES (?)').run(n).lastInsertRowid);
}

const createProveedor = (req, res) => {
  const d = datos(req.body || {});
  if (db.prepare('SELECT 1 FROM proveedores WHERE nombre = ? COLLATE NOCASE').get(d.nombre)) throw error(409, 'Ya existe un proveedor con ese nombre.');
  const r = db.prepare('INSERT INTO proveedores (nombre, cuit, telefono, email, notas) VALUES (?, ?, ?, ?, ?)').run(d.nombre, d.cuit, d.telefono, d.email, d.notas);
  res.status(201).json(db.prepare('SELECT * FROM proveedores WHERE id = ?').get(r.lastInsertRowid));
};

const updateProveedor = (req, res) => {
  const id = idParam(req.params.id);
  if (!db.prepare('SELECT 1 FROM proveedores WHERE id = ?').get(id)) throw error(404, 'Proveedor no encontrado');
  const d = datos(req.body || {});
  if (db.prepare('SELECT 1 FROM proveedores WHERE nombre = ? COLLATE NOCASE AND id <> ?').get(d.nombre, id)) throw error(409, 'Ya existe otro proveedor con ese nombre.');
  db.prepare('UPDATE proveedores SET nombre = ?, cuit = ?, telefono = ?, email = ?, notas = ? WHERE id = ?').run(d.nombre, d.cuit, d.telefono, d.email, d.notas, id);
  res.json(db.prepare('SELECT * FROM proveedores WHERE id = ?').get(id));
};

const deleteProveedor = (req, res) => {
  const id = idParam(req.params.id);
  db.transaction(() => {
    db.prepare('UPDATE productos SET proveedor_id = NULL WHERE proveedor_id = ?').run(id);
    db.prepare('UPDATE importaciones SET proveedor_id = NULL WHERE proveedor_id = ?').run(id);
    db.prepare('DELETE FROM proveedores WHERE id = ?').run(id);
  })();
  res.json({ message: 'Proveedor eliminado' });
};

module.exports = { getProveedores, createProveedor, updateProveedor, deleteProveedor, obtenerOCrear };
