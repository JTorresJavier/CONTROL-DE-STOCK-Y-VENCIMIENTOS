// src/import/parser.js
// Lee el contenido de un remito o factura (texto o planilla) y extrae las líneas de productos:
// código de barras, código interno, descripción, cantidad, lote, vencimiento y precio.
// No depende de la base de datos: el emparejamiento con productos está en matcher.js.

const { parseFechaFlexible, esFechaISO } = require('../utils/fechas');
const { sinTildes } = require('./normalizar');

// ─── Utilidades ───────────────────────────────────────────────────────────────

// Dígito verificador GS1 (EAN-8, UPC-A, EAN-13, EAN-14)
function eanValido(codigo) {
  if (!/^\d{8}$|^\d{12,14}$/.test(codigo)) return false;
  const digitos = codigo.split('').map(Number);
  const control = digitos.pop();
  let suma = 0;
  digitos.reverse().forEach((d, i) => { suma += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (suma % 10)) % 10 === control;
}

// "1.234,56" -> 1234.56 ; "1234.56" -> 1234.56 ; "1,234.56" -> 1234.56
function parseNumero(txt) {
  let s = String(txt).replace(/[$\s]/g, '');
  if (!s) return null;
  // OCR: "14.207.50" o "2,100,00" → el último separador seguido de 2 dígitos es el decimal
  const partes = s.split(/[.,]/);
  if (partes.length >= 3 && partes[partes.length - 1].length === 2 && partes.slice(1, -1).every((p) => p.length === 3)) {
    return Number(partes.slice(0, -1).join('') + '.' + partes[partes.length - 1]);
  }
  const ultimaComa = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');
  if (ultimaComa > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.');
  else if (ultimoPunto > ultimaComa && ultimaComa >= 0) s = s.replace(/,/g, '');
  else if (ultimaComa === -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 1.500 = mil quinientos
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const plano = (s) => sinTildes(String(s || '')).toLowerCase();

// Líneas que nunca son productos
const RE_IGNORAR = new RegExp(
  '\\b(' + [
    'sub ?total', 'total(es)?', 'importe total', 'iva', 'i\\.v\\.a', 'neto gravado', 'no gravado', 'cuit', 'c\\.u\\.i\\.t',
    'ingresos brutos', 'iibb', 'ii\\.bb', 'condicion (frente al )?iva', 'domicilio', 'direccion', 'telefono', 'tel\\.?:',
    'pagina', 'hoja', 'cae', 'fecha de vto', 'transporte', 'bultos', 'firma', 'aclaracion', 'recibi conforme',
    'razon social', 'son pesos', 'percepcion', 'responsable inscripto', 'monotributo', 'inicio de actividades',
    'punto de venta', 'comprobante', 'cond\\.? de venta', 'forma de pago', 'email', 'e-mail', 'www', 'original', 'duplicado',
  ].join('|') + ')\\b'
);

// Encabezados de columna
const RE_ENCABEZADO = /\b(cod(igo)?|ean|barras?|desc(ripcion)?|detalle|producto|articulo|cant(idad)?|unid(ades)?|lote|vto|venc(imiento)?|precio|p\.? ?unit|importe|subtotal)\b/g;

const RE_UNIDAD_DESPUES = /^\s*(?:(?:mg|mcg|ug|g|gr|grs|kg|ml|cc|l|lt|lts|ui|cm|mm|comp|caps|tab|amp|sob|sobres|gts|u|un|unid)(?![a-z0-9])|%|x\d)/i;

// ─── Fechas dentro de una línea ───────────────────────────────────────────────
const MES = '(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic|jan|apr|aug|dec)';
const RE_FECHAS = [
  /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
  /\b\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})\b/g,
  new RegExp(`\\b(?:\\d{1,2}[-/. ])?${MES}[a-z]*\\.?[-/. ]?(?:\\d{4}|\\d{2})\\b`, 'gi'),
  /\b(0?[1-9]|1[0-2])[/-](20\d{2}|\d{2})\b/g,
];
// "Vto 1226" o "Venc: 311226" (solo con la palabra delante)
const RE_FECHA_CON_PALABRA = /\b(?:vto|vence|venc(?:imiento)?|exp|cad)\.?\s*:?\s*(\d{4}|\d{6}|\d{8})\b/i;

function extraerFechas(texto) {
  const encontradas = [];
  // OCR: la barra de "03/2027" a veces se lee como 7, 1, l o | → "0372027"
  let s = texto.replace(/(?<![\d.,])(0[1-9]|1[0-2])[71lI|](20[2-4]\d)(?![\d.,])/g, '$1/$2');
  const m = s.match(RE_FECHA_CON_PALABRA);
  if (m) {
    const iso = parseFechaFlexible(m[1]);
    if (iso) { encontradas.push(iso); s = s.replace(m[0], ' '); }
  }
  for (const re of RE_FECHAS) {
    s = s.replace(re, (txt) => {
      const limpio = txt.replace(/\s+/g, ' ').trim();
      const iso = parseFechaFlexible(limpio) || parseFechaFlexible(limpio.replace(/ /g, '-'));
      if (iso) { encontradas.push(iso); return ' '; }
      return txt;
    });
  }
  return { fechas: encontradas, resto: s };
}

// ─── Lote ─────────────────────────────────────────────────────────────────────
const RE_LOTE = /\b(?:lote|lot|lt|partida|batch)\b\.?\s*(?:n(?:ro|°|º)?\.?\s*)?[:#]?\s*([a-z0-9][a-z0-9/-]{1,19})/i;
const RE_LOTE_CORTO = /(?:^|\s)l\s*[:.]\s*([a-z0-9][a-z0-9/-]{1,19})/i;

function extraerLote(texto) {
  const m = texto.match(RE_LOTE) || texto.match(RE_LOTE_CORTO);
  if (!m) return { lote: null, resto: texto };
  return { lote: m[1].toUpperCase(), resto: texto.replace(m[0], ' ') };
}

// ─── Una línea de texto ───────────────────────────────────────────────────────
function parsearLinea(original, opciones = {}) {
  let s = ` ${original.replace(/\t/g, '   ')} `;

  // Fechas (vencimiento) y lote primero, para que sus números no se confundan con cantidades
  const f = extraerFechas(s);
  s = f.resto;
  const l = extraerLote(s);
  s = l.resto;

  // Códigos de barras: 8 a 14 dígitos (preferimos los que tienen dígito verificador válido)
  const largos = [...s.matchAll(/(?<![\d.,])\d{8,14}(?![\d.,])/g)].map((m) => m[0]);
  const ean = largos.find(eanValido) || largos.find((c) => c.length === 13) || null;
  for (const c of largos) s = s.replace(c, ' ');

  // Precios: números con decimales (1.234,56 / 1234.56 / 12,50)
  const decimales = [];
  s = s.replace(/(?<![\w.,])\$?\s?(\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{1,2})(?![\w.,])/g, (txt, num, pos, todo) => {
    // "0,5 mg" o "x 2,5 ml" es una dosis o presentación, no un precio
    if (RE_UNIDAD_DESPUES.test(todo.slice(pos + txt.length)) || /x\s*$/i.test(todo.slice(0, pos))) return txt;
    const n = parseNumero(num);
    if (n !== null) { decimales.push(n); return ' # '; }
    return txt;
  });

  // Código interno al inicio: "A1234", "12345" seguido de texto (si no es la cantidad)
  let codigo = null;

  // Cantidades candidatas: enteros sueltos que no son dosis ("500 mg") ni presentaciones ("x 30")
  const candidatos = [];
  const reEntero = /(?<![\w.,/-])(\d{1,6})(?![\w.,/%-])/g;
  let m;
  while ((m = reEntero.exec(s))) {
    const antes = s.slice(0, m.index);
    const despues = s.slice(m.index + m[0].length);
    if (/x\s*$/i.test(antes)) continue; // "x 30"
    if (RE_UNIDAD_DESPUES.test(despues)) continue; // "500 mg"
    candidatos.push({ valor: Number(m[1]), index: m.index, texto: m[0] });
  }

  const posDesc = (s.search(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/) + 1 || s.length + 1) - 1;
  const antesDeDesc = candidatos.filter((c) => c.index < posDesc);
  const despuesDeDesc = candidatos.filter((c) => c.index > posDesc);

  let cantidad = null;
  let precioUnitario = null;
  let cantidadElegida = null;

  // Cantidad con decimales en facturas ("10,00  1.250,00  12.500,00"): q × unitario = total
  if (decimales.length >= 3) {
    for (let i = 0; i + 2 < decimales.length; i++) {
      const [q, u, t] = decimales.slice(i, i + 3);
      if (Number.isInteger(q) && q > 0 && Math.abs(q * u - t) <= Math.max(0.02, t * 0.01)) {
        cantidad = q; precioUnitario = u; break;
      }
    }
  }

  if (cantidad === null && candidatos.length) {
    // Si hay unitario y total, la cantidad es el entero que cumple cantidad × unitario = total
    if (decimales.length >= 2) {
      const u = decimales[decimales.length - 2];
      const t = decimales[decimales.length - 1];
      cantidadElegida = candidatos.find((c) => c.valor > 0 && Math.abs(c.valor * u - t) <= Math.max(0.02, t * 0.01));
      if (cantidadElegida) precioUnitario = u;
    }
    if (!cantidadElegida) {
      if (opciones.cantidadAlInicio && antesDeDesc.length) cantidadElegida = antesDeDesc[antesDeDesc.length - 1];
      else if (opciones.cantidadAlFinal && despuesDeDesc.length) cantidadElegida = despuesDeDesc[0];
      else if (antesDeDesc.length && !despuesDeDesc.length) cantidadElegida = antesDeDesc[antesDeDesc.length - 1];
      else if (despuesDeDesc.length) cantidadElegida = despuesDeDesc[0];
      else cantidadElegida = antesDeDesc[antesDeDesc.length - 1];
    }
    if (cantidadElegida) cantidad = cantidadElegida.valor;

    // Columna "Lote" sin la palabra en la línea: código alfanumérico que viene después de la cantidad
    if (opciones.columnaLote && !l.lote && cantidadElegida) {
      const fin = cantidadElegida.index + cantidadElegida.texto.length;
      const mLote = s.slice(fin).match(/(?<![\w])(?=[a-z0-9/-]*\d)(?=[a-z0-9/-]*[a-z])[a-z0-9][a-z0-9/-]{2,19}(?![\w])/i);
      if (mLote) {
        l.lote = mLote[0].toUpperCase();
        const pos = fin + mLote.index;
        s = s.slice(0, pos) + ' '.repeat(mLote[0].length) + s.slice(pos + mLote[0].length);
      }
    }
    if (precioUnitario === null && decimales.length) precioUnitario = decimales[0];

    // Un entero antes de la descripción que no es la cantidad: lo tomamos como código interno
    const otro = antesDeDesc.find((c) => c !== cantidadElegida && String(c.valor).length >= 3);
    if (otro) codigo = otro.texto;
  } else if (precioUnitario === null && decimales.length) {
    precioUnitario = decimales[0];
  }

  // Código alfanumérico al inicio (ej: "AB123 IBUPROFENO ...")
  const alfa = s.match(/^\s*([a-z]{1,4}-?\d{2,8}|\d{2,8}-?[a-z]{1,3})\s+(?=[a-z]{3,})/i);
  if (!codigo && alfa) {
    codigo = alfa[1].toUpperCase();
    s = s.replace(alfa[0], ' ');
  }

  // Descripción: lo que queda sin números sueltos, símbolos ni palabras de columna
  let desc = s;
  if (cantidadElegida) desc = desc.slice(0, cantidadElegida.index) + ' '.repeat(cantidadElegida.texto.length) + desc.slice(cantidadElegida.index + cantidadElegida.texto.length);
  if (codigo) desc = desc.replace(new RegExp(`(?<![\\w])${codigo.replace(/[-]/g, '\\-')}(?![\\w])`, 'i'), ' ');
  desc = desc
    .replace(/#/g, ' ')
    .replace(/\b(vto|venc(imiento)?|vence|lote|cant(idad)?|c\/u|p\.?\s?unit|precio)\b\.?:?/gi, ' ')
    .replace(/(?<![\w.,]|x\s*)\d{1,6}(?![\w.,%])\s*$/gi, ' ') // número suelto al final (columnas sin usar), pero no "x 30"
    .replace(/^\s*\d{1,6}(?![\w.,%])\s+/g, ' ') // número suelto al principio
    .replace(/[|$*_=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, '')
    .trim();

  const letras = (desc.match(/[a-záéíóúñ]/gi) || []).length;

  return {
    original: original.trim(),
    ean,
    codigo,
    descripcion: letras >= 3 ? desc : '',
    cantidad,
    lote: l.lote,
    vencimiento: f.fechas.length ? f.fechas[f.fechas.length - 1] : null,
    precioUnitario,
  };
}

// ─── Datos del documento (proveedor, número, fecha) ───────────────────────────
function extraerEncabezado(lineas) {
  const texto = lineas.join('\n');
  const t = plano(texto);
  let tipoDocumento = null;
  if (/factura/.test(t)) tipoDocumento = 'FACTURA';
  else if (/remito/.test(t)) tipoDocumento = 'REMITO';
  else if (/nota de (pedido|entrega)/.test(t)) tipoDocumento = 'NOTA DE ENTREGA';

  let numero = null;
  const mNum =
    texto.match(/\b(\d{4,5}\s?[-.]\s?\d{6,8})\b/) ||
    texto.match(/(?:remito|factura|comprobante)\s*(?:[a-z]\s+)?(?:n[°º.]?|nro\.?|numero)?\s*[:#]?\s*([a-z]?\s?\d[\d-]{3,})/i) ||
    texto.match(/\b(?:n[°º]|nro\.?)\s*[:#]?\s*(\d[\d-]{3,})/i);
  if (mNum) numero = mNum[1].replace(/\s+/g, '').replace(/^(\d{4,5})\.(\d{6,8})$/, '$1-$2').toUpperCase();

  let fechaDocumento = null;
  const mFecha = texto.match(/fecha(?:\s+de\s+emisi[oó]n)?\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i);
  if (mFecha) fechaDocumento = parseFechaFlexible(mFecha[1]);

  let proveedor = null;
  const mProv = texto.match(/(?:proveedor|raz[oó]n social|emisor|vendedor)\s*:\s*([^\n]{3,60})/i);
  if (mProv) proveedor = mProv[1];
  else {
    for (const linea of lineas.slice(0, 12)) {
      const p = plano(linea);
      if (/(cliente|senor|sr\.|destinatario|entregar a)/.test(p)) continue;
      if (/\b(s\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?\s?s\.?|droguer\w*|distribuid\w*|laboratorio\w*|farmaceutica)\b/.test(p)) {
        proveedor = linea;
        break;
      }
    }
  }
  if (proveedor) {
    proveedor = proveedor
      .replace(/\b(remito|factura|original|duplicado|cuit|c\.u\.i\.t)\b.*$/i, '')
      .replace(/\s{2,}.*/, '')
      .replace(/[|]/g, ' ')
      .trim()
      .slice(0, 60) || null;
  }

  return { tipoDocumento, numero, fechaDocumento, proveedor };
}

// ─── Texto completo (TXT, PDF, OCR, texto pegado) ─────────────────────────────
function parsearTexto(texto) {
  const lineas = String(texto || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').trimEnd())
    .filter((l) => l.trim());

  const encabezado = extraerEncabezado(lineas);
  const opciones = {};
  const items = [];

  const esEncabezadoTabla = (p) =>
    /\b(desc(ripcion)?|detalle|producto|articulo)\b/.test(p) && new Set(p.match(RE_ENCABEZADO) || []).size >= 2 && !/\d{3,}/.test(p);
  // Si hay encabezado de columnas, lo de arriba (datos del proveedor y del cliente) no son productos
  const inicioTabla = Math.max(0, lineas.findIndex((l) => esEncabezadoTabla(plano(l))));

  lineas.forEach((linea, i) => {
    if (i < inicioTabla) return;
    const p = plano(linea);

    // Encabezado de la tabla: aprendemos dónde está la cantidad
    if (esEncabezadoTabla(p)) {
      const iCant = p.search(/\b(cant(idad)?|unid(ades)?)\b/);
      const iDesc = p.search(/\b(desc(ripcion)?|detalle|producto|articulo)\b/);
      if (iCant >= 0 && iDesc >= 0) {
        opciones.cantidadAlInicio = iCant < iDesc;
        opciones.cantidadAlFinal = iCant > iDesc;
      }
      const iLote = p.search(/\b(lote|partida)\b/);
      opciones.columnaLote = iLote >= 0 && iLote > iCant;
      return;
    }
    if (RE_IGNORAR.test(p) && !/\d{8,14}/.test(p)) return;

    const r = parsearLinea(linea, opciones);

    // Línea sin producto que solo trae lote/vencimiento: completa la línea anterior
    if (!r.descripcion && !r.ean && (r.lote || r.vencimiento) && items.length) {
      const prev = items[items.length - 1];
      if (!prev.lote && r.lote) prev.lote = r.lote;
      if (!prev.vencimiento && r.vencimiento) prev.vencimiento = r.vencimiento;
      return;
    }

    if (!r.descripcion && !r.ean) return;
    if (r.cantidad === null && !r.ean) return; // texto suelto sin cantidad ni código
    if (r.vencimiento && encabezado.fechaDocumento === r.vencimiento && !RE_FECHA_CON_PALABRA.test(linea)) r.vencimiento = null;
    items.push({ linea: i + 1, ...r });
  });

  return { ...encabezado, lineas: items };
}

// ─── Planillas (Excel, CSV) ───────────────────────────────────────────────────
const COLUMNAS = {
  ean: /(ean|gtin|barra|barras|cod(igo)?\.?\s*(de\s*)?barras?)/,
  codigo: /^(cod(igo)?\.?(\s*(interno|art(iculo)?|prod(ucto)?))?|sku|id|art\.?|articulo|ref(erencia)?)$/,
  descripcion: /(desc|producto|detalle|articulo|nombre|medicamento|item)/,
  cantidad: /(cant|unidades|unid|qty|^u\.?$|bultos)/,
  lote: /(lote|partida|batch)/,
  vencimiento: /(venc|vto|expira|caduc|fecha\s*v)/,
  precio: /(precio|p\.?\s*unit|unitario|costo)/,
  laboratorio: /(laboratorio|^lab\.?$|marca)/,
};

function textoCelda(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// Número de serie de Excel (días desde 1899-12-30) a fecha
function fechaDesdeExcel(n) {
  if (!(n > 20000 && n < 80000)) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return d.toISOString().slice(0, 10);
}

function detectarColumnas(fila) {
  const mapa = {};
  fila.forEach((celda, i) => {
    const t = plano(textoCelda(celda));
    if (!t || t.length > 40) return;
    for (const [campo, re] of Object.entries(COLUMNAS)) {
      if (mapa[campo] === undefined && re.test(t)) {
        // "Código de barras" no es el código interno; "Descripción" no es el lote, etc.
        if (campo === 'codigo' && COLUMNAS.ean.test(t)) continue;
        if (campo === 'descripcion' && (COLUMNAS.ean.test(t) || COLUMNAS.codigo.test(t))) continue;
        mapa[campo] = i;
        break;
      }
    }
  });
  return mapa;
}

function parsearFilas(filas) {
  const limpias = (filas || []).filter((f) => Array.isArray(f) && f.some((c) => textoCelda(c)));
  let idxEncabezado = -1;
  let mapa = null;
  for (let i = 0; i < Math.min(limpias.length, 20); i++) {
    const m = detectarColumnas(limpias[i]);
    if (m.descripcion !== undefined && (m.cantidad !== undefined || m.ean !== undefined)) {
      idxEncabezado = i;
      mapa = m;
      break;
    }
  }

  // Sin encabezado reconocible: tratamos cada fila como una línea de texto
  if (!mapa) {
    return parsearTexto(limpias.map((f) => f.map(textoCelda).join('   ')).join('\n'));
  }

  const encabezado = extraerEncabezado(limpias.slice(0, idxEncabezado).map((f) => f.map(textoCelda).join(' ')));
  const items = [];
  for (let i = idxEncabezado + 1; i < limpias.length; i++) {
    const fila = limpias[i];
    const celda = (campo) => (mapa[campo] === undefined ? '' : fila[mapa[campo]]);
    const descripcion = textoCelda(celda('descripcion'));
    if (!descripcion || RE_IGNORAR.test(plano(descripcion))) continue;

    let ean = textoCelda(celda('ean')).replace(/\D/g, '') || null;
    let codigo = textoCelda(celda('codigo')) || null;
    if (!ean && codigo && /^\d{8,14}$/.test(codigo)) { ean = codigo; codigo = null; }
    if (ean && !/^\d{8,14}$/.test(ean)) { codigo = codigo || ean; ean = null; }

    const cantRaw = celda('cantidad');
    const cantidad = typeof cantRaw === 'number' ? cantRaw : parseNumero(textoCelda(cantRaw));

    const vRaw = celda('vencimiento');
    let vencimiento = null;
    if (typeof vRaw === 'number') vencimiento = fechaDesdeExcel(vRaw);
    else if (esFechaISO(textoCelda(vRaw).slice(0, 10))) vencimiento = textoCelda(vRaw).slice(0, 10);
    else vencimiento = parseFechaFlexible(textoCelda(vRaw));

    const pRaw = celda('precio');
    const precioUnitario = typeof pRaw === 'number' ? pRaw : parseNumero(textoCelda(pRaw));

    items.push({
      linea: i + 1,
      original: fila.map(textoCelda).filter(Boolean).join(' | '),
      ean,
      codigo,
      descripcion,
      // Cantidades con decimales (1,5) no se redondean: quedan vacías para que se completen a mano
      cantidad: Number.isInteger(cantidad) && cantidad > 0 ? cantidad : null,
      lote: textoCelda(celda('lote')).toUpperCase() || null,
      vencimiento,
      precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : null,
      laboratorio: textoCelda(celda('laboratorio')) || null,
    });
  }
  return { ...encabezado, lineas: items };
}

module.exports = { parsearTexto, parsearFilas, parsearLinea, eanValido, parseNumero, extraerEncabezado };
