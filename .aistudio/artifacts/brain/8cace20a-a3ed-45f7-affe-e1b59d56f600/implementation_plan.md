# Evoluzione Builder Grafico: Workstation Vettoriale Stile Adobe Illustrator, Caselle di Testo (Montserrat & Akena Otos) e Macchia Blob a Mano Libera

Questo piano trasforma il **Builder Grafico** di *Fatti a mano* in un ambiente di progettazione vettoriale professionale ispirato all'architettura e agli strumenti di **Adobe Illustrator**, integrando **Caselle di Testo** dedicate con le due sole famiglie tipografiche **Montserrat** e **Akena Otos** (in tutte le loro declinazioni di peso e stile), lo strumento **Macchia Blob a mano libera col cursore** (senza vincolo rettangolare) e la persistenza Cloud multi-dispositivo di ogni proprietà vettoriale.

## User Review & Critical Decisions

> [!IMPORTANT]
> Tutte le preferenze confermate nella fase di chiarimento sono state integrate nell'architettura del nuovo Builder Grafico.

- **Decisione Confermata 1 — Tema Interfaccia Builder**: **Switch istantaneo tra Tema Scuro Adobe Pro (`#1E1E1E` / `#252526` / `#333333`) e Tema Studio Beige Kraft (`#EADDCD` / `#F4ECE1` / `#1A2B4C`)**, per lavorare con il contrasto tipico di Adobe Illustrator oppure in continuità cromatica col brand *Fatti a mano*.
- **Decisione Confermata 2 — Strumento Macchia Blob col Cursore**: **Doppia modalità a mano libera** attivabile col cursore/Apple Pencil:
  1. **Lazo Forma Libera (`Freeform Blob Lasso`)**: muovendo liberamente il cursore o la Apple Pencil si disegna il perimetro di qualsiasi forma organica; al rilascio, il tracciato viene chiuso morbidamente con curve di Bézier/Chaikin e riempito di colore senza alcun vincolo di quadrato o rettangolo.
  2. **Pennello Blob Unione (`Illustrator Blob Brush — Shift+B`)**: disegna un tratto pieno organico che si fonde/unisce alle forme Blob adiacenti dello stesso colore per scolpire macchie complesse a mano libera.
- **Decisione Confermata 3 — Motore Tipografico Caselle di Testo**: **Due sole famiglie di font nel selettore tipografico (`Montserrat` e `Akena Otos`)** con **tutte le declinazioni integrate** (Thin 100, ExtraLight 200, Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800, Black 900 + varianti *Italic*) più la possibilità di **caricare il file font originale `.otf` / `.ttf` / `.woff2`** (tramite `FontFace` API salvato in locale) per un rendering tipografico identico al file master.

---

## 1. Overview & Core Concept

- **Cosa Fa**:
  1. **Interfaccia e Funzioni Adobe Illustrator**: Riorganizza il Builder con la classica disposizione professionale di Illustrator: **Barra di Controllo Contestuale Superiore** (Allineamento, Pathfinder, Undo/Redo, Righelli, Griglia, Riempimento/Traccia), **Dock Strumenti Verticale a Sinistra** (con scorciatoie da tastiera standard `V`, `A`, `P`, `B`, `Shift+B`, `T`, `M`, `L`, `I`, `H`, `Z`), **Tavola da Disegno (Artboard) con Righelli e Guide** al centro, e **Pannelli Studio Collassabili a Destra** (*Proprietà & Trasforma*, *Carattere & Caselle di Testo*, *Tracciati & Pathfinder*, *Livelli & Asset Partner*).
  2. **Caselle di Testo (`Type Box Tool — T`) con Montserrat & Akena Otos**: Permette di cliccare o trascinare sul canvas per creare una Casella di Testo ridimensionabile con wrapping automatico o testo su punto, scegliendo esclusivamente tra **Montserrat** e **Akena Otos** e selezionando qualsiasi declinazione (da `100 Thin` a `900 Black`, normale o `Italic`), crenatura (`letter-spacing`), interlinea (`line-height`), allineamento (`Sinistra`, `Centro`, `Destra`), colore di riempimento, traccia contorno e filtro texture.
  3. **Macchia Blob Disegnata col Cursore**: Elimina il trascinamento a scatola rettangolare a favore del disegno libero col cursore/Apple Pencil, mostrando in tempo reale l'anteprima fluida della forma organica mentre muovi il puntatore in qualsiasi direzione.

---

## 2. User Experience & Visual Design

