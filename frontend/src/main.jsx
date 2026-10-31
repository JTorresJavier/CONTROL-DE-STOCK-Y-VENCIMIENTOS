// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
// HashRouter: funciona igual servida por el backend, en Electron o abierta como archivo
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { ConfigProvider } from './context/ConfigContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </HashRouter>
  </React.StrictMode>
);
