// src/import/matcher.js
// Empareja las líneas leídas de un documento con los productos de la base.
// Orden: código de barras → código interno → nombre recordado de importaciones anteriores → nombre parecido.

const { normalizar, tokens, similitud } = require('./normalizar');

const UMBRAL_EXISTE = 0.82; // desde acá se asigna solo
const UMBRAL_SUGERIDO = 0.55; // entre los dos umbrales se sugiere y se pide confirmar

const sinCeros = (c) => String(c || '').replace(/^0+/, '');

// Arma índices en memoria con todos los productos (rápido aunque haya miles)
function crearIndice(db) {
  const productos = db.prepare('SELECT id, codigo_barra, codigo_interno, nombre FROM productos').all();
  const porBarra = new Map();
  const porInterno = new Map();
  const porPalabra = new Map();
  for (const p of productos) {
    p.norm = normalizar(p.nombre);
    porBarra.set(sinCeros(p.codigo_barra), p);
    if (p.codigo_interno) porInterno.set(String(p.codigo_interno).trim().toUpperCase(), p);
    for (const t of new Set(tokens(p.norm))) {
      if (t.length < 3 || /^\d/.test(t)) continue;
      if (!porPalabra.has(t)) porPalabra.set(t, []);
      porPalabra.get(t).push(p);
    }
  }
  const alias = new Map();
  for (const a of db.prepare('SELECT producto_id, texto_normalizado FROM producto_alias').all()) {
    alias.set(a.texto_normalizado, a.producto_id);
  }
  const porId = new Map(productos.map((p) => [p.id, p]));
  return { productos, porBarra, porInterno, porPalabra, alias, porId };
}

function resumen(p) {
  return { id: p.id, nombre: p.nombre, codigo_barra: p.codigo_barra, codigo_interno: p.codigo_interno };
}

// Busca candidatos por nombre usando solo los productos que comparten alguna palabra
function candidatosPorNombre(indice, norm) {
  const vistos = new Set();
  const lista = [];
  for (const t of tokens(norm)) {
    if (t.length < 3 || /^\d/.test(t)) continue;
    // también palabras que empiezan igual (amoxi → amoxicilina)
    const claves = indice.porPalabra.has(t) ? [t] : [];
    if (t.length >= 5) {
      for (const k of indice.porPalabra.keys()) {
        if (k !== t && (k.startsWith(t.slice(0, 5)))) claves.push(k);
      }
    }
    for (const k of claves) {
      for (const p of indice.porPalabra.get(k)) {
        if (!vistos.has(p.id)) { vistos.add(p.id); lista.push(p); }
      }
    }
  }
  return lista
    .map((p) => ({ producto: p, score: similitud(norm, p.norm) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function emparejarLinea(indice, linea) {
  // 1) Código de barras
  if (linea.ean) {
    const p = indice.porBarra.get(sinCeros(linea.ean));
    if (p) return { estado: 'existe', producto: resumen(p), confianza: 1, motivo: 'Código de barras' };
  }
  const norm = normalizar(linea.descripcion);

  // 2) Código interno (o un código que coincide con un código de barras cargado).
  // Cada proveedor usa sus propios códigos: si el nombre no se parece o el EAN dice otra cosa, solo se sugiere.
  if (linea.codigo) {
    const c = String(linea.codigo).trim().toUpperCase();
    const p = indice.porInterno.get(c) || indice.porBarra.get(sinCeros(c));
    const eanContradice = p && linea.ean && /^\d{8,14}$/.test(p.codigo_barra) && sinCeros(p.codigo_barra) !== sinCeros(linea.ean);
    if (p && !eanContradice) {
      const parecido = norm ? similitud(norm, p.norm) : 1;
      if (parecido >= 0.5) return { estado: 'existe', producto: resumen(p), confianza: 0.98, motivo: 'Código interno' };
      return { estado: 'sugerido', producto: resumen(p), confianza: 0.6, motivo: 'Mismo código interno, pero el nombre es distinto', alternativas: [] };
    }
  }
  if (!norm) return { estado: 'nuevo', producto: null, confianza: 0, motivo: 'Sin descripción' };

  // 3) Ya se importó antes con este mismo nombre
  const idAlias = indice.alias.get(norm);
  if (idAlias && indice.porId.has(idAlias)) {
    return { estado: 'existe', producto: resumen(indice.porId.get(idAlias)), confianza: 0.97, motivo: 'Reconocido de una importación anterior' };
  }

  // 4) Nombre parecido
  const cands = candidatosPorNombre(indice, norm);
  const alternativas = cands.filter((c) => c.score >= 0.4).map((c) => ({ ...resumen(c.producto), confianza: Number(c.score.toFixed(2)) }));
  const mejor = cands[0];
  if (mejor) {
    // Si el documento trae un código de barras distinto al del producto parecido, es otra presentación
    const otroCodigo = linea.ean && /^\d{8,14}$/.test(mejor.producto.codigo_barra) && sinCeros(mejor.producto.codigo_barra) !== sinCeros(linea.ean);
    const score = otroCodigo ? Math.min(mejor.score, UMBRAL_EXISTE - 0.01) : mejor.score;
    const pct = Math.round(mejor.score * 100);
    if (score >= UMBRAL_EXISTE) {
      return { estado: 'existe', producto: resumen(mejor.producto), confianza: Number(score.toFixed(2)), motivo: `Nombre parecido (${pct}%)`, alternativas };
    }
    if (score >= UMBRAL_SUGERIDO) {
      return { estado: 'sugerido', producto: resumen(mejor.producto), confianza: Number(score.toFixed(2)), motivo: `¿Es este? Nombre parecido (${pct}%)`, alternativas };
    }
  }
  return { estado: 'nuevo', producto: null, confianza: 0, motivo: 'No está en la base', alternativas };
}

function emparejar(db, lineas) {
  const indice = crearIndice(db);
  return lineas.map((l) => ({ ...l, ...emparejarLinea(indice, l) }));
}

module.exports = { emparejar, emparejarLinea, crearIndice, UMBRAL_EXISTE, UMBRAL_SUGERIDO };
