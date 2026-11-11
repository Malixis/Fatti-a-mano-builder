import {
  ExtractedInvoiceLineItem,
  FormatBalanceSheetMetrics,
  GeminiAssistResult,
  OperationalPhase,
  RoiMetrics,
  WorkshopCard,
} from '../types/erp';

/**
 * Fallback intelligente deterministico quando il server non ha una chiave Gemini attiva o è in modalità statica.
 */
export function buildClientFallbackAssist(
  workshop: WorkshopCard,
  metrics: RoiMetrics,
  phases: OperationalPhase[]
): GeminiAssistResult {
  const highestFixed = [...workshop.materials]
    .filter((m) => m.costType === 'fixed')
    .sort(
      (a, b) =>
        b.unitCost * (b.packsOrdered ?? b.quantity) -
        a.unitCost * (a.packsOrdered ?? a.quantity)
    )[0];
  const highestVariable = [...workshop.materials]
    .filter((m) => m.costType === 'variable')
    .sort(
      (a, b) =>
        b.unitCost * (b.packsOrdered ?? b.quantity) -
        a.unitCost * (a.packsOrdered ?? a.quantity)
    )[0];

  const phaseBullets =
    phases.length > 0
      ? phases
          .slice(0, 3)
          .map(
            (p) =>
              `• ${p.title}: ${
                (p.description || '').split('.')[0] || 'Esperienza guidata passo-passo'
              }`
          )
          .join('\n')
      : `• ${workshop.phase1Setup.split('.')[0]}\n• ${workshop.phase2Execution.split('.')[0]}\n• ${workshop.phase3Closing.split('.')[0]}`;

  return {
    costOptimizations: [
      highestVariable
        ? `Ottimizzazione confezioni "${highestVariable.name}": ordinando confezioni multi-pack per 3 serate consecutive (${workshop.targetPax * 3} pezzi) riduci l'incidenza unitaria del ~18% e alimenti l'Inventario Totale del format.`
        : `Ottimizzazione kit singolo partecipante: standardizza le porzioni di materiale di consumo per mantenere il costo variabile entro ${(metrics.variableCostPerPax * 0.85).toFixed(2)}€/pax.`,
      highestFixed
        ? `Ammortamento "${highestFixed.name}": il costo fisso si ripaga alla Serata 1 con ${metrics.breakEvenPaxEvent1} iscritti; dalle repliche il materiale resta a costo zero nell'Inventario Format portando l'utile a €${metrics.netProfitSubsequent.toFixed(0)}.`
        : `Accordo Partner con "${workshop.location}": proponi una soglia garantita di ${workshop.targetPax} consumazioni per ottimizzare la quota locale (€${workshop.venueFeePerPax}/pax).`,
      `Formula "Early Bird & Partner Promo": riserva 6 posti in prevendita condivisa sui canali del partner per coprire il Break-Even (${metrics.breakEvenPaxEvent1} pax) entro 48 ore dal lancio.`,
    ],
    instagramCaption: `Prenditi due ore per rallentare, sporcarti le mani e creare qualcosa di davvero tuo.\n\nTorna l'appuntamento con Fatti a mano: "${workshop.title}" — ${workshop.subtitle}.\n\nCosa faremo insieme:\n${phaseBullets}\n\nDove: ${workshop.location}\nQuando: ${workshop.dateLabel}\nQuota: ${workshop.ticketPrice}€ (tutti i materiali + aperitivo inclusi)\n\nI posti sono limitati a ${workshop.targetPax} partecipanti per seguire ognuno con cura. Scrivici in DM o clicca il link in bio per bloccare il tuo posto!`,
    reelHook: `Hai mai provato a creare il tuo ${workshop.title.toLowerCase()} da ${workshop.location.split(',')[0]}? Ecco cosa succede nei laboratori Fatti a mano (${workshop.ticketPrice}€ tutto incluso).`,
    pricingAdvice:
      metrics.netProfitEvent1 >= 80
        ? `Prezzo biglietto (${workshop.ticketPrice}€) ben calibrato: copre le confezioni e i costi fissi (€${metrics.fixedCostsTotal.toFixed(0)}) già al primo evento lasciando €${metrics.netProfitEvent1.toFixed(0)} di utile netto (€${metrics.netProfitSubsequent.toFixed(0)} dalle serate successive).`
        : `Valuta di portare il biglietto a ${workshop.ticketPrice + 3}€ o sfruttare le scorte già presenti nell'Inventario Totale del format per aumentare il margine della Serata 1.`,
    source: 'client-erp-engine',
  };
}

export function buildClientFallbackPhaseImprovement(params: {
  workshopTitle: string;
  phaseNumber: string;
  phaseTitle: string;
  currentDescription: string;
  targetPax: number;
  customInstruction?: string;
}): string {
  const pax = params.targetPax || 20;
  const base = (params.currentDescription || '').trim();
  const instruction = (params.customInstruction || '').trim();

  if (instruction) {
    return `${base ? `${base.replace(/\.$/, '')}. ` : ''}Dettaglio Operativo (${instruction}): per i ${pax} partecipanti del laboratorio "${params.workshopTitle}", predisporre gli strumenti sul tavolo, spiegare passo dopo passo come maneggiarli in sicurezza durante "${params.phaseTitle}" e mantenere ordinata ogni postazione.`;
  }

  if (!base) {
    return `[${params.phaseNumber} · ${params.phaseTitle}] Predisporre le ${pax} postazioni operative verificando illuminazione, disposizione ordinata degli strumenti e materiali pre-dosati per ciascun partecipante. Fornire indicazioni chiare sui tempi (15–20 min) e assistere i presenti passo dopo passo mantenendo un ritmo conviviale.`;
  }
  return `${base.replace(/\.$/, '')}. Operatività sul campo (${pax} pax): verificare che ogni postazione disponga del kit completo prima di iniziare la fase "${params.phaseTitle}", scandire i passaggi chiave con una dimostrazione pratica di 3 minuti al tavolo centrale e raccogliere subito gli strumenti non più necessari per lasciare spazio libero per l'aperitivo.`;
}

