// electron/main.js
// Arranca el backend (API + app web en http://localhost:4000) y abre la ventana.
const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');

const PUERTO = 4000;
const URL_APP = `http://localhost:${PUERTO}/`;

// Una sola ventana de la app: si se abre otra vez, se enfoca la existente
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

function startBackend() {
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'src', 'server.js')
    : path.join(__dirname, '..', 'backend', 'src', 'server.js');

  // El backend también sirve la app web (para la ventana y para los celulares de la red)
  process.env.FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
  process.env.APP_VERSION = app.getVersion();
  process.env.PORT = String(PUERTO);
  return require(backendPath);
}

// Espera a que responda NUESTRO servidor (otro programa en el mismo puerto no sirve)
function esperarBackend(server, intentos = 40) {
  return new Promise((resolve, reject) => {
    const probar = (quedan) => {
      if (server?.errorInicio) { reject(server.errorInicio); return; }
      const reintentar = () => {
        if (quedan <= 0) reject(new Error('El servidor interno no respondió'));
        else setTimeout(() => probar(quedan - 1), 250);
      };
      const req = http.get(`${URL_APP}api/health`, (res) => {
        let cuerpo = '';
        res.on('data', (c) => { cuerpo += c; });
        res.on('end', () => {
          try {
            if (JSON.parse(cuerpo).app === 'control-stock') { resolve(); return; }
          } catch { /* no es JSON: otro programa */ }
          reintentar();
        });
      });
      req.on('error', reintentar);
    };
    probar(intentos);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Control de Stock - EpicFarma',
    backgroundColor: '#020617',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setMenuBarVisibility(false);
  // Los enlaces externos se abren en el navegador, no dentro de la app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(URL_APP)) shell.openExternal(url);
    return { action: url.startsWith(URL_APP) ? 'allow' : 'deny' };
  });
  win.loadURL(URL_APP);
}

app.whenReady().then(async () => {
  let server;
  try {
    server = startBackend();
    await esperarBackend(server);
  } catch (err) {
    const detalle = (server?.errorInicio || err)?.code === 'EADDRINUSE'
      ? `El puerto ${PUERTO} está ocupado por otro programa. Cerralo (o reiniciá la PC) y volvé a abrir la app.`
      : err.message;
    dialog.showErrorBox('No se pudo iniciar Control de Stock', detalle);
    app.quit();
    return;
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