- **Architettura Workspace Stile Adobe Illustrator**:
  - **Barra di Controllo Contestuale (Top Control Bar)**:
    - Selettore Scheda Laboratorio attiva + Switch **Tema Adobe Dark Pro / Tema Kraft Studio**.
    - Cronologia **Annulla / Ripristina (`Undo` / `Redo`, `Ctrl+Z` / `Ctrl+Shift+Z`)** fino a 40 passaggi.
    - Controlli rapidi **Riempimento (`Fill`)** e **Traccia (`Stroke` + spessore + tratteggio)**.
    - Strumenti **Allinea & Distribuisci** sul canvas o tra livelli (Allinea a sinistra, centro orizzontale, destra, alto, centro verticale, basso).
    - Azioni **Elaborazione Tracciati (Pathfinder)**: *Unisci Forme*, *Sottrai Sopra*, *Converti in Forma Blob*, *Duplica*, *Rifletti Orizzontale/Verticale*.
    - Toggle **Righelli Pixel (`Rulers`)**, **Griglia di Precisione (`Grid`)** e **Guide Smart (`Smart Guides`)**.
  - **Toolbar Verticale Sinistra (Illustrator Tool Dock)**:
    - `V` — **Selezione (`Selection Tool`)**: seleziona, sposta, ruota e scala tramite maniglie di trasformazione (Bounding Box con 8 anchor handles).
    - `A` — **Selezione Diretta Nodi (`Direct Selection Tool`)**: mostra i vertici/punti di ancoraggio del tracciato SVG selezionato e permette di trascinare i singoli nodi col cursore per deformare qualsiasi macchia o curva!
    - `P` — **Penna Bézier (`Pen Tool`)**: clicca punto per punto per creare tracciati vettoriali e forme poligonali/curve chiuse.
    - `Shift+B` — **Macchia Blob col Cursore (`Freeform Blob Lasso & Blob Brush`)**: disegna liberamente con il cursore qualsiasi sagoma organica chiusa o espandi una macchia esistente.
    - `B` — **Pennello Fluido Calligrafico (`Fluid Brush`)**: tratto sensibile a pressione Apple Pencil e velocità trackpad.
    - `T` — **Casella di Testo (`Text Box Tool`)**: crea e modifica caselle di testo con le famiglie **Montserrat** e **Akena Otos**.
    - `M` / `L` — **Forme Geometriche & Wavy Checkerboard**: Rettangolo/ Riquadro arrotondato, Ellisse, Poligono/Stella e Scacchiera Ondulata.
    - `S` — **Timbri Brand (`Stamps`)**: sigilli e ritagli Matisse.
    - `I` — **Contagocce (`Eyedropper`)**: campiona colore, font, peso e texture da qualsiasi elemento sul canvas.
- **Pannello Carattere & Casella di Testo (Montserrat & Akena Otos)**:
  - Selettore **Famiglia Font**:
    1. **Montserrat** (Sans-Serif Geometrico Contemporaneo)
    2. **Akena Otos** (Display Editoriale & Organico ad Alto Contrasto + supporto caricamento file `.otf`/`.ttf`/`.woff2` personalizzato)
  - Selettore **Declinazione (Peso & Stile)**:
    - `Thin (100)`, `Thin Italic (100i)`
    - `ExtraLight (200)`, `ExtraLight Italic (200i)`
    - `Light (300)`, `Light Italic (300i)`
    - `Regular (400)`, `Italic (400i)`
    - `Medium (500)`, `Medium Italic (500i)`
    - `SemiBold (600)`, `SemiBold Italic (600i)`
    - `Bold (700)`, `Bold Italic (700i)`
    - `ExtraBold (800)`, `ExtraBold Italic (800i)`
    - `Black (900)`, `Black Italic (900i)`
  - Controlli tipografici di precisione: Corpo (`fontSize`), Interlinea (`lineHeight`), Crenatura/Tracking (`letterSpacing`), Larghezza Casella di Testo (`textBoxWidth` per a-capo automatico), Allineamento (`left`, `center`, `right`), Trasformazione (` Normale`, `TUTTO MAIUSCOLO`, `tutto minuscolo`), Riempimento, Contorno e Texture SVG.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisione 1: Disegno Libero della Macchia Blob col Cursore (`generateFreeformCursorBlobPath`)**
  - *Approccio Scelto*: Quando l'utente muove il cursore o la Apple Pencil con lo strumento **Macchia Blob**:
    - In modalità **Lazo Forma Libera**, tutti i punti disegnati dal cursore vengono campionati, regolarizzati con smoothing iterativo di Chaikin + spline Catmull-Rom chiusa (`closedCatmullRomToBezier`) e opzionalmente arricchiti da micro-ondulazione organica regolabile (`Morbidezza Organica 0%–100%`), creando esattamente la sagoma perimetrale tracciata dall'utente.
    - In modalità **Pennello Blob Unione**, l'inviluppo del tratto disegnato col cursore (`getStroke` con raggio pieno e cap arrotondati) genera un poligono morbido chiuso che può fondersi in un unico tracciato composto con la macchia selezionata.
  - *Perché*: Offre libertà creativa totale (stelle morbide, sagome a C, isole asimmetriche, cornici organiche, ritagli stile Matisse) impossibile da ottenere con un generatore rettangolare.
