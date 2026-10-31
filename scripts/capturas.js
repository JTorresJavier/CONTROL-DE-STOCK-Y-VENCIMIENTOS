// scripts/capturas.js
// Prueba de punta a punta en la app real (Electron) con una base TEMPORAL y datos de ejemplo:
// importa cada archivo de /muestras (TXT, CSV, Excel, PDF, foto y PDF escaneado con OCR),
// confirma una importación y guarda capturas de las pantallas principales en /capturas.
// Uso: npx electron scripts/capturas.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const raiz = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-capturas-'));
process.env.STOCK_DB_PATH = path.join(tmp, 'demo.db');
process.env.PORT = '4599';
process.env.FRONTEND_DIST = path.join(raiz, 'frontend', 'dist');
const BASE = 'http://localhost:4599/';
const carpeta = path.join(raiz, 'capturas');
fs.mkdirSync(carpeta, { recursive: true });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarQue(win, expr, ms = 120000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (await win.webContents.executeJavaScript(`Boolean(${expr})`)) return true;
    await esperar(300);
  }
  throw new Error(`Tiempo agotado esperando: ${expr}`);
}

async function ir(win, ruta) {
  await win.webContents.executeJavaScript(`location.hash = '#${ruta}'`);
  await esperar(1200);
}

async function captura(win, nombre) {
  // Captura la página completa (alto del contenido)
  const alto = await win.webContents.executeJavaScript('Math.max(document.body.scrollHeight, 860)');
  win.setContentSize(1360, Math.min(alto, 2400));
  await esperar(500);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(carpeta, nombre), img.toPNG());
  win.setContentSize(1360, 860);
  console.log('📸', nombre);
}

async function subirArchivo(win, archivo) {
  const dbg = win.webContents.debugger;
  const { root } = await dbg.sendCommand('DOM.getDocument');
  const { nodeId } = await dbg.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
  await dbg.sendCommand('DOM.setFileInputFiles', { nodeId, files: [archivo] });
}

const clickTexto = (win, texto) => win.webContents.executeJavaScript(
  `(() => { const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.includes(${JSON.stringify(texto)})); if (b) b.click(); return !!b; })()`
);

app.whenReady().then(async () => {
  const resultados = [];
  try {
    require(path.join(raiz, 'backend', 'src', 'server.js'));
    await esperar(1000);
    await fetch(`${BASE}api/demo`, { method: 'POST' });

    const win = new BrowserWindow({ width: 1360, height: 860, show: false, backgroundColor: '#020617' });
    win.webContents.debugger.attach('1.3');
    await win.loadURL(`${BASE}#/dashboard`);
    await esperarQue(win, "document.querySelector('.tarjetas')");
    await esperar(800);
    await captura(win, '01-inicio-alertas.png');

    // Probar la importación con cada archivo de ejemplo
    const soloOCR = process.env.SOLO_OCR === '1';
    const muestras = soloOCR
      ? ['remito-foto.png', 'remito-escaneado.pdf']
      : ['remito-drogueria-del-sur.txt', 'factura-distribuidora-norte.csv', 'factura-distribuidora-norte.xlsx', 'remito-drogueria-del-sur.pdf', 'remito-foto.png', 'remito-escaneado.pdf'];
    for (const m of muestras) {
      await ir(win, '/importar');
      await esperarQue(win, "document.querySelector('input[type=file]')");
      const t0 = Date.now();
      await subirArchivo(win, path.join(raiz, 'muestras', m));
      await esperarQue(win, "document.querySelector('.tabla-importar') || document.querySelector('.alert-error')", 180000);
      const info = await win.webContents.executeJavaScript(`({
        error: document.querySelector('.alert-error')?.textContent || null,
        chips: [...document.querySelectorAll('.chips-resumen .chip')].map((c) => c.textContent).join(' | '),
        doc: [...document.querySelectorAll('.doc-datos input, .doc-datos select')].map((i) => i.value).join(' | '),
      })`);
      resultados.push({ archivo: m, segundos: Math.round((Date.now() - t0) / 100) / 10, ...info });
      console.log('📄', m, JSON.stringify(info));
      if (soloOCR) {
        console.log(await win.webContents.executeJavaScript('window.__ultimaLectura?.texto'));
        console.log(await win.webContents.executeJavaScript("[...document.querySelectorAll('.tabla-importar tbody tr')].map((r) => r.innerText.replace(/\\s+/g, ' ')).join('\\n')"));
      }
      if (m === 'remito-drogueria-del-sur.pdf') {
        await captura(win, '02-importar-revision.png');
        // Completar el vencimiento que falta con el teclado (1228 + Enter) y confirmar
        await clickTexto(win, 'Cargar vencimientos que faltan');
        await esperar(300);
        win.webContents.insertText('1228');
        await esperar(500);
        await captura(win, '03-importar-completo.png');
        await clickTexto(win, 'Confirmar ingreso');
        await esperarQue(win, "document.querySelector('.importar-listo') || document.querySelector('.alert-error')");
        await captura(win, '04-importar-listo.png');
        resultados.push({ confirmacion: await win.webContents.executeJavaScript("document.querySelector('.importar-listo')?.innerText || document.querySelector('.alert-error')?.innerText") });
        await clickTexto(win, 'Importar otro documento');
      } else {
        await clickTexto(win, 'Cancelar');
      }
    }

    if (soloOCR) { app.exit(0); return; }
    await ir(win, '/dashboard');
    await esperarQue(win, "document.querySelector('.tarjetas')");
    await captura(win, '05-inicio-despues-de-importar.png');
    await ir(win, '/vencimientos');
    await captura(win, '06-vencimientos.png');
    await ir(win, '/productos');
    await captura(win, '07-productos.png');
    await ir(win, '/movimientos');
    await captura(win, '08-movimientos.png');
    await ir(win, '/importar');
    await clickTexto(win, 'Historial');
    await esperar(800);
    await captura(win, '09-historial-importaciones.png');
    await ir(win, '/herramientas');
    await captura(win, '10-herramientas.png');
    await ir(win, '/ingreso');
    await captura(win, '11-ingreso-escaner.png');

    fs.writeFileSync(path.join(carpeta, 'resultado-pruebas.json'), JSON.stringify(resultados, null, 2));
  } catch (e) {
    console.error('ERROR', e);
    process.exitCode = 1;
  }
  app.exit(process.exitCode || 0);
});
