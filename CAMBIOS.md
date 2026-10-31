# Cambios — versión 2.0.0 (30/10/2026)

Trabajo hecho en la rama `mejoras-ia` (sin publicar ni subir a GitHub).
Antes de empezar se guardaron en el commit `6f616ba` los 18 cambios locales que había sin guardar, tal cual estaban,
y se copiaron las bases de datos existentes a `respaldos/` (la del proyecto y la de `%APPDATA%\epicfarma-control-stock`).

## Errores corregidos

| Error | Dónde | Qué pasaba |
|---|---|---|
| Fechas corridas un día | Inicio, Vencimientos, Reportes, Salida | `new Date("2026-05-01")` es medianoche UTC: en Argentina se mostraba 30/04 y los "días que faltan" daban uno menos. Ahora las fechas se manejan como texto `AAAA-MM-DD`. |
| Fecha de carga en UTC | Backend | `date('now')` guarda la fecha UTC: después de las 21 h se registraba el día siguiente. Ahora se usa la hora local. |
| Rutas duplicadas peligrosas | `server.js` | Las rutas de lotes estaban montadas también en `/api`: `DELETE /api/123` borraba el lote 123. |
| Pantalla de Salida inaccesible y con error | `SalidaPage` | No estaba en el menú y al apretar Insert se rompía (`setManualOpen` no existía). |
| Cantidades y fechas sin validar | Backend | Se aceptaban cantidades negativas, decimales, texto ("abc" quedaba como NULL), fechas imposibles (31/02) y lotes de productos inexistentes. |
| Fechas 31/02 en el ingreso | `useScannerFlow` | DDMMAA no validaba el día del mes. Además MMAA ahora vence el último día del mes (antes el día 1). |
| Código manual como número | `ManualCodeModal`, `ExpiryModal` | Con `type="number"` se podían perder ceros adelante. |
| Advertencias de React | `VencimientosTable` | Fragmentos sin `key` en la tabla. |
| Movimientos incompletos | Backend | Solo se registraban las salidas: ingresos, ediciones y borrados no dejaban rastro. Ahora todo queda en Movimientos. |
| Líneas de ingreso perdidas | Ingreso | Si se cambiaba de pantalla antes de "Guardar" se perdía todo. Ahora quedan guardadas hasta confirmar, se pueden quitar y se ve el nombre del producto (antes el ID). |
| Búsqueda con `%` o `_` | Backend | Se interpretaban como comodines. |
| Backend no arrancaba suelto | `npm start` del backend | better-sqlite3 está compilado para Electron. Se agregó `scripts/electron-node.js`. |
| `.env` dentro del instalador | `package.json` | El archivo con datos de MySQL (no usados) se copiaba al `.exe`. |
| Ventana con `webSecurity: false` | `electron/main.js` | Ahora la app se sirve desde el backend (`http://localhost:4000`) con la seguridad normal activada, una sola instancia y aviso si el puerto está ocupado. |
| Versión vieja en caché | Backend | `index.html` se guardaba en caché 1 hora: después de actualizar se podía ver la versión anterior. |
| Errores de lint | Frontend | 7 errores (setState dentro de efectos, bloques vacíos). Ahora `npm run lint` da 0. |

## Funciones nuevas

### Importación de remitos y facturas (pantalla **Importar remito**)
- Lee **PDF con texto, PDF escaneado, fotos (JPG/PNG), Excel, CSV, TXT** o texto pegado. Todo sin internet:
  pdf.js para PDF y Tesseract (OCR en español, archivos incluidos en la app) para escaneos y fotos.
- El OCR prepara la imagen (agranda, pasa a blanco y negro y **borra las líneas de la tabla**, que confunden al reconocimiento) y
  corrige errores típicos de lectura (`14.207.50`, `0372027` = 03/2027).
- Detecta proveedor, tipo, número y fecha del documento; por línea: EAN (valida el dígito verificador), código, descripción,
  cantidad (incluso verificando cantidad × unitario = total), lote y vencimiento (también en la línea siguiente).
- Busca cada producto: código de barras → código interno → nombre recordado de importaciones anteriores → nombre parecido
  (tolera abreviaturas como "IBUPROF. 600MG X10" = "Ibuprofeno 600 mg x 10 comprimidos", y no confunde dosis distintas).
- Pantalla de revisión: ya cargado / revisar / nuevo, cambiar el producto, editar cantidad y lote, excluir líneas,
  **dividir** una línea con dos vencimientos, aceptar todas las sugerencias, carga rápida de vencimientos con Enter y
  "misma fecha para todas las que faltan".
- Al confirmar: crea los productos nuevos, carga los lotes con vencimiento, registra el movimiento, crea el proveedor
  y **aprende** cómo nombra ese proveedor a cada producto.
- Avisa si el documento ya se importó. **Historial** con detalle y **deshacer** (solo si ese stock no se usó).

