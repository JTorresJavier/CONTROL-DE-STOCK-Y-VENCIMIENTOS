// src/routes/ProveedoresPage.jsx
import { useCallback, useEffect, useState } from 'react';
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from '../services/api';
import { formatoFechaHora } from '../utils/fechas';
import { Mensajes, Modal, Vacio } from '../components/ui';

function FormProveedor({ inicial, onGuardar, onClose }) {
  const [f, setF] = useState(inicial);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal titulo={inicial.id ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose}>
      <form className="form-grid" onSubmit={async (e) => { e.preventDefault(); try { await onGuardar(f); } catch (err) { setError(err.message); } }}>
        <label className="ancho-completo">Nombre * <input type="text" value={f.nombre} onChange={set('nombre')} required autoFocus /></label>
        <label>CUIT <input type="text" value={f.cuit || ''} onChange={set('cuit')} /></label>
        <label>Teléfono <input type="text" value={f.telefono || ''} onChange={set('telefono')} /></label>
        <label className="ancho-completo">Email <input type="text" value={f.email || ''} onChange={set('email')} /></label>
        <label className="ancho-completo">Notas <textarea rows={2} value={f.notas || ''} onChange={set('notas')} /></label>
        <div className="ancho-completo"><Mensajes error={error} /></div>
        <div className="modal-actions ancho-completo">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}

export function ProveedoresPage() {
  const [lista, setLista] = useState([]);
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState({});
  const cargar = useCallback(() => getProveedores().then(setLista).catch((e) => setMsg({ error: e.message })), []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="page">
      <div className="card card-ancha">
        <div className="titulo-con-tabs">
          <h2>🚚 Proveedores</h2>
          <button type="button" className="btn-primary" onClick={() => setEditando({ nombre: '' })}>➕ Nuevo proveedor</button>
        </div>
        <p className="muted">Se crean solos al importar un remito. Acá podés completar sus datos.</p>
        <Mensajes {...msg} />
        {lista.length === 0 ? <Vacio>Todavía no hay proveedores.</Vacio> : (
          <div className="tabla-scroll">
            <table className="table-venc">
              <thead><tr><th>Proveedor</th><th>CUIT</th><th>Contacto</th><th>Productos</th><th>Importaciones</th><th>Última</th><th></th></tr></thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre}</strong>{p.notas && <small className="muted"><br />{p.notas}</small>}</td>
                    <td>{p.cuit || '—'}</td>
                    <td>{[p.telefono, p.email].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="text-right">{p.productos}</td>
                    <td className="text-right">{p.importaciones}</td>
                    <td>{p.ultima_importacion ? formatoFechaHora(p.ultima_importacion).slice(0, 10) : '—'}</td>
                    <td className="acciones-linea">
                      <button type="button" className="btn-mini" onClick={() => setEditando(p)}>✏️</button>
                      <button type="button" className="btn-mini btn-peligro-suave" onClick={async () => {
                        if (!window.confirm(`¿Eliminar el proveedor "${p.nombre}"? Los productos y el historial se conservan.`)) return;
                        try { await deleteProveedor(p.id); cargar(); } catch (e) { setMsg({ error: e.message }); }
                      }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editando && (
        <FormProveedor
          inicial={editando}
          onClose={() => setEditando(null)}
          onGuardar={async (f) => {
            if (f.id) await updateProveedor(f.id, f); else await createProveedor(f);
            setEditando(null);
            setMsg({ ok: 'Proveedor guardado' });
            cargar();
          }}
        />
      )}
    </div>
  );
}
