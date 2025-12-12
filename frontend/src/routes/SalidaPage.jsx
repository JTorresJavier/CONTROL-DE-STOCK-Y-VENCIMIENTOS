// src/routes/SalidaPage.jsx
import { useState } from 'react';
import { ScannerInput } from '../components/ScannerInput';
import { CameraScanner } from '../components/CameraScanner';
import {
  getProductoByCodigo,
  getLotesByProducto,
  registrarSalidaStock
} from '../services/api';
import { ProductNameSearch } from '../components/ProductNameSearch';

// Helper para formatear fecha YYYY-MM-DD a DD/MM/YYYY
function formatFecha(fechaISO) {
  if (!fechaISO) return '';
  const d = new Date(fechaISO);
  if (isNaN(d)) return fechaISO;
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export function SalidaPage() {
  const [producto, setProducto] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [camOpen, setCamOpen] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const cargarLotesProducto = async (productoId) => {
    const data = await getLotesByProducto(productoId);
    setLotes(data || []);
  };

  const handleCodeRead = async (codigo) => {
    try {
      setError(null);
      setOkMsg(null);
      setLoading(true);
      setProducto(null);
      setLotes([]);

      const prod = await getProductoByCodigo(codigo);
      setProducto(prod);
      await cargarLotesProducto(prod.id);
    } catch (e) {
      setError(e.message || 'Error al leer producto');
      setProducto(null);
      setLotes([]);
    } finally {
      setLoading(false);
    }
  };

  const stockTotal = lotes.reduce(
    (acc, l) => acc + (Number(l.cantidad) || 0),
    0
  );

  const handleDescontar = async () => {
    try {
      setError(null);
      setOkMsg(null);

      if (!producto) {
        setError('Primero escaneá un producto');
        return;
      }

      const n = Number(cantidad);
      if (!n || n <= 0) {
        setError('Cantidad inválida');
        return;
      }

      setLoading(true);

      await registrarSalidaStock({
        codigoBarra: producto.codigo_barra,
        cantidad: n,
        origen: 'DEPOSITO',
        observacion: 'Salida por reposición'
      });

      setOkMsg('Stock descontado correctamente');
      setCantidad('');
      await cargarLotesProducto(producto.id);
    } catch (e) {
      setError(e.message || 'Error al descontar stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-ingreso">
      <div className="page-ingreso-inner card">
        <h2>Salida de stock / Reposición</h2>

        {error && <div className="alert-error">{error}</div>}
        {okMsg && <div className="alert-info">{okMsg}</div>}
        {loading && <div className="alert-info">Procesando...</div>}

        {/* Botón de cámara en celular */}
        {isMobile && (
          <button
            className="btn-primary"
            style={{ width: '100%', marginBottom: '10px' }}
            onClick={() => setCamOpen(true)}
          >
            📷 Escanear con Cámara
          </button>
        )}

        {camOpen && (
          <CameraScanner
            onResult={(codigo) => {
              handleCodeRead(codigo);
              setCamOpen(false);
            }}
            onClose={() => setCamOpen(false)}
          />
        )}

        {/* Input principal para lector/código manual */}
        <div className="scanner-input-wrapper">
          <ScannerInput
            onCodeRead={handleCodeRead}
            onManualRequest={() => {
              // Podrías abrir un modal de código manual,
              // por ahora que escriban directo en el input.
            }}
          />
          <small>
            Escaneá el código del producto para ver su stock y vencimientos.
          </small>
        </div>

        <ProductNameSearch
        onProductSelected={(prod) => {
            // Reutiliza el mismo flujo: carga producto y lotes
            handleCodeRead(prod.codigo_barra);
        }}
        />

        {/* Info de producto + stock */}
        {producto && (
          <>
            <h3>Producto seleccionado</h3>
            <p>
              <strong>{producto.nombre}</strong>
            </p>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>
              Código barras: {producto.codigo_barra}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>
              Stock total (lotes activos): {stockTotal}
            </p>

            {/* Detalle de lotes */}
            {lotes.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Fecha vencimiento</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((l) => (
                    <tr key={l.id}>
                      <td>{formatFecha(l.fecha_vencimiento)}</td>
                      <td className="text-right">{l.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#9ca3af' }}>
                No hay lotes con stock para este producto.
              </p>
            )}

            {/* Form para descontar */}
            <div style={{ marginTop: '12px' }}>
              <h3>Descontar unidades</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="Cantidad a descontar"
                />
                <button
                  className="btn-primary"
                  type="button"
                  onClick={handleDescontar}
                  disabled={loading}
                >
                  Descontar
                </button>
              </div>
              <small style={{ color: '#9ca3af' }}>
                Se descontará primero de los lotes que vencen antes.
              </small>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
