// src/utils/extraer.js
// Lee el contenido de un remito/factura en el navegador, sin internet:
// - PDF con texto: pdf.js (si una página no tiene texto, es un escaneo → OCR)
// - Imágenes (foto o escaneo): OCR con Tesseract en español
// - Excel / CSV: filas y columnas
// - TXT: texto
// Devuelve { texto } o { filas } para mandar al servidor.

import * as XLSX from 'xlsx';

const EXT_IMAGEN = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
const EXT_PLANILLA = ['xlsx', 'xls', 'xlsm', 'ods'];
export const TIPOS_ACEPTADOS = '.pdf,.txt,.csv,.tsv,.xlsx,.xls,.xlsm,.ods,.png,.jpg,.jpeg,.webp,.bmp,.gif';

const extension = (nombre) => (nombre.split('.').pop() || '').toLowerCase();
const baseUrl = () => new URL('./', window.location.href).href;

// ─── Texto con la codificación correcta (los sistemas viejos exportan en Windows-1252) ───
function decodificar(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

// ─── CSV propio: detecta ; , o tabulación y respeta comillas ────────────────────
export function parsearCSV(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  const muestra = lineas.slice(0, 10).join('\n');
  const separador = [';', '\t', ','].map((s) => [s, muestra.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  return lineas.map((linea) => {
    const celdas = [];
    let actual = '';
    let comillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (comillas && linea[i + 1] === '"') { actual += '"'; i++; } else comillas = !comillas;
      } else if (c === separador && !comillas) {
        celdas.push(actual.trim());
        actual = '';
      } else actual += c;
    }
    celdas.push(actual.trim());
    return celdas;
  });
}

// ─── Excel ────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
function leerPlanilla(buffer) {
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });
  // La hoja con más filas suele ser la del detalle
  const hojas = libro.SheetNames.map((n) => XLSX.utils.sheet_to_json(libro.Sheets[n], { header: 1, raw: true, defval: '' }));
  const filas = hojas.sort((a, b) => b.length - a.length)[0] || [];
  return filas.map((fila) =>
    fila.map((v) => (v instanceof Date ? `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` : v))
  );
}

// ─── OCR (Tesseract, archivos locales en /ocr) ────────────────────────────────
let workerPromesa = null;
let avisarProgreso = () => {};

async function obtenerWorker() {
  if (!workerPromesa) {
    workerPromesa = (async () => {
      const { createWorker } = await import('tesseract.js');
      const base = baseUrl();
      return createWorker('spa', 1, {
        workerPath: `${base}ocr/worker.min.js`,
        corePath: `${base}ocr/`,
        langPath: `${base}ocr/`,
        gzip: true,
        logger: (m) => {
          if (m.status === 'recognizing text') avisarProgreso(`Reconociendo texto… ${Math.round(m.progress * 100)}%`);
          else if (m.status) avisarProgreso('Preparando lector de texto (OCR)…');
        },
      });
    })().catch((e) => {
      workerPromesa = null;
      throw e;
    });
  }
  return workerPromesa;
}

// Umbral automático (Otsu) para pasar a blanco y negro
function umbralOtsu(grises) {
  const hist = new Array(256).fill(0);
  for (const g of grises) hist[g]++;
  const total = grises.length;
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sumaB = 0, pesoB = 0, mejor = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    sumaB += t * hist[t];
    const mB = sumaB / pesoB;
    const mF = (suma - sumaB) / pesoF;
    const v = pesoB * pesoF * (mB - mF) ** 2;
    if (v > mejor) { mejor = v; umbral = t; }
  }
  return umbral;
}

