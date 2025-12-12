// src/routes/VencimientosPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { getLotesVencimientos } from '../services/api';
import { VencimientosTable } from '../components/VencimientosTable';

// Agrupa por (codigo_barra + fecha_vencimiento) y suma cantidades
function agruparLotes(lotes) {
  const mapa = new Map();

  for (const lote of lotes) {
    const key = `${lote.codigo_barra}-${lote.fecha_vencimiento}`;

    if (!mapa.has(key)) {
      mapa.set(key, {
        ...lote,
        cantidad: Number(lote.cantidad) || 0
      });
    } else {
      const existente = mapa.get(key);
      existente.cantidad += Number(lote.cantidad) || 0;
      mapa.set(key, existente);
    }
  }

  return Array.from(mapa.values());
}

export function VencimientosPage() {
  const [lotes, setLotes] = useState([]);
  const [error, setError] = useState(null);
  const [ordenFecha, setOrdenFecha] = useState('asc'); // 'asc' o 'desc'

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await getLotesVencimientos();
        setLotes(data || []);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, []);

  // Agrupamos y ordenamos
  const lotesOrdenadosYAgrupados = useMemo(() => {
    // 1) agrupar por código + fecha
    const agrupados = agruparLotes(lotes);

    // 2) ordenar por fecha
    agrupados.sort((a, b) => {
      const fa = new Date(a.fecha_vencimiento);
      const fb = new Date(b.fecha_vencimiento);
      if (ordenFecha === 'asc') {
        return fa - fb; // más viejos / próximos primero
      }
      return fb - fa;   // más lejanos primero
    });

    return agrupados;
  }, [lotes, ordenFecha]);

  return (
    <div className="page">
      <div className="card">
        <h2>Vencimientos</h2>
        {error && <div className="alert-error">{error}</div>}

        {/* Selector de orden */}
        <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>Ordenar por fecha:</span>
          <select
            value={ordenFecha}
            onChange={(e) => setOrdenFecha(e.target.value)}
          >
            <option value="asc">Más próximos primero</option>
            <option value="desc">Más lejanos primero</option>
          </select>
        </div>

        <p>
          Total lotes cargados (agrupados): {lotesOrdenadosYAgrupados.length}
        </p>

        <VencimientosTable lotes={lotesOrdenadosYAgrupados} />
      </div>
    </div>
  );
}
