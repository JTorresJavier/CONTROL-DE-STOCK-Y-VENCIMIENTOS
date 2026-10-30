// src/import/normalizar.js
// Normaliza nombres de productos y mide qué tan parecidos son dos nombres.

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'en', 'y', 'por', 'sin', 'a']);

// Unidades que se pegan al número: "500 MG" -> "500mg"
const UNIDADES = 'mg|mcg|ug|g|gr|grs|kg|ml|cc|l|lt|lts|ui|u|%|cm|mm|m';

// Sinónimos y abreviaturas habituales en remitos de farmacia
const SINONIMOS = {
  comprimidos: 'comp', comprimido: 'comp', comp: 'comp', cpr: 'comp', cps: 'caps', tabs: 'comp', tab: 'comp', tabletas: 'comp',
  capsulas: 'caps', capsula: 'caps', cap: 'caps', caps: 'caps',
  ampollas: 'amp', ampolla: 'amp', amp: 'amp',
  sobres: 'sob', sobre: 'sob', sob: 'sob',
  jarabe: 'jbe', jbe: 'jbe',
  suspension: 'susp', susp: 'susp',
  solucion: 'sol', sol: 'sol',
  gotas: 'gts', gts: 'gts',
  crema: 'crema', cr: 'crema',
  unidades: 'u', unidad: 'u', unid: 'u', uni: 'u', un: 'u',
  gramos: 'g', gr: 'g', grs: 'g',
  mililitros: 'ml',
};

function sinTildes(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizar(texto) {
  if (!texto) return '';
  let s = sinTildes(texto).toLowerCase();
  s = s.replace(/(\d),(\d)/g, '$1.$2'); // 0,5 mg -> 0.5mg
  s = s.replace(/[^a-z0-9.%]+/g, ' ');
  s = s.replace(/\.(?!\d)/g, ' ').replace(/(?<!\d)\./g, ' ');
  s = s.replace(new RegExp(`(\\d)\\s+(${UNIDADES})\\b`, 'g'), '$1$2'); // 500 mg -> 500mg
  s = s.replace(/\bx\s+(\d)/g, 'x$1'); // x 30 -> x30
  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => SINONIMOS[t] || t)
    .map((t) => t.replace(/^(\d+(?:\.\d+)?)(grs|gr)$/, '$1g'))
    .filter((t) => !STOPWORDS.has(t));
  return tokens.join(' ');
}

function tokens(normalizado) {
  return normalizado ? normalizado.split(' ') : [];
}

// Distancia de edición limitada (para errores de tipeo/OCR en palabras largas)
function levenshtein(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < minFila) minFila = cur[j];
    }
    if (minFila > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function tokensParecidos(a, b) {
  if (a === b) return 1;
  const tieneNumA = /\d/.test(a);
  const tieneNumB = /\d/.test(b);
  if (tieneNumA || tieneNumB) return 0; // "500mg" y "250mg" no son lo mismo
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.85;
  if (a.length >= 5 && b.length >= 5 && levenshtein(a, b, 1) <= 1) return 0.85;
  return 0;
}

function bigramas(s) {
  const t = s.replace(/\s+/g, '');
  const out = new Map();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}

function diceBigramas(a, b) {
  const A = bigramas(a);
  const B = bigramas(b);
  let inter = 0;
  let total = 0;
  for (const v of A.values()) total += v;
  for (const v of B.values()) total += v;
  for (const [g, v] of A) inter += Math.min(v, B.get(g) || 0);
  return total ? (2 * inter) / total : 0;
}

// Similitud entre 0 y 1 de dos nombres ya normalizados
function similitud(normA, normB) {
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  const ta = tokens(normA);
  const tb = tokens(normB);

  // Coincidencia de palabras (cada palabra de A busca su mejor par en B)
  let suma = 0;
  const usados = new Set();
  for (const a of ta) {
    let mejor = 0;
    let idx = -1;
    tb.forEach((b, i) => {
      if (usados.has(i)) return;
      const p = tokensParecidos(a, b);
      if (p > mejor) { mejor = p; idx = i; }
    });
    if (idx >= 0) usados.add(idx);
    suma += mejor;
  }
  const porPalabras = (2 * suma) / (ta.length + tb.length);
  const porLetras = diceBigramas(normA, normB);
  let score = 0.65 * porPalabras + 0.35 * porLetras;

  // La primera palabra suele ser la droga o la marca: si no coincide, es otro producto
  const primeraA = ta.find((t) => !/\d/.test(t));
  const primeraB = tb.find((t) => !/\d/.test(t));
  if (primeraA && primeraB && tokensParecidos(primeraA, primeraB) === 0) score *= 0.5;

  // Si las dosis/presentaciones no coinciden, casi seguro es otro producto
  const numA = ta.filter((t) => /\d/.test(t));
  const numB = tb.filter((t) => /\d/.test(t));
  if (numA.length && numB.length) {
    const comunes = numA.filter((n) => numB.includes(n)).length;
    if (comunes === 0) score *= 0.6;
    else if (comunes < Math.min(numA.length, numB.length)) score *= 0.85;
  }
  return Math.max(0, Math.min(1, score));
}

module.exports = { normalizar, tokens, similitud, sinTildes };
