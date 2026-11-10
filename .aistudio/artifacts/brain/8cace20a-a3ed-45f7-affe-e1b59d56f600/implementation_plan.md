# Fatti a mano — Evoluzione ERP: Gestione Partner, Google Calendar, Protocollo Dinamico IA & Inventario Globale

Questo aggiornamento espande **Fatti a mano — Lab & Design ERP** trasformando la Scheda Laboratorio e il Builder Grafico in un ecosistema multi-dispositivo completo: introduce l'archivio **Partner & Brand Kit** (con caricamento diretto nel Builder Grafico), la sincronizzazione con **Google Calendar**, il **Protocollo Operativo a fasi personalizzabili assistite da Gemini IA**, e il **Calcolatore Economico con modalità Collegata/Scollegata e Inventario Totale** delle scorte.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Di seguito sono riepilogate le scelte progettuali chiave per soddisfare tutte le funzionalità richieste mantenendo l'interfaccia fluida su Desktop e iPad Pro:

- **Integrazione Asset Partner nel Builder Grafico**: Selezionando un Partner dal menu a tendina del Builder Grafico, il sistema carica automaticamente il **Brand Kit del Partner** (affiancando la sua palette colori e il suo font di riferimento alla palette *Fatti a mano*) e permette di inserire con un tocco sul canvas il **badge/logo vettoriale co-brandizzato** e i dettagli della location.
- **Calcolatore Economico (Collegato vs. Scollegato) & Inventario Totale**: Ogni riga materiale supporta l'inserimento di **Confezioni Ordinate** e **Pezzi per Confezione** (calcolando i pezzi totali acquistati, i pezzi consumati dall'evento e la rimanenza). Un selettore permette di passare dalla modalità **Collegata** (i costi e i quantitativi scalano automaticamente al variare dei partecipanti e aggiornano i totali) alla modalità **Scollegata** (libera modifica manuale dei singoli valori senza ricalcolo forzato). Confermando i materiali della scheda, le eccedenze e le attrezzature vengono registrate nell'**Inventario Totale del Format**, da cui i laboratori successivi possono attingere.
- **Sincronizzazione Google Calendar**: Accanto ai campi Data e Orario (ora dotati di selettore data/ora strutturato + etichetta descrittiva) viene introdotto il controllo di sincronizzazione con **Google Calendar** (previa finestra di conferma esplicita prima della scrittura/aggiornamento dell'evento sul calendario primario dell'utente).

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Modulo Gestione Partner (CRM & Brand Kit)**: Permette di censire i locali e i partner commerciali specificando *Chi sono / Cosa fanno*, *Indirizzo*, *Tipo di Rapporto Commerciale* (es. Quota F&B fissa per pax, Revenue Share %, Affitto spazio, Sponsorizzazione tecnica), *Logo/Monogramma vettoriale*, *Font preferito* e *Palette Colori dedicata*.
  2. **Dropdown Partner nel Builder Grafico**: Nel Builder Grafico compare un menu a tendina con tutti i Partner salvati; selezionandone uno, la toolbar mostra i colori e il font del partner e aggiunge nella Clipboard e sul canvas il blocco co-branding (Logo + Location + Payoff partner).
  3. **Sincronizzazione Google Calendar**: Collega la data, l'orario di inizio/fine, il titolo del laboratorio, il partner ospitante e il protocollo operativo direttamente a Google Calendar tramite l'account Google autenticato.
  4. **Persistenza Automatica Multi-Dispositivo (Account Sync)**: Tutte le modifiche a Schede Laboratorio, Partner, Inventario Totale e Template Grafici vengono salvate in tempo reale sul profilo cloud Firebase dell'account Google connesso (con sincronizzazione automatica cambiando dispositivo, es. da Mac a iPad Pro).
  5. **Protocollo Operativo Dinamico con IA Gemini**: Sostituisce i 3 blocchi fissi con una lista dinamica di fasi in cui l'utente può **aggiungere, eliminare, rinumerare e rinominare** liberamente ogni fase, con un pulsante **"Migliora con IA"** su ciascun box di testo per espandere o rifinire la descrizione tecnica tramite Google Gemini.
  6. **Calcolatore Economico Avanzato & Inventario Globale**: Introduce il toggle **Valori Collegati / Scollegati**, le colonne **Q.tà Confezioni Ordinate** e **Pezzi per Confezione**, e il pulsante **"Conferma e Aggiorna Inventario Format"** che alimenta il magazzino centrale dei materiali riutilizzabili e delle scorte residue.
