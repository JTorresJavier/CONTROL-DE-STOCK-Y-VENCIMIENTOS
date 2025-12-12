// src/routes/IngresoPage.jsx
import { useState } from 'react';
import { useScannerFlow } from '../hooks/useScannerFlow';
import { ScannerInput } from '../components/ScannerInput';
import { ManualCodeModal } from '../components/Modals/ManualCodeModal';
import { NewProductModal } from '../components/Modals/NewProductModal';
import { QuantityModal } from '../components/Modals/QuantityModal';
import { ExpiryModal } from '../components/Modals/ExpiryModal';
import { CameraScanner } from '../components/CameraScanner';
import { ProductNameSearch } from '../components/ProductNameSearch';

export function IngresoPage() {
  const {
    batch,
    step,
    error,
    loading,
    currentProduct,
    currentCode,
    currentExpiryRaw,
    handleCodeRead,
    handleNewProductConfirm,
    handleQuantityConfirm,
    handleExpiryConfirm,
    handleFinish,
    handleCancelFlow,   // 👈 NUEVO
    STEPS
  } = useScannerFlow();

  const [manualOpen, setManualOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const isMobile = window.innerWidth < 768;

  const handleManualConfirm = (codigo) => {
    handleCodeRead(codigo);
  };

  return (
    <div className="page page-ingreso">
      <div className="page-ingreso-inner card">
        <h2>Ingreso de mercadería</h2>

        {error && <div className="alert-error">{error}</div>}
        {loading && <div className="alert-info">Cargando...</div>}

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
            }}
            onClose={() => setCamOpen(false)}
          />
        )}

        <div className="scanner-input-wrapper">
          <ScannerInput
            onCodeRead={handleCodeRead}
            onManualRequest={() => setManualOpen(true)}
          />
          <small>
            Escaneá el código o usá la tecla <strong>Insert</strong> para cargar
            manualmente.
          </small>
        </div>

        {/* Buscador por nombre que dispara el mismo flujo que el escáner */}
        <ProductNameSearch
          onProductSelected={(prod) => {
            // Simula que escaneaste el código de barras
            handleCodeRead(prod.codigo_barra);
          }}
        />

        <h3>Líneas cargadas (sin guardar todavía)</h3>
        {batch.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No hay líneas cargadas todavía.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Producto ID</th>
                <th>Cantidad</th>
                <th>Fecha vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {batch.map((lote, idx) => (
                <tr key={idx}>
                  <td>{lote.productoId}</td>
                  <td className="text-right">{lote.cantidad}</td>
                  <td>{lote.fechaVencimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <button
            className="btn-primary"
            onClick={handleFinish}
            disabled={loading || batch.length === 0}
          >
            Terminar y guardar todo
          </button>
        </div>

        {/* Modal código manual */}
        <ManualCodeModal
          isOpen={manualOpen}
          onClose={() => setManualOpen(false)}
          onConfirm={handleManualConfirm}
        />

        {/* Modal nuevo producto */}
        <NewProductModal
          isOpen={step === STEPS.ASK_NEW_PRODUCT_NAME}
          codigo={currentCode}
          onConfirm={handleNewProductConfirm}
          onCancel={handleCancelFlow}   // 👈 ahora sí cancela
        />

        {/* Modal cantidad */}
        <QuantityModal
          isOpen={step === STEPS.ASK_QUANTITY}
          productoNombre={currentProduct?.nombre || ''}
          onConfirm={handleQuantityConfirm}
          onCancel={handleCancelFlow}   // 👈 cancela el flujo
        />

        {/* Modal fecha vencimiento */}
        <ExpiryModal
          isOpen={step === STEPS.ASK_EXPIRY}
          rawValue={currentExpiryRaw}
          onConfirm={handleExpiryConfirm}
          onCancel={handleCancelFlow}   // 👈 idem
        />
      </div>
    </div>
  );
}
