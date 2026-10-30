// src/routes/DashboardPage.jsx
// Página de inicio con resumen general del estado del stock
// Muestra estadísticas clave y los lotes más urgentes

import { useEffect, useState, useMemo } from 'react';
import { getLotesVencimientos, getProductos } from '../services/api';

// ─── Helper: días que faltan para el vencimiento ──────────────────────────────
function diasFaltan(fechaISO) {
  const hoy = new Date();
  const fv = new Date(fechaISO);
  hoy.setHours(0, 0, 0, 0);
  fv.setHours(0, 0, 0, 0);
  return Math.round((fv - hoy) / (1000 * 60 * 60 * 24));
}

// ─── Helper: formatea fecha ISO a DD/MM/YYYY ──────────────────────────────────
function formatFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ─── Tarjeta de estadística ───────────────────────────────────────────────────
function StatCard({ titulo, valor, color, icono, subtitulo }) {
  return (
    <div style={{
      background: 'radial-gradient(circle at top, #111827 0, #020617 55%)',
      border: `1px solid ${color}33`,
      borderRadius: '16px',
      padding: '20px 24px',
      flex: '1',
      minWidth: '180px',
      boxShadow: `0 4px 24px ${color}22`,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ fontSize: '28px' }}>{icono}</div>
      <div style={{ fontSize: '36px', fontWeight: '700', color }}>{valor}</div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e5e7eb' }}>{titulo}</div>
      {subtitulo && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{subtitulo}</div>}
    </div>
  );
}

export function DashboardPage() {
  const [lotes, setLotes] = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── Cargar datos al montar ───────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        const [lotesData, productosData] = await Promise.all([
          getLotesVencimientos(),
          getProductos()
        ]);
        setLotes(lotesData || []);
        setTotalProductos((productosData || []).length);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  // ─── Estadísticas calculadas ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const vencidos = lotes.filter((l) => diasFaltan(l.fecha_vencimiento) < 0);
    const proximos15 = lotes.filter((l) => {
      const d = diasFaltan(l.fecha_vencimiento);
      return d >= 0 && d <= 15;
    });
    const proximos30 = lotes.filter((l) => {
      const d = diasFaltan(l.fecha_vencimiento);
      return d >= 0 && d <= 30;
    });
    const activos = lotes.length;

    return { vencidos, proximos15, proximos30, activos };
  }, [lotes]);

  // ─── Los 10 lotes más urgentes (próximos a vencer o ya vencidos) ──────────
  const lotesUrgentes = useMemo(() => {
    return [...lotes]
      .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))
      .slice(0, 10);
  }, [lotes]);

  return (
    <div className="page">
      <div style={{ width: '100%', maxWidth: '1100px' }}>

        {/* ── Título ── */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>👋 Bienvenido</h2>
          <p style={{ color: '#9ca3af', margin: '4px 0 0' }}>
            Resumen del estado actual del stock — {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {loading && <div className="alert-info">Cargando datos...</div>}

        {/* ── Tarjetas de estadísticas ── */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <StatCard
            icono="📦"
            titulo="Productos registrados"
            valor={totalProductos}
            color="#3b82f6"
            subtitulo="Total en la base de datos"
          />
          <StatCard
            icono="✅"
            titulo="Lotes activos"
            valor={stats.activos}
            color="#22c55e"
            subtitulo="Con stock disponible"
          />
          <StatCard
            icono="⚠️"
            titulo="Próximos a vencer"
            valor={stats.proximos30.length}
            color="#facc15"
            subtitulo="En los próximos 30 días"
          />
          <StatCard
            icono="🔴"
            titulo="Lotes vencidos"
            valor={stats.vencidos.length}
            color="#ef4444"
            subtitulo="Con stock todavía"
          />
        </div>

        {/* ── Alerta si hay vencidos ── */}
        {stats.vencidos.length > 0 && (
          <div className="alert-error" style={{ marginBottom: '16px', fontSize: '14px' }}>
            ⚠️ Hay <strong>{stats.vencidos.length}</strong> lote{stats.vencidos.length > 1 ? 's' : ''} vencido{stats.vencidos.length > 1 ? 's' : ''} con stock disponible. Revisalos en la pestaña <strong>Vencimientos</strong>.
          </div>
        )}

        {/* ── Alerta si hay proximos en 15 dias ── */}
        {stats.proximos15.length > 0 && (
          <div style={{
            background: 'rgba(250,204,21,0.1)',
            border: '1px solid rgba(250,204,21,0.4)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#fef08a'
          }}>
            ⚡ <strong>{stats.proximos15.length}</strong> lote{stats.proximos15.length > 1 ? 's' : ''} vence{stats.proximos15.length === 1 ? '' : 'n'} en los próximos <strong>15 días</strong>.
          </div>
        )}

        {/* ── Tabla de lotes más urgentes ── */}
        <div className="card">
          <h3 style={{ margin: '0 0 12px' }}>🚨 Lotes más urgentes</h3>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '12px' }}>
            Los 10 lotes con fechas de vencimiento más próximas
          </p>

          {lotesUrgentes.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>No hay lotes cargados todavía.</p>
          ) : (
            <table className="table-venc">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Vencimiento</th>
                  <th>Lote</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lotesUrgentes.map((lote) => {
                  const dias = diasFaltan(lote.fecha_vencimiento);
                  let rowClass = 'row-green';
                  if (dias <= 30 && dias > 15) rowClass = 'row-yellow';
                  if (dias <= 15) rowClass = 'row-red';
                  return (
                    <tr key={lote.id} className={rowClass}>
                      <td>{lote.producto_nombre}</td>
                      <td className="text-right">{lote.cantidad}</td>
                      <td>{formatFecha(lote.fecha_vencimiento)}</td>
                      <td>{lote.lote || '-'}</td>
                      <td>
                        {dias >= 0
                          ? `Faltan ${dias} días`
                          : `Vencido hace ${Math.abs(dias)} días`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}