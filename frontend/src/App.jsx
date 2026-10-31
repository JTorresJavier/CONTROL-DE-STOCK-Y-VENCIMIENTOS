// src/App.jsx
// Estructura de la app: menú lateral (o superior en el celular) y las pantallas.
import { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { DashboardPage } from './routes/DashboardPage.jsx';
import { ImportarPage } from './routes/ImportarPage.jsx';
import { IngresoPage } from './routes/IngresoPage.jsx';
import { SalidaPage } from './routes/SalidaPage.jsx';
import { VencimientosPage } from './routes/VencimientosPage.jsx';
import { ProductosPage } from './routes/ProductosPage.jsx';
import { MovimientosPage } from './routes/MovimientosPage.jsx';
import { ProveedoresPage } from './routes/ProveedoresPage.jsx';
import { AdminPage } from './routes/AdminPage.jsx';
import { HerramientasPage } from './routes/HerramientasPage.jsx';
import { useConfig } from './context/ConfigContext.jsx';

const MENU = [
  ['/dashboard', '🏠', 'Inicio'],
  ['/importar', '📥', 'Importar remito'],
  ['/ingreso', '📷', 'Ingreso'],
  ['/salida', '📤', 'Salida'],
  ['/vencimientos', '📅', 'Vencimientos'],
  ['/productos', '📦', 'Productos'],
  ['/movimientos', '🔁', 'Movimientos'],
  ['/proveedores', '🚚', 'Proveedores'],
  ['/admin', '📊', 'Reportes'],
  ['/herramientas', '🛠️', 'Herramientas'],
];

function App() {
  const { config } = useConfig();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [rutaPrevia, setRutaPrevia] = useState('');
  const { pathname } = useLocation();
  // En el celular el menú se cierra al cambiar de pantalla
  if (pathname !== rutaPrevia) { setRutaPrevia(pathname); setMenuAbierto(false); }

  return (
    <div className="layout">
      <aside className={`sidebar ${menuAbierto ? 'abierto' : ''}`}>
        <div className="marca">
          <span className="marca-logo">💊</span>
          <div>
            <strong>{config.nombreNegocio}</strong>
            <small>Stock y vencimientos</small>
          </div>
          <button type="button" className="boton-menu" aria-label="Menú" onClick={() => setMenuAbierto((v) => !v)}>☰</button>
        </div>
        <nav>
          {MENU.map(([ruta, icono, texto]) => (
            <NavLink key={ruta} to={ruta} className={({ isActive }) => (isActive ? 'activo' : '')}>
              <span className="nav-icono">{icono}</span> {texto}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="contenido">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/importar" element={<ImportarPage />} />
          <Route path="/ingreso" element={<IngresoPage />} />
          <Route path="/salida" element={<SalidaPage />} />
          <Route path="/vencimientos" element={<VencimientosPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/movimientos" element={<MovimientosPage />} />
          <Route path="/proveedores" element={<ProveedoresPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/herramientas" element={<HerramientasPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
