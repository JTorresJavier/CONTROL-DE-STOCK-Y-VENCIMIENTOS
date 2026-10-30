// src/app.js
// Arma la aplicación Express (sin levantar el puerto) para poder probarla.
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const productosRoutes = require('./routes/productos.routes');
const lotesRoutes = require('./routes/lotes.routes');
const stockRoutes = require('./routes/stock.routes');

const app = express();

app.disable('x-powered-by');
app.use(cors());
// La restauración de copias recibe el archivo crudo; el resto, JSON
app.use((req, res, next) => (req.path === '/api/backup/restaurar' ? next() : express.json({ limit: '25mb' })(req, res, next)));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/productos', productosRoutes);
app.use('/api/lotes', lotesRoutes);
app.use('/api', stockRoutes);

// Ruta de API inexistente
app.use('/api', (req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

// La misma app web se sirve desde acá (Electron y celulares en la red local)
const frontend = process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(frontend, 'index.html'))) {
  app.use(express.static(frontend, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(frontend, 'index.html')));
}

// Errores: mensaje claro en español, sin detalles internos
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Datos inválidos' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'El archivo es demasiado grande' });
  const status = err.status && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('Error interno:', err);
  res.status(status).json({ message: status >= 500 ? 'Error interno. Intentá de nuevo.' : err.message, ...(err.extra || {}) });
});

module.exports = app;
