// src/demo.js
// Datos ficticios para probar la app (productos de farmacia y un remito de ejemplo).
// Los códigos de barras son inventados, con dígito verificador válido.

function ean13(base12) {
  const d = base12.split('').map(Number);
  const suma = d.reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 1 : 3), 0);
  return base12 + ((10 - (suma % 10)) % 10);
}

// Catálogo inicial de demostración
const PRODUCTOS_DEMO = [
  { ean: ean13('779900000101'), nombre: 'Ibuprofeno 400 mg x 20 comprimidos', laboratorio: 'Lab. Norte', minimo: 10 },
  { ean: ean13('779900000102'), nombre: 'Ibuprofeno 600 mg x 10 comprimidos', laboratorio: 'Lab. Norte', minimo: 10 },
  { ean: ean13('779900000103'), nombre: 'Amoxicilina 500 mg x 16 cápsulas', laboratorio: 'Farma Sur', minimo: 6 },
  { ean: ean13('779900000104'), nombre: 'Paracetamol 500 mg x 20 comprimidos', laboratorio: 'Lab. Norte', minimo: 15 },
  { ean: ean13('779900000105'), nombre: 'Omeprazol 20 mg x 14 cápsulas', laboratorio: 'Gastro SA', minimo: 8 },
  { ean: ean13('779900000106'), nombre: 'Loratadina 10 mg x 10 comprimidos', laboratorio: 'Alergo Lab', minimo: 5 },
  { ean: ean13('779900000107'), nombre: 'Diclofenac 75 mg x 15 comprimidos', laboratorio: 'Farma Sur', minimo: 6 },
  { ean: ean13('779900000108'), nombre: 'Alcohol en gel 250 ml', laboratorio: 'Higiene Plus', minimo: 12 },
  { ean: ean13('779900000109'), nombre: 'Enalapril 10 mg x 30 comprimidos', laboratorio: 'Cardio Lab', minimo: 4 },
  { ean: ean13('779900000110'), nombre: 'Metformina 850 mg x 30 comprimidos', laboratorio: 'Cardio Lab', minimo: 4 },
  { ean: ean13('779900000111'), nombre: 'Jarabe para la tos 120 ml', laboratorio: 'Respira', minimo: 3 },
  { ean: ean13('779900000112'), nombre: 'Protector solar FPS 50 200 ml', laboratorio: 'Derma Sol', minimo: 2 },
];

// Lotes de demostración: días hasta el vencimiento (negativo = vencido) y cantidad
const LOTES_DEMO = [
  [0, -12, 4], [0, 120, 18], [1, 25, 3], [2, 8, 5], [2, 210, 10], [3, 45, 30], [4, -3, 2], [4, 75, 6],
  [5, 300, 12], [6, 20, 4], [7, 400, 20], [8, 55, 3], [9, 95, 8], [10, 15, 1], [11, 160, 6],
];

// Remito de ejemplo: mezcla productos existentes (por código o por nombre), nuevos y uno sin vencimiento
const REMITO_DEMO = {
  proveedor: 'DROGUERIA DEL SUR S.A.',
  numero: '0003-00012345',
  fecha: '28/10/2026',
  lineas: [
    { codigo: '10231', ean: PRODUCTOS_DEMO[0].ean, descripcion: 'IBUPROFENO 400 MG X 20 COMP', cantidad: 12, lote: 'L2401A', vto: '12/2027', precio: 1850.5 },
    { codigo: '10233', ean: PRODUCTOS_DEMO[2].ean, descripcion: 'AMOXICILINA 500 MG X 16 CAPS', cantidad: 6, lote: 'AMX883', vto: '03/2027', precio: 4210 },
    { codigo: '10240', ean: PRODUCTOS_DEMO[3].ean, descripcion: 'PARACETAMOL 500 MG X 20 COMP', cantidad: 24, lote: 'P77812', vto: '08/2028', precio: 990 },
    { codigo: '10251', ean: '', descripcion: 'IBUPROF. 600MG X10 COMPRIMIDOS', cantidad: 10, lote: 'IB6-22', vto: '05/2027', precio: 1420.75 },
    { codigo: '10260', ean: '', descripcion: 'OMEPRAZOL 20MG X 14 CAPSULAS', cantidad: 8, lote: 'OM2045', vto: '11/2027', precio: 2350 },
    { codigo: '10270', ean: PRODUCTOS_DEMO[7].ean, descripcion: 'ALCOHOL EN GEL 250 ML', cantidad: 20, lote: 'AG5521', vto: '01/2029', precio: 1500 },
    { codigo: '20011', ean: ean13('779900000201'), descripcion: 'CETIRIZINA 10 MG X 10 COMP', cantidad: 6, lote: 'CT1102', vto: '09/2027', precio: 2100 },
    { codigo: '20012', ean: ean13('779900000202'), descripcion: 'VITAMINA C 1 G X 10 EFERVESCENTES', cantidad: 15, lote: 'VC9001', vto: '02/2028', precio: 3200 },
    { codigo: '20013', ean: ean13('779900000203'), descripcion: 'GASAS ESTERILES 10X10 X 10 UNIDADES', cantidad: 30, lote: 'GZ0077', vto: '', precio: 650 },
  ],
};

function cargarDemo(db, { hoyISO, sumarDias, ahoraLocal }) {
  const hoy = hoyISO();
  return db.transaction(() => {
    const prov = db.prepare('INSERT OR IGNORE INTO proveedores (nombre) VALUES (?)');
    prov.run('DROGUERIA DEL SUR S.A.');
    prov.run('DISTRIBUIDORA NORTE SRL');
    const provId = db.prepare('SELECT id FROM proveedores WHERE nombre = ?').get('DROGUERIA DEL SUR S.A.').id;
    const insP = db.prepare('INSERT INTO productos (codigo_barra, nombre, laboratorio, stock_minimo, proveedor_id) VALUES (?, ?, ?, ?, ?)');
    const ids = PRODUCTOS_DEMO.map((p) => Number(insP.run(p.ean, p.nombre, p.laboratorio, p.minimo, provId).lastInsertRowid));
    const insL = db.prepare('INSERT INTO lotes (producto_id, lote, fecha_vencimiento, cantidad, cantidad_inicial, fecha_alta) VALUES (?, ?, ?, ?, ?, ?)');
    const insM = db.prepare("INSERT INTO movimientos_stock (tipo, producto_id, lote_id, cantidad, origen, observacion, fecha) VALUES ('INGRESO', ?, ?, ?, 'DEMO', 'Datos de demostración', ?)");
    LOTES_DEMO.forEach(([i, dias, cant], n) => {
      const r = insL.run(ids[i], `D${String(n + 1).padStart(3, '0')}`, sumarDias(hoy, dias), cant, cant, hoy);
      insM.run(ids[i], r.lastInsertRowid, cant, ahoraLocal());
    });
    return { productos: ids.length, lotes: LOTES_DEMO.length };
  })();
}

module.exports = { ean13, PRODUCTOS_DEMO, LOTES_DEMO, REMITO_DEMO, cargarDemo };
