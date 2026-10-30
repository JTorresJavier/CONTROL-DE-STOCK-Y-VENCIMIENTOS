// src/App.jsx
// Componente raíz de la app
// Define la navegación principal y las rutas de cada página

import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { IngresoPage } from './routes/IngresoPage.jsx';
import { VencimientosPage } from './routes/VencimientosPage.jsx';
import { AdminPage } from './routes/AdminPage.jsx';
import { DashboardPage } from './routes/DashboardPage.jsx';

function App() {
  return (
    <div className="app-container">
      <header>
        <h1>Control de Stock y Vencimientos</h1>
        <nav>
          <Link to="/dashboard">🏠 Inicio</Link>
          <Link to="/ingreso">Ingreso</Link>
          <Link to="/vencimientos">Vencimientos</Link>
          <Link to="/admin">Reportes</Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ingreso" element={<IngresoPage />} />
          <Route path="/vencimientos" element={<VencimientosPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;