// Pruebas del lector de remitos/facturas y de las fechas
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsearTexto, parsearFilas, parsearLinea, eanValido, parseNumero } = require('../src/import/parser');
const { parseFechaFlexible } = require('../src/utils/fechas');
const { normalizar, similitud } = require('../src/import/normalizar');
const { ean13 } = require('../src/demo');

test('fechas de vencimiento en todos los formatos habituales', () => {
  assert.equal(parseFechaFlexible('31/12/2026'), '2026-12-31');
  assert.equal(parseFechaFlexible('31-12-26'), '2026-12-31');
  assert.equal(parseFechaFlexible('2027-03-15'), '2027-03-15');
  assert.equal(parseFechaFlexible('12/26'), '2026-12-31'); // mes/año → último día del mes
  assert.equal(parseFechaFlexible('02/2028'), '2028-02-29'); // bisiesto
  assert.equal(parseFechaFlexible('1226'), '2026-12-31');
  assert.equal(parseFechaFlexible('150327'), '2027-03-15');
  assert.equal(parseFechaFlexible('DIC-26'), '2026-12-31');
  assert.equal(parseFechaFlexible('mar 2027'), '2027-03-31');
  assert.equal(parseFechaFlexible('31/02/2026'), null);
  assert.equal(parseFechaFlexible('13/26'), null);
  assert.equal(parseFechaFlexible('hola'), null);
});

test('números con formato argentino y dígito verificador EAN', () => {
  assert.equal(parseNumero('1.234,56'), 1234.56);
  assert.equal(parseNumero('1234.56'), 1234.56);
  assert.equal(parseNumero('1.500'), 1500);
  const bueno = ean13('779900000101');
  assert.ok(eanValido(bueno));
  assert.ok(!eanValido(bueno.slice(0, 12) + ((Number(bueno[12]) + 1) % 10)));
});

test('línea con código, EAN, descripción, cantidad, lote y vencimiento', () => {
  const ean = ean13('779900000101');
  const r = parsearLinea(`10231   ${ean}  IBUPROFENO 400 MG X 20 COMP     12   L2401A   12/2027`, { cantidadAlFinal: true, columnaLote: true });
  assert.equal(r.ean, ean);
  assert.equal(r.cantidad, 12);
  assert.equal(r.lote, 'L2401A');
  assert.equal(r.vencimiento, '2027-12-31');
  assert.match(r.descripcion, /IBUPROFENO 400 MG X 20 COMP/);
  assert.equal(r.codigo, '10231');
});

test('cantidad deducida de unitario × total aunque haya otros números', () => {
  const r = parsearLinea('AMOXICILINA 500 MG X 16 CAPS   6   4.210,00   25.260,00');
  assert.equal(r.cantidad, 6);
  assert.equal(r.precioUnitario, 4210);
  const f = parsearLinea('PARACETAMOL 500 MG X 20 COMP 24,00 990,00 23.760,00');
  assert.equal(f.cantidad, 24);
});

test('cantidad al inicio y dosis que no se confunden con cantidad', () => {
  const r = parsearLinea('10 IBUPROFENO 400 MG X 20 COMP');
  assert.equal(r.cantidad, 10);
  assert.equal(r.descripcion, 'IBUPROFENO 400 MG X 20 COMP');
});

test('remito completo en texto: encabezado, líneas y lote/vto en la línea siguiente', () => {
  const ean = ean13('779900000103');
  const texto = `
DROGUERIA DEL SUR S.A.                      REMITO R
Av. Siempre Viva 1234 - CABA                N° 0003-00012345
CUIT: 30-71234567-8                         Fecha: 28/10/2026
Cliente: FARMACIA EPICFARMA
CODIGO  EAN            DESCRIPCION                       CANT
10233   ${ean}  AMOXICILINA 500 MG X 16 CAPS        6
        Lote: AMX883   Vto: 03/2027
10251                  IBUPROF. 600MG X10 COMPRIMIDOS    10   Lote IB6-22  Vto 05/27
SUBTOTAL                                                 16
Son pesos: cien mil
`;
  const r = parsearTexto(texto);
  assert.equal(r.tipoDocumento, 'REMITO');
  assert.equal(r.numero, '0003-00012345');
  assert.equal(r.fechaDocumento, '2026-10-28');
  assert.match(r.proveedor, /DROGUERIA DEL SUR/);
  assert.equal(r.lineas.length, 2);
  assert.deepEqual(
    r.lineas.map((l) => [l.cantidad, l.lote, l.vencimiento]),
    [[6, 'AMX883', '2027-03-31'], [10, 'IB6-22', '2027-05-31']]
  );
});

test('planilla (Excel/CSV) con encabezados y fecha como número de Excel', () => {
  const filas = [
    ['Distribuidora Norte SRL'],
    ['Factura B 0001-00004567'],
    ['Cod. Barras', 'Descripción', 'Cantidad', 'Lote', 'Vencimiento', 'Precio unit.'],
    [ean13('779900000104'), 'Paracetamol 500 mg x 20', 24, 'P1', '08/2028', '990,00'],
    ['', 'Gasas estériles 10x10', '30', '', 46022, 650],
    ['', 'TOTAL', '', '', '', 50000],
  ];
  const r = parsearFilas(filas);
  assert.equal(r.lineas.length, 2);
  assert.equal(r.lineas[0].cantidad, 24);
  assert.equal(r.lineas[0].vencimiento, '2028-08-31');
  assert.equal(r.lineas[0].precioUnitario, 990);
  assert.equal(r.lineas[1].vencimiento, '2025-12-31');
  assert.equal(r.numero, '0001-00004567');
});

test('nombres parecidos se reconocen y dosis distintas no', () => {
  const a = normalizar('Ibuprofeno 600 mg x 10 comprimidos');
  assert.ok(similitud(a, normalizar('IBUPROF. 600MG X10 COMPRIMIDOS')) >= 0.82);
  assert.ok(similitud(a, normalizar('IBUPROFENO 400 MG X 10 COMP')) < 0.82);
  assert.ok(similitud(normalizar('Omeprazol 20 mg x 14 cápsulas'), normalizar('OMEPRAZOL 20MG X 14 CAPSULAS')) > 0.95);
});
