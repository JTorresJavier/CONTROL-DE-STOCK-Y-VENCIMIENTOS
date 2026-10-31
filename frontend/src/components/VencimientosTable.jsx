// src/components/VencimientosTable.jsx
// Tabla de lotes con acciones por fila: editar, descontar, dar de baja y eliminar.
import { Fragment, useState } from 'react';
import { updateLote, deleteLote, bajaLote, updateProductoNombre } from '../services/api';
import { estadoVencimiento, formatoAR } from '../utils/fechas';
import { useConfig } from '../context/ConfigContext';
import { FechaInput, Mensajes, Semaforo, Vacio } from './ui';

// Resalta la parte del texto que coincide con la búsqueda
function Highlight({ texto, busqueda }) {
  if (!busqueda || !texto) return <>{texto}</>;
  const idx = texto.toLowerCase().indexOf(busqueda.toLowerCase());
  if (idx === -1) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, idx)}
      <mark>{texto.slice(idx, idx + busqueda.length)}</mark>
      {texto.slice(idx + busqueda.length)}
    </>
  );
}

export function VencimientosTable({ lotes, onRefresh, busqueda = '' }) {
  const { config } = useConfig();
  const [editando, setEditando] = useState(null); // { id, cantidad, fecha, lote, nombre }
  const [descontando, setDescontando] = useState(null); // { id, cantidad }
  const [msg, setMsg] = useState({});
  const [loading, setLoading] = useState(false);

  if (!lotes || lotes.length === 0) return <Vacio>No hay lotes para mostrar.</Vacio>;

  const accion = async (fn, ok) => {
    try {
      setLoading(true);
      setMsg({});
      await fn();
      setMsg({ ok });
      setEditando(null);
      setDescontando(null);
      onRefresh();
    } catch (err) {
      setMsg({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const guardarEdicion = (lote) => {
    if (!editando.fecha) { setMsg({ error: 'La fecha de vencimiento no es válida.' }); return; }
    accion(async () => {
      await updateLote(lote.id, { cantidad: Number(editando.cantidad), fecha_vencimiento: editando.fecha, lote: editando.lote, motivo: 'Corrección desde Vencimientos' });
      if (editando.nombre.trim() && editando.nombre.trim() !== lote.producto_nombre) {
        await updateProductoNombre(lote.codigo_barra, editando.nombre.trim());
      }
    }, 'Lote actualizado correctamente');
  };

  const confirmarDescuento = (lote) => {
    const n = Number(descontando.cantidad);
    if (!Number.isInteger(n) || n <= 0) { setMsg({ error: 'Ingresá una cantidad válida' }); return; }
    if (n > lote.cantidad) { setMsg({ error: `No podés descontar más de ${lote.cantidad} unidades` }); return; }
    accion(() => updateLote(lote.id, { cantidad: lote.cantidad - n, tipo: 'SALIDA', motivo: 'Salida desde Vencimientos' }), `Se descontaron ${n} unidades`);
  };

  const darDeBaja = (lote) => {
    if (!window.confirm(`¿Dar de baja las ${lote.cantidad} unidades de "${lote.producto_nombre}" (vence ${formatoAR(lote.fecha_vencimiento)})?\nQueda registrado en Movimientos.`)) return;
    accion(() => bajaLote(lote.id), `Se dieron de baja ${lote.cantidad} unidades`);
  };

  const eliminar = (lote) => {
    if (!window.confirm(`¿Eliminar este lote de "${lote.producto_nombre}"?\nUsalo solo para cargas por error (para vencidos usá "Dar de baja").`)) return;
    accion(() => deleteLote(lote.id), 'Lote eliminado');
  };

  return (
    <div>
      <Mensajes {...msg} />
      <div className="tabla-scroll">
        <table className="table-venc">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Vencimiento</th>
              <th>Lote</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((lote) => {
              const est = estadoVencimiento(lote.fecha_vencimiento, config);
              const estaEditando = editando?.id === lote.id;
              const estaDescontando = descontando?.id === lote.id;
              return (
                <Fragment key={lote.id}>
                  <tr className={est.clase}>
                    <td className="mono"><Highlight texto={lote.codigo_barra} busqueda={busqueda} /></td>
                    <td><Highlight texto={lote.producto_nombre} busqueda={busqueda} /></td>
                    <td className="text-right">{lote.cantidad}</td>
                    <td>{formatoAR(lote.fecha_vencimiento)}</td>
                    <td>{lote.lote || '-'}</td>
                    <td><Semaforo fecha={lote.fecha_vencimiento} /></td>
                    <td>
                      <div className="acciones-linea">
                        <button type="button" className="btn-mini" disabled={loading}
                          onClick={() => (estaEditando ? setEditando(null) : (setDescontando(null), setEditando({ id: lote.id, cantidad: String(lote.cantidad), fecha: lote.fecha_vencimiento, lote: lote.lote || '', nombre: lote.producto_nombre || '' })))}>
                          {estaEditando ? 'Cancelar' : '✏️ Editar'}
                        </button>
                        <button type="button" className="btn-mini" disabled={loading}
                          onClick={() => (estaDescontando ? setDescontando(null) : (setEditando(null), setDescontando({ id: lote.id, cantidad: '' })))}>
                          {estaDescontando ? 'Cancelar' : '➖ Descontar'}
                        </button>
                        {est.nivel === 'vencido' && (
                          <button type="button" className="btn-mini btn-peligro" disabled={loading} onClick={() => darDeBaja(lote)}>⛔ Dar de baja</button>
                        )}
                        <button type="button" className="btn-mini btn-peligro-suave" disabled={loading} onClick={() => eliminar(lote)} title="Eliminar lote cargado por error">🗑️</button>
                      </div>
                    </td>
                  </tr>

                  {estaEditando && (
                    <tr className="fila-edicion">
                      <td colSpan="7">
                        <div className="form-linea">
                          <label>Nombre del producto
                            <input type="text" value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
                          </label>
                          <label>Cantidad
                            <input type="number" min="0" value={editando.cantidad} onChange={(e) => setEditando({ ...editando, cantidad: e.target.value })} style={{ width: 90 }} />
                          </label>
                          <label>Vencimiento
                            <FechaInput valor={editando.fecha} onChange={(f) => setEditando({ ...editando, fecha: f })} />
                          </label>
                          <label>N° de lote
                            <input type="text" value={editando.lote} onChange={(e) => setEditando({ ...editando, lote: e.target.value })} placeholder="Opcional" style={{ width: 120 }} />
                          </label>
                          <button className="btn-primary" type="button" onClick={() => guardarEdicion(lote)} disabled={loading}>
                            {loading ? 'Guardando…' : '✅ Guardar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {estaDescontando && (
                    <tr className="fila-descuento">
                      <td colSpan="7">
                        <form className="form-linea" onSubmit={(e) => { e.preventDefault(); confirmarDescuento(lote); }}>
                          <label>Cantidad a descontar (máx. {lote.cantidad})
                            <input type="number" min="1" max={lote.cantidad} autoFocus value={descontando.cantidad} onChange={(e) => setDescontando({ ...descontando, cantidad: e.target.value })} style={{ width: 100 }} />
                          </label>
                          <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Procesando…' : '✅ Confirmar'}</button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
