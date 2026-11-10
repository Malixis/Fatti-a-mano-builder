import { InventoryItem, PartnerProfile, VectorElement, WorkshopCard } from '../types/erp';
import { buildPosterFromWorkshop } from '../utils/vectorMath';

export const INITIAL_PARTNERS: PartnerProfile[] = [
  {
    id: 'partner-osteria-cortile',
    name: 'Osteria del Cortile',
    whoTheyAre:
      'Enoteca indipendente e bistrot con giardino interno in zona Tortona. Seleziona vini naturali di piccoli vignaioli italiani e taglieri artigianali.',
    address: 'Via Tortona 18 · Milano',
    commercialDealType: 'Quota F&B Fissa a Partecipante',
    commercialDealNotes:
      'Accordo 6,50€/pax per calice di vino naturale + focaccia calda servita a metà laboratorio. Spazio riservato in esclusiva dalle 19:00 alle 21:45 senza affitto sala.',
    defaultVenueFee: 6.5,
    logoText: 'ODC',
    logoShape: 'circle-seal',
    fontStyle: 'editorial-serif',
    palette: ['#7C2D12', '#C26D4A', '#365314'],
  },
  {
    id: 'partner-spazio-serra',
    name: 'Spazio Serra & Forno',
    whoTheyAre:
      'Serra botanica urbana e micropanificio agricolo in zona Isola. Ospita mostre d\'illustrazione, mercatini di editoria indipendente e workshop manuali.',
    address: 'Via Maroncelli 12 · Milano',
    commercialDealType: 'Revenue Share 70/30 + Consumazione Inclusa',
    commercialDealNotes:
      'Quota 8,00€/pax per calice biologico + degustazione lievitati del forno. Promozione congiunta con newsletter Spazio Serra (8.500 iscritti).',
    defaultVenueFee: 8.0,
    logoText: 'SERRA',
    logoShape: 'botanical-crest',
    fontStyle: 'craft-rounded',
    palette: ['#2D5A3C', '#D97742', '#1E3A5F'],
  },
  {
    id: 'partner-lab-urbano-nolo',
    name: 'Laboratorio Urbano Nolo',
    whoTheyAre:
      'Ex tipografia industriale riconvertita in hub culturale e cocktail bar botanico con grandi tavoli da lavoro in legno massello.',
    address: 'Via Varanini 8 · Milano',
    commercialDealType: 'Minimo Garantito 15 Pax + Drink Botanico',
    commercialDealNotes:
      'Quota 7,00€/pax per Gin Tonic artigianale o analcolico alle erbe. Supporto impianto luci e stoccaggio casse materiali tra una serata e l\'altra.',
    defaultVenueFee: 7.0,
    logoText: 'NOLO·LAB',
    logoShape: 'arch-badge',
    fontStyle: 'mono-label',
    palette: ['#1A2B4C', '#3B6E8C', '#D4A373'],
  },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-cavalletti-faggio',
    name: 'Cavalletti da tavolo in legno di faggio (kit 20 pz)',
    costType: 'fixed',
    unitCost: 4.5,
    packsOrderedTotal: 1,
    piecesPerPack: 20,
    totalPiecesOrdered: 20,
    piecesUsedTotal: 0,
    piecesAvailable: 20,
    lastWorkshopTitle: 'Paint & Wine — Botanica Matisse',
    updatedAt: '2026-11-09',
  },
  {
    id: 'inv-set-pennelli-grembiuli',
    name: 'Set 40 pennelli sintetici + 20 grembiuli cotone',
    costType: 'fixed',
    unitCost: 65.0,
    packsOrderedTotal: 1,
    piecesPerPack: 40,
    totalPiecesOrdered: 40,
    piecesUsedTotal: 0,
    piecesAvailable: 40,
    lastWorkshopTitle: 'Paint & Wine — Botanica Matisse',
    updatedAt: '2026-11-09',
  },
  {
    id: 'inv-tele-cotone-30x40',
    name: 'Tela telata 100% cotone 30x40cm (confezione 10 pz)',
    costType: 'variable',
    unitCost: 2.1,
    packsOrderedTotal: 3,
    piecesPerPack: 10,
    totalPiecesOrdered: 30,
    piecesUsedTotal: 20,
    piecesAvailable: 10,
    lastWorkshopTitle: 'Paint & Wine — Botanica Matisse',
    updatedAt: '2026-11-09',
  },
];

