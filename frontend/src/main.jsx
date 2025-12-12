// src/main.jsx

// Importamos React y ReactDOM para montar la app
import React from 'react';
import ReactDOM from 'react-dom/client';
// Importamos el router para manejar rutas
import { BrowserRouter } from 'react-router-dom';
// Importamos el componente principal de la app
import App from './App.jsx';
// Importamos estilos globales (podés dejar lo que trae Vite o uno propio)
import './index.css';

// Creamos la raíz de React y renderizamos la app dentro del div con id="root"
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode ayuda en desarrollo a detectar problemas
  <React.StrictMode>
    {/* BrowserRouter envuelve toda la app para habilitar rutas */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
