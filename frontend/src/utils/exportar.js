// src/utils/exportar.js
// Exportación a Excel y PDF de cualquier listado.
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { hoyISO } from './fechas';

// filas: array de objetos { 'Columna': valor }
export function exportarExcel(nombreArchivo, filas, hoja = 'Datos') {
  const ws = XLSX.utils.json_to_sheet(filas);
  // Ancho de columnas según el contenido
  const cols = Object.keys(filas[0] || {});
  ws['!cols'] = cols.map((c) => ({ wch: Math.min(60, Math.max(c.length, ...filas.map((f) => String(f[c] ?? '').length)) + 2) }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, ws, hoja.slice(0, 31));
  XLSX.writeFile(libro, `${nombreArchivo}_${hoyISO()}.xlsx`);
}

const COLORES = {
  vencido: [254, 202, 202],
  rojo: [254, 215, 170],
  naranja: [254, 230, 180],
  amarillo: [254, 249, 195],
  verde: [220, 252, 231],
};

// columnas: ['Código', ...]; filas: arrays; nivelFila(i) → 'vencido'|'rojo'|... para colorear
export function exportarPDF({ titulo, subtitulo, columnas, filas, nivelFila, nombreArchivo, negocio = 'EpicFarma' }) {
  const doc = new jsPDF({ orientation: columnas.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(`${titulo} - ${negocio}`, 14, 15);
  doc.setFontSize(9);
  doc.text(`${new Date().toLocaleString('es-AR')}${subtitulo ? '  |  ' + subtitulo : ''}  |  ${filas.length} filas`, 14, 21);
  autoTable(doc, {
    startY: 26,
    head: [columnas],
    body: filas,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
    didParseCell: (data) => {
      if (data.section === 'body' && nivelFila) {
        const color = COLORES[nivelFila(data.row.index)];
        if (color) data.cell.styles.fillColor = color;
      }
    },
  });
  doc.save(`${nombreArchivo}_${hoyISO()}.pdf`);
}
