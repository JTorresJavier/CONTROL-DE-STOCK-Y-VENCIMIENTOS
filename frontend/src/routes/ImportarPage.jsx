// src/routes/ImportarPage.jsx
// Importar un remito o factura: subir el archivo → revisar lo que se leyó → confirmar.
// Los productos que ya existen se reconocen solos y pasan directo a la carga de vencimiento;
// los que no existen se crean al confirmar.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  analizarDocumento, confirmarImportacion, getImportaciones, getImportacion, deshacerImportacion,
  getProveedores, searchProductos,
} from '../services/api';
import { extraerArchivos, TIPOS_ACEPTADOS } from '../utils/extraer';
import { formatoAR, formatoFechaHora } from '../utils/fechas';
import { FechaInput, Mensajes, Modal, Semaforo, Vacio } from '../components/ui';

let contador = 0;
const nuevaClave = () => `l${++contador}`;

// "IBUPROFENO 400 MG" → "Ibuprofeno 400 mg" (para el nombre de un producto nuevo)
function nombreLindo(txt) {
  if (!txt) return '';
  if (txt !== txt.toUpperCase()) return txt;
  return txt.toLowerCase().replace(/(^|\s)([a-záéíóúñ])/g, (m, s, l) => s + l.toUpperCase())
    .replace(/\b(\d+(?:[.,]\d+)?)\s?(Mg|Ml|G|Mcg|Ui|Gr|Kg|Cc)\b/g, (m, n, u) => `${n} ${u.toLowerCase()}`)
    .replace(/\bX\b/g, 'x');
}

function aLineaUI(l) {
  return {
    key: nuevaClave(),
    incluir: true,
    estado: l.estado,
    confirmado: l.estado === 'existe',
    producto: l.producto,
    nuevo: { nombre: nombreLindo(l.descripcion), codigoBarra: l.ean || '', codigoInterno: l.codigo || '' },
    cantidad: l.cantidad ?? '',
    lote: l.lote || '',
    vencimiento: l.vencimiento || null,
    descripcion: l.descripcion,
    ean: l.ean,
    codigo: l.codigo,
    motivo: l.motivo,
    confianza: l.confianza,
    alternativas: l.alternativas || [],
    original: l.original,
    precio: l.precioUnitario,
  };
}

function problemas(l) {
  const p = [];
  if (!(Number.isInteger(Number(l.cantidad)) && Number(l.cantidad) > 0)) p.push('cantidad');
  if (!l.vencimiento) p.push('vencimiento');
  if (l.producto && !l.confirmado) p.push('confirmar producto');
  if (!l.producto && !l.nuevo.nombre.trim()) p.push('nombre');
  return p;
}

