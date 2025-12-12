// src/server.js

// Importamos express para crear el servidor HTTP
const express = require('express');
// cors permite que React (otro puerto) pueda llamar a esta API
const cors = require('cors');
// Importamos las rutas de productos y lotes
const productosRoutes = require('./routes/productos.routes');
// Importamos las rutas de lotes
const lotesRoutes = require('./routes/lotes.routes');
// Cargamos variables de entorno (.env)
require('dotenv').config();
// Importamos las rutas de stock
const stockRoutes = require('./routes/stock.routes');

// Creamos la app de Express
const app = express();

// Tomamos el puerto desde .env o usamos 4000
const PORT = process.env.PORT || 4000;

// Middleware para permitir CORS (acceso desde el frontend)
app.use(cors());

// Middleware para poder leer JSON en el body de las requests
app.use(express.json());

// Montamos las rutas de productos bajo /api/productos
app.use('/api/productos', productosRoutes);

// Montamos las rutas de lotes bajo /api/lotes
app.use('/api/lotes', lotesRoutes);

// Montamos las rutas de productos bajo /api/productos
app.use('/api', productosRoutes);

// Montamos las rutas de lotes bajo /api/lotes
app.use('/api', lotesRoutes);

// Montamos las rutas de stock bajo /api
app.use('/api', stockRoutes);

// Levantamos el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
