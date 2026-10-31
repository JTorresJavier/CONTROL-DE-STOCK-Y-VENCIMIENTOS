// src/utils/fechas.js
// Las fechas se manejan como texto "AAAA-MM-DD" para evitar el corrimiento de un día por zona horaria
// (new Date("2026-05-01") es medianoche UTC = 30/04 a las 21 h en Argentina).

const pad = (n) => String(n).padStart(2, '0');

export function hoyISO(base = new Date()) {
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

export function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  return hoyISO(new Date(y, m - 1, d + dias));
}

// Días que faltan (negativo = vencido hace N días)
export function diasHasta(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const objetivo = Date.UTC(y, m - 1, d);
  const h = new Date();
  const hoy = Date.UTC(h.getFullYear(), h.getMonth(), h.getDate());
  return Math.round((objetivo - hoy) / 86400000);
}

// "2026-12-31" o "2026-12-31 10:20:00" → "31/12/2026"
export function formatoAR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!d) return String(iso);
  return `${d}/${m}/${y}`;
}

export function formatoFechaHora(txt) {
  if (!txt) return '';
  const s = String(txt);
  return `${formatoAR(s)}${s.length > 10 ? ' ' + s.slice(11, 16) : ''}`;
}

function ultimoDia(y, m) {
  return new Date(y, m, 0).getDate();
}

function armar(anio, mes, dia) {
  let y = Number(anio);
  if (y < 100) y += 2000;
  const m = Number(mes);
  const d = dia === undefined ? ultimoDia(y, m) : Number(dia);
  if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= ultimoDia(y, m))) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

// Igual que en el servidor: 12/26, 1226, 31/12/2026, 311226, DIC-26, 2026-12-31.
// Si solo hay mes y año, vence el último día del mes.
export function parseFechaFlexible(texto) {
  const s = String(texto ?? '').trim().toLowerCase();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return armar(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) return armar(m[3], m[2], m[1]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{2}|\d{4})$/))) return armar(m[2], m[1]);
  if (/^\d+$/.test(s)) {
    if (s.length === 4) return armar(s.slice(2), s.slice(0, 2));
    if (s.length === 6 || s.length === 8) return armar(s.slice(4), s.slice(2, 4), s.slice(0, 2));
    return null;
  }
  if ((m = s.match(/^(?:(\d{1,2})[-/. ])?([a-z]{3})[a-z]*\.?[-/. ]?(\d{2}|\d{4})$/))) {
    return MESES[m[2]] ? armar(m[3], MESES[m[2]], m[1]) : null;
  }
  return null;
}

// Semáforo según los días de alerta configurados
export function estadoVencimiento(iso, cfg = { alertaRoja: 30, alertaNaranja: 60, alertaAmarilla: 90 }) {
  const dias = diasHasta(iso);
  if (dias === null) return { nivel: 'sin', clase: '', texto: 'Sin fecha', dias };
  if (dias < 0) return { nivel: 'vencido', clase: 'row-vencido', texto: `Vencido hace ${-dias} día${dias === -1 ? '' : 's'}`, dias };
  const texto = dias === 0 ? 'Vence hoy' : `Faltan ${dias} día${dias === 1 ? '' : 's'}`;
  if (dias <= cfg.alertaRoja) return { nivel: 'rojo', clase: 'row-red', texto, dias };
  if (dias <= cfg.alertaNaranja) return { nivel: 'naranja', clase: 'row-orange', texto, dias };
  if (dias <= cfg.alertaAmarilla) return { nivel: 'amarillo', clase: 'row-yellow', texto, dias };
  return { nivel: 'verde', clase: 'row-green', texto, dias };
}