export const INITIAL_WORKSHOPS: WorkshopCard[] = [
  {
    id: 'ws-paint-wine',
    title: 'Paint & Wine — Botanica Matisse',
    subtitle: 'Dipingi la tua tela organica sorseggiando vino naturale',
    location: 'Osteria del Cortile, Via Tortona 18 · Milano',
    partnerId: 'partner-osteria-cortile',
    dateLabel: 'Giovedì 19 Novembre · Ore 19:30',
    eventDate: '2026-11-19',
    eventStartTime: '19:30',
    eventDurationMinutes: 135,
    category: 'Paint & Wine',
    ticketPrice: 20,
    venueFeePerPax: 6.5,
    targetPax: 20,
    calculatorLinked: true,
    phases: [
      {
        id: 'ph-1',
        numberLabel: '01',
        title: 'Accoglienza & Allestimento Tavoli Kraft',
        durationLabel: 'Pre-evento (-30 min)',
        description:
          'Allestimento 4 tavoli conviviali da 5 postazioni ciascuno con tovagliette in carta Kraft #EADDCD. Posizionare 1 cavalletto da tavolo in faggio per partecipante, 2 pennelli sintetici (piatto n.12 e tondo n.4), bicchierino lavapennelli e tavolozza con i 5 colori brand pre-dosati (Terracotta, Verde Bosco, Ocra, Blu Notte, Bianco Titanio). Accendere playlist indie-acustica 15 minuti prima dell\'arrivo.',
      },
      {
        id: 'ph-2',
        numberLabel: '02',
        title: 'Guida Artistica & Composizione Botanica',
        durationLabel: 'Cuore del Lab (75 min)',
        description:
          'Introduzione di 10 minuti sul taglio e la forma organica ispirata a Henri Matisse (nessuna competenza di disegno richiesta). Primo esercizio di scioglimento del polso su foglio di prova con curve continue e macchie piene. Passaggio su tela 30x40cm: stesura campiture di fondo (25 min), sovrapposizione foglie botaniche e scacchiere ondulate (35 min), dettagli a contrasto e timbro finale (15 min).',
      },
      {
        id: 'ph-3',
        numberLabel: '03',
        title: 'Punzonatura, Calice & Consegna Shopper',
        durationLabel: 'Social & Networking (30 min)',
        description:
          'Asciugatura rapida con fon termico silenzioso e applicazione timbro circolare "Fatti a mano" sul retro della tela. Foto di gruppo con tutte le tele sollevate per le Storie Instagram del format. Apertura buffet aperitivo e secondo calice insieme ai partecipanti; inserimento tele nelle shopper in carta Kraft timbrate.',
      },
    ],
    phase1Setup:
      'Allestimento 4 tavoli conviviali da 5 postazioni ciascuno con tovagliette in carta Kraft #EADDCD. Posizionare 1 cavalletto da tavolo in faggio per partecipante, 2 pennelli sintetici (piatto n.12 e tondo n.4), bicchierino lavapennelli e tavolozza con i 5 colori brand pre-dosati (Terracotta, Verde Bosco, Ocra, Blu Notte, Bianco Titanio). Accendere playlist indie-acustica 15 minuti prima dell\'arrivo.',
    phase2Execution:
      'Introduzione di 10 minuti sul taglio e la forma organica ispirata a Henri Matisse (nessuna competenza di disegno richiesta). Primo esercizio di scioglimento del polso su foglio di prova con curve continue e macchie piene. Passaggio su tela 30x40cm: stesura campiture di fondo (25 min), sovrapposizione foglie botaniche e scacchiere ondulate (35 min), dettagli a contrasto e timbro finale (15 min).',
    phase3Closing:
      'Asciugatura rapida con fon termico silenzioso e applicazione timbro circolare "Fatti a mano" sul retro della tela. Foto di gruppo con tutte le tele sollevate per le Storie Instagram del format. Apertura buffet aperitivo e secondo calice insieme ai partecipanti; inserimento tele nelle shopper in carta Kraft timbrate.',
    materials: [
      {
        id: 'm-1',
        name: 'Cavalletti da tavolo in legno di faggio (kit 20 pz)',
        unitCost: 4.5,
        quantity: 20,
        packsOrdered: 1,
        piecesPerPack: 20,
        costType: 'fixed',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'm-2',
        name: 'Set 40 pennelli sintetici + 20 grembiuli cotone',
        unitCost: 65.0,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'fixed',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'm-3',
        name: 'Tela telata 100% cotone 30x40cm (per partecipante)',
        unitCost: 2.1,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'variable',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'm-4',
        name: 'Colori acrilici opachi ad alta pigmentazione (quota pax)',
        unitCost: 1.15,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'variable',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'm-5',
        name: 'Shopper Kraft #EADDCD timbrata + tovaglietta protettiva',
        unitCost: 0.65,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'variable',
        packed: false,
        confirmedForInventory: true,
      },
    ],
  },
  {
    id: 'ws-legatoria-diario',
    title: 'Rilega il tuo Diario Artigianale',
    subtitle: 'Legatoria giapponese a 4 fori con carte cotone e copertina timbrata',
    location: 'Spazio Serra, Via Maroncelli 12 · Milano',
    partnerId: 'partner-spazio-serra',
    dateLabel: 'Martedì 24 Novembre · Ore 20:00',
    eventDate: '2026-11-24',
    eventStartTime: '20:00',
    eventDurationMinutes: 120,
    category: 'Legatoria & Carta',
    ticketPrice: 30,
    venueFeePerPax: 8.0,
    targetPax: 20,
    calculatorLinked: true,
    phases: [
      {
        id: 'ph-b1',
        numberLabel: '01',
        title: 'Preparazione Postazioni & Rocchetti Filo Cerato',
        durationLabel: 'Pre-evento (-25 min)',
        description:
          'Disporre su ogni postazione 1 tappetino da taglio autorigenerante A4, 1 punteruolo con manico in legno, 1 stecca d\'osso per cordonatura, 1 ago da legatoria a punta tonda e 2 morsetti metallici. Preparare al centro del tavolo i rocchetti di filo cerato nei colori Terracotta, Verde Bosco e Blu Notte.',
      },
      {
        id: 'ph-b2',
        numberLabel: '02',
        title: 'Timbratura Copertina, Foratura & Cucitura Asa-no-ha',
        durationLabel: 'Esecuzione (80 min)',
        description:
          'Scelta della carta di copertina e stampa a mano del frontespizio con i timbri in gomma intagliata e cuscinetti ad inchiostro pigmentato (20 min). Allineamento dei 40 fogli interni in carta avorio 120g, bloccaggio con morsetti e foratura guidata tramite dima millimetrata (25 min). Cucitura giapponese Asa-no-ha (foglia di canapa) passo dopo passo (35 min).',
      },
      {
        id: 'ph-b3',
        numberLabel: '03',
        title: 'Ex-Libris Personale & Degustazione Forno',
        durationLabel: 'Chiusura (25 min)',
        description:
          'Personalizzazione della prima pagina con dedica calligrafica o timbro ex-libris personale. Degustazione calice di vino biologico e focaccia artigianale del forno ospitante. Raccolta feedback tramite QR code sul segnalibro omaggio.',
      },
    ],
    phase1Setup:
      'Disporre su ogni postazione 1 tappetino da taglio autorigenerante A4, 1 punteruolo con manico in legno, 1 stecca d\'osso per cordonatura, 1 ago da legatoria a punta tonda e 2 morsetti metallici. Preparare al centro del tavolo i rocchetti di filo cerato nei colori Terracotta, Verde Bosco e Blu Notte.',
    phase2Execution:
      'Scelta della carta di copertina e stampa a mano del frontespizio con i timbri in gomma intagliata e cuscinetti ad inchiostro pigmentato (20 min). Allineamento dei 40 fogli interni in carta avorio 120g, bloccaggio con morsetti e foratura guidata tramite dima millimetrata (25 min). Cucitura giapponese Asa-no-ha (foglia di canapa) passo dopo passo (35 min).',
    phase3Closing:
      'Personalizzazione della prima pagina con dedica calligrafica o timbro ex-libris personale. Degustazione calice di vino biologico e focaccia artigianale del forno ospitante. Raccolta feedback tramite QR code sul segnalibro omaggio.',
    materials: [
      {
        id: 'b-1',
        name: 'Kit 20 tappetini taglio A4 + 20 punteruoli + 20 stecche d\'osso',
        unitCost: 6.2,
        quantity: 20,
        packsOrdered: 1,
        piecesPerPack: 20,
        costType: 'fixed',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'b-2',
        name: 'Set timbri botanici intagliati + 6 tamponi inchiostro',
        unitCost: 48.0,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'fixed',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'b-3',
        name: 'Risma pre-tagliata 40 fogli carta avorio 120g + 2 cartoncini',
        unitCost: 2.9,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'variable',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'b-4',
        name: 'Filo di lino cerato (2 metri) + fascetta Kraft personalizzata',
        unitCost: 0.9,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'variable',
        packed: false,
        confirmedForInventory: true,
      },
    ],
  },
  {
    id: 'ws-cianotipia',
    title: 'Cianotipia Botanica & Gin Tonic',
    subtitle: 'Stampa fotografica solare su carta d\'acquerello con erbario essiccato',
    location: 'Laboratorio Urbano Nolo, Via Varanini 8 · Milano',
    partnerId: 'partner-lab-urbano-nolo',
    dateLabel: 'Domenica 29 Novembre · Ore 18:00',
    eventDate: '2026-11-29',
    eventStartTime: '18:00',
    eventDurationMinutes: 120,
    category: 'Stampa Antica',
    ticketPrice: 25,
    venueFeePerPax: 7.0,
    targetPax: 20,
    calculatorLinked: true,
    phases: [
      {
        id: 'ph-c1',
        numberLabel: '01',
        title: 'Stazione Lampade UV-A & Bacinelle Sviluppo',
        durationLabel: 'Pre-evento (-30 min)',
        description:
          'Allestire l\'angolo di esposizione UV con 4 lampade UV-A da 50W su stativo sicuro e 3 bacinelle di sviluppo con acqua e gocce di perossido d\'idrogeno per intensificare il Blu di Prussia. Sui tavoli: cornici a contatto in vetro, pennelli in spugna Hake ed erbario di felci, ginkgo e fiori pressati.',
      },
      {
        id: 'ph-c2',
        numberLabel: '02',
        title: 'Sensibilizzazione Carta Cotone & Esposizione Solare/UV',
        durationLabel: 'Esecuzione (70 min)',
        description:
          'Spiegazione della reazione chimica tra citrato ferrico ammoniacale e ferricianuro di potassio (10 min). Stesura a pennello dell\'emulsione fotosensibile su 2 cartoline e 1 stampa A4 in carta cotone 300g (20 min). Composizione botanica sotto vetro, esposizione UV di 6 minuti e lavaggio rivelatore dal vivo (40 min).',
      },
      {
        id: 'ph-c3',
        numberLabel: '03',
        title: 'Asciugatura su Corda & Gin Tonic Botanico',
        durationLabel: 'Chiusura (30 min)',
        description:
          'Stesura delle stampe sul filo in corda con mollette di legno per l\'asciugatura durante l\'aperitivo. Consegna in busta protettiva rigida con guida tascabile alla cianotipia domestica.',
      },
    ],
    phase1Setup:
      'Allestire l\'angolo di esposizione UV con 4 lampade UV-A da 50W su stativo sicuro e 3 bacinelle di sviluppo con acqua e gocce di perossido d\'idrogeno per intensificare il Blu di Prussia. Sui tavoli: cornici a contatto in vetro, pennelli in spugna Hake ed erbario di felci, ginkgo e fiori pressati.',
    phase2Execution:
      'Spiegazione della reazione chimica tra citrato ferrico ammoniacale e ferricianuro di potassio (10 min). Stesura a pennello dell\'emulsione fotosensibile su 2 cartoline e 1 stampa A4 in carta cotone 300g (20 min). Composizione botanica sotto vetro, esposizione UV di 6 minuti e lavaggio rivelatore dal vivo (40 min).',
    phase3Closing:
      'Stesura delle stampe sul filo in corda con mollette di legno per l\'asciugatura durante l\'aperitivo. Consegna in busta protettiva rigida con guida tascabile alla cianotipia domestica.',
    materials: [
      {
        id: 'c-1',
        name: '4 Lampade UV-A 50W + 20 lastre vetro con clip + 3 bacinelle',
        unitCost: 115.0,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'fixed',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'c-2',
        name: 'Fogli carta 100% cotone 300g (1 A4 + 2 cartoline per pax)',
        unitCost: 2.4,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'variable',
        packed: true,
        confirmedForInventory: true,
      },
      {
        id: 'c-3',
        name: 'Soluzione chimica Ferricianuro + Citrato + Erbario pressato',
        unitCost: 1.2,
        quantity: 1,
        packsOrdered: 1,
        piecesPerPack: 1,
        costType: 'variable',
        packed: true,
        confirmedForInventory: true,
      },
    ],
  },
];

export const INITIAL_POSTER_STATE: {
  canvasElements: VectorElement[];
  clipboardAssets: VectorElement[];
} = buildPosterFromWorkshop(INITIAL_WORKSHOPS[0], INITIAL_PARTNERS[0]);
