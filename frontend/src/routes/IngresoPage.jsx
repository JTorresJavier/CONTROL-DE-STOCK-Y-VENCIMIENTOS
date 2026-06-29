// src/routes/IngresoPage.jsx
import { useState } from 'react';
import { useScannerFlow } from '../hooks/useScannerFlow';
//import { ScannerInput } from '../components/ScannerInput';
import { ManualCodeModal } from '../components/Modals/ManualCodeModal';
import { NewProductModal } from '../components/Modals/NewProductModal';
import { QuantityModal } from '../components/Modals/QuantityModal';
import { ExpiryModal } from '../components/Modals/ExpiryModal';
//import { CameraScanner } from '../components/CameraScanner';
//import { ProductNameSearch } from '../components/ProductNameSearch';
import { CameraScannerZXing } from '../components/CameraScannerZXing';
import { ProductSearchInput } from '../components/ProductSearchInput';
import { LoteModal } from '../components/Modals/LoteModal';



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
    handleLoteConfirm,
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
          <CameraScannerZXing
            onResult={(codigo) => {
              // 1) cerramos el modal YA
              setCamOpen(false);

              // 2) y recién después procesamos el código
              setTimeout(() => {
                handleCodeRead(codigo);
              }, 0);
            }}
            onClose={() => setCamOpen(false)}
          />
        )}


        {/* {camOpen && (
          <CameraScanner
            onResult={(codigo) => {
              handleCodeRead(codigo);
            }}
            onClose={() => setCamOpen(false)}
          />
        )} */}

        <div className="scanner-input-wrapper">
          {/* <ScannerInput
            onCodeRead={handleCodeRead}
            onManualRequest={() => setManualOpen(true)}
          />

          <ProductNameSearch
          onProductSelected={(prod) => {
            // Simula que escaneaste el código de barras
            handleCodeRead(prod.codigo_barra);
          }}
        /> */}

        <ProductSearchInput
          onSelectCodigo={(codigo) => handleCodeRead(codigo)}
          onManualRequest={() => setManualOpen(true)}
          placeholder="Escaneá código o escribí nombre (COCA, MONSTER...)"
        />

          <small>
            Escaneá el código o usá la tecla <strong>Insert</strong> para cargar
            manualmente.
          </small>
        </div>

        {/* Buscador por nombre que dispara el mismo flujo que el escáner */}
        

        <h3>Líneas cargadas (sin guardar todavía)</h3>
        {batch.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No hay líneas cargadas todavía.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Producto ID</th>
                <th>Lote</th>
                <th>Cantidad</th>
                <th>Fecha vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {batch.map((lote, idx) => (
                <tr key={idx}>
                  <td>{lote.productoId}</td>
                  <td>{lote.lote || '-'}</td>
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

        <LoteModal
          isOpen={step === STEPS.ASK_LOTE}
          productoNombre={currentProduct?.nombre || ""}
          onConfirm={handleLoteConfirm}
          onCancel={handleCancelFlow}
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
