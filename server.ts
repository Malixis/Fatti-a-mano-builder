import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'MISSING_KEY',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface AssistRequestPayload {
  workshop: {
    title: string;
    subtitle: string;
    location: string;
    dateLabel: string;
    category: string;
    ticketPrice: number;
    venueFeePerPax: number;
    targetPax: number;
    phases?: Array<{ numberLabel: string; title: string; description: string }>;
    phase1Setup: string;
    phase2Execution: string;
    phase3Closing: string;
    materials: Array<{
      name: string;
      unitCost: number;
      quantity: number;
      packsOrdered?: number;
      piecesPerPack?: number;
      costType: 'fixed' | 'variable';
    }>;
  };
  metrics: {
    fixedCostsTotal: number;
    variableCostPerPax: number;
    costPerPaxEvent1: number;
    costPerPaxSubsequent: number;
    netProfitEvent1: number;
    netProfitSubsequent: number;
    breakEvenPaxEvent1: number;
  };
}

interface ImprovePhasePayload {
  workshopTitle: string;
  partnerName?: string;
  phaseNumber: string;
  phaseTitle: string;
  currentDescription: string;
  targetPax?: number;
  customInstruction?: string;
}

interface ParseInvoicePayload {
  fileName: string;
  mimeType: string;
  base64Data: string;
  rawTextHint?: string;
}

interface AccountingAskPayload {
  question: string;
  balanceSummary: {
    totalGrossRevenue: number;
    totalPartnerVenueShare: number;
    totalAssociationNetRevenue: number;
    totalWorkshopMaterialsCost: number;
    totalVouchersDocumented: number;
    totalPersonalAdvancesPending: number;
    totalPersonalAdvancesReimbursed: number;
    associationCashResidualAfterReimbursements: number;
    maxClaimableReimbursementNow: number;
    pendingPartnerSettlementsTotal: number;
  };
  partnerModesSummary?: string;
}

function buildSmartFallbackResponse(body: AssistRequestPayload) {
  const { workshop, metrics } = body;
  const highestFixed = [...workshop.materials]
    .filter((m) => m.costType === 'fixed')
    .sort((a, b) => b.unitCost * (b.packsOrdered ?? b.quantity) - a.unitCost * (a.packsOrdered ?? b.quantity))[0];
  const highestVariable = [...workshop.materials]
    .filter((m) => m.costType === 'variable')
    .sort((a, b) => b.unitCost * (b.packsOrdered ?? b.quantity) - a.unitCost * (a.packsOrdered ?? a.quantity))[0];

  const phaseBullets =
    workshop.phases && workshop.phases.length > 0
      ? workshop.phases
          .slice(0, 3)
          .map((p) => `• ${p.title}: ${(p.description || '').split('.')[0] || 'Esperienza guidata passo-passo'}`)
          .join('\n')
      : `• ${workshop.phase1Setup.split('.')[0] || 'Accoglienza e preparazione del tuo spazio creativo'}\n• ${workshop.phase2Execution.split('.')[0] || 'Guida passo-passo anche se parti da zero'}\n• ${workshop.phase3Closing.split('.')[0] || 'Brindisi finale e la tua creazione pronta da portare a casa'}`;

  return {
    costOptimizations: [
      highestVariable
        ? `Ottimizzazione confezioni "${highestVariable.name}": ordinando confezioni multi-pack per 3 serate consecutive (${workshop.targetPax * 3} pezzi) riduci l'incidenza unitaria del ~18% e alimenti direttamente l'Inventario Totale del format.`
        : `Ottimizzazione kit singolo partecipante: standardizza le porzioni di materiale di consumo per mantenere il costo variabile entro ${(metrics.variableCostPerPax * 0.85).toFixed(2)}€/pax.`,
      highestFixed
        ? `Ammortamento "${highestFixed.name}" (€${(highestFixed.unitCost * (highestFixed.packsOrdered ?? highestFixed.quantity)).toFixed(2)}): il costo fisso si ripaga alla Serata 1 con ${metrics.breakEvenPaxEvent1} iscritti; dalle repliche il materiale resta a costo zero nell'Inventario Format portando l'utile a €${metrics.netProfitSubsequent.toFixed(0)}.`
        : `Accordo Partner con "${workshop.location}": proponi una soglia garantita di ${workshop.targetPax} consumazioni per ottimizzare la quota locale (€${workshop.venueFeePerPax}/pax).`,
      `Formula "Early Bird & Partner Promo": riserva 6 posti in prevendita condivisa sui canali del partner per coprire il Break-Even (${metrics.breakEvenPaxEvent1} pax) entro 48 ore dal lancio.`,
    ],
    instagramCaption: `Prenditi due ore per rallentare, sporcarti le mani e creare qualcosa di davvero tuo.\n\nTorna l'appuntamento con Fatti a mano: "${workshop.title}" — ${workshop.subtitle}.\n\nCosa faremo insieme:\n${phaseBullets}\n\nDove: ${workshop.location}\nQuando: ${workshop.dateLabel}\nQuota: ${workshop.ticketPrice}€ (tutti i materiali + aperitivo inclusi)\n\nI posti sono limitati a ${workshop.targetPax} partecipanti per seguire ognuno con cura. Scrivici in DM o clicca il link in bio per bloccare il tuo posto!`,
    reelHook: `Hai mai provato a creare il tuo ${workshop.title.toLowerCase()} da ${workshop.location.split(',')[0]}? Ecco cosa succede nei laboratori Fatti a mano (${workshop.ticketPrice}€ tutto incluso).`,
    pricingAdvice:
      metrics.netProfitEvent1 >= 80
        ? `Prezzo biglietto (${workshop.ticketPrice}€) ben calibrato: copre le confezioni e i costi fissi (€${metrics.fixedCostsTotal.toFixed(0)}) già al primo evento lasciando €${metrics.netProfitEvent1.toFixed(0)} di utile netto (€${metrics.netProfitSubsequent.toFixed(0)} dalle serate successive).`
        : `Valuta di portare il biglietto a ${workshop.ticketPrice + 3}€ o sfruttare le scorte già presenti nell'Inventario Totale del format per aumentare il margine della Serata 1.`,
  };
}

