// src/hooks/useScannerFlow.js
// Flujo de ingreso con escáner: código → (producto nuevo) → cantidad → lote → vencimiento → siguiente.
// Las líneas se guardan en el navegador hasta tocar "Guardar", así no se pierden si se cambia de pantalla.
import { useEffect, useState } from 'react';
import { getProductoByCodigo, createProducto, createLotesBatch } from '../services/api';
import { parseFechaFlexible } from '../utils/fechas';

const STEPS = {
  IDLE: 'IDLE',
  ASK_NEW_PRODUCT_NAME: 'ASK_NEW_PRODUCT_NAME',
  ASK_QUANTITY: 'ASK_QUANTITY',
  ASK_LOTE: 'ASK_LOTE',
  ASK_EXPIRY: 'ASK_EXPIRY',
};

const CLAVE = 'ingreso-pendiente';

function leerPendiente() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    return Array.isArray(v) ? v.filter((l) => l && l.productoId && l.cantidad > 0 && l.fechaVencimiento) : [];
  } catch {
    return [];
  }
}

export function useScannerFlow() {
  const [batch, setBatch] = useState(leerPendiente);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentCode, setCurrentCode] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [currentLote, setCurrentLote] = useState('');
  const [step, setStep] = useState(STEPS.IDLE);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(batch)); } catch { /* sin almacenamiento */ }
  }, [batch]);

  const resetFlow = () => {
    setCurrentProduct(null);
    setCurrentCode('');
    setCurrentQuantity('');
    setCurrentLote('');
    setStep(STEPS.IDLE);
  };

  const handleCancelFlow = () => { resetFlow(); setError(null); };

  const handleCodeRead = async (codigo) => {
    try {
      setError(null);
      setOkMsg(null);
      setLoading(true);
      setCurrentCode(codigo);
      const prod = await getProductoByCodigo(codigo);
      setCurrentProduct(prod);
      setStep(STEPS.ASK_QUANTITY);
    } catch (err) {
      if (err.status === 404) setStep(STEPS.ASK_NEW_PRODUCT_NAME);
      else { setError(err.message); setStep(STEPS.IDLE); }
    } finally {
      setLoading(false);
    }
  };

  const handleNewProductConfirm = async (nombre) => {
    try {
      setError(null);
      setLoading(true);
      const nuevo = await createProducto({ codigoBarra: currentCode, nombre });
      setCurrentProduct(nuevo);
      setStep(STEPS.ASK_QUANTITY);
    } catch (err) {
      setError(err.message);
      setStep(STEPS.IDLE);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityConfirm = (cantidad) => {
    setCurrentQuantity(cantidad);
    setStep(STEPS.ASK_LOTE);
  };

  const handleLoteConfirm = (lote) => {
    setCurrentLote(lote || '');
    setStep(STEPS.ASK_EXPIRY);
  };

  // Acepta 1226, 12/26, 311226, 31/12/2026... (mes y año = último día del mes)
  const handleExpiryConfirm = (rawExpiry) => {
    const isoDate = parseFechaFlexible(rawExpiry);
    if (!isoDate) {
      setError('Fecha no válida. Ejemplos: 1226, 12/26, 311226, 31/12/2026.');
      return;
    }
    setError(null);
    setBatch((prev) => [...prev, {
      productoId: currentProduct.id,
      nombre: currentProduct.nombre,
      codigo: currentProduct.codigo_barra,
      fechaVencimiento: isoDate,
      cantidad: Number(currentQuantity),
      lote: currentLote || null,
    }]);
    resetFlow();
  };

  const quitarLinea = (idx) => setBatch((prev) => prev.filter((_, i) => i !== idx));

  const handleFinish = async () => {
    if (batch.length === 0) { setError('No hay lotes para guardar'); return; }
    try {
      setError(null);
      setLoading(true);
      await createLotesBatch(batch.map(({ productoId, fechaVencimiento, cantidad, lote }) => ({ productoId, fechaVencimiento, cantidad, lote })));
      const unidades = batch.reduce((a, l) => a + l.cantidad, 0);
      setOkMsg(`✅ Se guardaron ${batch.length} líneas (${unidades} unidades).`);
      setBatch([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    batch,
    step,
    error,
    okMsg,
    loading,
    currentProduct,
    currentCode,
    currentQuantity,
    currentLote,
    handleCodeRead,
    handleNewProductConfirm,
    handleQuantityConfirm,
    handleExpiryConfirm,
    handleLoteConfirm,
    handleFinish,
    handleCancelFlow,
    quitarLinea,
    STEPS,
  };
}
