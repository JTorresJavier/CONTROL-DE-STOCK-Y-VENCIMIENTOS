// src/routes/VencimientosPage.jsx
// Todos los lotes con stock: búsqueda, filtro por semáforo, agrupado por fecha de carga o por vencimiento.
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLotesVencimientos } from '../services/api';
import { VencimientosTable } from '../components/VencimientosTable';
import { estadoVencimiento, formatoAR } from '../utils/fechas';
import { useConfig } from '../context/ConfigContext';
import { Mensajes, Vacio } from '../components/ui';

const ESTADOS = [
  ['', 'Todos'],
  ['vencido', '⛔ Vencidos'],
  ['rojo', '🔴 Rojo'],
  ['naranja', '🟠 Naranja'],
  ['amarillo', '🟡 Amarillo'],
  ['verde', '🟢 Lejanos'],
];

function agruparPorDiaDeCarga(lotes) {
  const mapa = new Map();
  for (const lote of lotes) {
    const dia = lote.fecha_alta ? String(lote.fecha_alta).slice(0, 10) : 'Sin fecha';
    if (!mapa.has(dia)) mapa.set(dia, []);
    mapa.get(dia).push(lote);
  }
  return [...mapa.entries()].sort((a, b) => (a[0] === 'Sin fecha' ? 1 : b[0] === 'Sin fecha' ? -1 : b[0].localeCompare(a[0])));
}

export function VencimientosPage() {
  const { config } = useConfig();
  const [params, setParams] = useSearchParams();
  const [lotes, setLotes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ordenFecha, setOrdenFecha] = useState('asc');
  const estado = params.get('estado') || '';
  const vista = params.get('vista') || 'venc';

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const cargarLotes = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setLotes((await getLotesVencimientos()) || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lotes
      .filter((l) => !estado || estadoVencimiento(l.fecha_vencimiento, config).nivel === estado)
      .filter((l) => !q || l.producto_nombre?.toLowerCase().includes(q) || l.codigo_barra?.toLowerCase().includes(q) || l.lote?.toLowerCase().includes(q))
      .sort((a, b) => (ordenFecha === 'asc' ? 1 : -1) * a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  }, [lotes, busqueda, estado, ordenFecha, config]);

  const grupos = useMemo(() => agruparPorDiaDeCarga(filtrados), [filtrados]);
  const unidades = filtrados.reduce((a, l) => a + l.cantidad, 0);

  return (
    <div className="page">
      <div className="card card-ancha">
        <h2>📅 Vencimientos</h2>
        <Mensajes error={error} />

        <div className="filtros">
          <input type="search" placeholder="Buscar por nombre, código o lote…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <select value={vista} onChange={(e) => setParam('vista', e.target.value)}>
            <option value="venc">Ordenado por vencimiento</option>
            <option value="carga">Agrupado por día de carga</option>
          </select>
          <select value={ordenFecha} onChange={(e) => setOrdenFecha(e.target.value)}>
            <option value="asc">Más próximos primero</option>
            <option value="desc">Más lejanos primero</option>
          </select>
          <button type="button" onClick={cargarLotes} disabled={loading}>🔄 Actualizar</button>
        </div>

        <div className="chips-filtro">
          {ESTADOS.map(([v, txt]) => (
            <button key={v} type="button" className={`chip ${estado === v ? 'activa' : ''} chip-${v || 'todos'}`} onClick={() => setParam('estado', v)}>{txt}</button>
          ))}
        </div>

        <p className="muted">{filtrados.length} lotes · {unidades} unidades{busqueda && ` · filtrado por "${busqueda}"`}{loading && ' · cargando…'}</p>

        {filtrados.length === 0 ? <Vacio>No hay lotes para mostrar.</Vacio> : vista === 'carga' ? (
          grupos.map(([dia, items]) => (
            <div key={dia} className="grupo">
              <div className="grupo-titulo">
                <h3>Cargado el {dia === 'Sin fecha' ? '(sin fecha)' : formatoAR(dia)}</h3>
                <small className="muted">{items.length} líneas</small>
              </div>
              <VencimientosTable lotes={items} onRefresh={cargarLotes} busqueda={busqueda} />
            </div>
          ))
        ) : (
          <VencimientosTable lotes={filtrados} onRefresh={cargarLotes} busqueda={busqueda} />
        )}
      </div>
    </div>
  );
}
