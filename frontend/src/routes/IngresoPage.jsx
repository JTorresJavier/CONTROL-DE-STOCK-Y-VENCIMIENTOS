// src/routes/IngresoPage.jsx
// Ingreso de mercadería con lector de código de barras, cámara (celular) o búsqueda por nombre.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useScannerFlow } from '../hooks/useScannerFlow';
import { ManualCodeModal } from '../components/Modals/ManualCodeModal';
import { NewProductModal } from '../components/Modals/NewProductModal';
import { QuantityModal } from '../components/Modals/QuantityModal';
import { ExpiryModal } from '../components/Modals/ExpiryModal';
import { LoteModal } from '../components/Modals/LoteModal';
import { CameraScannerZXing } from '../components/CameraScannerZXing';
import { ProductSearchInput } from '../components/ProductSearchInput';
import { formatoAR } from '../utils/fechas';
import { Mensajes, Semaforo, Vacio } from '../components/ui';

export function IngresoPage() {
  const f = useScannerFlow();
  const [manualOpen, setManualOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const isMobile = window.innerWidth < 768;
  const unidades = f.batch.reduce((a, l) => a + l.cantidad, 0);

  return (
    <div className="page page-ingreso">
      <div className="page-ingreso-inner card">
        <h2>📷 Ingreso de mercadería</h2>
        <p className="muted">¿Llegó un remito con muchos productos? <Link to="/importar">Importalo de una vez →</Link></p>

        <Mensajes error={f.error} ok={f.okMsg} />
        {f.loading && <div className="alert-info">Cargando…</div>}

        {isMobile && <button className="btn-primary btn-ancho" onClick={() => setCamOpen(true)}>📷 Escanear con cámara</button>}
        {camOpen && (
          <CameraScannerZXing
            onResult={(codigo) => { setCamOpen(false); setTimeout(() => f.handleCodeRead(codigo), 0); }}
            onClose={() => setCamOpen(false)}
          />
        )}

        <ProductSearchInput
          onSelectCodigo={(codigo) => f.handleCodeRead(codigo)}
          onManualRequest={() => setManualOpen(true)}
          placeholder="Escaneá el código o escribí el nombre"
        />

        <h3>Líneas cargadas (sin guardar todavía)</h3>
        {f.batch.length === 0 ? <Vacio>No hay líneas cargadas todavía.</Vacio> : (
          <table className="table-venc">
            <thead><tr><th>Producto</th><th>Cant.</th><th>Lote</th><th>Vence</th><th></th></tr></thead>
            <tbody>
              {f.batch.map((l, idx) => (
                <tr key={idx}>
                  <td className="text-left">{l.nombre || `Producto #${l.productoId}`}</td>
                  <td className="text-right">{l.cantidad}</td>
                  <td>{l.lote || '-'}</td>
                  <td>{formatoAR(l.fechaVencimiento)} <Semaforo fecha={l.fechaVencimiento} /></td>
                  <td><button type="button" className="btn-mini btn-peligro-suave" onClick={() => f.quitarLinea(idx)} title="Quitar línea">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="barra-confirmar">
          <small className="muted">{f.batch.length} líneas · {unidades} unidades</small>
          <button className="btn-primary" onClick={f.handleFinish} disabled={f.loading || f.batch.length === 0}>Guardar todo</button>
        </div>

        <ManualCodeModal isOpen={manualOpen} onClose={() => setManualOpen(false)} onConfirm={f.handleCodeRead} />
        <NewProductModal isOpen={f.step === f.STEPS.ASK_NEW_PRODUCT_NAME} codigo={f.currentCode} onConfirm={f.handleNewProductConfirm} onCancel={f.handleCancelFlow} />
        <QuantityModal isOpen={f.step === f.STEPS.ASK_QUANTITY} productoNombre={f.currentProduct?.nombre || ''} onConfirm={f.handleQuantityConfirm} onCancel={f.handleCancelFlow} />
        <LoteModal isOpen={f.step === f.STEPS.ASK_LOTE} productoNombre={f.currentProduct?.nombre || ''} onConfirm={f.handleLoteConfirm} onCancel={f.handleCancelFlow} />
        <ExpiryModal isOpen={f.step === f.STEPS.ASK_EXPIRY} productoNombre={f.currentProduct?.nombre || ''} error={f.error} onConfirm={f.handleExpiryConfirm} onCancel={f.handleCancelFlow} />
      </div>
    </div>
  );
}
