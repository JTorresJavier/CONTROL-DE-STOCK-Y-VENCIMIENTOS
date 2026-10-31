// src/routes/ProductosPage.jsx
// Catálogo: stock total, stock mínimo, próximo vencimiento, faltantes, alta/edición/baja y exportación.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProductos, createProducto, updateProducto, deleteProducto, getProveedores, getLotesByProducto } from '../services/api';
import { formatoAR } from '../utils/fechas';
import { exportarExcel, exportarPDF } from '../utils/exportar';
import { useConfig } from '../context/ConfigContext';
import { Mensajes, Modal, Semaforo, Vacio } from '../components/ui';

const VACIO = { codigoBarra: '', nombre: '', codigoInterno: '', laboratorio: '', stockMinimo: 0, proveedorId: '', descripcion: '' };

function FormProducto({ inicial, proveedores, onGuardar, onClose }) {
  const [f, setF] = useState(inicial);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({ ...f, stockMinimo: Number(f.stockMinimo) || 0, proveedorId: f.proveedorId || null });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={inicial.id ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} ancho={520}>
      <form onSubmit={guardar} className="form-grid">
        <label className="ancho-completo">Nombre *
          <input type="text" value={f.nombre} onChange={set('nombre')} autoFocus required maxLength={150} />
        </label>
        <label>Código de barras
          <input type="text" inputMode="numeric" value={f.codigoBarra} onChange={set('codigoBarra')} placeholder={inicial.id ? '' : 'Si no tiene, se genera uno'} />
        </label>
        <label>Código interno / proveedor
          <input type="text" value={f.codigoInterno} onChange={set('codigoInterno')} />
        </label>
        <label>Laboratorio / marca
          <input type="text" value={f.laboratorio} onChange={set('laboratorio')} />
        </label>
        <label>Stock mínimo
          <input type="number" min="0" value={f.stockMinimo} onChange={set('stockMinimo')} />
        </label>
        <label className="ancho-completo">Proveedor habitual
          <select value={f.proveedorId || ''} onChange={set('proveedorId')}>
            <option value="">—</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <div className="ancho-completo"><Mensajes error={error} /></div>
        <div className="modal-actions ancho-completo">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DetalleLotes({ producto, onClose }) {
  const [lotes, setLotes] = useState(null);
  useEffect(() => { getLotesByProducto(producto.id).then(setLotes).catch(() => setLotes([])); }, [producto.id]);
  return (
    <Modal titulo={producto.nombre} onClose={onClose} ancho={560}>
      <p className="muted">Código {producto.codigo_barra} · Stock {producto.stock} · Mínimo {producto.stock_minimo}</p>
      {!lotes ? <p>Cargando…</p> : lotes.length === 0 ? <Vacio>Sin lotes con stock.</Vacio> : (
        <table className="table-venc">
          <thead><tr><th>Vence</th><th>Lote</th><th>Cant.</th><th>Estado</th></tr></thead>
          <tbody>{lotes.map((l) => <tr key={l.id}><td>{formatoAR(l.fecha_vencimiento)}</td><td>{l.lote || '-'}</td><td className="text-right">{l.cantidad}</td><td><Semaforo fecha={l.fecha_vencimiento} /></td></tr>)}</tbody>
        </table>
      )}
      <div className="modal-actions"><button type="button" onClick={onClose}>Cerrar</button></div>
    </Modal>
  );
}

export function ProductosPage() {
  const { config } = useConfig();
  const [params, setParams] = useSearchParams();
  const soloFaltantes = params.get('faltantes') === '1';
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroStock, setFiltroStock] = useState('');
  const [editando, setEditando] = useState(null);
  const [viendo, setViendo] = useState(null);
  const [msg, setMsg] = useState({});

  const cargar = useCallback(() => getProductos().then(setProductos).catch((e) => setMsg({ error: e.message })), []);
  useEffect(() => { cargar(); getProveedores().then(setProveedores).catch(() => {}); }, [cargar]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (soloFaltantes && !(p.stock_minimo > 0 && p.stock < p.stock_minimo)) return false;
      if (filtroStock === 'sin' && p.stock > 0) return false;
      if (filtroStock === 'con' && p.stock <= 0) return false;
      if (!q) return true;
      return [p.nombre, p.codigo_barra, p.codigo_interno, p.laboratorio, p.proveedor_nombre].some((v) => v && v.toLowerCase().includes(q));
    });
  }, [productos, busqueda, soloFaltantes, filtroStock]);

  const guardar = async (datos) => {
    if (editando.id) await updateProducto(editando.id, datos);
    else await createProducto(datos);
    setEditando(null);
    setMsg({ ok: 'Producto guardado' });
    cargar();
  };

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.nombre}"? Solo se puede si no tiene stock.`)) return;
    try {
      await deleteProducto(p.id);
      setMsg({ ok: 'Producto eliminado' });
      cargar();
    } catch (e) {
      setMsg({ error: e.message });
    }
  };

  const filasExport = () => lista.map((p) => ({
    'Código de barras': p.codigo_barra,
    'Código interno': p.codigo_interno || '',
    Producto: p.nombre,
    Laboratorio: p.laboratorio || '',
    Proveedor: p.proveedor_nombre || '',
    Stock: p.stock,
    'Stock mínimo': p.stock_minimo,
    'A reponer': Math.max(0, p.stock_minimo - p.stock),
    'Próximo vencimiento': formatoAR(p.proximo_vencimiento),
  }));

  return (
    <div className="page">
      <div className="card card-ancha">
        <div className="titulo-con-tabs">
          <h2>📦 Productos {soloFaltantes && <span className="badge badge-rojo">Solo faltantes</span>}</h2>
          <button type="button" className="btn-primary" onClick={() => setEditando({ ...VACIO })}>➕ Nuevo producto</button>
        </div>
        <Mensajes {...msg} />

        <div className="filtros">
          <input type="search" placeholder="Buscar por nombre, código, laboratorio o proveedor…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <select value={filtroStock} onChange={(e) => setFiltroStock(e.target.value)}>
            <option value="">Todos</option>
            <option value="con">Con stock</option>
            <option value="sin">Sin stock</option>
          </select>
          <label className="check">
            <input type="checkbox" checked={soloFaltantes} onChange={(e) => setParams(e.target.checked ? { faltantes: '1' } : {}, { replace: true })} /> Bajo stock mínimo
          </label>
          <button type="button" disabled={!lista.length} onClick={() => exportarExcel(soloFaltantes ? 'faltantes' : 'productos', filasExport(), 'Productos')}>📊 Excel</button>
          <button type="button" disabled={!lista.length} onClick={() => {
            const f = filasExport();
            exportarPDF({
              titulo: soloFaltantes ? 'Productos para reponer' : 'Stock de productos',
              columnas: ['Código', 'Producto', 'Stock', 'Mínimo', 'A reponer', 'Próx. venc.'],
              filas: f.map((x) => [x['Código de barras'], x.Producto, x.Stock, x['Stock mínimo'], x['A reponer'], x['Próximo vencimiento']]),
              nivelFila: (i) => (lista[i].stock_minimo > 0 && lista[i].stock < lista[i].stock_minimo ? 'rojo' : null),
              nombreArchivo: soloFaltantes ? 'faltantes' : 'stock',
              negocio: config.nombreNegocio,
            });
          }}>📄 PDF</button>
        </div>

        <p className="muted">{lista.length} productos · {lista.reduce((a, p) => a + p.stock, 0)} unidades</p>

        {lista.length === 0 ? <Vacio>No hay productos para mostrar.</Vacio> : (
          <div className="tabla-scroll">
            <table className="table-venc">
              <thead>
                <tr><th>Código</th><th>Producto</th><th>Proveedor</th><th>Stock</th><th>Mínimo</th><th>Próx. vencimiento</th><th></th></tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const falta = p.stock_minimo > 0 && p.stock < p.stock_minimo;
                  return (
                    <tr key={p.id} className={falta ? 'row-faltante' : ''}>
                      <td className="mono">{p.codigo_barra}{p.codigo_interno && <small className="muted"><br />{p.codigo_interno}</small>}</td>
                      <td>{p.nombre}{p.laboratorio && <small className="muted"><br />{p.laboratorio}</small>}</td>
                      <td>{p.proveedor_nombre || '—'}</td>
                      <td className="text-right"><strong className={p.stock === 0 ? 'texto-error' : falta ? 'texto-warn' : ''}>{p.stock}</strong></td>
                      <td className="text-right">{p.stock_minimo || '—'}</td>
                      <td>{p.proximo_vencimiento ? <>{formatoAR(p.proximo_vencimiento)} <Semaforo fecha={p.proximo_vencimiento} /></> : '—'}</td>
                      <td className="acciones-linea">
                        <button type="button" className="btn-mini" onClick={() => setViendo(p)}>Lotes</button>
                        <button type="button" className="btn-mini" onClick={() => setEditando({ id: p.id, codigoBarra: p.codigo_barra, nombre: p.nombre, codigoInterno: p.codigo_interno || '', laboratorio: p.laboratorio || '', stockMinimo: p.stock_minimo, proveedorId: p.proveedor_id || '', descripcion: p.descripcion || '' })}>✏️</button>
                        <button type="button" className="btn-mini btn-peligro-suave" onClick={() => eliminar(p)} title="Eliminar">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && <FormProducto inicial={editando} proveedores={proveedores} onGuardar={guardar} onClose={() => setEditando(null)} />}
      {viendo && <DetalleLotes producto={viendo} onClose={() => setViendo(null)} />}
    </div>
  );
}
