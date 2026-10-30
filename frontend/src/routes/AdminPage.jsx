// src/routes/AdminPage.jsx
// Reportes de vencimientos con filtros y exportación a Excel o PDF.
import { useEffect, useState, useMemo } from 'react';
import { getLotesVencimientos } from '../services/api';
import { estadoVencimiento, formatoAR } from '../utils/fechas';
import { exportarExcel, exportarPDF } from '../utils/exportar';
import { useConfig } from '../context/ConfigContext';
import { Mensajes, Semaforo, Vacio } from '../components/ui';

export function AdminPage() {
  const { config } = useConfig();
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    getLotesVencimientos().then((d) => setLotes(d || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const OPCIONES = {
    todos: 'Todos los lotes con stock',
    vencidos: 'Vencidos',
    rojo: `Vencen en ${config.alertaRoja} días o menos`,
    hastaNaranja: `Vencen en ${config.alertaNaranja} días o menos`,
    hastaAmarilla: `Vencen en ${config.alertaAmarilla} días o menos`,
  };

  const lotesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lotes.filter((lote) => {
      const { dias } = estadoVencimiento(lote.fecha_vencimiento, config);
      const fv = lote.fecha_vencimiento; // "AAAA-MM-DD" se compara como texto
      if (filtroEstado === 'vencidos' && dias >= 0) return false;
      if (filtroEstado === 'rojo' && (dias < 0 || dias > config.alertaRoja)) return false;
      if (filtroEstado === 'hastaNaranja' && (dias < 0 || dias > config.alertaNaranja)) return false;
      if (filtroEstado === 'hastaAmarilla' && (dias < 0 || dias > config.alertaAmarilla)) return false;
      if (fechaDesde && fv < fechaDesde) return false;
      if (fechaHasta && fv > fechaHasta) return false;
      if (q && !lote.producto_nombre?.toLowerCase().includes(q) && !lote.codigo_barra?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lotes, filtroEstado, fechaDesde, fechaHasta, busqueda, config]);

  const exportarExcelVenc = () => exportarExcel('vencimientos', lotesFiltrados.map((l) => {
    const e = estadoVencimiento(l.fecha_vencimiento, config);
    return {
      'Código barras': l.codigo_barra,
      Producto: l.producto_nombre,
      Cantidad: l.cantidad,
      'Fecha vencimiento': formatoAR(l.fecha_vencimiento),
      'N° Lote': l.lote || '-',
      'Días restantes': e.dias,
      Estado: e.texto,
    };
  }), 'Vencimientos');

  const exportarPDFVenc = () => exportarPDF({
    titulo: 'Reporte de vencimientos',
    subtitulo: OPCIONES[filtroEstado],
    columnas: ['Código', 'Producto', 'Cantidad', 'Vencimiento', 'Lote', 'Estado'],
    filas: lotesFiltrados.map((l) => [l.codigo_barra, l.producto_nombre, l.cantidad, formatoAR(l.fecha_vencimiento), l.lote || '-', estadoVencimiento(l.fecha_vencimiento, config).texto]),
    nivelFila: (i) => estadoVencimiento(lotesFiltrados[i].fecha_vencimiento, config).nivel,
    nombreArchivo: 'vencimientos',
    negocio: config.nombreNegocio,
  });

  return (
    <div className="page">
      <div className="card card-ancha">
        <h2>📊 Reportes de vencimientos</h2>
        <p className="muted">Para stock y faltantes usá la exportación de <strong>Productos</strong>; para entradas y salidas, la de <strong>Movimientos</strong>.</p>
        <Mensajes error={error} />
        {loading && <div className="alert-info">Cargando lotes…</div>}

        <div className="filtros">
          <label>Estado
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              {Object.entries(OPCIONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Vencimiento desde <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} /></label>
          <label>hasta <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} /></label>
          <label style={{ flex: 1, minWidth: 180 }}>Buscar producto
            <input type="search" placeholder="Nombre o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </label>
          <button type="button" onClick={() => { setFiltroEstado('todos'); setFechaDesde(''); setFechaHasta(''); setBusqueda(''); }}>Limpiar</button>
        </div>

        <div className="barra-export">
          <div>
            <strong>{OPCIONES[filtroEstado]}</strong>
            <small className="muted"> · {lotesFiltrados.length} lotes · {lotesFiltrados.reduce((a, l) => a + l.cantidad, 0)} unidades</small>
          </div>
          <div className="botones">
            <button className="btn-primary" type="button" onClick={exportarExcelVenc} disabled={!lotesFiltrados.length}>📊 Exportar Excel</button>
            <button className="btn-primary" type="button" onClick={exportarPDFVenc} disabled={!lotesFiltrados.length}>📄 Exportar PDF</button>
          </div>
        </div>

        {lotesFiltrados.length === 0 ? <Vacio>No hay lotes que coincidan con los filtros.</Vacio> : (
          <div className="tabla-scroll">
            <table className="table-venc">
              <thead><tr><th>Código</th><th>Producto</th><th>Cant.</th><th>Vencimiento</th><th>Lote</th><th>Estado</th></tr></thead>
              <tbody>
                {lotesFiltrados.map((lote) => (
                  <tr key={lote.id} className={estadoVencimiento(lote.fecha_vencimiento, config).clase}>
                    <td className="mono">{lote.codigo_barra}</td>
                    <td>{lote.producto_nombre}</td>
                    <td className="text-right">{lote.cantidad}</td>
                    <td>{formatoAR(lote.fecha_vencimiento)}</td>
                    <td>{lote.lote || '-'}</td>
                    <td><Semaforo fecha={lote.fecha_vencimiento} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
