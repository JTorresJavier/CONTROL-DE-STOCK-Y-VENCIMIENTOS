// src/routes/MovimientosPage.jsx
// Historial de todo lo que entró y salió: ingresos, importaciones, salidas, ajustes, bajas.
import { useCallback, useEffect, useState } from 'react';
import { getMovimientos } from '../services/api';
import { formatoAR, formatoFechaHora, hoyISO, sumarDias } from '../utils/fechas';
import { exportarExcel } from '../utils/exportar';
import { Mensajes, Vacio } from '../components/ui';

const TIPOS = {
  INGRESO: ['📥', 'Ingreso', 'badge-verde'],
  SALIDA: ['📤', 'Salida', 'badge-azul'],
  AJUSTE: ['✏️', 'Ajuste', 'badge-amarillo'],
  BAJA: ['⛔', 'Baja', 'badge-rojo'],
  ANULACION: ['↩', 'Anulación', 'badge-sin'],
};

export function MovimientosPage() {
  const [filtros, setFiltros] = useState({ desde: sumarDias(hoyISO(), -30), hasta: hoyISO(), tipo: '', q: '' });
  const [movs, setMovs] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (f) => {
    setCargando(true);
    try {
      setMovs(await getMovimientos({ ...f, limite: 2000 }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => cargar(filtros), 250);
    return () => clearTimeout(t);
  }, [filtros, cargar]);

  const set = (k) => (e) => setFiltros({ ...filtros, [k]: e.target.value });
  const entradas = movs.filter((m) => m.cantidad > 0).reduce((a, m) => a + m.cantidad, 0);
  const salidas = movs.filter((m) => m.cantidad < 0).reduce((a, m) => a - m.cantidad, 0);

  return (
    <div className="page">
      <div className="card card-ancha">
        <h2>🔁 Movimientos de stock</h2>
        <Mensajes error={error} />
        <div className="filtros">
          <label>Desde <input type="date" value={filtros.desde} onChange={set('desde')} /></label>
          <label>Hasta <input type="date" value={filtros.hasta} onChange={set('hasta')} /></label>
          <select value={filtros.tipo} onChange={set('tipo')}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS).map(([k, [, t]]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <input type="search" placeholder="Producto, código u observación…" value={filtros.q} onChange={set('q')} style={{ flex: 1, minWidth: 180 }} />
          <button type="button" disabled={!movs.length} onClick={() => exportarExcel('movimientos', movs.map((m) => ({
            Fecha: formatoFechaHora(m.fecha), Tipo: TIPOS[m.tipo]?.[1] || m.tipo, Producto: m.producto_nombre, Código: m.codigo_barra || '',
            Cantidad: m.cantidad, Lote: m.lote || '', Vencimiento: formatoAR(m.fecha_vencimiento), Origen: m.origen || '', Observación: m.observacion || '',
          })), 'Movimientos')}>📊 Excel</button>
        </div>
        <p className="muted">{movs.length} movimientos · entraron {entradas} · salieron {salidas}{cargando && ' · cargando…'}</p>
        {movs.length === 0 ? <Vacio>No hay movimientos en ese período.</Vacio> : (
          <div className="tabla-scroll">
            <table className="table-venc">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cant.</th><th>Lote / Vence</th><th>Detalle</th></tr></thead>
              <tbody>
                {movs.map((m) => {
                  const [icono, texto, clase] = TIPOS[m.tipo] || ['•', m.tipo, 'badge-sin'];
                  return (
                    <tr key={m.id}>
                      <td>{formatoFechaHora(m.fecha)}</td>
                      <td><span className={`badge ${clase}`}>{icono} {texto}</span></td>
                      <td>{m.producto_nombre}</td>
                      <td className={`text-right ${m.cantidad < 0 ? 'texto-error' : 'texto-ok'}`}><strong>{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</strong></td>
                      <td>{m.lote || '-'}{m.fecha_vencimiento && <small className="muted"> · {formatoAR(m.fecha_vencimiento)}</small>}</td>
                      <td><small>{[m.origen, m.observacion].filter(Boolean).join(' · ')}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