- **Decisione 2: Tutte le Declinazioni di Montserrat e Akena Otos + Caricamento Font Master**
  - *Approccio Scelto*: Includere l'intera famiglia variabile **Montserrat** (`ital,wght@0,100..900;1,100..900`) e configurare la famiglia `@font-face` **Akena Otos** in tutte le sue declinazioni di peso (`100`–`900`) e stile (`normal` / `italic`), aggiungendo nel pannello Carattere un pulsante **"Carica file font Akena Otos / Custom (.otf, .ttf, .woff2)"** che registra il font tramite `FontFace` API del browser e lo salva in `localStorage` (base64 data URL) per mantenerlo sempre attivo.
  - *Perché*: Garantisce che tutte le 18 declinazioni di entrambi i font funzionino immediatamente e che, caricando il file `.otf`/`.ttf` originale di *Akena Otos*, ogni glifo rispecchi al 100% il file tipografico proprietario.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│                   Illustrator Control Bar (Top Contextual Bar)                     │
│  [Progetto Scheda] [Undo/Redo] [Fill/Stroke] [Align 6x] [Pathfinder] [Dark/Kraft]  │
├──────────┬──────────────────────────────────────────────────────┬──────────────────┤
│          │              Righello Orizzontale (px)               │ Pannelli Studio  │
│   Tool   ├────┬─────────────────────────────────────────────────┤ (Destra):        │
│   Dock   │ R  │                                                 │                  │
│ (Sin.)   │ i  │          Artboard Vettoriale Interattiva        │ • Carattere &    │
│          │ g  │                                                 │   Casella Testo  │
│ • [V] Sel│ h  │  • Bounding Box 8-Handle (Scala/Ruota)          │   - Montserrat   │
│ • [A] Nod│ e  │  • Editing Diretto Nodi (Trascina Vertici)      │   - Akena Otos   │
│ • [P] Pen│ l  │  • Lazo Macchia Blob a Mano Libera col Cursore  │   - 18 Pesi/Stili│
│ • [B]Blb │ l  │  • Caselle di Testo Ridimensionabili            │   - Upload .OTF  │
│ • [B] Brs│ o  │    (Montserrat & Akena Otos, 100..900 + Italic) │ • Trasforma &    │
│ • [T] Txt│    │  • Guide Smart & Griglia Vettoriale             │   Aspetto        │
│ • [M] Shp│ V  │                                                 │ • Pathfinder &   │
│ • [S] Stp│ e  │                                                 │   Nodi           │
│ • [I] Eye│ r  │                                                 │ • Livelli &      │
│ • [Z] Zm │ t  │                                                 │   Partner Kit    │
└──────────┴────┴─────────────────────────────────────────────────┴──────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│          Persistenza Automatica Multi-Device (localStorage + Cloud Firestore)      │
│  • Salva ogni elemento con fontFamily, fontWeight, fontStyleItalic, letterSpacing, │
│    lineHeight, textAlign, textBoxWidth, strokeColor, strokeWidth, points[]         │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Synchronization

1. **Estensione `VectorElement` (`src/types/erp.ts` + `src/firebase.ts` + `src/utils/roiCalculator.ts`)**:
   - Nuovi attributi tipografici per le Caselle di Testo:
     - `fontFamily?: 'Montserrat' | 'Akena Otos'`
     - `fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900`
     - `fontItalic?: boolean`
     - `letterSpacing?: number` (in em/px)
     - `lineHeight?: number` (es. `1.2`)
     - `textAlign?: 'left' | 'center' | 'right'`
     - `textTransform?: 'none' | 'uppercase' | 'lowercase'`
     - `textBoxWidth?: number` (larghezza della casella di testo per l'andata a capo automatica)
   - Nuovi attributi vettoriali stile Illustrator:
     - `strokeColor?: string`, `strokeWidth?: number`, `strokeDasharray?: string`
     - `flipX?: boolean`, `flipY?: boolean`
     - `controlPoints?: Array<{ x: number; y: number }>` (punti di ancoraggio modificabili con lo strumento **Selezione Diretta Nodi `A`** per deformare qualsiasi Macchia Blob o tracciato Penna dopo averlo disegnato!).
2. **Sincronizzazione Automatica Cloud Firestore**:
   - Tutti i nuovi campi tipografici e vettoriali vengono inclusi in `sanitizeVectorElementsList` e `parseVectorElementFromCloud` così che ogni casella di testo in **Montserrat** o **Akena Otos** e ogni **Macchia Blob** disegnata col cursore vengano salvate in automatico e ritrovate identiche su qualsiasi dispositivo.