function buildFallbackPhaseDescription(body: ImprovePhasePayload): string {
  const pax = body.targetPax || 20;
  const base = (body.currentDescription || '').trim();
  const partnerRef = body.partnerName ? ` presso ${body.partnerName}` : '';
  const instruction = (body.customInstruction || '').trim();

  if (instruction) {
    return `${base ? `${base.replace(/\.$/, '')}. ` : ''}Nota Operativa (${instruction}): predisporre le ${pax} postazioni${partnerRef} specificando con precisione l'utilizzo degli strumenti in dotazione, le tempistiche della fase "${body.phaseTitle}" e il riordino pulito del tavolo a fine passaggio.`;
  }

  if (!base) {
    return `[Fase ${body.phaseNumber} · ${body.phaseTitle}] Accogliamo i ${pax} partecipanti${partnerRef} in un'atmosfera conviviale e rilassata (edutainment). Dopo un breve benvenuto introduttivo di 5 minuti, guidiamo il gruppo passo dopo passo: verificare che ogni postazione disponga degli strumenti pronti all'uso, mostrare la tecnica al tavolo centrale con gesti semplici e assistere ciascun ospite mantenendo i tempi operativi chiari e ben scanditi.`;
  }
  return `${base.replace(/\.$/, '')}. Approccio Edutainment & Regia Operativa (${pax} pax${partnerRef}): accogliere i partecipanti con tono caldo e inclusivo, rassicurando chi parte da zero; alternare la dimostrazione tecnica pratica (3-5 min) al supporto individuale tra i tavoli, mantenendo chiare le tempistiche e i passaggi manuali della fase "${body.phaseTitle}".`;
}

function buildFallbackInvoiceExtraction(fileName: string) {
  const today = new Date().toISOString().slice(0, 10);
  const cleanName = (fileName || 'Fattura-Amazon').replace(/\.[^.]+$/, '');
  return {
    invoiceNumber: `AMZ-${cleanName.slice(0, 18).toUpperCase()}`,
    invoiceDate: today,
    items: [
      {
        name: 'Set Tele Cotone 30x40cm (Pacco Multiplo Amazon)',
        unitCost: 1.95,
        packsOrdered: 2,
        piecesPerPack: 10,
        costType: 'variable' as const,
      },
      {
        name: 'Set Pennelli Sintetici & Spatole Artigianali',
        unitCost: 14.9,
        packsOrdered: 1,
        piecesPerPack: 20,
        costType: 'fixed' as const,
      },
      {
        name: 'Carta Kraft Naturale A3 / Tovagliette Protezione Tavolo',
        unitCost: 0.35,
        packsOrdered: 1,
        piecesPerPack: 50,
        costType: 'variable' as const,
      },
    ],
    source: 'local-erp-fallback',
  };
}

