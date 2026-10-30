// src/routes/AdminPage.jsx
// Panel de reportes y exportación
// Permite filtrar lotes por estado y exportar a Excel o PDF

import { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getLotesVencimientos } from '../services/api';

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

// ─── Helper: convierte fecha a YYYY-MM-DD para inputs ────────────────────────
function toInputDate(fecha) {
  if (!fecha) return '';
  return String(fecha).split('T')[0];
}

export function AdminPage() {
  // Lista completa de lotes del backend
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Filtros ──
  // Filtro por estado: 'todos', 'proximos15', 'proximos30', 'proximos60', 'vencidos'
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Filtro por rango de fechas de vencimiento
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Búsqueda por nombre de producto
  const [busqueda, setBusqueda] = useState('');

  // ─── Cargar lotes al montar ───────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getLotesVencimientos();
        setLotes(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  // ─── Aplicar filtros sobre los lotes ─────────────────────────────────────
  const lotesFiltrados = useMemo(() => {
    return lotes.filter((lote) => {
      const dias = diasFaltan(lote.fecha_vencimiento);
      const fv = new Date(lote.fecha_vencimiento);

      // Filtro por estado
      if (filtroEstado === 'vencidos' && dias >= 0) return false;
      if (filtroEstado === 'proximos15' && (dias < 0 || dias > 15)) return false;
      if (filtroEstado === 'proximos30' && (dias < 0 || dias > 30)) return false;
      if (filtroEstado === 'proximos60' && (dias < 0 || dias > 60)) return false;

      // Filtro por fecha desde
      if (fechaDesde) {
        const desde = new Date(fechaDesde);
        if (fv < desde) return false;
      }

      // Filtro por fecha hasta
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        if (fv > hasta) return false;
      }

      // Filtro por búsqueda de nombre o código
      if (busqueda.trim()) {
        const q = busqueda.trim().toLowerCase();
        if (
          !lote.producto_nombre?.toLowerCase().includes(q) &&
          !lote.codigo_barra?.toLowerCase().includes(q)
        ) return false;
      }

      return true;
    });
  }, [lotes, filtroEstado, fechaDesde, fechaHasta, busqueda]);

  // ─── Exportar a Excel ─────────────────────────────────────────────────────
  const exportarExcel = () => {
    // Armamos los datos con los campos que queremos exportar
    const datos = lotesFiltrados.map((l) => ({
      'Código barras': l.codigo_barra,
      'Producto': l.producto_nombre,
      'Cantidad': l.cantidad,
      'Fecha vencimiento': formatFecha(l.fecha_vencimiento),
      'N° Lote': l.lote || '-',
      'Días restantes': diasFaltan(l.fecha_vencimiento),
      'Estado': diasFaltan(l.fecha_vencimiento) >= 0
        ? `Faltan ${diasFaltan(l.fecha_vencimiento)} días`
        : `Vencido hace ${Math.abs(diasFaltan(l.fecha_vencimiento))} días`
    }));

    // Creamos el libro y la hoja de Excel
    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Vencimientos');

    // Nombre del archivo con fecha de hoy
    const hoy = new Date().toISOString().split('T')[0];
    XLSX.writeFile(libro, `vencimientos_${hoy}.xlsx`);
  };

  // ─── Exportar a PDF ───────────────────────────────────────────────────────
  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Título del reporte
    const hoy = new Date().toLocaleDateString('es-AR');
    doc.setFontSize(14);
    doc.text('Reporte de Vencimientos - EpicFarma', 14, 15);
    doc.setFontSize(10);
    doc.text(`Fecha: ${hoy}  |  Total: ${lotesFiltrados.length} lotes`, 14, 22);

    // Tabla con los datos
    autoTable(doc, {
      startY: 28,
      head: [['Código', 'Producto', 'Cantidad', 'Vencimiento', 'Lote', 'Estado']],
      body: lotesFiltrados.map((l) => [
        l.codigo_barra,
        l.producto_nombre,
        l.cantidad,
        formatFecha(l.fecha_vencimiento),
        l.lote || '-',
        diasFaltan(l.fecha_vencimiento) >= 0
          ? `Faltan ${diasFaltan(l.fecha_vencimiento)} días`
          : `Vencido hace ${Math.abs(diasFaltan(l.fecha_vencimiento))} días`
      ]),
      // Coloreamos las filas según estado
      didParseCell: (data) => {
        if (data.section === 'body') {
          const lote = lotesFiltrados[data.row.index];
          const dias = diasFaltan(lote.fecha_vencimiento);
          if (dias < 0) {
            data.cell.styles.fillColor = [254, 202, 202]; // rojo suave
          } else if (dias <= 15) {
            data.cell.styles.fillColor = [254, 215, 170]; // naranja suave
          } else if (dias <= 30) {
            data.cell.styles.fillColor = [254, 249, 195]; // amarillo suave
          } else {
            data.cell.styles.fillColor = [220, 252, 231]; // verde suave
          }
        }
      },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] }, // azul oscuro
    });

    const hoyStr = new Date().toISOString().split('T')[0];
    doc.save(`vencimientos_${hoyStr}.pdf`);
  };

  // ─── Etiqueta del filtro activo para mostrar en el título ─────────────────
  const etiquetaFiltro = {
    todos: 'Todos los lotes activos',
    proximos15: 'Próximos a vencer (15 días)',
    proximos30: 'Próximos a vencer (30 días)',
    proximos60: 'Próximos a vencer (60 días)',
    vencidos: 'Lotes vencidos'
  }[filtroEstado];

  return (
    <div className="page">
      <div className="card" style={{ width: '100%', maxWidth: '1100px' }}>
        <h2>Reportes y Exportación</h2>

        {error && <div className="alert-error">{error}</div>}
        {loading && <div className="alert-info">Cargando lotes...</div>}

        {/* ── Filtros ── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>

          {/* Filtro por estado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small>Estado</small>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="todos">Todos los activos</option>
              <option value="proximos15">Próximos a vencer (15 días)</option>
              <option value="proximos30">Próximos a vencer (30 días)</option>
              <option value="proximos60">Próximos a vencer (60 días)</option>
              <option value="vencidos">Vencidos</option>
            </select>
          </div>

          {/* Filtro por fecha desde */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small>Vencimiento desde</small>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          {/* Filtro por fecha hasta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small>Vencimiento hasta</small>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          {/* Buscador por nombre */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '180px' }}>
            <small>Buscar producto</small>
            <input
              type="text"
              placeholder="Nombre o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {/* Botón limpiar filtros */}
          <button
            type="button"
            onClick={() => {
              setFiltroEstado('todos');
              setFechaDesde('');
              setFechaHasta('');
              setBusqueda('');
            }}
          >
            🗑️ Limpiar filtros
          </button>
        </div>

        {/* ── Resumen y botones de exportación ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{etiquetaFiltro}</p>
            <small style={{ color: '#9ca3af' }}>{lotesFiltrados.length} lotes encontrados</small>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Exportar Excel */}
            <button
              className="btn-primary"
              type="button"
              onClick={exportarExcel}
              disabled={lotesFiltrados.length === 0}
            >
              📊 Exportar Excel
            </button>

            {/* Exportar PDF */}
            <button
              className="btn-primary"
              type="button"
              onClick={exportarPDF}
              disabled={lotesFiltrados.length === 0}
            >
              📄 Exportar PDF
            </button>
          </div>
        </div>

        {/* ── Vista previa de la tabla ── */}
        {lotesFiltrados.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No hay lotes que coincidan con los filtros aplicados.</p>
        ) : (
          <table className="table-venc">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Vencimiento</th>
                <th>Lote</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {lotesFiltrados.map((lote) => {
                const dias = diasFaltan(lote.fecha_vencimiento);
                let rowClass = 'row-green';
                if (dias <= 30 && dias > 15) rowClass = 'row-yellow';
                if (dias <= 15) rowClass = 'row-red';
                return (
                  <tr key={lote.id} className={rowClass}>
                    <td>{lote.codigo_barra}</td>
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
  );
}