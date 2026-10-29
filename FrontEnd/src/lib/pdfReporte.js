import { ESTADO_PLAN, fecha, fechaHora, importe, nombreUsuario } from './formato.js';

// PDF ejecutivo en el navegador (jsPDF + jspdf-autotable); las gráficas ya
// renderizadas en la vista previa se capturan con html2canvas. Las tres
// librerías se cargan bajo demanda para no engordar el bundle principal.
const TINTA = [39, 49, 58];
const TENUE = [99, 113, 123];
const ACENTO = [67, 91, 108];
const MARGEN = 16;

// Divide el texto del LLM en secciones "## Título" con párrafos y viñetas "- ".
export function seccionesDeTexto(texto) {
  const secciones = [];
  for (const linea of texto.split('\n')) {
    const limpia = linea.trim();
    if (!limpia) continue;
    if (limpia.startsWith('## ')) secciones.push({ titulo: limpia.slice(3).trim(), lineas: [] });
    else {
      if (secciones.length === 0) secciones.push({ titulo: '', lineas: [] });
      secciones.at(-1).lineas.push(limpia.replace(/\*\*/g, ''));
    }
  }
  return secciones;
}

export async function generarPdfReporte({ titulo, periodoDesde, periodoHasta, texto, resumen, prioridades, graficas }) {
  const [{ jsPDF }, { autoTable }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('html2canvas'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  let y = MARGEN;

  const espacio = (necesario) => {
    if (y + necesario > alto - MARGEN) {
      doc.addPage();
      y = MARGEN;
    }
  };

  // Encabezado
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACENTO);
  doc.text('SolvIA · Reporte ejecutivo', MARGEN, y);
  y += 7;
  doc.setFontSize(16).setTextColor(...TINTA);
  for (const linea of doc.splitTextToSize(titulo, util)) {
    doc.text(linea, MARGEN, y);
    y += 7;
  }
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...TENUE);
  doc.text(`Periodo: ${fecha(periodoDesde)} – ${fecha(periodoHasta)}   ·   Generado: ${fechaHora(new Date().toISOString())}`, MARGEN, y);
  y += 4;
  doc.setDrawColor(...ACENTO).setLineWidth(0.4).line(MARGEN, y, ancho - MARGEN, y);
  y += 8;

  // Indicadores
  const t = resumen.totales;
  const indicadores = [
    ['Cuentas', String(t.cuentas)],
    ['Atrasadas', String(t.atrasadas)],
    ['Morosidad', `${t.indiceMorosidad} %`],
    ['Saldo total', importe(t.saldoTotal)],
    ['Vencido', importe(t.montoVencido)],
  ];
  const celda = util / indicadores.length;
  indicadores.forEach(([nombre, valor], i) => {
    const x = MARGEN + i * celda;
    doc.setFontSize(8).setTextColor(...TENUE).text(nombre, x, y);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...TINTA).text(valor, x, y + 6);
    doc.setFont('helvetica', 'normal');
  });
  y += 14;

  // Texto del LLM revisado por el administrador
  for (const { titulo: encabezado, lineas } of seccionesDeTexto(texto)) {
    if (encabezado) {
      espacio(12);
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...ACENTO).text(encabezado, MARGEN, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
    }
    doc.setFontSize(10).setTextColor(...TINTA);
    for (const linea of lineas) {
      const vineta = linea.startsWith('- ');
      const contenido = vineta ? linea.slice(2) : linea;
      const sangria = vineta ? 5 : 0;
      for (const [i, parte] of doc.splitTextToSize(contenido, util - sangria).entries()) {
        espacio(5);
        if (vineta && i === 0) doc.text('•', MARGEN + 1, y);
        doc.text(parte, MARGEN + sangria, y);
        y += 5;
      }
      y += 1.5;
    }
    y += 3;
  }

  // Gráficas capturadas de la vista previa
  for (const { titulo: nombre, nodo } of graficas) {
    if (!nodo) continue;
    // html2canvas no resuelve los clip-path de Recharts y oculta barras y
    // líneas: se quitan en la copia que captura (no en la página).
    const lienzo = await html2canvas(nodo, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (_doc, copia) => copia.querySelectorAll('[clip-path]').forEach((el) => el.removeAttribute('clip-path')),
    });
    const altoImagen = (lienzo.height / lienzo.width) * util;
    espacio(altoImagen + 10);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...ACENTO).text(nombre, MARGEN, y);
    doc.setFont('helvetica', 'normal');
    y += 3;
    // JPEG: con PNG cada gráfica pesaba más de 1 MB.
    doc.addImage(lienzo.toDataURL('image/jpeg', 0.9), 'JPEG', MARGEN, y, util, altoImagen);
    y += altoImagen + 8;
  }

  // Cuentas prioritarias
  if (prioridades.length > 0) {
    espacio(30);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...ACENTO).text('Cuentas que necesitan atención', MARGEN, y);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: y + 3,
      margin: { left: MARGEN, right: MARGEN },
      head: [['Cuenta', 'Deudor', 'Situación', 'Vencido', 'Días de mora', 'Prioridad', 'Responsable']],
      body: prioridades.map((p) => [
        p.referenciaExterna ?? `#${p.id}`,
        p.deudor.nombre,
        ESTADO_PLAN[p.estadoPlan] ?? p.estadoPlan,
        importe(p.montoVencido),
        String(p.diasMora),
        String(p.prioridad),
        nombreUsuario(p.responsable),
      ]),
      styles: { fontSize: 8, textColor: TINTA, cellPadding: 1.8 },
      headStyles: { fillColor: ACENTO, textColor: [255, 255, 255] },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });
  }

  // Pie con número de página
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(...TENUE);
    doc.text('Texto redactado con IA (Gemini vía MCP) y revisado por el administrador. Datos ficticios de demostración.', MARGEN, alto - 8);
    doc.text(`${i} / ${paginas}`, ancho - MARGEN, alto - 8, { align: 'right' });
  }

  return doc.output('blob');
}
