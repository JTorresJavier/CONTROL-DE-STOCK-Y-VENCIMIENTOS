// src/routes/DashboardPage.jsx
// Inicio: semáforo de vencimientos, faltantes, lotes urgentes y accesos rápidos.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getResumen, cargarDemo } from '../services/api';
import { estadoVencimiento, formatoAR, formatoFechaHora } from '../utils/fechas';
import { Mensajes, Semaforo, Tarjeta, Vacio } from '../components/ui';

export function DashboardPage() {
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const navegar = useNavigate();

  const cargar = useCallback(() => getResumen().then((d) => { setR(d); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { cargar(); }, [cargar]);

  if (!r) {
    return <div className="page"><div className="card card-ancha"><Mensajes error={error} />{!error && <p>Cargando…</p>}</div></div>;
  }

  const cfg = r.config;
  const vacio = r.totales.productos === 0;

  return (
    <div className="page">
      <div className="card-ancha">
        <div className="saludo">
          <div>
            <h2>👋 Hola, {cfg.nombreNegocio}</h2>
            <p className="muted">{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="acciones-rapidas">
            <Link className="btn btn-primary" to="/importar">📥 Importar remito</Link>
            <Link className="btn" to="/ingreso">📷 Ingreso con escáner</Link>
            <Link className="btn" to="/salida">📤 Registrar salida</Link>
          </div>
        </div>

        <Mensajes error={error} ok={ok} />

        {vacio && (
          <div className="card bienvenida">
            <h3>La base está vacía</h3>
            <p>Empezá importando un remito o factura de tu proveedor, o cargá productos con el escáner.</p>
            <p className="muted">¿Querés ver cómo funciona? Cargá productos de ejemplo (se pueden borrar después restaurando un respaldo).</p>
            <button type="button" onClick={async () => {
              try { const d = await cargarDemo(); setOk(d.message); cargar(); } catch (e) { setError(e.message); }
            }}>Cargar datos de ejemplo</button>
          </div>
        )}

        <div className="tarjetas">
          <Tarjeta icono="⛔" nivel="vencido" titulo="Vencidos con stock" valor={r.vencidos.lotes} detalle={`${r.vencidos.unidades} unidades`} onClick={() => navegar('/vencimientos?estado=vencido')} />
          <Tarjeta icono="🔴" nivel="rojo" titulo={`Vencen en ${cfg.alertaRoja} días`} valor={r.rangos.rojo.lotes} detalle={`${r.rangos.rojo.unidades} unidades`} onClick={() => navegar('/vencimientos?estado=rojo')} />
          <Tarjeta icono="🟠" nivel="naranja" titulo={`${cfg.alertaRoja + 1} a ${cfg.alertaNaranja} días`} valor={r.rangos.naranja.lotes} detalle={`${r.rangos.naranja.unidades} unidades`} onClick={() => navegar('/vencimientos?estado=naranja')} />
          <Tarjeta icono="🟡" nivel="amarillo" titulo={`${cfg.alertaNaranja + 1} a ${cfg.alertaAmarilla} días`} valor={r.rangos.amarillo.lotes} detalle={`${r.rangos.amarillo.unidades} unidades`} onClick={() => navegar('/vencimientos?estado=amarillo')} />
          <Tarjeta icono="📉" nivel="faltante" titulo="Bajo stock mínimo" valor={r.faltantes.total} detalle="productos para reponer" onClick={() => navegar('/productos?faltantes=1')} />
          <Tarjeta icono="📦" nivel="azul" titulo="Productos" valor={r.totales.productos} detalle={`${r.totales.unidades} unidades en ${r.totales.lotes} lotes`} onClick={() => navegar('/productos')} />
        </div>

        <div className="dos-columnas">
          <div className="card">
            <h3>🚨 Lo más urgente</h3>
            {r.urgentes.length === 0 ? <Vacio>No hay vencimientos en los próximos {cfg.alertaAmarilla} días. 🎉</Vacio> : (
              <table className="table-venc">
                <thead><tr><th>Producto</th><th>Cant.</th><th>Vence</th><th>Estado</th></tr></thead>
                <tbody>
                  {r.urgentes.map((l) => (
                    <tr key={l.id} className={estadoVencimiento(l.fecha_vencimiento, cfg).clase}>
                      <td>{l.producto_nombre}{l.lote ? <small className="muted"> · {l.lote}</small> : null}</td>
                      <td className="text-right">{l.cantidad}</td>
                      <td>{formatoAR(l.fecha_vencimiento)}</td>
                      <td><Semaforo fecha={l.fecha_vencimiento} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Link to="/vencimientos" className="link-mas">Ver todos los vencimientos →</Link>
          </div>

          <div className="columna">
            <div className="card">
              <h3>📉 Para reponer</h3>
              {r.faltantes.lista.length === 0 ? <Vacio>Ningún producto está por debajo de su stock mínimo.</Vacio> : (
                <ul className="lista-simple">
                  {r.faltantes.lista.slice(0, 8).map((p) => (
                    <li key={p.id}><span>{p.nombre}</span><span className={p.stock === 0 ? 'texto-error' : 'texto-warn'}>{p.stock} / {p.stock_minimo}</span></li>
                  ))}
                </ul>
              )}
              <Link to="/productos?faltantes=1" className="link-mas">Ver faltantes →</Link>
            </div>

            <div className="card">
              <h3>📥 Últimas importaciones</h3>
              {r.ultimasImportaciones.length === 0 ? <Vacio>Todavía no importaste remitos.</Vacio> : (
                <ul className="lista-simple">
                  {r.ultimasImportaciones.map((i) => (
                    <li key={i.id}>
                      <span>{i.proveedor_nombre || 'Sin proveedor'} <small className="muted">{[i.tipo_documento, i.numero].filter(Boolean).join(' ')}</small></span>
                      <span className="muted">{i.estado === 'DESHECHA' ? 'deshecha' : `${i.total_unidades} u.`} · {formatoFechaHora(i.fecha).slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/importar" className="link-mas">Importar →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