// ─── Paso 1: subir ────────────────────────────────────────────────────────────
function Subir({ onLeido }) {
  const [arrastrando, setArrastrando] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [error, setError] = useState(null);
  const [texto, setTexto] = useState('');
  const inputRef = useRef(null);

  const procesar = async (archivos) => {
    if (!archivos.length) return;
    setError(null);
    try {
      setProgreso('Leyendo archivo…');
      const contenido = await extraerArchivos(archivos, setProgreso);
      if (!contenido.filas?.length && !String(contenido.texto || '').trim()) {
        throw new Error('No se encontró texto en el archivo. Si es una foto, probá con mejor luz y el papel derecho.');
      }
      setProgreso('Buscando los productos en la base…');
      const nombre = archivos.map((a) => a.name).join(', ');
      const r = await analizarDocumento({ ...contenido, archivo: nombre });
      onLeido(r, nombre, contenido);
    } catch (e) {
      setError(e.message || 'No se pudo leer el archivo.');
    } finally {
      setProgreso('');
    }
  };

  const analizarTexto = async () => {
    if (!texto.trim()) return;
    setError(null);
    setProgreso('Analizando texto…');
    try {
      const r = await analizarDocumento({ texto, archivo: 'Texto pegado' });
      onLeido(r, 'Texto pegado', { texto });
    } catch (e) {
      setError(e.message);
    } finally {
      setProgreso('');
    }
  };

  return (
    <div className="importar-subir">
      <Mensajes error={error} />
      <div
        className={`dropzone ${arrastrando ? 'activa' : ''} ${progreso ? 'ocupada' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); procesar([...e.dataTransfer.files]); }}
        onClick={() => !progreso && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        {progreso ? (
          <>
            <div className="spinner" />
            <p><strong>{progreso}</strong></p>
            <small>Todo se procesa en esta computadora, sin internet.</small>
          </>
        ) : (
          <>
            <div className="dropzone-icono">📄</div>
            <p><strong>Arrastrá acá el remito o la factura</strong> o tocá para elegir el archivo</p>
            <small>PDF · foto o escaneo (JPG, PNG) · Excel · CSV · TXT. Podés elegir varias fotos de un mismo remito.</small>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={TIPOS_ACEPTADOS}
          multiple
          hidden
          onChange={(e) => { procesar([...e.target.files]); e.target.value = ''; }}
        />
      </div>

      <details className="pegar-texto">
        <summary>…o pegá el texto del documento</summary>
        <textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Copiá las líneas del remito (por ejemplo desde un mail) y pegalas acá" />
        <button className="btn-primary" onClick={analizarTexto} disabled={!texto.trim() || !!progreso}>Analizar texto</button>
      </details>
    </div>
  );
}

// ─── Elegir otro producto para una línea ──────────────────────────────────────
function SelectorProducto({ linea, onElegir, onNuevo, onClose }) {
  const [q, setQ] = useState(linea.descripcion || '');
  const [resultados, setResultados] = useState([]);
  useEffect(() => {
    const t = setTimeout(() => {
      searchProductos(q.split(/\s+/).filter((w) => w.length >= 3)[0] || q).then(setResultados).catch(() => setResultados([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Modal titulo="¿Qué producto es?" onClose={onClose} ancho={620}>
      <p className="muted">En el documento dice: <strong>{linea.descripcion || linea.original}</strong></p>
      {linea.alternativas.length > 0 && (
        <>
          <small>Parecidos encontrados</small>
          <ul className="lista-opciones">
            {linea.alternativas.map((a) => (
              <li key={a.id}><button type="button" onClick={() => onElegir(a)}>{a.nombre} <small>{a.codigo_barra} · {Math.round(a.confianza * 100)}%</small></button></li>
            ))}
          </ul>
        </>
      )}
      <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código" autoFocus style={{ width: '100%', marginTop: 8 }} />
      <ul className="lista-opciones">
        {resultados.map((p) => (
          <li key={p.id}><button type="button" onClick={() => onElegir(p)}>{p.nombre} <small>{p.codigo_barra}</small></button></li>
        ))}
      </ul>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={onNuevo}>➕ Es un producto nuevo</button>
      </div>
    </Modal>
  );
}

// ─── Paso 2: revisar y completar ──────────────────────────────────────────────
function Revisar({ analisis, archivo, onCancelar, onListo }) {
  const [doc, setDoc] = useState({ ...analisis.documento });
  const [lineas, setLineas] = useState(() => analisis.lineas.map(aLineaUI));
  const [proveedores, setProveedores] = useState([]);
  const [eligiendo, setEligiendo] = useState(null);
  const [forzar, setForzar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [fechaMasiva, setFechaMasiva] = useState(null);
  const refsFecha = useRef({});

  useEffect(() => { getProveedores().then(setProveedores).catch(() => {}); }, []);

  const cambiar = (key, cambios) => setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...cambios } : l)));

  const incluidas = lineas.filter((l) => l.incluir);
  const pendientes = incluidas.filter((l) => problemas(l).length);
  const sinFecha = incluidas.filter((l) => !l.vencimiento);
  const sugeridas = incluidas.filter((l) => l.producto && !l.confirmado);
  const unidades = incluidas.reduce((a, l) => a + (Number(l.cantidad) || 0), 0);

  // Enter en un vencimiento → salta a la próxima línea que no tiene fecha
  const siguienteSinFecha = (keyActual) => {
    const idx = lineas.findIndex((l) => l.key === keyActual);
    const siguiente = [...lineas.slice(idx + 1), ...lineas.slice(0, idx)].find((l) => l.incluir && !l.vencimiento && l.key !== keyActual);
    if (siguiente) refsFecha.current[siguiente.key]?.focus();
  };

  const irAPrimeraSinFecha = () => {
    const l = lineas.find((x) => x.incluir && !x.vencimiento);
    if (l) refsFecha.current[l.key]?.focus();
  };

  // Mismo producto con dos vencimientos: se divide la línea
  const dividir = (l) => {
    const total = Number(l.cantidad) || 0;
    const mitad = Math.floor(total / 2);
    setLineas((ls) => {
      const i = ls.findIndex((x) => x.key === l.key);
      const copia = { ...l, key: nuevaClave(), cantidad: total - mitad || '', vencimiento: null, lote: '' };
      const out = [...ls];
      out[i] = { ...l, cantidad: mitad || l.cantidad };
      out.splice(i + 1, 0, copia);
      return out;
    });
  };

  const confirmar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const r = await confirmarImportacion({
        archivo,
        tipoDocumento: doc.tipoDocumento,
        numero: doc.numero,
        fechaDocumento: doc.fechaDocumento,
        proveedor: doc.proveedor,
        forzar,
        lineas: incluidas.map((l) => ({
          productoId: l.producto?.id,
          nuevo: l.producto ? undefined : { nombre: l.nuevo.nombre.trim(), codigoBarra: l.nuevo.codigoBarra.trim() || undefined, codigoInterno: l.nuevo.codigoInterno.trim() || undefined },
          cantidad: Number(l.cantidad),
          vencimiento: l.vencimiento,
          lote: l.lote,
          descripcionOriginal: l.descripcion,
        })),
      });
      onListo(r);
    } catch (e) {
      setError(e.message);
      if (e.data?.duplicado) setForzar(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div className="doc-datos">
        <label>Proveedor
          <input type="text" list="lista-proveedores" value={doc.proveedor || ''} onChange={(e) => setDoc({ ...doc, proveedor: e.target.value })} placeholder="Nombre del proveedor" />
          <datalist id="lista-proveedores">{proveedores.map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
        </label>
        <label>Tipo
          <select value={doc.tipoDocumento || ''} onChange={(e) => setDoc({ ...doc, tipoDocumento: e.target.value || null })}>
            <option value="">—</option><option>REMITO</option><option>FACTURA</option><option>NOTA DE ENTREGA</option>
          </select>
        </label>
        <label>Número
          <input type="text" value={doc.numero || ''} onChange={(e) => setDoc({ ...doc, numero: e.target.value })} placeholder="0001-00001234" />
        </label>
        <label>Fecha del documento
          <input type="date" value={doc.fechaDocumento || ''} onChange={(e) => setDoc({ ...doc, fechaDocumento: e.target.value || null })} />
        </label>
        <small className="doc-archivo">📎 {archivo}</small>
      </div>

      {analisis.duplicado && (
        <div className="alert-warn">
          ⚠️ Este documento ({analisis.duplicado.numero}) ya se importó el {formatoFechaHora(analisis.duplicado.fecha)}.
          <label className="check"><input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)} /> Importarlo igual</label>
        </div>
      )}

      <div className="chips-resumen">
        <span className="chip">{incluidas.length} líneas · {unidades} unidades</span>
        <span className="chip chip-ok">✔ {incluidas.filter((l) => l.producto && l.confirmado).length} ya cargados</span>
        {sugeridas.length > 0 && <span className="chip chip-warn">? {sugeridas.length} para confirmar</span>}
        <span className="chip chip-nuevo">➕ {incluidas.filter((l) => !l.producto).length} nuevos</span>
        {sinFecha.length > 0 && <span className="chip chip-error">📅 {sinFecha.length} sin vencimiento</span>}
      </div>

      <div className="acciones-masivas">
        {sugeridas.length > 0 && (
          <button type="button" onClick={() => setLineas((ls) => ls.map((l) => (l.producto ? { ...l, confirmado: true } : l)))}>
            ✔ Aceptar las {sugeridas.length} sugerencias
          </button>
        )}
        {sinFecha.length > 0 && (
          <>
            <button type="button" onClick={irAPrimeraSinFecha}>📅 Cargar vencimientos que faltan</button>
            <span className="masivo-fecha">
              <FechaInput valor={fechaMasiva} onChange={setFechaMasiva} compacto placeholder="Misma fecha…" />
              <button type="button" disabled={!fechaMasiva} onClick={() => setLineas((ls) => ls.map((l) => (l.incluir && !l.vencimiento ? { ...l, vencimiento: fechaMasiva } : l)))}>
                Aplicar a las {sinFecha.length} sin fecha
              </button>
            </span>
          </>
        )}
      </div>

      {lineas.length === 0 ? (
        <Vacio>No se encontraron productos en el documento. Revisá que sea un remito o factura con el detalle de productos, o pegá el texto.</Vacio>
      ) : (
        <div className="tabla-scroll">
          <table className="tabla-importar">
            <thead>
              <tr>
                <th title="Incluir">✓</th>
                <th>En el documento</th>
                <th>Producto en la base</th>
                <th>Cant.</th>
                <th>Lote</th>
                <th>Vencimiento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const faltan = problemas(l);
                return (
                  <tr key={l.key} className={`${!l.incluir ? 'excluida' : faltan.length ? 'pendiente' : 'lista'}`}>
                    <td><input type="checkbox" checked={l.incluir} onChange={(e) => cambiar(l.key, { incluir: e.target.checked })} aria-label="Incluir línea" /></td>
                    <td className="celda-doc">
                      <div>{l.descripcion || <em>{l.original}</em>}</div>
                      <small>{[l.ean && `EAN ${l.ean}`, l.codigo && `Cód. ${l.codigo}`].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td className="celda-producto">
                      {l.producto ? (
                        <>
                          <span className={`badge ${l.confirmado ? 'badge-verde' : 'badge-amarillo'}`}>
                            {l.confirmado ? (l.estado === 'existe' ? '✔ Ya cargado' : '✔ Confirmado') : '? Revisar'}
                          </span>{' '}
                          <strong>{l.producto.nombre}</strong>
                          <small className="motivo">{l.motivo}</small>
                          <div className="acciones-linea">
                            {!l.confirmado && <button type="button" className="btn-mini btn-primary" onClick={() => cambiar(l.key, { confirmado: true })}>Sí, es este</button>}
                            <button type="button" className="btn-mini" onClick={() => setEligiendo(l)}>Cambiar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="badge badge-nuevo">➕ Nuevo</span>
                          <input type="text" value={l.nuevo.nombre} onChange={(e) => cambiar(l.key, { nuevo: { ...l.nuevo, nombre: e.target.value } })} placeholder="Nombre del producto" className="input-nombre" />
                          <input type="text" value={l.nuevo.codigoBarra} onChange={(e) => cambiar(l.key, { nuevo: { ...l.nuevo, codigoBarra: e.target.value.replace(/\s/g, '') } })} placeholder="Código de barras (opcional)" className="input-codigo" />
                          <button type="button" className="btn-mini" onClick={() => setEligiendo(l)}>Buscar en la base</button>
                        </>
                      )}
                    </td>
                    <td>
                      <input type="number" min="1" className="input-cant" value={l.cantidad} onChange={(e) => cambiar(l.key, { cantidad: e.target.value })} aria-invalid={faltan.includes('cantidad')} />
                    </td>
                    <td><input type="text" className="input-lote" value={l.lote} onChange={(e) => cambiar(l.key, { lote: e.target.value })} placeholder="Opcional" /></td>
                    <td>
                      <FechaInput
                        valor={l.vencimiento}
                        onChange={(v) => cambiar(l.key, { vencimiento: v })}
                        onEnter={() => siguienteSinFecha(l.key)}
                        inputRef={(el) => { refsFecha.current[l.key] = el; }}
                        compacto
                      />
                      {l.vencimiento && <Semaforo fecha={l.vencimiento} />}
                    </td>
                    <td><button type="button" className="btn-mini" title="Mismo producto con otro vencimiento" onClick={() => dividir(l)}>➗ Dividir</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Mensajes error={error} />

      <div className="barra-confirmar">
        <button type="button" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <div>
          {pendientes.length > 0 && <small className="texto-error">Faltan datos en {pendientes.length} línea{pendientes.length > 1 ? 's' : ''} (marcadas en amarillo).</small>}
          <button
            type="button"
            className="btn-primary btn-grande"
            onClick={confirmar}
            disabled={guardando || !incluidas.length || pendientes.length > 0 || (analisis.duplicado && !forzar)}
          >
            {guardando ? 'Guardando…' : `✔ Confirmar ingreso (${unidades} unidades)`}
          </button>
        </div>
      </div>

      {eligiendo && (
        <SelectorProducto
          linea={eligiendo}
          onClose={() => setEligiendo(null)}
          onElegir={(p) => { cambiar(eligiendo.key, { producto: p, confirmado: true, estado: 'existe', motivo: 'Elegido a mano' }); setEligiendo(null); }}
          onNuevo={() => { cambiar(eligiendo.key, { producto: null, confirmado: false, estado: 'nuevo' }); setEligiendo(null); }}
        />
      )}
    </div>
  );
}

// ─── Paso 3: listo ────────────────────────────────────────────────────────────
function Listo({ resultado, onOtro, onDeshacer }) {
  return (
    <div className="importar-listo">
      <div className="listo-icono">✅</div>
      <h3>Importación guardada</h3>
      <p>Se cargaron <strong>{resultado.unidades}</strong> unidades en <strong>{resultado.lineas}</strong> lotes
        {resultado.productosNuevos > 0 && <> y se crearon <strong>{resultado.productosNuevos}</strong> productos nuevos</>}.</p>
      <div className="botones-centro">
        <Link className="btn btn-primary" to="/vencimientos">Ver vencimientos</Link>
        <button type="button" onClick={onOtro}>📄 Importar otro documento</button>
        <button type="button" className="btn-peligro" onClick={onDeshacer}>↩ Deshacer esta importación</button>
      </div>
    </div>
  );
}

// ─── Historial ────────────────────────────────────────────────────────────────
function Historial() {
  const [lista, setLista] = useState([]);
  const [abierta, setAbierta] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [msg, setMsg] = useState({});

  const cargar = useCallback(() => getImportaciones().then(setLista).catch((e) => setMsg({ error: e.message })), []);
  useEffect(() => { cargar(); }, [cargar]);

  const ver = async (id) => {
    if (abierta === id) { setAbierta(null); return; }
    setAbierta(id);
    setDetalle(null);
    setDetalle(await getImportacion(id));
  };

  const deshacer = async (imp) => {
    if (!window.confirm(`¿Deshacer la importación #${imp.id}? Se quitarán sus ${imp.total_unidades} unidades del stock y los productos que se crearon con ella.`)) return;
    try {
      const r = await deshacerImportacion(imp.id);
      setMsg({ ok: `${r.message}: ${r.lotesEliminados} lotes quitados, ${r.productosEliminados} productos eliminados.` });
      cargar();
      setAbierta(null);
    } catch (e) {
      setMsg({ error: e.message });
    }
  };

  return (
    <div>
      <Mensajes {...msg} />
      {lista.length === 0 ? <Vacio>Todavía no hay importaciones.</Vacio> : (
        <div className="tabla-scroll">
          <table className="table-venc">
            <thead><tr><th>#</th><th>Fecha</th><th>Proveedor</th><th>Documento</th><th>Líneas</th><th>Unidades</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {lista.map((i) => (
                <FilaHistorial key={i.id} i={i} abierta={abierta === i.id} detalle={abierta === i.id ? detalle : null} onVer={() => ver(i.id)} onDeshacer={() => deshacer(i)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaHistorial({ i, abierta, detalle, onVer, onDeshacer }) {
  return (
    <>
      <tr className={i.estado === 'DESHECHA' ? 'excluida' : ''}>
        <td>{i.id}</td>
        <td>{formatoFechaHora(i.fecha)}</td>
        <td>{i.proveedor_nombre || '—'}</td>
        <td>{[i.tipo_documento, i.numero].filter(Boolean).join(' ') || i.archivo}</td>
        <td className="text-right">{i.total_lineas}</td>
        <td className="text-right">{i.total_unidades}</td>
        <td>{i.estado === 'DESHECHA' ? <span className="badge badge-sin">Deshecha</span> : <span className="badge badge-verde">Confirmada</span>}</td>
        <td className="acciones-linea">
          <button type="button" className="btn-mini" onClick={onVer}>{abierta ? 'Ocultar' : 'Ver'}</button>
          {i.estado === 'CONFIRMADA' && <button type="button" className="btn-mini btn-peligro" onClick={onDeshacer} disabled={i.lotes_modificados > 0} title={i.lotes_modificados > 0 ? 'Ya hubo movimientos de este stock' : ''}>Deshacer</button>}
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={8} className="detalle-fila">
            {!detalle ? 'Cargando…' : (
              <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>Lote</th><th>Vencimiento</th></tr></thead>
                <tbody>
                  {(detalle.lotes.length ? detalle.lotes : detalle.movimientos).map((l) => (
                    <tr key={l.id}>
                      <td>{l.producto_nombre}{l.producto_nuevo ? ' (nuevo)' : ''}</td>
                      <td className="text-right">{l.cantidad_inicial ?? l.cantidad}</td>
                      <td>{l.lote || '-'}</td>
                      <td>{formatoAR(l.fecha_vencimiento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export function ImportarPage() {
  const [pestana, setPestana] = useState('importar');
  const [analisis, setAnalisis] = useState(null);
  const [archivo, setArchivo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [msg, setMsg] = useState({});
  const [clave, setClave] = useState(0);

  const reiniciar = () => { setAnalisis(null); setResultado(null); setMsg({}); };

  return (
    <div className="page">
      <div className="card card-ancha">
        <div className="titulo-con-tabs">
          <h2>📥 Importar remito o factura</h2>
          <div className="tabs">
            <button type="button" className={pestana === 'importar' ? 'activa' : ''} onClick={() => setPestana('importar')}>Importar</button>
            <button type="button" className={pestana === 'historial' ? 'activa' : ''} onClick={() => setPestana('historial')}>Historial</button>
          </div>
        </div>

        {pestana === 'historial' ? <Historial /> : (
          <>
            <Mensajes {...msg} />
            {resultado ? (
              <Listo
                resultado={resultado}
                onOtro={reiniciar}
                onDeshacer={async () => {
                  try {
                    const r = await deshacerImportacion(resultado.importacionId);
                    setResultado(null);
                    setAnalisis(null);
                    setMsg({ ok: `Importación deshecha (${r.lotesEliminados} lotes quitados).` });
                  } catch (e) { setMsg({ error: e.message }); }
                }}
              />
            ) : analisis ? (
              <Revisar key={clave} analisis={analisis} archivo={archivo} onCancelar={reiniciar} onListo={(r) => { setResultado(r); setMsg({}); }} />
            ) : (
              <>
                <ol className="pasos">
                  <li><strong>Subí</strong> el remito o la factura (PDF, foto, Excel, CSV o texto).</li>
                  <li><strong>Revisá</strong>: lo que ya está en la base se reconoce solo; lo nuevo se crea.</li>
                  <li><strong>Completá</strong> los vencimientos que falten (escribí 1226 + Enter y pasa al siguiente).</li>
                </ol>
                <Subir onLeido={(r, nombre) => { setAnalisis(r); setArchivo(nombre); setClave((c) => c + 1); setMsg({}); }} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
