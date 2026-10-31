// src/routes/SalidaPage.jsx
// Salida de stock: escaneás o buscás el producto, ves sus lotes y descontás (sale primero lo que vence antes).
import { useState } from 'react';
import { CameraScannerZXing } from '../components/CameraScannerZXing';
import { ProductSearchInput } from '../components/ProductSearchInput';
import { ManualCodeModal } from '../components/Modals/ManualCodeModal';
import { getProductoByCodigo, getLotesByProducto, registrarSalidaStock } from '../services/api';
import { formatoAR } from '../utils/fechas';
import { Mensajes, Semaforo, Vacio } from '../components/ui';

const MOTIVOS = ['Venta', 'Reposición a mostrador', 'Devolución al proveedor', 'Uso interno', 'Rotura'];

export function SalidaPage() {
  const [producto, setProducto] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [msg, setMsg] = useState({});
  const [loading, setLoading] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const cargarLotes = async (id) => setLotes((await getLotesByProducto(id)) || []);

  const handleCodeRead = async (codigo) => {
    try {
      setMsg({});
      setLoading(true);
      setProducto(null);
      setLotes([]);
      const prod = await getProductoByCodigo(codigo);
      setProducto(prod);
      await cargarLotes(prod.id);
    } catch (e) {
      setMsg({ error: e.message === 'Producto no encontrado' ? `No hay ningún producto con el código ${codigo}.` : e.message });
    } finally {
      setLoading(false);
    }
  };

  const stockTotal = lotes.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);

  const handleDescontar = async (e) => {
    e.preventDefault();
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n <= 0) { setMsg({ error: 'Cantidad inválida' }); return; }
    try {
      setLoading(true);
      setMsg({});
      const r = await registrarSalidaStock({ productoId: producto.id, cantidad: n, origen: 'SALIDA', observacion: motivo });
      setMsg({ ok: `Se descontaron ${n} unidades de ${producto.nombre}. Quedan ${r.restante}.` });
      setCantidad('');
      await cargarLotes(producto.id);
    } catch (err) {
      setMsg({ error: err.message || 'Error al descontar stock' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-ingreso">
      <div className="page-ingreso-inner card">
        <h2>📤 Salida de stock</h2>
        <Mensajes {...msg} />

        {isMobile && (
          <button className="btn-primary btn-ancho" onClick={() => setCamOpen(true)}>📷 Escanear con cámara</button>
        )}
        {camOpen && (
          <CameraScannerZXing
            onResult={(codigo) => { setCamOpen(false); setTimeout(() => handleCodeRead(codigo), 0); }}
            onClose={() => setCamOpen(false)}
          />
        )}

        <ProductSearchInput
          onSelectCodigo={handleCodeRead}
          onManualRequest={() => setManualOpen(true)}
          placeholder="Escaneá el código o escribí el nombre del producto"
        />
        {loading && <div className="alert-info">Procesando…</div>}

        {producto && (
          <div className="producto-elegido">
            <h3>{producto.nombre}</h3>
            <p className="muted">Código {producto.codigo_barra} · Stock total: <strong>{stockTotal}</strong></p>

            {lotes.length > 0 ? (
              <table className="table-venc">
                <thead><tr><th>Vence</th><th>Lote</th><th>Cant.</th><th>Estado</th></tr></thead>
                <tbody>
                  {lotes.map((l, i) => (
                    <tr key={l.id} className={i === 0 ? 'fila-proxima' : ''}>
                      <td>{formatoAR(l.fecha_vencimiento)}</td>
                      <td>{l.lote || '-'}</td>
                      <td className="text-right">{l.cantidad}</td>
                      <td><Semaforo fecha={l.fecha_vencimiento} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Vacio>Este producto no tiene stock.</Vacio>}

            {stockTotal > 0 && (
              <form className="form-linea centrado" onSubmit={handleDescontar}>
                <label>Cantidad
                  <input type="number" min="1" max={stockTotal} value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus style={{ width: 110 }} />
                </label>
                <label>Motivo
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}</select>
                </label>
                <button className="btn-primary" type="submit" disabled={loading}>Descontar</button>
              </form>
            )}
            <small className="muted">Se descuenta primero del lote que vence antes (FEFO).</small>
          </div>
        )}

        <ManualCodeModal isOpen={manualOpen} onClose={() => setManualOpen(false)} onConfirm={handleCodeRead} />
      </div>
    </div>
  );
}
