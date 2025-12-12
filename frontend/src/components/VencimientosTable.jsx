// src/components/VencimientosTable.jsx

// Calcula cuántos días faltan para el vencimiento
function diasFaltan(fechaISO) {
  const hoy = new Date();
  const fv = new Date(fechaISO);

  hoy.setHours(0, 0, 0, 0);
  fv.setHours(0, 0, 0, 0);

  const diffMs = fv.getTime() - hoy.getTime();
  const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return dias;
}

export function VencimientosTable({ lotes }) {
  if (!lotes || lotes.length === 0) {
    return <p style={{ color: '#93a5b4' }}>No hay lotes para mostrar.</p>;
  }

  return (
    <table className="table-venc">
      <thead>
        <tr>
          <th>Código barras</th>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Fecha vencimiento</th>
          <th>Descripción</th>
        </tr>
      </thead>
      <tbody>
        {lotes.map((lote) => {
          const dias = diasFaltan(lote.fecha_vencimiento);

          // Formatea YYYY-MM-DDTHH:mm:ssZ → DD/MM/YYYY
          function formatearFecha(iso) {
            if (!iso) return '';
            const d = new Date(iso);
            const dia = String(d.getDate()).padStart(2, '0');
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const año = d.getFullYear();
            return `${dia}/${mes}/${año}`;
          }

          // Determinamos la clase según días restantes
          let rowClass = 'row-green';
          if (dias <= 30 && dias > 15) rowClass = 'row-yellow';
          if (dias <= 15) rowClass = 'row-red';

          const descripcion =
            dias >= 0
              ? `Faltan ${dias} días`
              : `Vencido hace ${Math.abs(dias)} días`;

          return (
            <tr key={lote.id} className={rowClass}>
              <td>{lote.codigo_barra}</td>
              <td>{lote.producto_nombre}</td>
              <td className="text-right">{lote.cantidad}</td>
              <td>{formatearFecha(lote.fecha_vencimiento)}</td>
              <td>{descripcion}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
