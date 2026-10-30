// src/components/VencimientosTable.jsx
// Tabla de lotes con acciones por fila: editar, descontar y eliminar
// Soporta resaltado de texto cuando se busca desde VencimientosPage

import { useState } from 'react';
import { updateLote, deleteLote, updateProductoNombre } from '../services/api';

// ─── Helper: calcula cuántos días faltan para el vencimiento ─────────────────
function diasFaltan(fechaISO) {
  const hoy = new Date();
  const fv = new Date(fechaISO);
  hoy.setHours(0, 0, 0, 0);
  fv.setHours(0, 0, 0, 0);
  return Math.round((fv - hoy) / (1000 * 60 * 60 * 24));
}

// ─── Helper: formatea fecha ISO a DD/MM/YYYY ──────────────────────────────────
function formatearFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ─── Helper: convierte fecha ISO a formato YYYY-MM-DD para input date ─────────
function toInputDate(fechaISO) {
  if (!fechaISO) return '';
  return String(fechaISO).split('T')[0];
}

// ─── Componente Highlight ─────────────────────────────────────────────────────
// Resalta en amarillo la parte del texto que coincide con la búsqueda
function Highlight({ texto, busqueda }) {
  if (!busqueda || !texto) return <>{texto}</>;

  const idx = texto.toLowerCase().indexOf(busqueda.toLowerCase());
  if (idx === -1) return <>{texto}</>;

  const antes = texto.slice(0, idx);
  const coincidencia = texto.slice(idx, idx + busqueda.length);
  const despues = texto.slice(idx + busqueda.length);

  return (
    <>
      {antes}
      <mark style={{
        backgroundColor: 'rgba(250, 204, 21, 0.5)',
        color: '#fff',
        borderRadius: '3px',
        padding: '0 2px'
      }}>
        {coincidencia}
      </mark>
      {despues}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function VencimientosTable({ lotes, onRefresh, busqueda = '' }) {
  const [editandoId, setEditandoId] = useState(null);
  const [editCantidad, setEditCantidad] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editLote, setEditLote] = useState('');
  const [editNombre, setEditNombre] = useState('');

  const [descontandoId, setDescontandoId] = useState(null);
  const [cantidadDescuento, setCantidadDescuento] = useState('');

  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!lotes || lotes.length === 0) {
    return <p style={{ color: '#93a5b4' }}>No hay lotes para mostrar.</p>;
  }

  const abrirEdicion = (lote) => {
    setEditandoId(lote.id);
    setEditCantidad(String(lote.cantidad));
    setEditFecha(toInputDate(lote.fecha_vencimiento));
    setEditLote(lote.lote || '');
    setEditNombre(lote.producto_nombre || '');
    setDescontandoId(null);
    setError(null);
    setOkMsg(null);
  };

  const guardarEdicion = async (lote) => {
    try {
      setLoading(true);
      setError(null);
      await updateLote(lote.id, {
        cantidad: Number(editCantidad),
        fecha_vencimiento: editFecha,
        lote: editLote
      });
      if (editNombre.trim() && editNombre.trim() !== lote.producto_nombre) {
        await updateProductoNombre(lote.codigo_barra, editNombre.trim());
      }
      setOkMsg('Lote actualizado correctamente');
      setEditandoId(null);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const eliminarLote = async (id, nombreProducto) => {
    const confirmar = window.confirm(
      `¿Seguro que querés eliminar este lote de "${nombreProducto}"?\nEsta acción no se puede deshacer.`
    );
    if (!confirmar) return;
    try {
      setLoading(true);
      setError(null);
      await deleteLote(id);
      setOkMsg('Lote eliminado correctamente');
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const abrirDescuento = (lote) => {
    setDescontandoId(lote.id);
    setCantidadDescuento('');
    setEditandoId(null);
    setError(null);
    setOkMsg(null);
  };

  const confirmarDescuento = async (lote) => {
    const n = Number(cantidadDescuento);
    if (!n || n <= 0) { setError('Ingresá una cantidad válida'); return; }
    if (n > lote.cantidad) { setError(`No podés descontar más de ${lote.cantidad} unidades`); return; }
    try {
      setLoading(true);
      setError(null);
      await updateLote(lote.id, { cantidad: lote.cantidad - n });
      setOkMsg(`Se descontaron ${n} unidades correctamente`);
      setDescontandoId(null);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="alert-error">{error}</div>}
      {okMsg && <div className="alert-info">{okMsg}</div>}

      <table className="table-venc">
        <thead>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Vencimiento</th>
            <th>Lote</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((lote) => {
            const dias = diasFaltan(lote.fecha_vencimiento);
            let rowClass = 'row-green';
            if (dias <= 30 && dias > 15) rowClass = 'row-yellow';
            if (dias <= 15) rowClass = 'row-red';
            const descripcion = dias >= 0 ? `Faltan ${dias} días` : `Vencido hace ${Math.abs(dias)} días`;
            const estaEditando = editandoId === lote.id;
            const estaDescontando = descontandoId === lote.id;

            return (
              <>
                <tr key={lote.id} className={rowClass}>
                  {/* Resaltamos código y nombre con el componente Highlight */}
                  <td><Highlight texto={lote.codigo_barra} busqueda={busqueda} /></td>
                  <td><Highlight texto={lote.producto_nombre} busqueda={busqueda} /></td>
                  <td className="text-right">{lote.cantidad}</td>
                  <td>{formatearFecha(lote.fecha_vencimiento)}</td>
                  <td>{lote.lote || '-'}</td>
                  <td>{descripcion}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button type="button" style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => estaEditando ? setEditandoId(null) : abrirEdicion(lote)}
                        disabled={loading}>
                        {estaEditando ? 'Cancelar' : '✏️ Editar'}
                      </button>
                      <button type="button" style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => estaDescontando ? setDescontandoId(null) : abrirDescuento(lote)}
                        disabled={loading}>
                        {estaDescontando ? 'Cancelar' : '➖ Descontar'}
                      </button>
                      <button type="button"
                        style={{ fontSize: '12px', padding: '4px 10px', borderColor: '#ef4444', color: '#fca5a5' }}
                        onClick={() => eliminarLote(lote.id, lote.producto_nombre)}
                        disabled={loading}>
                        🗑️ Eliminar
                      </button>
                    </div>
                  </td>
                </tr>

                {/* ── Fila de edición ── */}
                {estaEditando && (
                  <tr key={`edit-${lote.id}`}>
                    <td colSpan="7" style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.08)' }}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <small>Nombre producto</small>
                          <input type="text" value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '160px' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <small>Cantidad</small>
                          <input type="number" min="0" value={editCantidad}
                            onChange={(e) => setEditCantidad(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '90px' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <small>Fecha vencimiento</small>
                          <input type="date" value={editFecha}
                            onChange={(e) => setEditFecha(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <small>N° Lote</small>
                          <input type="text" value={editLote}
                            onChange={(e) => setEditLote(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '110px' }} placeholder="Opcional" />
                        </div>
                        <button className="btn-primary" type="button"
                          onClick={() => guardarEdicion(lote)}
                          disabled={loading} style={{ fontSize: '13px' }}>
                          {loading ? 'Guardando...' : '✅ Guardar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Fila de descuento ── */}
                {estaDescontando && (
                  <tr key={`desc-${lote.id}`}>
                    <td colSpan="7" style={{ padding: '10px 14px', background: 'rgba(250,204,21,0.08)' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <small>Cantidad a descontar (máx: {lote.cantidad})</small>
                          <input type="number" min="1" max={lote.cantidad}
                            value={cantidadDescuento}
                            onChange={(e) => setCantidadDescuento(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '90px' }} />
                        </div>
                        <button className="btn-primary" type="button"
                          onClick={() => confirmarDescuento(lote)}
                          disabled={loading} style={{ fontSize: '13px' }}>
                          {loading ? 'Procesando...' : '✅ Confirmar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}