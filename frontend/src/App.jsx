// src/App.jsx

// Importamos componentes del router
import { Routes, Route, Link, Navigate } from 'react-router-dom';
// Importamos nuestras páginas
import { IngresoPage } from './routes/IngresoPage.jsx';
import { VencimientosPage } from './routes/VencimientosPage.jsx';
import { AdminPage } from './routes/AdminPage.jsx';
import { SalidaPage } from './routes/SalidaPage';

function App() {
  return (
    <div className="app-container">
      <header>
        <h1>Control de Stock y Vencimientos</h1>
        <nav>
          <Link to="/ingreso">Ingreso</Link>
          <Link to="/vencimientos">Vencimientos</Link>
          <Link to="/salida">Salida</Link>
          <Link to="/admin">Administración</Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/ingreso" element={<IngresoPage />} />
          <Route path="/vencimientos" element={<VencimientosPage />} />
          <Route path="/salida" element={<SalidaPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={<Navigate to="/ingreso" replace />} />
        </Routes>
      </main>
    </div>
  );
}


export default App;
