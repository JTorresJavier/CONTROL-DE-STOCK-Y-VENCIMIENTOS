// src/routes/VencimientosPage.jsx
// Página principal de vencimientos
// Muestra todos los lotes activos con opciones de editar, descontar y eliminar
// Permite filtrar por nombre de producto y ordenar por fecha

import { useEffect, useState, useMemo, useCallback } from 'react';
import { getLotesVencimientos } from '../services/api';
import { VencimientosTable } from '../components/VencimientosTable';

// ─── Helper: convierte cualquier fecha a clave diaria "YYYY-MM-DD" ────────────
function toDia(fecha) {
  if (!fecha) return 'Sin fecha';
  const s = String(fecha);
  return s.includes('T') ? s.split('T')[0] : s;
}

// ─── Helper: formatea "YYYY-MM-DD" a "DD/MM/YYYY" para mostrar en pantalla ───
function formatFechaAR(yyyyMMdd) {
  if (!yyyyMMdd || yyyyMMdd === 'Sin fecha') return yyyyMMdd;
  const [y, m, d] = yyyyMMdd.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Helper: agrupa lotes por día de carga (fecha_alta) ──────────────────────
function agruparPorDiaDeCarga(lotes) {
  const mapa = new Map();
  for (const lote of lotes) {
    const dia = toDia(lote.fecha_alta);
    if (!mapa.has(dia)) mapa.set(dia, []);
    mapa.get(dia).push(lote);
  }
  return Array.from(mapa.entries()).sort((a, b) => {
    if (a[0] === 'Sin fecha') return 1;
    if (b[0] === 'Sin fecha') return -1;
    return new Date(b[0]) - new Date(a[0]);
  });
}

export function VencimientosPage() {
  const [lotes, setLotes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ordenFecha, setOrdenFecha] = useState('asc');
  const [vista, setVista] = useState('carga');

  // ─── Cargar lotes del backend ───────────────────────────────────────────────
  const cargarLotes = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getLotesVencimientos();
      setLotes(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarLotes();
  }, [cargarLotes]);

  // ─── Filtrar lotes según búsqueda ───────────────────────────────────────────
  const lotesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return lotes;
    const q = busqueda.trim().toLowerCase();
    return lotes.filter(
      (l) =>
        l.producto_nombre?.toLowerCase().includes(q) ||
        l.codigo_barra?.toLowerCase().includes(q)
    );
  }, [lotes, busqueda]);

  // ─── Agrupar por día de carga ───────────────────────────────────────────────
  const gruposPorDia = useMemo(() => {
    const grupos = agruparPorDiaDeCarga(lotesFiltrados);
    for (const [, items] of grupos) {
      items.sort((a, b) => {
        const fa = new Date(a.fecha_vencimiento);
        const fb = new Date(b.fecha_vencimiento);
        return ordenFecha === 'asc' ? fa - fb : fb - fa;
      });
    }
    return grupos;
  }, [lotesFiltrados, ordenFecha]);

  const totalLineas = useMemo(() =>
    gruposPorDia.reduce((acc, [, items]) => acc + items.length, 0),
    [gruposPorDia]
  );

  // ─── Lotes ordenados globalmente por vencimiento ────────────────────────────
  const lotesOrdenadosPorVenc = useMemo(() => {
    return [...lotesFiltrados].sort((a, b) => {
      const fa = a?.fecha_vencimiento ? new Date(a.fecha_vencimiento) : new Date(8640000000000000);
      const fb = b?.fecha_vencimiento ? new Date(b.fecha_vencimiento) : new Date(8640000000000000);
      return ordenFecha === 'asc' ? fa - fb : fb - fa;
    });
  }, [lotesFiltrados, ordenFecha]);

  return (
    <div className="page">
      <div className="card" style={{ width: '100%', maxWidth: '1100px' }}>
        <h2>Vencimientos</h2>

        {error && <div className="alert-error">{error}</div>}
        {loading && <div className="alert-info">Cargando...</div>}

        {/* ── Controles ── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Buscar producto por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select value={vista} onChange={(e) => setVista(e.target.value)}>
            <option value="carga">Agrupado por fecha de carga</option>
            <option value="venc">Próximos a vencer (global)</option>
          </select>
          <select value={ordenFecha} onChange={(e) => setOrdenFecha(e.target.value)}>
            <option value="asc">Más próximos primero</option>
            <option value="desc">Más lejanos primero</option>
          </select>
          <button type="button" onClick={cargarLotes} disabled={loading}>
            🔄 Refrescar
          </button>
        </div>

        <p style={{ color: '#9ca3af', marginBottom: '10px' }}>
          Total líneas: <strong>
            {vista === 'carga' ? totalLineas : lotesOrdenadosPorVenc.length}
          </strong>
          {busqueda && <span> (filtrado por "{busqueda}")</span>}
        </p>

        {/* ── Vista global por vencimiento ── */}
        {vista === 'venc' ? (
          lotesOrdenadosPorVenc.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>No hay lotes para mostrar.</p>
          ) : (
            <VencimientosTable
              lotes={lotesOrdenadosPorVenc}
              onRefresh={cargarLotes}
              busqueda={busqueda}
            />
          )
        ) : (
          /* ── Vista agrupada por fecha de carga ── */
          gruposPorDia.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>No hay lotes para mostrar.</p>
          ) : (
            gruposPorDia.map(([dia, items]) => (
              <div key={dia} style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0 }}>Cargado el: {formatFechaAR(dia)}</h3>
                  <small style={{ color: '#9ca3af' }}>{items.length} líneas</small>
                </div>
                <VencimientosTable
                  lotes={items}
                  onRefresh={cargarLotes}
                  busqueda={busqueda}
                />
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}