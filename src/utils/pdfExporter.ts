import { jsPDF } from 'jspdf';
import {
  ExpenseVoucher,
  FormatBalanceSheetMetrics,
  PartnerProfile,
  RoiMetrics,
  WorkshopCard,
} from '../types/erp';
import { computeMaterialRowBreakdown } from './roiCalculator';

/**
 * Genera il testo formattato per WhatsApp / Email della Scheda Riassuntiva per il Partner,
 * includendo nome laboratorio, prezzo pubblico, ripartizione economica secondo gli accordi commerciali,
 * strumenti utilizzati e protocollo operativo — SENZA alcun margine di guadagno o costo interno dei materiali.
 */
export function buildPartnerSummaryText(
  workshop: WorkshopCard,
  partner?: PartnerProfile
): string {
  const pax = Math.max(1, Number(workshop.targetPax) || 20);
  const ticket = Math.max(0, Number(workshop.ticketPrice) || 0);
  const venueFee = Math.max(0, Number(workshop.venueFeePerPax) || 0);
  const grossTotal = ticket * pax;
  const partnerTotalShare = venueFee * pax;
  const formatShare = Math.max(0, grossTotal - partnerTotalShare);
  const formatFeePerPax = Math.max(0, ticket - venueFee);

  const dealType = partner?.commercialDealType || 'Quota F&B Fissa a Partecipante';
  const dealNotes =
    partner?.commercialDealNotes ||
    `Quota locale concordata di €${venueFee.toFixed(2)} a partecipante.`;

  const toolsAndMaterialsList =
    workshop.materials.length > 0
      ? workshop.materials
          .map(
            (m) =>
              `• ${m.name} (${
                m.costType === 'fixed'
                  ? 'Attrezzatura portata e ritirata da Fatti a mano'
                  : 'Kit creativo individuale per ogni partecipante'
              })`
          )
          .join('\n')
      : '• Kit creativo completo individuale e protezioni per i tavoli forniti da Fatti a mano.';

  const phases =
    Array.isArray(workshop.phases) && workshop.phases.length > 0
      ? workshop.phases
      : [
          {
            id: 'p1',
            numberLabel: '01',
            title: 'Allestimento & Preparazione Tavoli',
            durationLabel: 'Pre-evento (-30 min)',
            description: workshop.phase1Setup,
          },
          {
            id: 'p2',
            numberLabel: '02',
            title: 'Svolgimento Laboratorio & Uso Strumenti',
            durationLabel: 'Cuore del Lab (75 min)',
            description: workshop.phase2Execution,
          },
          {
            id: 'p3',
            numberLabel: '03',
            title: 'Riordino Postazioni & Momento Conviviale',
            durationLabel: 'Chiusura (30 min)',
            description: workshop.phase3Closing,
          },
        ];

  const phasesText = phases
    .map(
      (p) =>
        `[${p.numberLabel} · ${p.title}${p.durationLabel ? ` — ${p.durationLabel}` : ''}]\n${
          p.description || 'Attività guidata dallo staff Fatti a mano.'
        }`
    )
    .join('\n\n');

  return `SCHEDA RIASSUNTIVA PARTNER · FATTI A MANO
==================================================
Laboratorio: ${workshop.title}
Sottotitolo: ${workshop.subtitle}
Partner Ospitante: ${partner?.name || workshop.location}
Indirizzo: ${partner?.address || workshop.location}
Data e Orario: ${workshop.dateLabel} (Durata: ${workshop.eventDurationMinutes || 120} min)
Capienza Target: ${pax} partecipanti

1. RIEPILOGO ECONOMICO & RIPARTIZIONE PARTNER
--------------------------------------------------
• Tipologia Accordo: ${dealType}
• Dettagli Accordo: ${dealNotes}
• Quota di partecipazione pubblica: €${ticket.toFixed(2)} / partecipante
• Quota spettante a ${partner?.name || 'Partner Locale'}: €${venueFee.toFixed(2)} / pax (Totale su ${pax} pax: €${partnerTotalShare.toFixed(2)})
• Quota attività laboratorio (Fatti a mano): €${formatFeePerPax.toFixed(2)} / pax (Totale su ${pax} pax: €${formatShare.toFixed(2)})
• Incasso Lordo Complessivo stimato (${pax} pax): €${grossTotal.toFixed(2)}

2. DOTAZIONE STRUMENTI & CURA DEGLI SPAZI
--------------------------------------------------
Tutti gli strumenti, i materiali didattici e le protezioni per i tavoli sono forniti e gestiti interamente dal team Fatti a mano:
${toolsAndMaterialsList}

3. PROTOCOLLO OPERATIVO & MODALITÀ DI UTILIZZO STRUMENTI
--------------------------------------------------
${phasesText}

4. INFORMAZIONI UTILI PER LO STAFF DEL LOCALE
--------------------------------------------------
• Arrivo team Fatti a mano: 30 minuti prima dell'inizio per proteggere i tavoli con tovagliette Kraft e predisporre i kit.
• Esigenze tecniche: tavoli stabili con sedute per ${pax} persone e buona illuminazione sul piano di lavoro.
• Servizio Food & Beverage: consigliato durante l'accoglienza iniziale o nella fase conclusiva, lasciando libero il centro tavola durante la creazione manuale.
• Ripristino sala: al termine dell'evento lo staff Fatti a mano ritira tutti gli strumenti lasciando i tavoli perfettamente puliti.`;
}

