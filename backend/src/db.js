// src/db.js

// Importamos mysql2 en modo promesa para poder usar async/await
const mysql = require('mysql2/promise');
// Cargamos variables de entorno desde .env
require('dotenv').config();

// Creamos un pool de conexiones a MySQL
const pool = mysql.createPool({
  // Host del servidor de base de datos (normalmente localhost)
  host: process.env.DB_HOST,
  // Usuario de la base
  user: process.env.DB_USER,
  // Password del usuario
  password: process.env.DB_PASSWORD,
  // Nombre de la base de datos
  database: process.env.DB_NAME,
  // Puerto (por defecto 3306)
  port: process.env.DB_PORT || 3306,
  // Configs del pool
  waitForConnections: true,      // Esperar si no hay conexiones libres
  connectionLimit: 10,           // Máximo de conexiones simultáneas
  queueLimit: 0                  // Sin límite de cola
});

// Exportamos el pool para usarlo en los controllers
module.exports = pool;