### Otras herramientas
- **Inicio** con semáforo configurable (vencidos / rojo / naranja / amarillo), faltantes, lo más urgente y accesos rápidos.
- **Productos**: stock total, stock mínimo, próximo vencimiento, faltantes, alta/edición/baja, proveedor, laboratorio, código interno, exportar Excel/PDF.
- **Movimientos**: historial con filtros por fecha, tipo y producto, exportable.
- **Proveedores**.
- **Vencimientos**: filtro por color, búsqueda por lote, **dar de baja** vencidos (queda registrado).
- **Salida** con motivo y detalle FEFO.
- **Herramientas**: copias de seguridad automáticas (al abrir y diarias, últimas 20), descarga, restauración
  (valida el archivo y guarda antes una copia de lo actual), días del semáforo, nombre del negocio y acceso desde el celular.
- **Datos de ejemplo** para probar (solo con la base vacía) y documentos de ejemplo en `muestras/`.

## Decisiones tomadas
- **Vencimiento MM/AA = último día del mes** (criterio habitual en medicamentos).
- **Acceso desde la red desactivado por defecto.** Se activa en Herramientas y pide un PIN de 6 números; desde otro equipo
  no se pueden hacer respaldos, restauraciones ni cambiar la configuración. La cámara del celular para escanear necesita
  conexión segura (HTTPS), así que por la red local sirve el lector de código de barras o escribir el código.
- Se mantuvo Electron 31 (el que traía el proyecto) para no recompilar la base de datos; conviene actualizarlo más adelante.
- Las tablas viejas no se tocan: las migraciones solo agregan columnas y tablas (versión del esquema en `PRAGMA user_version`).

## Auditoría Codex

Codex (OpenAI) revisó todos los cambios en modo **solo lectura**, en tres rondas. Cada hallazgo se comprobó en el código antes de corregirlo.

### Ronda 1: 9 hallazgos, todos confirmados y corregidos
| # | Gravedad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Alta | La API escuchaba en la red sin ninguna protección (cualquiera en el Wi-Fi podía bajar la base o restaurar otra). | Acceso desde la red **desactivado por defecto**; si se activa pide PIN de 6 números; respaldos, restauración, datos de ejemplo y configuración solo desde la PC; CORS solo para el servidor de desarrollo. |
| 2 | Alta | Se borraba la presentación al final de la descripción ("X 30" y "X 60" quedaban iguales y se mezclaban). | No se elimina un número precedido de "x". |
| 3 | Alta | Las dosis decimales ("0,5 mg") se tomaban como precio y se perdían. | Un decimal seguido de unidad (mg, ml, g…) o precedido de "x" es parte del producto. |
| 4 | Alta | Un código interno igual asignaba otro producto aunque el EAN y el nombre fueran distintos. | Si el EAN contradice o el nombre no se parece, solo se **sugiere**. |
| 5 | Media | Dos respaldos en el mismo minuto se pisaban. | Nombre con segundos y sufijo si ya existe. |
| 6 | Media | Se podía deshacer una importación que tuvo movimientos si la cantidad volvía al valor inicial, o con lotes borrados. | Se revisan los movimientos de cada lote y los lotes faltantes. |
| 7 | Media | El OCR dejaba en blanco las imágenes que ya eran blanco y negro puro. | Comparación `<=` con el umbral. |
| 8 | Media | Cantidades con decimales (1,5) se redondeaban sin avisar. | Quedan vacías para completar a mano. |
| 9 | Media | "Dividir" una línea de 1 unidad la duplicaba. | Solo se puede dividir desde 2 unidades. |

### Ronda 2: verificación
- Confirmó corregidos 2, 3, 6, 7, 8 y 9. Marcó 1, 4 y 5 como parciales y encontró 2 problemas nuevos, todos corregidos:
  - (Alta) `/api/BACKUP` o `/api/config/` (mayúsculas o barra final) saltaban la restricción "solo desde la PC" → la ruta se normaliza.
  - (Media) `/api/resumen` mostraba el PIN a los celulares → se oculta fuera de la PC.
  - (Parcial 4) Un nombre recordado de importaciones anteriores con otro EAN se asignaba solo → ahora se sugiere.
  - (Parcial 5) Dos respaldos simultáneos podían elegir el mismo archivo → se reserva el nombre en forma exclusiva.

### Ronda 3: verificación final
- Confirmó todo corregido, **sin problemas nuevos**.

### Encontrado en la prueba de punta a punta (después de Codex)
- En el PDF escaneado el OCR leyó una cantidad "6" como "B" y se tomaba el código 20011 como cantidad. Ahora no se inventa
  la cantidad si la columna está vacía y, si hay precio unitario y total, se deduce (total ÷ unitario). Agregado a las pruebas.

## Pruebas
- `npm test`: 22 pruebas del backend (fechas, lector de remitos con texto real de OCR, emparejamiento, API completa,
  importar/deshacer, respaldo/restauración, acceso por red).
- `npm run lint` y `npm run build` sin errores.
- `npx electron scripts/capturas.js`: prueba de punta a punta en la app real con una base temporal. Importó los 6 archivos
  de ejemplo (TXT, CSV, Excel, PDF, foto y PDF escaneado): todos leyeron las 9 líneas / 131 unidades del remito
  (5 / 40 de la factura) y reconocieron los productos existentes. Capturas en `capturas/`.
