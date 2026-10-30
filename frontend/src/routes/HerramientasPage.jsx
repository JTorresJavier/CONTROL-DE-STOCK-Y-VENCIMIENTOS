// src/routes/HerramientasPage.jsx
// Copias de seguridad, alertas del semáforo, nombre del negocio y acceso desde el celular.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRespaldosAutomaticos, crearRespaldo, restaurarAutomatico, restaurarRespaldo, urlDescargaRespaldo,
  guardarConfig, getInfo,
} from '../services/api';
import { useConfig } from '../context/ConfigContext';
import { Mensajes } from '../components/ui';

export function HerramientasPage() {
  const { config, recargar } = useConfig();
  const [form, setForm] = useState(config);
  const [formPrevio, setFormPrevio] = useState(config);
  const [respaldos, setRespaldos] = useState({ lista: [], carpeta: '' });
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const archivoRef = useRef(null);

  if (config !== formPrevio) { setFormPrevio(config); setForm(config); }

  const cargar = useCallback(() => getRespaldosAutomaticos().then(setRespaldos).catch(() => {}), []);
  useEffect(() => { cargar(); getInfo().then(setInfo).catch(() => {}); }, [cargar]);

  const ejecutar = async (fn) => {
    setOcupado(true);
    setMsg({});
    try { await fn(); } catch (e) { setMsg({ error: e.message }); } finally { setOcupado(false); }
  };

  const restaurarArchivo = (archivo) => {
    if (!archivo) return;
    if (!window.confirm(`¿Restaurar "${archivo.name}"?\nTodos los datos actuales se reemplazan por los de la copia (antes se guarda un respaldo automático).`)) return;
    ejecutar(async () => {
      const r = await restaurarRespaldo(archivo);
      setMsg({ ok: r.message });
      cargar();
      recargar();
    });
  };

  return (
    <div className="page">
      <div className="card-ancha herramientas">
        <h2>🛠️ Herramientas</h2>
        <Mensajes {...msg} />

        <div className="dos-columnas">
          <div className="card">
            <h3>💾 Copias de seguridad</h3>
            <p className="muted">La app guarda una copia automática al abrirse y una vez por día (se conservan las últimas 20).</p>
            <div className="botones">
              <a className="btn btn-primary" href={urlDescargaRespaldo()} download>⬇ Descargar copia ahora</a>
              <button type="button" disabled={ocupado} onClick={() => ejecutar(async () => { const r = await crearRespaldo(); setMsg({ ok: `Respaldo creado: ${r.nombre}` }); cargar(); })}>Guardar copia en la PC</button>
              <button type="button" disabled={ocupado} onClick={() => archivoRef.current?.click()}>⬆ Restaurar desde archivo…</button>
              <input ref={archivoRef} type="file" accept=".db,.sqlite,.sqlite3" hidden onChange={(e) => { restaurarArchivo(e.target.files[0]); e.target.value = ''; }} />
            </div>
            <small className="muted">Carpeta: {respaldos.carpeta}</small>
            <ul className="lista-simple lista-respaldos">
              {respaldos.lista.slice(0, 10).map((r) => (
                <li key={r.nombre}>
                  <span>{r.nombre}<small className="muted"> · {(r.tamano / 1024).toFixed(0)} KB</small></span>
                  <button type="button" className="btn-mini" disabled={ocupado} onClick={() => {
                    if (!window.confirm(`¿Volver a los datos de "${r.nombre}"? Se guarda un respaldo de lo actual antes.`)) return;
                    ejecutar(async () => { const x = await restaurarAutomatico(r.nombre); setMsg({ ok: x.message }); cargar(); recargar(); });
                  }}>Restaurar</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="columna">
            <div className="card">
              <h3>🚦 Semáforo de vencimientos</h3>
              <form className="form-grid" onSubmit={(e) => {
                e.preventDefault();
                ejecutar(async () => { await guardarConfig(form); await recargar(); setMsg({ ok: 'Configuración guardada' }); });
              }}>
                <label className="ancho-completo">Nombre del negocio
                  <input type="text" value={form.nombreNegocio} onChange={(e) => setForm({ ...form, nombreNegocio: e.target.value })} />
                </label>
                <label>🔴 Rojo: hasta (días)
                  <input type="number" min="1" value={form.alertaRoja} onChange={(e) => setForm({ ...form, alertaRoja: e.target.value })} />
                </label>
                <label>🟠 Naranja: hasta
                  <input type="number" min="1" value={form.alertaNaranja} onChange={(e) => setForm({ ...form, alertaNaranja: e.target.value })} />
                </label>
                <label>🟡 Amarillo: hasta
                  <input type="number" min="1" value={form.alertaAmarilla} onChange={(e) => setForm({ ...form, alertaAmarilla: e.target.value })} />
                </label>
                <div className="ancho-completo"><button type="submit" className="btn-primary" disabled={ocupado}>Guardar</button></div>
              </form>
            </div>

            <div className="card">
              <h3>📱 Usar desde el celular</h3>
              <label className="check">
                <input type="checkbox" checked={!!config.accesoRed} disabled={ocupado} onChange={(e) => {
                  const activar = e.target.checked;
                  ejecutar(async () => { await guardarConfig({ accesoRed: activar }); await recargar(); setMsg({ ok: activar ? 'Acceso desde la red activado' : 'Acceso desde la red desactivado' }); });
                }} />
                Permitir el uso desde otros equipos de la red (Wi-Fi del local)
              </label>
              {config.accesoRed ? (
                <>
                  <p className="muted">Con el celular en el mismo Wi-Fi que esta PC, abrí en el navegador:</p>
                  {info?.ips?.length ? (
                    <ul className="lista-simple">{info.ips.map((ip) => <li key={ip}><code>http://{ip}:{info.puerto}</code></li>)}</ul>
                  ) : <p className="muted">No se detectó una red local.</p>}
                  <p>PIN para entrar: <strong className="pin">{config.pinRed}</strong>{' '}
                    <button type="button" className="btn-mini" disabled={ocupado} onClick={() => ejecutar(async () => { await guardarConfig({ regenerarPin: true }); await recargar(); setMsg({ ok: 'PIN cambiado: los celulares van a tener que ingresarlo de nuevo' }); })}>Cambiar PIN</button>
                  </p>
                  <small className="muted">Desde otro equipo no se pueden hacer copias de seguridad ni cambiar la configuración. La primera vez Windows puede pedir permiso de red: aceptá solo para redes privadas.</small>
                </>
              ) : (
                <small className="muted">Desactivado: solo se puede usar desde esta PC.</small>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
