// Copia los archivos del OCR (Tesseract) a public/ocr para que funcione sin internet.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(raiz, 'node_modules');
const destino = join(raiz, 'public', 'ocr');
mkdirSync(destino, { recursive: true });

const archivos = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', 'spa.traineddata.gz'],
];

for (const [origen, nombre] of archivos) {
  const desde = join(nm, origen);
  if (!existsSync(desde)) {
    console.error(`Falta ${origen}. Ejecutá "npm install" en frontend.`);
    process.exit(1);
  }
  copyFileSync(desde, join(destino, nombre));
}
console.log('OCR listo en public/ocr');
