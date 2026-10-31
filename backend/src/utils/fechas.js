// src/utils/fechas.js
// Fechas como texto "AAAA-MM-DD" (sin horas), en la hora local de la PC.

const pad = (n) => String(n).padStart(2, '0');

// Hoy en hora local: "2026-10-30"
function hoyISO(base = new Date()) {
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

// Fecha y hora local: "2026-10-30 14:05:00"
function ahoraLocal(base = new Date()) {
  return `${hoyISO(base)} ${pad(base.getHours())}:${pad(base.getMinutes())}:${pad(base.getSeconds())}`;
}

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1, d + dias);
  return hoyISO(f);
}

function ultimoDiaDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function anio4(y) {
  const n = Number(y);
  return n < 100 ? 2000 + n : n;
}

// Arma la fecha si es válida (rechaza 31/02, mes 13, etc.)
function armar(anio, mes, dia) {
  const y = anio4(anio);
  const m = Number(mes);
  const d = dia === undefined ? ultimoDiaDelMes(y, m) : Number(dia);
  if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12)) return null;
  if (!(d >= 1 && d <= ultimoDiaDelMes(y, m))) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8,
  sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
};

// Interpreta una fecha de vencimiento escrita de cualquier forma habitual.
// Si solo trae mes y año (12/26, 1226, DIC-26), vence el último día de ese mes.
// Devuelve "AAAA-MM-DD" o null.
function parseFechaFlexible(texto) {
  if (texto === null || texto === undefined) return null;
  const s = String(texto).trim().toLowerCase();
  if (!s) return null;

  let m;
  // 2026-12-31
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return armar(m[1], m[2], m[3]);
  // 31/12/2026, 31-12-26, 31.12.26
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) return armar(m[3], m[2], m[1]);
  // 12/2026, 12/26, 12-26
  if ((m = s.match(/^(\d{1,2})[-/.](\d{2}|\d{4})$/))) return armar(m[2], m[1]);
  // 2026/12
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) return armar(m[1], m[2]);
  // Solo dígitos: MMAA (1226), DDMMAA (311226), DDMMAAAA (31122026)
  if (/^\d+$/.test(s)) {
    if (s.length === 4) return armar(s.slice(2), s.slice(0, 2));
    if (s.length === 6) return armar(s.slice(4), s.slice(2, 4), s.slice(0, 2));
    if (s.length === 8) return armar(s.slice(4), s.slice(2, 4), s.slice(0, 2));
    return null;
  }
  // DIC-26, dic/2026, dic 2026, 31-dic-26
  if ((m = s.match(/^(?:(\d{1,2})[-/. ])?([a-z]{3})[a-z]*\.?[-/. ]?(\d{2}|\d{4})$/))) {
    const mes = MESES[m[2]];
    if (!mes) return null;
    return armar(m[3], mes, m[1]);
  }
  return null;
}

// "2026-12-31" -> "31/12/2026"
function formatoAR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function esFechaISO(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && armar(s.slice(0, 4), s.slice(5, 7), s.slice(8, 10)) === s;
}

module.exports = { hoyISO, ahoraLocal, sumarDias, parseFechaFlexible, formatoAR, esFechaISO };