/**
 * Esporta il PDF impaginato della Scheda Riassuntiva per il Partner
 * (senza alcun costo d'acquisto materiali, né break-even o margini interni del format).
 */
export function exportPartnerSummaryPdf(
  workshop: WorkshopCard,
  partner?: PartnerProfile
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pax = Math.max(1, Number(workshop.targetPax) || 20);
  const ticket = Math.max(0, Number(workshop.ticketPrice) || 0);
  const venueFee = Math.max(0, Number(workshop.venueFeePerPax) || 0);
  const grossTotal = ticket * pax;
  const partnerTotalShare = venueFee * pax;
  const formatShare = Math.max(0, grossTotal - partnerTotalShare);
  const formatFeePerPax = Math.max(0, ticket - venueFee);
  const partnerName = partner?.name || workshop.location.split(',')[0] || 'Locale Partner';

  // Sfondo intestazione Kraft
  doc.setFillColor(234, 221, 205); // #EADDCD
  doc.rect(0, 0, 210, 50, 'F');

  doc.setTextColor(26, 43, 76); // #1A2B4C
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FATTI A MANO  ×  SCHEDA RIASSUNTIVA PARTNER & PROTOCOLLO OPERATIVO', 14, 13);

  doc.setFontSize(17);
  doc.text(workshop.title, 14, 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(74, 107, 83); // #4A6B53
  doc.text(
    `${workshop.dateLabel}  |  Location: ${workshop.location}  |  Capienza prevista: ${pax} Partecipanti`,
    14,
    31
  );

  doc.setTextColor(26, 43, 76);
  doc.setFontSize(9);
  doc.text(
    `Partner: ${partnerName}  ·  Accordo: ${partner?.commercialDealType || 'Quota F&B a Partecipante'}`,
    14,
    39
  );
  if (partner?.commercialDealNotes) {
    doc.setFontSize(8.2);
    doc.text(`Condizioni concordate: ${partner.commercialDealNotes.slice(0, 95)}`, 14, 45);
  }

  // Sezione 1: Ripartizione Economica secondo gli Accordi Commerciali
  let y = 59;
  doc.setDrawColor(184, 91, 67);
  doc.setLineWidth(0.4);
  doc.rect(14, y - 6, 182, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(184, 91, 67);
  doc.text('1. CONDIZIONI ECONOMICHE & RIPARTIZIONE INCASSO CON IL PARTNER', 18, y);

  doc.setTextColor(26, 43, 76);
  doc.setFontSize(9);
  doc.text(
    `Prezzo Pubblico Biglietto: €${ticket.toFixed(2)} / pax   |   Incasso Totale (${pax} pax): €${grossTotal.toFixed(2)}`,
    18,
    y + 7
  );
  doc.text(
    `Quota Spettante a ${partnerName}: €${venueFee.toFixed(2)} / pax  (Totale Partner su ${pax} pax: €${partnerTotalShare.toFixed(2)})`,
    18,
    y + 13
  );
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Quota Laboratorio Fatti a mano: €${formatFeePerPax.toFixed(2)} / pax  (Totale Format su ${pax} pax: €${formatShare.toFixed(2)})`,
    18,
    y + 18.5
  );

  // Sezione 2: Strumenti e Dotazione Tecnica (senza costi interni)
  y += 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(74, 107, 83);
  doc.text('2. STRUMENTI, MATERIALI & ALLESTIMENTO A CURA DI FATTI A MANO', 14, y);

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(26, 43, 76);
  doc.text(
    'Tutti i materiali didattici, gli utensili e le coperture protettive dei tavoli sono portati e gestiti dal team Fatti a mano:',
    14,
    y
  );
  y += 6;

  for (const item of workshop.materials) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    const roleLabel =
      item.costType === 'fixed'
        ? 'Strumento / Attrezzatura in dotazione (ritirato a fine serata)'
        : 'Materiale didattico individuale per ciascun partecipante';
    doc.setFont('helvetica', 'bold');
    doc.text(`• ${item.name.slice(0, 55)}`, 16, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 107, 83);
    doc.text(`— ${roleLabel}`, 108, y);
    doc.setTextColor(26, 43, 76);
    y += 6;
  }

  // Sezione 3: Protocollo Operativo e Utilizzo Strumenti
  y += 4;
  if (y > 245) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(184, 91, 67);
  doc.text('3. PROTOCOLLO OPERATIVO DELLA SERATA & MODALITÀ D\'USO', 14, y);
  y += 6.5;

  const dynamicPhases =
    Array.isArray(workshop.phases) && workshop.phases.length > 0
      ? workshop.phases.map((p) => ({
          label: `FASE ${p.numberLabel} — ${p.title.toUpperCase()} (${p.durationLabel || 'Operativa'})`,
          content: p.description,
        }))
      : [
          { label: 'FASE 01 — ALLESTIMENTO & PROTEZIONE TAVOLI', content: workshop.phase1Setup },
          { label: 'FASE 02 — GUIDA TECNICA & USO STRUMENTI', content: workshop.phase2Execution },
          { label: 'FASE 03 — RIORDino & MOMENTO CONVIVIALE', content: workshop.phase3Closing },
        ];

  for (const phase of dynamicPhases) {
    if (y > 252) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(74, 107, 83);
    doc.text(phase.label, 14, y);
    y += 4.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(26, 43, 76);
    const wrapped = doc.splitTextToSize(phase.content || '—', 180);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 4.3 + 4.5;
  }

  // Sezione 4: Informazioni Logistiche per il Locale Ospitante
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  y += 2;
  doc.setDrawColor(26, 43, 76);
  doc.setLineWidth(0.3);
  doc.rect(14, y, 182, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(26, 43, 76);
  doc.text('4. NOTE LOGISTICHE & COORDINAMENTO CON LO STAFF DEL LOCALE', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.text(
    `• Allestimento: arrivo del team Fatti a mano 30 minuti prima dell'orario di inizio per stendere le protezioni Kraft sui tavoli.`,
    18,
    y + 12
  );
  doc.text(
    `• Somministrazione F&B: ideale in apertura (accoglienza) o negli ultimi 30 minuti per agevolare la manualità dei partecipanti.`,
    18,
    y + 17.5
  );
  doc.text(
    `• Pulizia e disallestimento: al termine del laboratorio lo staff Fatti a mano riconsegna i tavoli puliti e liberi da attrezzature.`,
    18,
    y + 23
  );

  const safeSlug = workshop.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  doc.save(`scheda-partner-${safeSlug || 'fatti-a-mano'}.pdf`);
}

/**
 * Genera ed esporta il PDF della Nota Spese Associativa (Rimborso a piè di lista + Rimborso Chilometrico)
 * per giustificare il prelievo esente IRPEF dalla cassa dell'Associazione.
 */
export function exportAssociationExpenseNotePdf(
  vouchers: ExpenseVoucher[],
  balance: FormatBalanceSheetMetrics,
  claimantName = 'Responsabile Format / Socio Operativo'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const today = new Date().toLocaleDateString('it-IT');

  doc.setFillColor(234, 221, 205);
  doc.rect(0, 0, 210, 44, 'F');

  doc.setTextColor(26, 43, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('ASSOCIAZIONE CULTURALE · FORMAT "FATTI A MANO"', 14, 13);

  doc.setFontSize(16);
  doc.text('NOTA DI RIMBORSO SPESE DOCUMENTATE (A PIÈ DI LISTA)', 14, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(74, 107, 83);
  doc.text(
    `Data emissione: ${today}   |   Richiedente: ${claimantName}   |   Esente IRPEF (Spese documentate / Trasferte)`,
    14,
    31
  );

  let y = 52;
  doc.setDrawColor(184, 91, 67);
  doc.setLineWidth(0.4);
  doc.rect(14, y - 5, 182, 20);

  doc.setTextColor(26, 43, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.text(
    `Spese Anticipate da Rimborsare: €${balance.totalPersonalAdvancesPending.toFixed(2)}   |   Già Rimborsate: €${balance.totalPersonalAdvancesReimbursed.toFixed(2)}`,
    18,
    y + 1
  );
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Cassa Associazione Disponibile: €${balance.associationCashResidualAfterReimbursements.toFixed(2)}   |   Importo Liquidabile Ora: €${balance.maxClaimableReimbursementNow.toFixed(2)}`,
    18,
    y + 8
  );

  y += 23;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(184, 91, 67);
  doc.text('ELENCO GIUSTIFICATIVI ALLEGATI (FATTURE AMAZON, SCONTRINI E TRASFERTE)', 14, y);

  y += 6.5;
  doc.setFontSize(8.2);
  doc.setTextColor(26, 43, 76);
  doc.text('DATA', 14, y);
  doc.text('RIF. DOC', 36, y);
  doc.text('DESCRIZIONE SPESA / TRASFERTA', 66, y);
  doc.text('STATO', 148, y);
  doc.text('IMPORTO', 176, y);
  doc.line(14, y + 2, 196, y + 2);
  y += 7;

  const personalVouchers = vouchers.filter((v) => v.paidBy === 'personal-advance');
  doc.setFont('helvetica', 'normal');
  for (const v of personalVouchers) {
    if (y > 255) {
      doc.addPage();
      y = 20;
    }
    doc.text(v.voucherDate, 14, y);
    doc.text((v.invoiceNumber || 'Ricevuta').slice(0, 14), 36, y);
    doc.text(v.description.slice(0, 44), 66, y);
    doc.text(v.reimbursementStatus === 'reimbursed' ? 'Rimborsato' : 'Da rimborsare', 148, y);
    doc.text(`€${v.amount.toFixed(2)}`, 176, y);
    y += 6.5;
  }

  y += 12;
  if (y > 250) {
    doc.addPage();
    y = 25;
  }
  doc.setFontSize(8.8);
  doc.text(
    'Si attesta che tutte le spese sopra elencate sono state sostenute esclusivamente per lo svolgimento delle attività',
    14,
    y
  );
  doc.text(
    'istituzionali e didattiche dei laboratori "Fatti a mano" e sono corredate dai relativi giustificativi fiscali originali.',
    14,
    y + 5
  );

  doc.text('Firma del Richiedente: ___________________________', 14, y + 20);
  doc.text('Visto del Tesoriere / Presidente: ___________________________', 112, y + 20);

  doc.save(`nota-rimborso-spese-associazione-${new Date().toISOString().slice(0, 10)}.pdf`);
}

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
  clone.querySelectorAll('[data-ui-overlay="true"]').forEach((node) => node.remove());
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

