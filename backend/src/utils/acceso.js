// src/utils/acceso.js
// Protección del acceso desde la red local.
// - Desde la misma PC (la ventana de la app): acceso completo.
// - Desde otro equipo (celular): solo si está activado en Herramientas y con el PIN de 6 dígitos.
//   Aun con PIN, desde otro equipo no se puede descargar/restaurar la base ni cambiar la configuración.

const LOCALES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const SOLO_LOCAL = [/^\/backup/, /^\/demo/, /^\/config$/];

function esLocal(req) {
  return LOCALES.has(req.socket.remoteAddress);
}

function protegerRed(leerConfig) {
  return (req, res, next) => {
    req.esLocal = esLocal(req);
    if (req.esLocal) return next();
    if (req.path === '/health') return next();
    const cfg = leerConfig();
    if (!cfg.accesoRed) {
      return res.status(403).json({ codigo: 'RED_DESACTIVADA', message: 'El uso desde otros equipos está desactivado. Activalo en Herramientas, en la PC.' });
    }
    if (String(req.get('x-pin') || '') !== cfg.pinRed) {
      return res.status(401).json({ codigo: 'PIN', message: 'Ingresá el PIN que aparece en Herramientas, en la PC.' });
    }
    if (SOLO_LOCAL.some((re) => re.test(req.path)) && !(req.path === '/config' && req.method === 'GET')) {
      return res.status(403).json({ message: 'Esta acción solo se puede hacer desde la PC.' });
    }
    next();
  };
}

// CORS solo para el servidor de desarrollo de Vite (puerto 5173); la app normal usa el mismo origen
const origenPermitido = (origin, cb) => cb(null, !origin || /^https?:\/\/[^/]+:5173$/.test(origin));

module.exports = { esLocal, protegerRed, origenPermitido };
