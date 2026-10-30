// scripts/generar-muestras.js
// Genera documentos de ejemplo (ficticios) para probar la importación: TXT, CSV, Excel, PDF, foto y PDF escaneado.
// Uso: npm run muestras   (se ejecuta con Electron para poder crear el PDF y la imagen)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('../frontend/node_modules/xlsx');
const { REMITO_DEMO, PRODUCTOS_DEMO, ean13 } = require('../backend/src/demo');

const salida = path.join(__dirname, '..', 'muestras');
fs.mkdirSync(salida, { recursive: true });

const pesos = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const R = REMITO_DEMO;

// ─── 1) Remito en texto (como lo exportan muchos sistemas de droguerías) ─────
function txt() {
  const col = (s, n) => String(s).padEnd(n).slice(0, n);
  const lineas = [
    `${R.proveedor}                                   REMITO  R`,
    `Av. Siempre Viva 1234 - CABA                             N° ${R.numero}`,
    `CUIT: 30-71234567-8   IVA Responsable Inscripto         Fecha: ${R.fecha}`,
    '',
    'Cliente: FARMACIA EPICFARMA      Domicilio: Calle Falsa 123',
    '',
    `${col('CODIGO', 8)}${col('EAN', 15)}${col('DESCRIPCION', 40)}${col('CANT', 6)}${col('LOTE', 10)}VTO`,
    '-'.repeat(88),
    ...R.lineas.map((l) => `${col(l.codigo, 8)}${col(l.ean, 15)}${col(l.descripcion, 40)}${col(l.cantidad, 6)}${col(l.lote, 10)}${l.vto}`),
    '-'.repeat(88),
    `TOTAL UNIDADES: ${R.lineas.reduce((a, l) => a + l.cantidad, 0)}`,
    'Recibí conforme: ____________________',
  ];
  fs.writeFileSync(path.join(salida, 'remito-drogueria-del-sur.txt'), lineas.join('\r\n'), 'utf8');
}

// ─── 2) Factura en CSV y en Excel (otro proveedor, otras columnas) ────────────
const FACTURA = [
  { ean: PRODUCTOS_DEMO[4].ean, desc: 'Omeprazol 20 mg x 14 cápsulas', cant: 10, lote: 'OMZ-771', vto: '2027-09-30', precio: 2350 },
  { ean: PRODUCTOS_DEMO[5].ean, desc: 'Loratadina 10 mg x 10 comprimidos', cant: 12, lote: 'LR5530', vto: '2028-01-31', precio: 1710.4 },
  { ean: PRODUCTOS_DEMO[9].ean, desc: 'Metformina 850 mg x 30 comprimidos', cant: 6, lote: 'MF0099', vto: '2027-04-30', precio: 3890 },
  { ean: ean13('779900000301'), desc: 'Termómetro digital', cant: 4, lote: '', vto: '', precio: 8900 },
  { ean: ean13('779900000302'), desc: 'Ibuprofeno 400 mg suspensión pediátrica 100 ml', cant: 8, lote: 'IBS-204', vto: '2027-02-28', precio: 4120 },
];