- **Target Audience / Persona**: Ideatori e gestori di format creativi edutainment che pianificano eventi con locali partner, controllano i margini al centesimo, gestiscono il magazzino materiali e disegnano locandine co-brandizzate su iPad Pro.
- **Key Value**: Elimina la duplicazione di dati tra gestione commerciale (accordi partner e magazzino), calendario operativo (Google Calendar) e produzione grafica (locandine co-brandizzate).

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Flusso Partner -> Scheda Lab -> Builder Grafico**: L'utente crea o seleziona un Partner (es. *Osteria del Cortile* o *Spazio Serra*) definendone palette colori, font, logo/simbolo e accordo commerciale (es. *Quota F&B 6,50€/pax*). Nella Scheda Laboratorio associa il Partner (che compila in automatico location e condizioni economiche concordate). Aprendo il Builder Grafico, seleziona il Partner dal menu a tendina in alto per applicarne palette, font e badge co-brandizzato.
  2. **Flusso Data/Orario -> Google Calendar**: L'utente imposta data, ora di inizio e durata nella Scheda Laboratorio e preme *"Sincronizza su Google Calendar"*. Si apre un dialogo di conferma con il riepilogo dell'evento; confermando, l'evento viene creato o aggiornato sul Google Calendar dell'utente.
  3. **Flusso Protocollo Dinamico & Assistenza IA**: L'utente aggiunge una nuova fase (es. *04. Allestimento Corner Fotografico*), scrive una bozza veloce e clicca *"Migliora con IA"*: Gemini riscrive e struttura il testo in modo chiaro e operativo.
  4. **Flusso Calcolatore Collegato/Scollegato & Inventario**: L'utente inserisce per un materiale *2 confezioni ordinate* da *15 pezzi ciascuna* (30 pezzi totali). Con 20 partecipanti, il sistema calcola 20 pezzi utilizzati e **10 pezzi residui**. Cliccando *"Conferma nell'Inventario Format"*, i 10 pezzi residui e le attrezzature fisse entrano nell'Inventario Totale, pronti per essere riutilizzati nei laboratori futuri.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Stile editoriale artigianale su carta naturale, pulito e ad alta leggibilità tabellare (`tabular-nums`).
  - *Color Palette & Mood*: Mantiene la base calda Beige Kraft (`#EADDCD`) con superfici strutturali `#F4ECE1`, accenti Terracotta (`#B85B43`), Verde Bosco (`#4A6B53`), Ocra (`#D4A373`) e tipografia Blu Notte (`#1A2B4C`), arricchendosi dinamicamente degli swatch colore specifici del Partner selezionato.
  - *Typography & Hierarchy*: `Fraunces` per i titoli editoriali, `Plus Jakarta Sans` per l'interfaccia ad alta densità, `Bricolage Grotesque` per il display morbido e `JetBrains Mono` (`tabular-nums`) per calcoli economici, scorte di magazzino e orari.
  - *Component Styling & Layout*: Layout desktop a 1440px con griglia a 12 colonne, superfici piatte con bordi sottili (`1px solid rgba(26,43,76,0.15)`), zero badge superflui e controlli single-line ottimizzati per il tocco su iPad Pro.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Modalità Collegata vs. Scollegata nel Calcolatore Economico**
  - *Chosen Approach*: Un interruttore esplicito nella barra del Calcolatore permette di scegliere tra **Modalità Collegata** (default: il totale di riga e il consumo materiali scalano automaticamente in base a `Confezioni × Pezzi`, `Partecipanti` e `Quota Partner`) e **Modalità Scollegata** (in cui l'utente può sovrascrivere liberamente il subtotale di riga, il costo totale o la quota locale senza che il cambio di un parametro alteri gli altri).
  - *Why*: Durante le trattative coi fornitori o i forfait coi locali partner, spesso si concorda un prezzo a corpo o si usano confezioni miste che richiedono libertà di inserimento manuale senza perdere i calcoli automatici quando desiderati.
- **Decision 2: Sincronizzazione Multi-Dispositivo Automatica + Fallback Locale**
  - *Chosen Approach*: Quando l'utente ha effettuato l'accesso con Google, ogni modifica a laboratori, partner, inventario e template viene salvata automaticamente (con *debouncing* intelligente e indicatore di stato sincronizzazione) su Cloud Firestore sotto l'UID dell'utente, mantenendo anche una copia speculare locale per continuità immediata.
  - *Why*: Garantisce che aprendo l'app su iPad Pro dopo aver lavorato da computer (o viceversa) ci si ritrovi esattamente con gli stessi partner, fasi operative, inventario e locandine.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                 FATTI A MANO — LAB & DESIGN ERP (Cloud + iPad Pro)               │
├───────────────────────┬──────────────────────────┬───────────────────────────────┤
│  Google Auth & OAuth  │   Cloud Firestore Sync   │   Server-Side Gemini AI API   │
│  • Account Persist    │   • /workshops           │   • /api/gemini/assist        │
│  • Google Calendar    │   • /partners            │   • /api/gemini/improve-phase │
│    Events API (v3)    │   • /inventory           │                               │
│                       │   • /templates           │                               │
└───────────┬───────────┴─────────────┬────────────┴───────────────┬───────────────┘
            │                         │                            │
            ▼                         ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        STATO APPLICATIVO CONDIVISO (React)                       │
├─────────────────────────────────────────┬────────────────────────────────────────┤
│       MODULO LAB MANAGER & ERP          │         MODULO BUILDER GRAFICO         │
│  ┌───────────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ Sezione Partner & Brand Kit       │  │  │ Dropdown Selettore Partner       │  │
│  │ • Logo SVG / URL, Font, Palette   │──┼─►│ • Carica Palette & Font Partner  │  │
│  │ • Chi sono & Accordo Commerciale  │  │  │ • Inserisce Badge Co-Branding    │  │
│  └───────────────────────────────────┘  │  └──────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ Data & Orario + Google Calendar   │  │  │ Canvas Vettoriale & Font Engine  │  │
│  │ • Conferma & Sync Evento Calendar │  │  │ • Pointer Events (Apple Pencil)  │  │
│  └───────────────────────────────────┘  │  │ • Livelli Z-Index & Texture SVG  │  │
│  ┌───────────────────────────────────┐  │  └──────────────────────────────────┘  │
│  │ Protocollo Operativo Dinamico     │  │                                        │
│  │ • N Fasi Numerate + Titolo Libero │  │                                        │
│  │ • Bottone "Migliora con IA"       │  │                                        │
│  └───────────────────────────────────┘  │                                        │
│  ┌───────────────────────────────────┐  │                                        │
│  │ Calcolatore & Inventario Format   │  │                                        │
│  │ • Toggle Collegato / Scollegato   │  │                                        │
│  │ • Confezioni × Pezzi Contenuti    │  │                                        │
│  │ • Conferma -> Inventario Totale   │  │                                        │
│  └───────────────────────────────────┘  │                                        │
└─────────────────────────────────────────┴────────────────────────────────────────┘
```

- **Data Model & State**:
  - **PartnerProfile**: `id`, `name`, `description` (chi sono e cosa fanno), `address`, `dealType` (tipo di rapporto commerciale: es. quota F&B per pax, revenue share, affitto fisso, barter), `dealNotes`, `defaultVenueFee`, `logoText` / `logoSvgOrUrl`, `fontStyle`, `palette` (array di 3–4 colori hex del partner).
  - **OperationalPhase**: `id`, `orderNumber`, `title`, `durationLabel`, `description` (lista dinamica ordinabile in ogni `WorkshopCard`).
  - **MaterialItem (Esteso)**: `id`, `name`, `unitCost` (costo per confezione o unitario), `packsOrdered` (quantità prodotto/confezioni ordinate), `piecesPerPack` (pezzi contenuti in ogni confezione), `manualTotalCost` (usato quando la riga o la tabella è in modalità scollegata), `costType` (`fixed` | `variable`), `syncedToInventory` (boolean).
  - **InventoryItem (Inventario Totale Format)**: `id`, `name`, `category`, `totalPiecesAvailable`, `unitCostAverage`, `lastUpdatedFromWorkshop`, `costType`.
- **Interactive Component & State Mapping**:
  - **Selezione Partner**: Nel Lab Manager, selezionare un partner aggiorna Location e Quota Locale predefinita (se in modalità collegata). Nel Builder Grafico, il menu a tendina *"Partner sul Canvas"* mostra i colori del partner nella barra laterale e permette di inserire in un clic il timbro/logo co-brandizzato del partner.
  - **Miglioramento Fase con IA**: Ogni fase del Protocollo Operativo ha un pulsante *"Migliora con IA"* che invia titolo e bozza della fase a `/api/gemini/improve-phase` e aggiorna il box di testo con una versione rifinita e professionale.
  - **Conferma Inventario**: Il pulsante *"Conferma Materiali nell'Inventario Format"* calcola per ogni materiale i pezzi acquistati (`packsOrdered × piecesPerPack`), sottrae i materiali variabili consumati dai partecipanti del laboratorio e aggiunge le attrezzature fisse e le rimanenze all'Inventario Totale del format (con possibilità di prelevare dall'inventario nei laboratori successivi).
