// src/server.js
// Levanta la API (y la app web) en el puerto 4000. Electron lo carga al iniciar.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = require('./app');
const { respaldoAutomatico } = require('./controllers/sistema.controller');

const PORT = Number(process.env.PORT) || 4000;

const server = app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} ya está en uso. ¿Hay otra ventana de la app abierta?`);
  } else {
    console.error('Error del servidor:', err);
  }
  server.errorInicio = err;
});

// Copia de seguridad automática al iniciar y una vez por día
const respaldar = () => respaldoAutomatico('auto').catch((e) => console.error('No se pudo crear el respaldo automático:', e.message));
setTimeout(respaldar, 5000).unref();
setInterval(respaldar, 24 * 60 * 60 * 1000).unref();

module.exports = server;