function csvYExcel() {
  const encabezado = ['Cod. Barras', 'Descripción', 'Cantidad', 'Lote', 'Vencimiento', 'Precio unit.', 'Importe'];
  const filas = FACTURA.map((f) => [f.ean, f.desc, f.cant, f.lote, f.vto ? f.vto.split('-').reverse().join('/') : '', pesos(f.precio), pesos(f.precio * f.cant)]);
  const csv = [
    'DISTRIBUIDORA NORTE SRL;;;;;;',
    'Factura B N° 0002-00004567;;Fecha: 29/10/2026;;;;',
    encabezado.join(';'),
    ...filas.map((f) => f.map((c) => (String(c).includes(';') ? `"${c}"` : c)).join(';')),
  ].join('\r\n');
  fs.writeFileSync(path.join(salida, 'factura-distribuidora-norte.csv'), csv, 'utf8');

  const hoja = XLSX.utils.aoa_to_sheet([
    ['DISTRIBUIDORA NORTE SRL'],
    ['Factura B N° 0002-00004568', '', 'Fecha: 29/10/2026'],
    [],
    encabezado,
    ...FACTURA.map((f) => [f.ean, f.desc, f.cant, f.lote, f.vto ? new Date(`${f.vto}T12:00:00`) : '', f.precio, f.precio * f.cant]),
  ], { cellDates: true });
  hoja['!cols'] = [{ wch: 16 }, { wch: 44 }, { wch: 9 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Factura');
  XLSX.writeFile(libro, path.join(salida, 'factura-distribuidora-norte.xlsx'));
}

// ─── 3) Remito impreso: PDF con texto, foto (PNG) y PDF escaneado (solo imagen) ───
function htmlRemito() {
  const filas = R.lineas.map((l) => `<tr><td>${l.codigo}</td><td>${l.ean}</td><td>${l.descripcion}</td><td class="n">${l.cantidad}</td><td>${l.lote}</td><td>${l.vto}</td><td class="n">${pesos(l.precio)}</td><td class="n">${pesos(l.precio * l.cantidad)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;margin:28px;color:#111;background:#fff;font-size:13px}
    .cab{display:flex;justify-content:space-between;border:2px solid #111;padding:12px}
    h1{margin:0;font-size:20px} .r{font-size:30px;border:2px solid #111;padding:2px 12px;align-self:flex-start}
    table{width:100%;border-collapse:collapse;margin-top:14px} th,td{border:1px solid #444;padding:5px 6px;text-align:left}
    th{background:#eee} .n{text-align:right} .pie{margin-top:16px;display:flex;justify-content:space-between}
  </style></head><body>
    <div class="cab"><div><h1>${R.proveedor}</h1>Av. Siempre Viva 1234 - CABA<br>CUIT: 30-71234567-8 · IVA Responsable Inscripto</div>
    <div class="r">R</div><div><b>REMITO</b><br>N° ${R.numero}<br>Fecha: ${R.fecha}</div></div>
    <p><b>Cliente:</b> FARMACIA EPICFARMA &nbsp; <b>Domicilio:</b> Calle Falsa 123</p>
    <table><thead><tr><th>Código</th><th>EAN</th><th>Descripción</th><th>Cant.</th><th>Lote</th><th>Vto.</th><th>P. Unit.</th><th>Importe</th></tr></thead><tbody>${filas}</tbody></table>
    <div class="pie"><span>Total unidades: ${R.lineas.reduce((a, l) => a + l.cantidad, 0)}</span><span>Recibí conforme: ____________________</span></div>
  </body></html>`;
}

async function pdfYFoto() {
  const win = new BrowserWindow({ show: false, width: 1100, height: 760, webPreferences: { offscreen: false } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlRemito())}`);
  const pdf = await win.webContents.printToPDF({ landscape: true, printBackground: true, pageSize: 'A4' });
  fs.writeFileSync(path.join(salida, 'remito-drogueria-del-sur.pdf'), pdf);

  const imagen = await win.webContents.capturePage();
  const png = path.join(salida, 'remito-foto.png');
  fs.writeFileSync(png, imagen.toPNG());

  // PDF escaneado: la misma hoja pero como imagen, sin texto seleccionable
  const datos = imagen.toPNG().toString('base64');
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="margin:0"><img src="data:image/png;base64,${datos}" style="width:100%"></body></html>`)}`);
  const escaneado = await win.webContents.printToPDF({ landscape: true, printBackground: true, pageSize: 'A4', margins: { marginType: 'none' } });
  fs.writeFileSync(path.join(salida, 'remito-escaneado.pdf'), escaneado);
  win.destroy();
}

app.whenReady().then(async () => {
  try {
    txt();
    csvYExcel();
    await pdfYFoto();
    console.log('Muestras generadas en', salida);
    for (const f of fs.readdirSync(salida)) console.log(' -', f);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
  app.quit();
});
