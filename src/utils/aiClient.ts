import { GoogleGenAI, Type } from '@google/genai';
import { GeminiAssistResult, OperationalPhase, RoiMetrics, WorkshopCard } from '../types/erp';

/**
 * Fallback intelligente deterministico lato client quando l'app è pubblicata su hosting statico
 * (es. GitHub Pages) senza backend Express attivo o senza chiave Gemini.
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
}): string {
  const pax = params.targetPax || 20;
  const base = (params.currentDescription || '').trim();
  if (!base) {
    return `[${params.phaseNumber} · ${params.phaseTitle}] Predisporre le ${pax} postazioni operative verificando illuminazione, disposizione ordinata degli strumenti e materiali pre-dosati per ciascun partecipante. Fornire indicazioni chiare sui tempi (15–20 min) e assistere i presenti passo dopo passo mantenendo un ritmo conviviale.`;
  }
  return `${base.replace(/\.$/, '')}. Operatività sul campo (${pax} pax): verificare che ogni postazione disponga del kit completo prima di iniziare la fase "${params.phaseTitle}", scandire i passaggi chiave con una dimostrazione pratica di 3 minuti al tavolo centrale e raccogliere subito gli strumenti non più necessari per lasciare spazio libero per l'aperitivo.`;
}

/**
 * Richiede l'analisi strategica Costi & Copy Instagram:
 * 1) Prova prima l'endpoint server `/api/gemini/assist`
 * 2) Su GitHub Pages (statico), usa `VITE_GEMINI_API_KEY` se configurata nei GitHub Secrets oppure il motore ERP locale.
 */
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
    // Su GitHub Pages / hosting statico, passa al fallback client
  }

  const clientApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (clientApiKey && clientApiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: clientApiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analizza il laboratorio "${workshop.title}" (${workshop.ticketPrice}€, ${workshop.targetPax} pax presso ${workshop.location}) e restituisci JSON con costOptimizations, instagramCaption, reelHook e pricingAdvice.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              costOptimizations: { type: Type.ARRAY, items: { type: Type.STRING } },
              instagramCaption: { type: Type.STRING },
              reelHook: { type: Type.STRING },
              pricingAdvice: { type: Type.STRING },
            },
            required: ['costOptimizations', 'instagramCaption', 'reelHook', 'pricingAdvice'],
          },
        },
      });
      const parsed = JSON.parse((res.text ?? '{}').trim()) as GeminiAssistResult;
      if (parsed.instagramCaption) return parsed;
    } catch {
      // Fallback deterministico
    }
  }

  return buildClientFallbackAssist(workshop, metrics, phases);
}

/**
 * Migliora il testo di una singola fase operativa:
 * 1) Prova prima `/api/gemini/improve-phase`
 * 2) Su GitHub Pages (statico), usa `VITE_GEMINI_API_KEY` oppure il motore ERP locale.
 */
export async function requestPhaseTextImprovement(params: {
  workshopTitle: string;
  category: string;
  targetPax: number;
  phaseNumber: string;
  phaseTitle: string;
  currentDescription: string;
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
    // Su GitHub Pages / hosting statico, passa al fallback client
  }

  const clientApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (clientApiKey && clientApiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: clientApiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Riscrivi e arricchisci in 3-4 frasi operative in italiano la fase "${params.phaseNumber} - ${params.phaseTitle}" per il laboratorio "${params.workshopTitle}" (${params.targetPax} pax). Bozza: "${params.currentDescription}"`,
      });
      if (res.text?.trim()) {
        return { improvedDescription: res.text.trim() };
      }
    } catch {
      // Fallback deterministico
    }
  }

  return {
    improvedDescription: buildClientFallbackPhaseImprovement(params),
  };
}
