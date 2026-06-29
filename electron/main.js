const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

function startBackend() {
  // En producción el backend está en resources/ (fuera del asar)
  // En desarrollo está en ../backend/
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'src', 'server.js')
    : path.join(__dirname, '..', 'backend', 'src', 'server.js');

  const dotenvPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', '.env')
    : path.join(__dirname, '..', 'backend', '.env');

  console.log('Backend path:', backendPath);
  console.log('Dotenv path:', dotenvPath);

  require('dotenv').config({ path: dotenvPath });
  require(backendPath);
}

function waitForBackend(retries = 20) {
  return new Promise((resolve, reject) => {
    const check = (attemptsLeft) => {
      const req = http.get('http://localhost:4000/api/productos', (res) => {
        resolve();
      });
      req.on('error', () => {
        if (attemptsLeft <= 0) reject(new Error('Backend no respondió'));
        else setTimeout(() => check(attemptsLeft - 1), 500);
      });
      req.end();
    };
    check(retries);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Control de Stock - EpicFarma',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  win.setMenuBarVisibility(false);

  if (app.isPackaged) {
    // En producción los archivos del frontend están dentro del asar
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');
    console.log('Cargando frontend:', fileUrl);
    win.loadURL(fileUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    const fileUrl = 'file:///' + indexPath.replace(/\\/g, '/');
    win.loadURL(fileUrl);
  }
}

app.whenReady().then(async () => {
  startBackend();
  try {
    await waitForBackend();
  } catch (err) {
    console.error('Backend no respondió:', err.message);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});