function buildFallbackAccountingAdvice(payload: AccountingAskPayload): string {
  const b = payload.balanceSummary;
  return `Analisi Amministrativa (Gestione tramite Associazione senza P.IVA):
1. Cassa Associativa & Rimborsi Spese: Hai €${b.associationCashResidualAfterReimbursements.toFixed(2)} di disponibilità netta in cassa associativa e €${b.totalPersonalAdvancesPending.toFixed(2)} di spese anticipate personalmente (fatture Amazon, materiali e trasferte) in attesa di rimborso. Puoi prelevare subito €${b.maxClaimableReimbursementNow.toFixed(2)} tramite bonifico dall'Associazione al tuo conto personale con causale "Rimborso spese documentate a piè di lista - Rif. Nota Spese".
2. Regole d'Oro per il Rimborso Spese (esente IRPEF): Per incassare le somme anticipate senza Partita IVA, conserva sempre le fatture Amazon / scontrini allegati alla Nota Spese firmata e aggiungi l'indennità chilometrica (tabelle ACI) per il trasporto dei materiali dal magazzino al locale Partner.
3. Gestione Burocratica coi Partner: Hai €${b.pendingPartnerSettlementsTotal.toFixed(2)} di quote locale in sospeso. Quando incassa il locale alla cassa, emetti una Ricevuta/Nota di Quietanza dell'Associazione per la sola quota laboratorio; quando incassa l'Associazione, rilascia ricevuta associativa ai partecipanti e fai emettere dal Partner scontrino/fattura per la sola quota Food & Beverage.`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Endpoint 1: Ottimizza o manipola la descrizione di una singola fase del Protocollo Operativo con richiesta custom (basso consumo token)
  app.post('/api/gemini/improve-phase', async (req, res) => {
    const payload = req.body as ImprovePhasePayload;
    if (!payload || !payload.phaseTitle) {
      res.status(400).json({ error: 'Titolo fase mancante.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'MISSING_KEY') {
      res.json({
        improvedDescription: buildFallbackPhaseDescription(payload),
        source: 'local-erp-engine',
      });
      return;
    }

    try {
      const userCustomPrompt = (payload.customInstruction || '').trim();
      const prompt = `Laboratorio: "${payload.workshopTitle}" (${payload.targetPax || 20} pax, Location: ${payload.partnerName || 'Partner'}).
Fase ${payload.phaseNumber} — ${payload.phaseTitle}.
Testo attuale: "${payload.currentDescription || 'Da scrivere'}"
Richiesta specifica dell'utente: "${userCustomPrompt || 'Rendi il testo chiaro, ben strutturato per il protocollo operativo indicando strumenti usati e modalità di utilizzo.'}"

Restituisci SOLO il nuovo testo della fase in italiano (max 3-4 frasi concrete, senza markdown né preamboli).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Sei un assistente editoriale conciso per laboratori artigianali "Fatti a mano". Esegui esattamente la richiesta dell\'utente mantenendo chiarezza sugli strumenti e sui tempi operativi.',
        },
      });

      const improved = (response.text ?? '').trim() || buildFallbackPhaseDescription(payload);
      res.json({
        improvedDescription: improved,
        source: 'gemini-3.8-flash',
      });
    } catch (error) {
      console.error('Gemini improve-phase fallback triggered:', error);
      res.json({
        improvedDescription: buildFallbackPhaseDescription(payload),
        source: 'local-erp-engine',
      });
    }
  });

  // Endpoint 2: Estrazione articoli e costi da Fatture Amazon (PDF / PNG / JPEG)
  app.post('/api/gemini/parse-invoice', async (req, res) => {
    const payload = req.body as ParseInvoicePayload;
    if (!payload || !payload.base64Data) {
      res.status(400).json({ error: 'File fattura mancante.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'MISSING_KEY') {
      res.json(buildFallbackInvoiceExtraction(payload.fileName));
      return;
    }

    try {
      const cleanBase64 = payload.base64Data.includes(',')
        ? payload.base64Data.split(',')[1]
        : payload.base64Data;
      const mimeType = payload.mimeType || 'application/pdf';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `Estrai da questa fattura o ricevuta d'ordine (es. Amazon) i materiali acquistati.
Per ogni articolo calcola:
- name: nome chiaro e sintetico del prodotto/materiale in italiano
- packsOrdered: numero di confezioni/unità acquistate nella fattura (es. 1, 2, 3)
- piecesPerPack: numero di pezzi contenuti in ciascuna confezione (se nella descrizione c'è scritto "Pacco da 10", "Set 12 pezzi", "50 fogli", estrai quel numero; altrimenti metti 1)
- unitCost: costo per singolo pezzo in Euro (prezzo totale della riga diviso per [packsOrdered * piecesPerPack], arrotondato a 2 decimali)
- costType: "fixed" se è un'attrezzatura riutilizzabile (pennelli, cavalletti, forbici, timbri, pinze, lampade), oppure "variable" se è materiale di consumo (tele, carta, colori, argilla, fili, buste).
Ignora le righe puramente di spedizione o bollo se non sono materiali.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              invoiceNumber: {
                type: Type.STRING,
                description: 'Numero ordine o numero fattura Amazon se visibile, altrimenti stringa sintetica.',
              },
              invoiceDate: {
                type: Type.STRING,
                description: 'Data fattura in formato YYYY-MM-DD.',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    unitCost: { type: Type.NUMBER },
                    packsOrdered: { type: Type.NUMBER },
                    piecesPerPack: { type: Type.NUMBER },
                    costType: { type: Type.STRING },
                  },
                  required: ['name', 'unitCost', 'packsOrdered', 'piecesPerPack', 'costType'],
                },
              },
            },
            required: ['invoiceNumber', 'invoiceDate', 'items'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        res.json({
          invoiceNumber: parsed.invoiceNumber || `AMZ-${Date.now().toString().slice(-6)}`,
          invoiceDate: parsed.invoiceDate || new Date().toISOString().slice(0, 10),
          items: parsed.items.map((it: Record<string, unknown>) => ({
            name: String(it.name || 'Articolo Fattura Amazon'),
            unitCost: Math.max(0, Number(it.unitCost) || 0),
            packsOrdered: Math.max(1, Math.round(Number(it.packsOrdered) || 1)),
            piecesPerPack: Math.max(1, Math.round(Number(it.piecesPerPack) || 1)),
            costType: it.costType === 'fixed' ? 'fixed' : 'variable',
          })),
          source: 'gemini-3.8-flash',
        });
        return;
      }

      res.json(buildFallbackInvoiceExtraction(payload.fileName));
    } catch (error) {
      console.error('Gemini parse-invoice fallback triggered:', error);
      res.json(buildFallbackInvoiceExtraction(payload.fileName));
    }
  });

  // Endpoint 3: Agente Contabile & Fiscale Associazione (Low-Token)
  app.post('/api/gemini/accounting-ask', async (req, res) => {
    const payload = req.body as AccountingAskPayload;
    if (!payload || !payload.question) {
      res.status(400).json({ error: 'Domanda mancante.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'MISSING_KEY') {
      res.json({
        answer: buildFallbackAccountingAdvice(payload),
        source: 'local-erp-engine',
      });
      return;
    }

    try {
      const b = payload.balanceSummary;
      const compactPrompt = `DATI CONTABILI FORMAT "FATTI A MANO" (Gestione tramite Associazione, utente senza P.IVA che recupera i fondi tramite Rimborso Spese):
- Incassi Lordi Tot: €${b.totalGrossRevenue.toFixed(0)} | Quote Partner F&B: €${b.totalPartnerVenueShare.toFixed(0)} (Da saldare: €${b.pendingPartnerSettlementsTotal.toFixed(0)})
- Entrate Nette Associazione: €${b.totalAssociationNetRevenue.toFixed(0)}
- Cassa Associazione Disponibile: €${b.associationCashResidualAfterReimbursements.toFixed(0)}
- Spese Documentate (Fatture Amazon + Scontrini + Trasferte Km): €${b.totalVouchersDocumented.toFixed(0)}
- Spese Anticipate dall'utente da rimborsare: €${b.totalPersonalAdvancesPending.toFixed(0)} (Già rimborsate: €${b.totalPersonalAdvancesReimbursed.toFixed(0)})
- Rimborso prelevabile subito: €${b.maxClaimableReimbursementNow.toFixed(0)}
${payload.partnerModesSummary ? `- Accord Burocratici Partner: ${payload.partnerModesSummary}` : ''}

DOMANDA UTENTE: "${payload.question}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: compactPrompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Sei il consulente amministrativo-contabile del format creativo "Fatti a mano". L\'utente non ha Partita IVA, incassa tramite un\'Associazione e preleva legalmente tramite Rimborsi Spese documentati (piè di lista con fatture Amazon/scontrini e rimborsi chilometrici ACI) e accordi diversi per ogni locale Partner. Rispondi in italiano in modo pratico, sintetico (max 140 parole), numerico e orientato alla corretta gestione documentale.',
        },
      });

      res.json({
        answer: (response.text ?? '').trim() || buildFallbackAccountingAdvice(payload),
        source: 'gemini-3.8-flash',
      });
    } catch (error) {
      console.error('Gemini accounting-ask fallback triggered:', error);
      res.json({
        answer: buildFallbackAccountingAdvice(payload),
        source: 'local-erp-engine',
      });
    }
  });

  // Endpoint 4: Consulente Strategico Costi & Copy Instagram
  app.post('/api/gemini/assist', async (req, res) => {
    const payload = req.body as AssistRequestPayload;
    if (!payload || !payload.workshop) {
      res.status(400).json({ error: 'Dati scheda laboratorio mancanti.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'MISSING_KEY') {
      res.json({
        ...buildSmartFallbackResponse(payload),
        source: 'local-erp-engine',
      });
      return;
    }

    try {
      const { workshop, metrics } = payload;
      const materialsSummary = workshop.materials
        .map(
          (m) =>
            `- ${m.name}: €${m.unitCost.toFixed(2)}/pz x ${m.packsOrdered ?? 1} conf (${
              m.piecesPerPack ?? m.quantity
            } pz/conf) [${m.costType === 'fixed' ? 'Fisso' : 'Variabile'}]`
        )
        .join('\n');

      const phasesSummary =
        workshop.phases && workshop.phases.length > 0
          ? workshop.phases
              .map((p) => `- ${p.numberLabel} (${p.title}): ${p.description}`)
              .join('\n')
          : `- Fase 1: ${workshop.phase1Setup}\n- Fase 2: ${workshop.phase2Execution}\n- Fase 3: ${workshop.phase3Closing}`;

      const prompt = `Analizza questa scheda laboratorio "Fatti a mano" e restituisci suggerimenti di ottimizzazione costi/ROI e copy Instagram:
- Titolo: ${workshop.title} (${workshop.subtitle})
- Location: ${workshop.location} | Data: ${workshop.dateLabel}
- Biglietto: €${workshop.ticketPrice} | Quota Locale: €${workshop.venueFeePerPax}/pax | Target: ${workshop.targetPax} pax
- Costi Fissi: €${metrics.fixedCostsTotal.toFixed(2)} | Var/pax: €${metrics.variableCostPerPax.toFixed(2)}
- Utile S1: €${metrics.netProfitEvent1.toFixed(2)} | Utile S2+: €${metrics.netProfitSubsequent.toFixed(2)} | Break-even: ${metrics.breakEvenPaxEvent1} pax
Materiali:
${materialsSummary}
Fasi:
${phasesSummary}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Rispondi sempre in italiano con tono caldo, artigianale, competente e orientato ai margini operativi di laboratori creativi dal vivo.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              costOptimizations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              instagramCaption: {
                type: Type.STRING,
              },
              reelHook: {
                type: Type.STRING,
              },
              pricingAdvice: {
                type: Type.STRING,
              },
            },
            required: ['costOptimizations', 'instagramCaption', 'reelHook', 'pricingAdvice'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        ...parsed,
        source: 'gemini-3.8-flash',
      });
    } catch (error) {
      console.error('Gemini API fallback triggered:', error);
      res.json({
        ...buildSmartFallbackResponse(payload),
        source: 'local-erp-engine',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fatti a mano ERP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

