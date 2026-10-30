// src/context/ConfigContext.jsx
// Configuración compartida (nombre del negocio y días del semáforo de vencimientos).
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getConfig } from '../services/api';

const DEFECTO = { nombreNegocio: 'EpicFarma', alertaRoja: 30, alertaNaranja: 60, alertaAmarilla: 90 };
const ConfigCtx = createContext({ config: DEFECTO, recargar: () => {} });

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFECTO);
  const recargar = useCallback(() => getConfig().then(setConfig).catch(() => {}), []);
  useEffect(() => { recargar(); }, [recargar]);
  return <ConfigCtx.Provider value={{ config, recargar }}>{children}</ConfigCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useConfig = () => useContext(ConfigCtx);
