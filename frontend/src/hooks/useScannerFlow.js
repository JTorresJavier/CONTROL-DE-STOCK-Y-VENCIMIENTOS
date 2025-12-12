// src/hooks/useScannerFlow.js
import { useState } from 'react';
import {
  getProductoByCodigo,
  createProducto,
  createLotesBatch
} from '../services/api';

const STEPS = {
  IDLE: 'IDLE',
  ASK_NEW_PRODUCT_NAME: 'ASK_NEW_PRODUCT_NAME',
  ASK_QUANTITY: 'ASK_QUANTITY',
  ASK_EXPIRY: 'ASK_EXPIRY'
};

export function useScannerFlow() {
  const [batch, setBatch] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentCode, setCurrentCode] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [currentExpiryRaw, setCurrentExpiryRaw] = useState('');
  const [step, setStep] = useState(STEPS.IDLE);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🔹 Resetea todo el flujo actual y vuelve a IDLE
  const resetFlow = () => {
    setCurrentProduct(null);
    setCurrentCode('');
    setCurrentQuantity('');
    setCurrentExpiryRaw('');
    setStep(STEPS.IDLE);
    setError(null);
  };

  // Se llama cuando el usuario toca "Cancelar" en cualquier modal
  const handleCancelFlow = () => {
    resetFlow();
  };

  const handleCodeRead = async (codigo) => {
    try {
      setError(null);
      setLoading(true);
      setCurrentCode(codigo);

      const prod = await getProductoByCodigo(codigo);
      setCurrentProduct(prod);
      setStep(STEPS.ASK_QUANTITY);
    } catch (err) {
      if (err.message === 'Producto no encontrado') {
        setStep(STEPS.ASK_NEW_PRODUCT_NAME);
      } else {
        setError(err.message);
        setStep(STEPS.IDLE);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewProductConfirm = async (nombre) => {
    try {
      setError(null);
      setLoading(true);
      const nuevo = await createProducto({
        codigoBarra: currentCode,
        nombre,
        descripcion: ''
      });
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
    setStep(STEPS.ASK_EXPIRY);
  };

  function parseExpiryToISO(raw) {
    const value = String(raw).trim();
    if (!/^\d+$/.test(value)) return null;

    if (value.length === 4) {
      const mm = parseInt(value.slice(0, 2), 10);
      const yy = parseInt(value.slice(2, 4), 10);
      if (isNaN(mm) || isNaN(yy)) return null;
      if (mm < 1 || mm > 12) return null;
      const year = 2000 + yy;
      const monthStr = mm.toString().padStart(2, '0');
      const dayStr = '01';
      return `${year}-${monthStr}-${dayStr}`;
    }

    if (value.length === 6) {
      const dd = parseInt(value.slice(0, 2), 10);
      const mm = parseInt(value.slice(2, 4), 10);
      const yy = parseInt(value.slice(4, 6), 10);
      if (isNaN(dd) || isNaN(mm) || isNaN(yy)) return null;
      if (mm < 1 || mm > 12) return null;
      if (dd < 1 || dd > 31) return null;
      const year = 2000 + yy;
      const monthStr = mm.toString().padStart(2, '0');
      const dayStr = dd.toString().padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }

    return null;
  }

  const handleExpiryConfirm = (rawExpiry) => {
    setCurrentExpiryRaw(rawExpiry);

    const isoDate = parseExpiryToISO(rawExpiry);
    if (!isoDate) {
      setError('Fecha no válida. Usá MMYY (1125) o DDMMYY (131225).');
      setStep(STEPS.ASK_EXPIRY);
      return;
    }

    const lote = {
      productoId: currentProduct.id,
      fechaVencimiento: isoDate,
      cantidad: Number(currentQuantity)
    };

    setBatch((prev) => [...prev, lote]);
    resetFlow(); // después de guardar la línea, volvemos a IDLE
  };

  const handleFinish = async () => {
    if (batch.length === 0) {
      setError('No hay lotes para guardar');
      return;
    }
    try {
      setError(null);
      setLoading(true);
      await createLotesBatch(batch);
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
    loading,
    currentProduct,
    currentCode,
    currentQuantity,
    currentExpiryRaw,
    handleCodeRead,
    handleNewProductConfirm,
    handleQuantityConfirm,
    handleExpiryConfirm,
    handleFinish,
    handleCancelFlow,   // 👈 importante
    STEPS
  };
}
