// Pruebas de la API completa sobre una base temporal
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-test-'));
process.env.STOCK_DB_PATH = path.join(dir, 'test.db');

const app = require('../src/app');
const { ean13, REMITO_DEMO } = require('../src/demo');
const { hoyISO, sumarDias } = require('../src/utils/fechas');

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server.close();
  require('../src/db').close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function api(metodo, ruta, body) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}

test('demo, resumen con semáforo y faltantes', async () => {
  const demo = await api('POST', '/demo');
  assert.equal(demo.status, 201);
  assert.equal((await api('POST', '/demo')).status, 409); // solo con base vacía

  const { data } = await api('GET', '/resumen');
  assert.equal(data.totales.productos, 12);
  assert.equal(data.vencidos.lotes, 2);
  assert.ok(data.rangos.rojo.lotes >= 3);
  assert.ok(data.faltantes.total >= 1);
  assert.ok(data.urgentes.length > 0);
});

test('productos: alta, código duplicado, búsqueda y edición', async () => {
  const codigo = ean13('779912345678');
  const r = await api('POST', '/productos', { codigoBarra: codigo, nombre: 'Producto de prueba', stockMinimo: 5 });
  assert.equal(r.status, 201);
  assert.equal(r.data.stock, 0);
  assert.equal((await api('POST', '/productos', { codigoBarra: codigo, nombre: 'Otro' })).status, 409);
  assert.equal((await api('POST', '/productos', { nombre: '' })).status, 400);

  const sinCodigo = await api('POST', '/productos', { nombre: 'Sin código de barras' });
  assert.match(sinCodigo.data.codigo_barra, /^INT-\d{6}$/);

  const busq = await api('GET', '/productos/search?q=prueba');
  assert.equal(busq.data[0].codigo_barra, codigo);
  assert.equal((await api('GET', '/productos/search?q=%25')).data.length, 0); // % se busca como texto

  const ed = await api('PUT', `/productos/${r.data.id}`, { nombre: 'Producto editado', stockMinimo: 3 });
  assert.equal(ed.data.nombre, 'Producto editado');
  assert.equal(ed.data.stock_minimo, 3);
});

test('ingreso por lotes valida datos y registra movimientos', async () => {
  const p = (await api('GET', `/productos/by-codigo/${ean13('779912345678')}`)).data;
  assert.equal((await api('POST', '/lotes/batch', { lotes: [{ productoId: p.id, cantidad: 0, fechaVencimiento: '2027-01-01' }] })).status, 400);
  assert.equal((await api('POST', '/lotes/batch', { lotes: [{ productoId: p.id, cantidad: 1.5, fechaVencimiento: '2027-01-01' }] })).status, 400);
  assert.equal((await api('POST', '/lotes/batch', { lotes: [{ productoId: p.id, cantidad: 2, fechaVencimiento: '31/02/2027' }] })).status, 400);
  assert.equal((await api('POST', '/lotes/batch', { lotes: [{ productoId: 99999, cantidad: 2, fechaVencimiento: '2027-01-01' }] })).status, 400);

  const ok = await api('POST', '/lotes/batch', {
    lotes: [
      { productoId: p.id, cantidad: 5, fechaVencimiento: '12/27', lote: 'B' },
      { productoId: p.id, cantidad: 3, fechaVencimiento: '2027-06-30', lote: 'A' },
    ],
  });
  assert.equal(ok.status, 201);
  const lotes = (await api('GET', `/lotes/producto/${p.id}`)).data;
  assert.deepEqual(lotes.map((l) => [l.fecha_vencimiento, l.cantidad]), [['2027-06-30', 3], ['2027-12-31', 5]]);
  assert.equal(lotes[0].fecha_alta, hoyISO()); // fecha local, no UTC

  const movs = (await api('GET', `/movimientos?q=${encodeURIComponent('Producto editado')}`)).data;
  assert.equal(movs.filter((m) => m.tipo === 'INGRESO').length, 2);
});

