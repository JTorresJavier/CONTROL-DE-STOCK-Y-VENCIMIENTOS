// scripts/electron-node.js
// Ejecuta Node.js usando el Node que trae Electron.
// Hace falta porque better-sqlite3 está compilado para Electron (no para el Node de la PC).
// Uso: node scripts/electron-node.js <archivo.js | --test carpeta>
const { spawnSync } = require('child_process');
const electron = require('electron'); // en Node común devuelve la ruta al ejecutable

const r = spawnSync(electron, process.argv.slice(2), {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});
process.exit(r.status ?? 1);
