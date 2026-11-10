import { jsPDF } from 'jspdf';
import { PartnerProfile, RoiMetrics, WorkshopCard } from '../types/erp';
import { computeMaterialRowBreakdown } from './roiCalculator';

/**
 * Genera ed esporta il PDF stampabile della Packing List Materiali + Sintesi Operativa del Laboratorio.
 */
export function exportPackingListPdf(
  workshop: WorkshopCard,
  metrics: RoiMetrics,
  partner?: PartnerProfile
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Sfondo intestazione Kraft
  doc.setFillColor(234, 221, 205); // #EADDCD
  doc.rect(0, 0, 210, 48, 'F');

  // Titolo Brand e Scheda
  doc.setTextColor(26, 43, 76); // #1A2B4C Blu Notte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('FATTI A MANO — LAB & DESIGN ERP · PACKING LIST OPERATIVA', 14, 13);

  doc.setFontSize(17);
  doc.text(workshop.title, 14, 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(74, 107, 83); // #4A6B53 Verde Bosco
  doc.text(
    `${workshop.dateLabel}  |  Location: ${workshop.location}  |  Target: ${metrics.pax} Partecipanti`,
    14,
    31
  );

  if (partner) {
    doc.setTextColor(26, 43, 76);
    doc.setFontSize(8.5);
    doc.text(
      `Partner: ${partner.name} · Accordo: ${partner.commercialDealType} (Font: ${partner.fontStyle}, Palette: ${partner.palette.join(', ')})`,
      14,
      39
    );
  }

  // Box Riepilogo Economico Rapido
  let y = 57;
  doc.setDrawColor(184, 91, 67); // #B85B43 Terracotta
  doc.setLineWidth(0.4);
  doc.rect(14, y - 6, 182, 18);

  doc.setTextColor(26, 43, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    `Biglietto: €${metrics.ticketPrice.toFixed(2)}   |   Quota Locale: €${metrics.venueFeePerPax.toFixed(2)}/pax   |   Costo/Pax (S1): €${metrics.costPerPaxEvent1.toFixed(2)}`,
    18,
    y
  );
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Utile Netto Serata 1 (con fissi): €${metrics.netProfitEvent1.toFixed(2)}   |   Utile Netto Serate Successive: €${metrics.netProfitSubsequent.toFixed(2)}`,
    18,
    y + 7
  );

  // Sezione Checklist Materiali
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(184, 91, 67);
  doc.text('CHECKLIST MATERIALI DA CARICARE (CONF. x PEZZI & SCORTE)', 14, y);

  y += 7;
  doc.setFontSize(8.5);
  doc.setTextColor(26, 43, 76);
  doc.text('OK', 14, y);
  doc.text('MATERIALE / ATTREZZATURA', 26, y);
  doc.text('TIPO', 110, y);
  doc.text('CONF.xPZ', 136, y);
  doc.text('SCORTA', 158, y);
  doc.text('SUBTOTALE', 178, y);

  doc.setDrawColor(26, 43, 76);
  doc.line(14, y + 2, 196, y + 2);
  y += 8;

  const isLinked = workshop.calculatorLinked ?? true;
  doc.setFont('helvetica', 'normal');
  for (const item of workshop.materials) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    const isFixed = item.costType === 'fixed';
    const breakdown = computeMaterialRowBreakdown(item, metrics.pax, isLinked);

    // Casella spunta
    doc.rect(14.5, y - 3.5, 4, 4);
    if (item.packed) {
      doc.setFont('helvetica', 'bold');
      doc.text('X', 15.5, y - 0.3);
      doc.setFont('helvetica', 'normal');
    }

    doc.text(item.name.slice(0, 44), 26, y);
    doc.text(isFixed ? 'Fisso' : 'Variabile', 110, y);
    doc.text(
      `${item.packsOrdered ?? 1}x${item.piecesPerPack ?? item.quantity}`,
      136,
      y
    );
    doc.text(`${breakdown.remainingPiecesForInventory} pz`, 158, y);
    doc.text(`€${breakdown.rowTotalCost.toFixed(2)}`, 178, y);

    y += 7.5;
  }

  // Sintesi Fasi Operative Dinamiche
  y += 6;
  const dynamicPhases =
    Array.isArray(workshop.phases) && workshop.phases.length > 0
      ? workshop.phases.map((p) => ({
          label: `${p.numberLabel} — ${p.title.toUpperCase()} (${p.durationLabel || 'Fase Operativa'})`,
          content: p.description,
        }))
      : [
          { label: '01 — SETUP & ALLESTIMENTO', content: workshop.phase1Setup },
          { label: '02 — ESECUZIONE TECNICA', content: workshop.phase2Execution },
          { label: '03 — CHIUSURA & APERITIVO', content: workshop.phase3Closing },
        ];

  for (const phase of dynamicPhases) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(74, 107, 83);
    doc.text(phase.label, 14, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(26, 43, 76);
    const wrapped = doc.splitTextToSize(phase.content || '—', 180);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 4.5 + 5;
  }

  const safeSlug = workshop.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  doc.save(`packing-list-${safeSlug || 'fatti-a-mano'}.pdf`);
}

/**
 * Esporta l'elemento SVG del Canvas come file vettoriale .svg nativo o .png ad alta risoluzione.
 */
export function exportSvgCanvas(
  svgElement: SVGSVGElement | null,
  filenameBase: string,
  format: 'svg' | 'png',
  width: number,
  height: number
): void {
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const svgString = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  if (format === 'svg') {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // Esportazione PNG ad alta risoluzione tramite HTML5 Canvas offscreen
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${filenameBase}-${width}x${height}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