test('salida FEFO descuenta primero lo que vence antes', async () => {
  const codigo = ean13('779912345678');
  assert.equal((await api('POST', '/stock/salida', { codigoBarra: codigo, cantidad: 100 })).status, 400);
  const r = await api('POST', '/stock/salida', { codigoBarra: codigo, cantidad: 4 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.detalle.map((d) => d.cantidad), [3, 1]);
  const p = (await api('GET', `/productos/by-codigo/${codigo}`)).data;
  assert.equal(p.stock, 4);
});

test('editar lote registra ajuste; baja deja el lote en cero; rutas inválidas dan 404', async () => {
  const p = (await api('GET', `/productos/by-codigo/${ean13('779912345678')}`)).data;
  const [lote] = (await api('GET', `/lotes/producto/${p.id}`)).data;
  assert.equal((await api('PUT', `/lotes/${lote.id}`, { cantidad: 'abc' })).status, 400);
  const ed = await api('PUT', `/lotes/${lote.id}`, { cantidad: 6, motivo: 'Recuento' });
  assert.equal(ed.data.cantidad, 6);
  const baja = await api('POST', `/lotes/${lote.id}/baja`, {});
  assert.equal(baja.status, 200);
  const movs = (await api('GET', '/movimientos?tipo=BAJA')).data;
  assert.equal(movs[0].cantidad, -6);
  assert.equal((await api('DELETE', `/${lote.id}`)).status, 404); // antes esto borraba lotes
});

test('importación: analiza, empareja, confirma, detecta duplicado y se deshace', async () => {
  const texto = [
    `${REMITO_DEMO.proveedor}           REMITO`,
    `N° ${REMITO_DEMO.numero}           Fecha: ${REMITO_DEMO.fecha}`,
    'CODIGO  EAN  DESCRIPCION  CANT  LOTE  VTO',
    ...REMITO_DEMO.lineas.map((l) => `${l.codigo}  ${l.ean}  ${l.descripcion}  ${l.cantidad}  ${l.lote ? 'Lote ' + l.lote : ''}  ${l.vto}`),
    'TOTAL  131',
  ].join('\n');

  const an = await api('POST', '/importaciones/analizar', { texto });
  assert.equal(an.status, 200);
  assert.equal(an.data.documento.numero, '0003-00012345');
  assert.equal(an.data.documento.proveedor, 'DROGUERIA DEL SUR S.A.'); // reconoce el proveedor guardado
  assert.equal(an.data.lineas.length, REMITO_DEMO.lineas.length);
  const estados = an.data.lineas.map((l) => l.estado);
  assert.deepEqual(estados.slice(0, 6), ['existe', 'existe', 'existe', 'existe', 'existe', 'existe']); // 4 por código, 2 por nombre
  assert.match(an.data.lineas[3].motivo, /Nombre parecido/);
  assert.deepEqual(estados.slice(6), ['nuevo', 'nuevo', 'nuevo']);
  assert.equal(an.data.lineas[8].vencimiento, null); // las gasas vienen sin vencimiento

  // Sin vencimiento no se puede confirmar
  const lineas = an.data.lineas.map((l) => ({
    productoId: l.estado === 'existe' ? l.producto.id : undefined,
    nuevo: l.estado === 'nuevo' ? { nombre: l.descripcion, codigoBarra: l.ean, codigoInterno: l.codigo } : undefined,
    cantidad: l.cantidad,
    vencimiento: l.vencimiento,
    lote: l.lote,
    descripcionOriginal: l.descripcion,
  }));
  const doc = { ...an.data.documento, archivo: 'remito.txt', lineas };
  assert.equal((await api('POST', '/importaciones', doc)).status, 400);

  lineas[8].vencimiento = sumarDias(hoyISO(), 700);
  const conf = await api('POST', '/importaciones', doc);
  assert.equal(conf.status, 201);
  assert.equal(conf.data.productosNuevos, 3);
  assert.equal(conf.data.unidades, 131);

  // El mismo documento otra vez: avisa que ya se importó
  const dup = await api('POST', '/importaciones', doc);
  assert.equal(dup.status, 409);
  assert.ok(dup.data.duplicado);

  // La próxima vez, los nuevos ya existen y los nombres aprendidos se reconocen
  const an2 = await api('POST', '/importaciones/analizar', { texto });
  assert.ok(an2.data.lineas.every((l) => l.estado === 'existe'));
  assert.ok(an2.data.duplicado);

  // Deshacer
  const imp = conf.data.importacionId;
  const des = await api('POST', `/importaciones/${imp}/deshacer`);
  assert.equal(des.status, 200);
  assert.equal(des.data.productosEliminados, 3);
  assert.equal((await api('POST', `/importaciones/${imp}/deshacer`)).status, 400);
  assert.equal((await api('GET', `/importaciones/${imp}`)).data.estado, 'DESHECHA');
});

test('no se puede deshacer una importación con stock ya usado', async () => {
  const codigo = ean13('779900000101');
  const conf = await api('POST', '/importaciones', {
    numero: 'X-1', proveedor: 'Otro',
    lineas: [{ nuevo: { nombre: 'Algo nuevo', codigoBarra: ean13('779955555555') }, cantidad: 5, vencimiento: '12/2030' }],
  });
  assert.equal(conf.status, 201);
  await api('POST', '/stock/salida', { codigoBarra: ean13('779955555555'), cantidad: 1 });
  const des = await api('POST', `/importaciones/${conf.data.importacionId}/deshacer`);
  assert.equal(des.status, 409);
  assert.ok(codigo);
});

test('código interno de otro proveedor no asigna un producto distinto', async () => {
  const amox = (await api('POST', '/productos', { nombre: 'Amoxicilina 875 mg x 14', codigoBarra: ean13('779988880001'), codigoInterno: 'X9999' })).data;
  const an = await api('POST', '/importaciones/analizar', {
    texto: 'CODIGO EAN DESCRIPCION CANT\nX9999  ' + ean13('779988880002') + '  IBUPROFENO 600 MG X 10  3',
  });
  assert.notEqual(an.data.lineas[0].estado, 'existe');
  const an2 = await api('POST', '/importaciones/analizar', { texto: 'CODIGO DESCRIPCION CANT\nX9999  AMOXICILINA 875 MG X 14  3' });
  assert.equal(an2.data.lineas[0].producto.id, amox.id);
  assert.equal(an2.data.lineas[0].estado, 'existe');
});

test('no se puede deshacer si hubo movimientos aunque la cantidad vuelva a ser la misma', async () => {
  const conf = await api('POST', '/importaciones', {
    numero: 'X-2', lineas: [{ nuevo: { nombre: 'Producto mov' }, cantidad: 5, vencimiento: '12/2031' }],
  });
  const imp = (await api('GET', `/importaciones/${conf.data.importacionId}`)).data;
  const loteId = imp.lotes[0].id;
  await api('PUT', `/lotes/${loteId}`, { cantidad: 4 });
  await api('PUT', `/lotes/${loteId}`, { cantidad: 5 });
  assert.equal((await api('POST', `/importaciones/${conf.data.importacionId}/deshacer`)).status, 409);

  const conf2 = await api('POST', '/importaciones', { numero: 'X-3', lineas: [{ nuevo: { nombre: 'Prod borrado' }, cantidad: 2, vencimiento: '12/2031' }, { nuevo: { nombre: 'Prod sigue' }, cantidad: 2, vencimiento: '12/2031' }] });
  const imp2 = (await api('GET', `/importaciones/${conf2.data.importacionId}`)).data;
  await api('DELETE', `/lotes/${imp2.lotes[0].id}`);
  assert.equal((await api('POST', `/importaciones/${conf2.data.importacionId}/deshacer`)).status, 409);
});

test('acceso desde la red: bloqueado por defecto, con PIN si se activa, sin respaldos remotos', () => {
  const { protegerRed } = require('../src/utils/acceso');
  const probar = (cfg, { ip = '192.168.0.20', pin, ruta = '/productos', metodo = 'GET' } = {}) => {
    let estado = 200;
    const req = { socket: { remoteAddress: ip }, path: ruta, method: metodo, get: () => pin };
    const res = { status: (s) => { estado = s; return { json: () => {} }; } };
    protegerRed(() => cfg)(req, res, () => {});
    return estado;
  };
  assert.equal(probar({ accesoRed: false, pinRed: '123456' }, { ip: '127.0.0.1' }), 200);
  assert.equal(probar({ accesoRed: false, pinRed: '123456' }), 403);
  assert.equal(probar({ accesoRed: true, pinRed: '123456' }), 401);
  assert.equal(probar({ accesoRed: true, pinRed: '123456' }, { pin: '123456' }), 200);
  assert.equal(probar({ accesoRed: true, pinRed: '123456' }, { pin: '123456', ruta: '/backup' }), 403);
  assert.equal(probar({ accesoRed: true, pinRed: '123456' }, { pin: '123456', ruta: '/config', metodo: 'PUT' }), 403);
});

test('configuración de alertas y respaldo/restauración', async () => {
  assert.equal((await api('PUT', '/config', { alertaRoja: 90, alertaNaranja: 60 })).status, 400);
  const cfg = await api('PUT', '/config', { alertaRoja: 15, alertaNaranja: 45, alertaAmarilla: 120 });
  assert.equal(cfg.data.alertaRoja, 15);

  const antes = (await api('GET', '/productos')).data.length;
  const r = await fetch(base + '/backup');
  assert.equal(r.status, 200);
  const copia = Buffer.from(await r.arrayBuffer());
  assert.equal(copia.subarray(0, 15).toString(), 'SQLite format 3');

  await api('POST', '/productos', { nombre: 'Se borra al restaurar' });
  assert.equal((await api('GET', '/productos')).data.length, antes + 1);

  const malo = await fetch(base + '/backup/restaurar', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.alloc(500, 1) });
  assert.equal(malo.status, 400);

  const rest = await fetch(base + '/backup/restaurar', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: copia });
  assert.equal(rest.status, 200);
  assert.equal((await api('GET', '/productos')).data.length, antes);
  assert.ok((await api('GET', '/backup/automaticos')).data.lista.some((b) => b.nombre.startsWith('antes-de-restaurar')));

  // Dos respaldos seguidos no se pisan
  const r1 = await api('POST', '/backup/automaticos');
  const r2 = await api('POST', '/backup/automaticos');
  assert.notEqual(r1.data.nombre, r2.data.nombre);
  assert.equal((await api('GET', '/config')).data.pinRed.length, 6); // desde la PC se ve el PIN
});

test('errores sin detalles internos', async () => {
  const r = await fetch(base + '/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{mal' });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { message: 'Datos inválidos' });
  assert.equal((await api('GET', '/no-existe')).status, 404);
});
