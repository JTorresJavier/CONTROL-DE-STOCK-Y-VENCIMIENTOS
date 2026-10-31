// src/utils/validar.js
// Validaciones comunes. Lanzan un error con status 400 que el manejador de errores devuelve como JSON.

class ErrorApp extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const error = (status, message, extra) => new ErrorApp(status, message, extra);

function entero(valor, { min = 0, max = 10_000_000, campo = 'cantidad' } = {}) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw error(400, `${campo[0].toUpperCase() + campo.slice(1)} inválida: tiene que ser un número entero${min > 0 ? ' mayor a 0' : ''}.`);
  }
  return n;
}

function texto(valor, { max = 200, requerido = false, campo = 'texto' } = {}) {
  const s = typeof valor === 'string' ? valor.trim() : valor === null || valor === undefined ? '' : String(valor).trim();
  if (requerido && !s) throw error(400, `Falta ${campo}.`);
  return s.slice(0, max) || null;
}

function idParam(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw error(400, 'Identificador inválido.');
  return n;
}

// Envuelve un controlador para que cualquier error termine en el manejador central
const manejar = (fn) => (req, res, next) => {
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (e) {
    next(e);
  }
};

module.exports = { ErrorApp, error, entero, texto, idParam, manejar };