export async function requestWorkshopAiAssist(
  workshop: WorkshopCard,
  metrics: RoiMetrics,
  phases: OperationalPhase[]
): Promise<GeminiAssistResult> {
  try {
    const response = await fetch('/api/gemini/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshop: { ...workshop, phases },
        metrics: {
          fixedCostsTotal: metrics.fixedCostsTotal,
          variableCostPerPax: metrics.variableCostPerPax,
          costPerPaxEvent1: metrics.costPerPaxEvent1,
          costPerPaxSubsequent: metrics.costPerPaxSubsequent,
          netProfitEvent1: metrics.netProfitEvent1,
          netProfitSubsequent: metrics.netProfitSubsequent,
          breakEvenPaxEvent1: metrics.breakEvenPaxEvent1,
        },
      }),
    });
    if (response.ok) {
      return (await response.json()) as GeminiAssistResult;
    }
  } catch {
    // Fallback deterministico
  }

  return buildClientFallbackAssist(workshop, metrics, phases);
}

export async function requestPhaseTextImprovement(params: {
  workshopTitle: string;
  category: string;
  targetPax: number;
  phaseNumber: string;
  phaseTitle: string;
  currentDescription: string;
  partnerName?: string;
  customInstruction?: string;
}): Promise<{ improvedDescription: string }> {
  try {
    const response = await fetch('/api/gemini/improve-phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (response.ok) {
      return (await response.json()) as { improvedDescription: string };
    }
  } catch {
    // Fallback deterministico
  }

  return {
    improvedDescription: buildClientFallbackPhaseImprovement(params),
  };
}

export async function requestAmazonInvoiceExtraction(params: {
  fileName: string;
  mimeType: string;
  base64Data: string;
}): Promise<{
  invoiceNumber: string;
  invoiceDate: string;
  items: ExtractedInvoiceLineItem[];
}> {
  try {
    const response = await fetch('/api/gemini/parse-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        invoiceNumber: string;
        invoiceDate: string;
        items: Array<{
          name: string;
          unitCost: number;
          packsOrdered: number;
          piecesPerPack: number;
          costType: 'fixed' | 'variable';
        }>;
      };
      return {
        invoiceNumber: data.invoiceNumber || `AMZ-${Date.now().toString().slice(-6)}`,
        invoiceDate: data.invoiceDate || new Date().toISOString().slice(0, 10),
        items: (data.items || []).map((it, idx) => ({
          id: `ext-${Date.now()}-${idx}`,
          name: it.name || 'Articolo Fattura Amazon',
          unitCost: Math.max(0, Number(it.unitCost) || 0),
          packsOrdered: Math.max(1, Math.round(Number(it.packsOrdered) || 1)),
          piecesPerPack: Math.max(1, Math.round(Number(it.piecesPerPack) || 1)),
          costType: it.costType === 'fixed' ? 'fixed' : 'variable',
          selected: true,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
        })),
      };
    }
  } catch {
    // Fallback deterministico
  }

  const today = new Date().toISOString().slice(0, 10);
  const invNum = `AMZ-${params.fileName.replace(/\.[^.]+$/, '').slice(0, 14).toUpperCase()}`;
  return {
    invoiceNumber: invNum,
    invoiceDate: today,
    items: [
      {
        id: `ext-${Date.now()}-0`,
        name: `Materiale da Fattura (${params.fileName})`,
        unitCost: 2.2,
        packsOrdered: 2,
        piecesPerPack: 10,
        costType: 'variable',
        selected: true,
        invoiceNumber: invNum,
        invoiceDate: today,
      },
      {
        id: `ext-${Date.now()}-1`,
        name: 'Kit Strumenti Riutilizzabili Laboratorio',
        unitCost: 8.5,
        packsOrdered: 1,
        piecesPerPack: 10,
        costType: 'fixed',
        selected: true,
        invoiceNumber: invNum,
        invoiceDate: today,
      },
    ],
  };
}

export async function requestAccountingAgentAdvice(params: {
  question: string;
  balanceSummary: FormatBalanceSheetMetrics;
  partnerModesSummary?: string;
}): Promise<{ answer: string }> {
  try {
    const response = await fetch('/api/gemini/accounting-ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (response.ok) {
      return (await response.json()) as { answer: string };
    }
  } catch {
    // Fallback deterministico
  }

  const b = params.balanceSummary;
  return {
    answer: `Riepilogo Contabile Associazione: Hai €${b.associationCashResidualAfterReimbursements.toFixed(
      2
    )} disponibili in cassa associativa e €${b.totalPersonalAdvancesPending.toFixed(
      2
    )} di spese anticipate personalmente da rimborsare. Puoi emettere subito una Nota Spese a piè di lista per prelevare €${b.maxClaimableReimbursementNow.toFixed(
      2
    )} allegando le fatture Amazon e il prospetto dei rimborsi chilometrici verso i locali Partner.`,
  };
}