// Prepara la imagen para el OCR: agranda, pasa a blanco y negro y borra las líneas de la tabla
// (los bordes de las celdas confunden mucho al reconocimiento de texto)
function prepararImagen(origen) {
  const ancho = origen.width || origen.naturalWidth;
  const alto = origen.height || origen.naturalHeight;
  const escala = ancho < 2600 ? Math.min(3, 2600 / ancho) : 1;
  const canvas = document.createElement('canvas');
  const W = (canvas.width = Math.round(ancho * escala));
  const H = (canvas.height = Math.round(alto * escala));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(origen, 0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;

  const grises = new Uint8Array(W * H);
  for (let p = 0, i = 0; p < grises.length; p++, i += 4) grises[p] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
  const umbral = umbralOtsu(grises);
  const negro = new Uint8Array(W * H);
  // "<=": en imágenes ya en blanco y negro puro, Otsu da umbral 0 y el negro (0) tiene que quedar negro
  for (let p = 0; p < negro.length; p++) negro[p] = grises[p] <= umbral ? 1 : 0;

  // Líneas horizontales: tramos negros muy largos en una fila
  const minH = Math.max(60, W * 0.08);
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!negro[y * W + x]) { x++; continue; }
      let fin = x;
      while (fin < W && negro[y * W + fin]) fin++;
      if (fin - x >= minH) for (let k = x; k < fin; k++) negro[y * W + k] = 2;
      x = fin;
    }
  }
  // Líneas verticales
  const minV = Math.max(60, H * 0.04);
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      if (!negro[y * W + x]) { y++; continue; }
      let fin = y;
      while (fin < H && negro[fin * W + x]) fin++;
      if (fin - y >= minV) for (let k = y; k < fin; k++) negro[k * W + x] = 2;
      y = fin;
    }
  }

  for (let p = 0, i = 0; p < negro.length; p++, i += 4) {
    const v = negro[p] === 1 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function ocr(imagen) {
  const worker = await obtenerWorker();
  // PSM 6: bloque de texto uniforme (respeta mejor las filas de una tabla)
  await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
  const { data } = await worker.recognize(imagen);
  return data.text || '';
}

async function ocrArchivoImagen(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await ocr(prepararImagen(img));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────
async function cargarPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

// Reconstruye las líneas del PDF agrupando los textos por altura y ordenándolos de izquierda a derecha
function lineasDePagina(items) {
  const filas = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    const x = it.transform[4];
    let fila = filas.find((f) => Math.abs(f.y - y) <= Math.max(2, (it.height || 10) * 0.4));
    if (!fila) { fila = { y, items: [] }; filas.push(fila); }
    fila.items.push({ x, ancho: it.width, str: it.str, alto: it.height || 10 });
  }
  filas.sort((a, b) => b.y - a.y);
  return filas.map((f) => {
    f.items.sort((a, b) => a.x - b.x);
    let linea = '';
    let finAnterior = null;
    for (const it of f.items) {
      if (finAnterior !== null) {
        const hueco = it.x - finAnterior;
        linea += hueco > it.alto * 1.2 ? '   ' : hueco > it.alto * 0.15 ? ' ' : '';
      }
      linea += it.str;
      finAnterior = it.x + (it.ancho || it.str.length * it.alto * 0.5);
    }
    return linea;
  });
}

async function leerPdf(buffer, progreso) {
  const pdfjs = await cargarPdfjs();
  const doc = await pdfjs.getDocument({ data: buffer, isEvalSupported: false }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    progreso(`Leyendo PDF: página ${n} de ${doc.numPages}…`);
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    const lineas = lineasDePagina(contenido.items);
    if (lineas.join('').replace(/\s/g, '').length >= 30) {
      paginas.push(lineas.join('\n'));
    } else {
      // Página escaneada: la dibujamos y aplicamos OCR
      progreso(`Página ${n} escaneada: reconociendo texto…`);
      const viewport = pagina.getViewport({ scale: 2.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      paginas.push(await ocr(prepararImagen(canvas)));
    }
  }
  return paginas.join('\n');
}

// ─── Entrada principal ────────────────────────────────────────────────────────
export async function extraerArchivo(archivo, progreso = () => {}) {
  avisarProgreso = progreso;
  const ext = extension(archivo.name);
  if (EXT_IMAGEN.includes(ext) || archivo.type.startsWith('image/')) {
    progreso('Reconociendo texto de la imagen…');
    return { texto: await ocrArchivoImagen(archivo), ocr: true };
  }
  const buffer = await archivo.arrayBuffer();
  if (ext === 'pdf' || archivo.type === 'application/pdf') return { texto: await leerPdf(buffer, progreso) };
  if (EXT_PLANILLA.includes(ext)) return { filas: leerPlanilla(buffer) };
  if (ext === 'csv' || ext === 'tsv') return { filas: parsearCSV(decodificar(buffer)) };
  return { texto: decodificar(buffer) };
}

// Varias imágenes (fotos de las hojas de un mismo remito) se leen como un solo documento
export async function extraerArchivos(archivos, progreso = () => {}) {
  const r = await extraerVarios(archivos, progreso);
  window.__ultimaLectura = r; // para diagnóstico (consola del navegador)
  return r;
}

async function extraerVarios(archivos, progreso) {
  if (archivos.length === 1) return extraerArchivo(archivos[0], progreso);
  const textos = [];
  for (const [i, a] of archivos.entries()) {
    const r = await extraerArchivo(a, (m) => progreso(`Archivo ${i + 1} de ${archivos.length}: ${m}`));
    if (r.filas) textos.push(r.filas.map((f) => f.join('   ')).join('\n'));
    else textos.push(r.texto);
  }
  return { texto: textos.join('\n') };
}
