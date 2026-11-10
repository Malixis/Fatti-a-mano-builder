import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

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
}

function buildSmartFallbackResponse(body: AssistRequestPayload) {
  const { workshop, metrics } = body;
  const highestFixed = [...workshop.materials]
    .filter((m) => m.costType === 'fixed')
    .sort((a, b) => b.unitCost * (b.packsOrdered ?? b.quantity) - a.unitCost * (a.packsOrdered ?? a.quantity))[0];
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
  if (!base) {
    return `[Fase ${body.phaseNumber} · ${body.phaseTitle}] Accogliamo i ${pax} partecipanti${partnerRef} in un'atmosfera conviviale e rilassata (edutainment). Dopo un breve benvenuto introduttivo di 5 minuti, guidiamo il gruppo passo dopo passo: verificare che ogni postazione disponga degli strumenti pronti all'uso, mostrare la tecnica al tavolo centrale con gesti semplici e assistere ciascun ospite mantenendo i tempi operativi chiari e ben scanditi.`;
  }
  return `${base.replace(/\.$/, '')}. Approccio Edutainment & Regia Operativa (${pax} pax${partnerRef}): accogliere i partecipanti con tono caldo e inclusivo, rassicurando chi parte da zero; alternare la dimostrazione tecnica pratica (3-5 min) al supporto individuale tra i tavoli, mantenendo chiare le tempistiche e i passaggi manuali della fase "${body.phaseTitle}".`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // Endpoint 1: Ottimizza la descrizione di una singola fase del Protocollo Operativo con Gemini IA
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
      const prompt = `Sei il direttore creativo e responsabile didattico dei laboratori "Fatti a mano" (format di edutainment artigianale dal vivo).
Ottimizza la descrizione della seguente fase del Protocollo Operativo rendendo il tono più professionale, accogliente e orientato all'edutainment, mantenendo al tempo stesso tutte le istruzioni tecniche, le quantità e le tempistiche perfettamente chiare e strutturate per lo staff.

CONTESTO LABORATORIO:
- Laboratorio: ${payload.workshopTitle}
- Partner / Location: ${payload.partnerName || 'Locale Partner'}
- Partecipanti previsti: ${payload.targetPax || 20} pax
- Fase: ${payload.phaseNumber} — ${payload.phaseTitle}
- Testo attuale della fase: "${payload.currentDescription || 'Da definire'}"

Restituisci SOLO il testo ottimizzato della fase in italiano (3-5 frasi fluide, professionali, accoglienti e tecnicamente inequivocabili, senza preamboli o formattazione markdown).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'Rendi il testo professionale, caloroso, accogliente e orientato all\'edutainment esperienziale, preservando con assoluta chiarezza le istruzioni tecniche, i materiali e le tempistiche operative.',
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

  // Endpoint 2: Consulente Strategico Costi & Copy Instagram
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
            `- ${m.name}: €${m.unitCost.toFixed(2)}/conf x ${m.packsOrdered ?? m.quantity} conf (${
              m.piecesPerPack ?? 1
            } pz/conf) [${m.costType === 'fixed' ? 'Fisso/Riutilizzabile' : 'Variabile'}]`
        )
        .join('\n');

      const phasesSummary =
        workshop.phases && workshop.phases.length > 0
          ? workshop.phases
              .map((p) => `- ${p.numberLabel} (${p.title}): ${p.description}`)
              .join('\n')
          : `- Fase 1: ${workshop.phase1Setup}\n- Fase 2: ${workshop.phase2Execution}\n- Fase 3: ${workshop.phase3Closing}`;

      const prompt = `Sei il consulente strategico e copywriter ufficiale del format di laboratori creativi edutainment "Fatti a mano".
Analizza i dati di questa scheda laboratorio e restituisci suggerimenti di ottimizzazione costi/ROI e il copy persuasivo per Instagram.

DATI LABORATORIO:
- Titolo: ${workshop.title}
- Sottotitolo: ${workshop.subtitle}
- Categoria: ${workshop.category}
- Location / Partner: ${workshop.location}
- Data/Ora: ${workshop.dateLabel}
- Prezzo Biglietto Pubblico: €${workshop.ticketPrice}
- Quota Locale (Food & Beverage per pax): €${workshop.venueFeePerPax}
- Partecipanti previsti: ${workshop.targetPax} pax

METRICHE CALCOLATE:
- Costi Fissi Totali: €${metrics.fixedCostsTotal.toFixed(2)}
- Costo Materiali Variabili per Pax: €${metrics.variableCostPerPax.toFixed(2)}
- Costo Totale per Pax (Serata 1): €${metrics.costPerPaxEvent1.toFixed(2)}
- Utile Netto Serata 1 (con costi fissi): €${metrics.netProfitEvent1.toFixed(2)}
- Utile Netto Serate Successive (margine puro): €${metrics.netProfitSubsequent.toFixed(2)}
- Break-even Serata 1: ${metrics.breakEvenPaxEvent1} partecipanti

MATERIALI E CONFEZIONI:
${materialsSummary}

PROTOCOLLO OPERATIVO:
${phasesSummary}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'Rispondi sempre in italiano con tono caldo, artigianale, competente e orientato ai margini operativi di laboratori creativi dal vivo.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              costOptimizations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '3 consigli pratici e numerici per ottimizzare i costi delle confezioni materiali, l\'inventario e il margine tra Serata 1 e Serate Successive.',
              },
              instagramCaption: {
                type: Type.STRING,
                description:
                  'Copy completo e persuasivo per il post Instagram di lancio della serata, nello stile artigianale Fatti a mano.',
              },
              reelHook: {
                type: Type.STRING,
                description:
                  'Hook incisivo di 1-2 frasi per i primi 3 secondi di un Reel o Storia Instagram.',
              },
              pricingAdvice: {
                type: Type.STRING,
                description:
                  'Analisi sintetica del posizionamento di prezzo rispetto alla quota locale e al margine per partecipante.',
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
