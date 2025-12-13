// src/routes/VencimientosPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { getLotesVencimientos } from '../services/api';
import { VencimientosTable } from '../components/VencimientosTable';

/**
 * 1) Función helper: convierte cualquier fecha (ISO con hora o YYYY-MM-DD)
 *    a clave diaria "YYYY-MM-DD".
 *    - Si viene "2025-12-12T10:33:00.000Z" -> "2025-12-12"
 *    - Si ya viene "2025-12-12" -> "2025-12-12"
 */
function toDia(fecha) {
  if (!fecha) return 'Sin fecha';
  // Si viene tipo Date o string, lo transformamos a string primero
  const s = String(fecha);
  // Si trae "T", nos quedamos con lo anterior (YYYY-MM-DD)
  return s.includes('T') ? s.split('T')[0] : s;
}

/**
 * 2) Formateo para mostrar en pantalla en formato argentino DD/MM/YYYY
 *    Recibe "YYYY-MM-DD" y devuelve "DD/MM/YYYY"
 */
function formatFechaAR(yyyyMMdd) {
  if (!yyyyMMdd || yyyyMMdd === 'Sin fecha') return yyyyMMdd;
  const [y, m, d] = yyyyMMdd.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * 3) Agrupar lotes por fecha_alta (DÍA), sin sumar cantidades.
 *    Esto sirve para ver "todo lo que se cargó ese día".
 *    Devuelve: [ [dia, items[]], [dia, items[]], ... ] ya ordenado por día.
 */
function agruparPorDiaDeCarga(lotes) {
  const mapa = new Map();

  for (const lote of lotes) {
    // clave de grupo = día de carga
    const dia = toDia(lote.fecha_alta);

    if (!mapa.has(dia)) {
      mapa.set(dia, []);
    }
    mapa.get(dia).push(lote);
  }

  // Convertimos el Map a array de pares y ordenamos por día (más nuevo primero)
  const grupos = Array.from(mapa.entries()).sort((a, b) => {
    const diaA = a[0];
    const diaB = b[0];

    if (diaA === 'Sin fecha') return 1;
    if (diaB === 'Sin fecha') return -1;

    return new Date(diaB) - new Date(diaA);
  });

  return grupos;
}

export function VencimientosPage() {
  // 4) Estado principal con los lotes que llegan del backend
  const [lotes, setLotes] = useState([]);

  // 5) Estado de error para mostrar en UI
  const [error, setError] = useState(null);

  // 6) Estado del orden de vencimiento dentro de cada grupo
  const [ordenFecha, setOrdenFecha] = useState('asc'); // 'asc' o 'desc'

  // 7) Cuando se monta el componente, pedimos datos al backend
  useEffect(() => {
    const load = async () => {
      try {
        setError(null); // limpiamos error anterior
        const data = await getLotesVencimientos(); // trae lotes desde el backend
        setLotes(data || []); // guardamos en estado (si viene null, usamos [])
      } catch (err) {
        setError(err.message); // si falla, guardamos mensaje
      }
    };
    load();
  }, []);

  /**
   * 8) Preparamos los grupos por día.
   *    - Primero agrupamos por fecha_alta
   *    - Luego ordenamos cada grupo por fecha_vencimiento según el selector
   */
  const gruposPorDia = useMemo(() => {
    // 8.1 agrupamos por día de carga
    const grupos = agruparPorDiaDeCarga(lotes);

    // 8.2 ordenamos los items dentro de cada día por vencimiento
    for (const [, items] of grupos) {
      items.sort((a, b) => {
        const fa = new Date(a.fecha_vencimiento);
        const fb = new Date(b.fecha_vencimiento);

        if (ordenFecha === 'asc') return fa - fb; // más próximos primero
        return fb - fa; // más lejanos primero
      });
    }

    return grupos;
  }, [lotes, ordenFecha]);

  /**
   * 9) Contador total de filas (sin agrupar cantidades)
   *    - suma la cantidad de items en cada grupo
   */
  const totalLineas = useMemo(() => {
    return gruposPorDia.reduce((acc, [, items]) => acc + items.length, 0);
  }, [gruposPorDia]);

  return (
    <div className="page">
      <div className="card">
        <h2>Vencimientos</h2>

        {/* 10) si hay error lo mostramos */}
        {error && <div className="alert-error">{error}</div>}

        {/* 11) selector para ordenar por fecha de vencimiento */}
        <div
          style={{
            marginBottom: '10px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>
            Ordenar por fecha:
          </span>

          <select value={ordenFecha} onChange={(e) => setOrdenFecha(e.target.value)}>
            <option value="asc">Más próximos primero</option>
            <option value="desc">Más lejanos primero</option>
          </select>
        </div>

        {/* 12) total de líneas que se muestran */}
        <p>Total líneas (por día): {totalLineas}</p>

        {/* 13) Render por grupos: un encabezado por día + tabla para ese día */}
        {gruposPorDia.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No hay lotes para mostrar.</p>
        ) : (
          gruposPorDia.map(([dia, items]) => (
            <div key={dia} style={{ marginTop: '14px' }}>
              {/* Encabezado del día */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}
              >
                <h3 style={{ margin: 0 }}>Cargado el: {formatFechaAR(dia)}</h3>
                <small style={{ color: '#9ca3af' }}>{items.length} líneas</small>
              </div>

              {/* Tabla de ese día */}
              <VencimientosTable lotes={items} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
