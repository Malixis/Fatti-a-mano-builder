# Persistenza Cloud Multi-Dispositivo: Fix Ripristino Scheda & Salvataggio Automatico del Builder Grafico

Questo piano risolve in modo definitivo il problema per cui le modifiche alla **Scheda Laboratorio** venivano ripristinate ai vecchi valori premendo **Salva su Account**, e introduce il **salvataggio automatico continuo e multi-dispositivo** per il **Builder Grafico**, facendo sì che ogni Scheda Laboratorio conservi la propria locandina vettoriale su tutti i dispositivi collegati all'Account Google.

## User Review & Critical Decisions

> [!IMPORTANT]
> Le scelte confermate garantiscono che nessuna modifica su Scheda, Partner, Inventario o Builder Grafico vada mai persa, né lavorando in locale né cambiando dispositivo (es. da Mac a iPad Pro).

- **Decisione Confermata 1 — Modalità di Salvataggio**: **Salvataggio automatico continuo (debounced) + bottone Salva manuale** con indicatore visivo di sincronizzazione Cloud e timestamp di ultimo salvataggio.
- **Decisione Confermata 2 — Architettura Progetti del Builder Grafico**: **Ogni Scheda Laboratorio conserva la propria locandina dedicata nel Builder** (`tpl-<workshopId>`), oltre agli appunti vettoriali (clipboard), dimensioni canvas e Partner selezionato. Passando da una Scheda Laboratorio all'altra, il Builder carica automaticamente il progetto grafico di quella scheda senza sovrascrivere le modifiche fatte manualmente dall'utente.

---

## 1. Overview & Core Concept

- **Diagnosi del Bug di Ripristino ("Salva Scheda ripristina le modifiche")**:
  1. **Conflitto Timestamp & Campi nelle Security Rules (`firestore.rules`)**: Durante l'aggiornamento di una scheda esistente, `saveWorkshopToCloud` inviava sempre `createdAt: serverTimestamp()` e il campo `calendarEventUrl`, mentre `firestore.rules` imponeva `incoming().createdAt == existing().createdAt` e un controllo rigoroso `hasOnly(...)` sulle chiavi ammesse.
  2. **Rollback della Cache Firestore (`onSnapshot`)**: Quando Firestore rifiutava la scrittura di aggiornamento (`update`), il listener in tempo reale `onSnapshot` emetteva un evento di rollback ripristinando nello stato React la vecchia versione salvata sul server e cancellando le modifiche appena digitate dall'utente.
  3. **Mancata Persistenza del Builder Grafico**: Gli elementi vettoriali del Builder (`canvasElements`, `clipboardAssets`, `canvasSize`) vivevano solo in memoria React volatile e non venivano né salvati in `localStorage` per singola scheda né sincronizzati automaticamente con la collezione Cloud `templates` all'accesso o al cambio dispositivo.
- **Key Value**:
  - **Zero Rollback delle Modifiche**: Sincronizzazione allineata tra payload sanitizzati, timestamp `createdAt` immutabile sugli aggiornamenti e regole `firestore.rules`, con protezione delle modifiche locali più recenti (`updatedAtMs`).
  - **Persistenza Totale del Builder Grafico per Scheda**: Ogni disegno a mano libera con Apple Pencil, testo texturizzato, spostamento livelli, cambio colore o asset Partner viene salvato istantaneamente in locale e sincronizzato automaticamente sul Cloud Firestore (`templates/tpl-{workshopId}`) dell'account Google connesso.

---

## 2. User Experience & Visual Design

- **Flusso Operativo Continuo (Lab Manager ↔ Builder Grafico ↔ Cambio Dispositivo)**:
  1. **Modifica nella Scheda Laboratorio**: Ogni modifica a titolo, fasi operative, partner, data o calcolatore aggiorna immediatamente il timestamp locale e avvia il salvataggio automatico (con debounce di 700ms) su Cloud Firestore senza mai subire rollback da vecchi snapshot.
  2. **Modifica nel Builder Grafico o Font & Texture**: Qualsiasi tratto disegnato, timbro inserito, testo texturizzato o ridimensionamento canvas viene associato alla Scheda Laboratorio attiva e salvato automaticamente sia su `localStorage` sia sulla collezione Cloud `templates` dell'utente.
  3. **Passaggio tra Schede o Uso di "Genera Locandina"**:
     - Selezionando una Scheda Laboratorio diversa, il Builder mostra automaticamente la locandina associata a quella scheda.
     - Premendo **Genera Locandina (1080×1350)** dalla scheda, se l'utente ha già personalizzato la locandina nel Builder, i testi (Titolo, Prezzo, Data, Location, Partner) vengono aggiornati preservando i disegni e i livelli aggiunti dall'utente, con possibilità di rigenerare da zero il layout se desiderato.
  4. **Accesso da un Nuovo Dispositivo (es. iPad Pro)**: Appena effettuato l'accesso con Google, l'app scarica schede, partner, inventario e tutte le locandine del Builder (`subscribeUserTemplates`), fondendo eventuali modifiche locali più recenti senza mai sovrascriverle con dati più vecchi.
- **Visual Identity & Theme**:
  - **Palette Brand-Safe**: Sfondo Beige Kraft (`#EADDCD`), superfici strutturali Avorio Carta (`#F4ECE1`), testo principale Blu Notte (`#1A2B4C`), accenti operativi Terracotta (`#B85B43`), Verde Bosco (`#4A6B53`) e Ocra (`#D4A373`).
  - **Feedback di Stato Non Intrusivo**: Indicatore testuale sobrio nella barra della Scheda e del Builder (`"Salvato in automatico · Cloud sincronizzato"`) senza popup bloccanti.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisione 1: Gestione Immutabile di `createdAt` e Allineamento Schema Firestore**
  - *Approccio Scelto*: Conservare `createdAt` originale quando il documento esiste già (usando `setDoc` con verifica o preservazione dei campi immutabili e aggiornando `firestore.rules` e `firebase-blueprint.json` in perfetto sincronismo) + aggiungere un timestamp numerico `clientUpdatedAt` per risolvere eventuali conflitti tra stato locale e snapshot cloud.
  - *Perché*: Impedisce che le regole di sicurezza rifiutino gli aggiornamenti successivi al primo salvataggio e garantisce che `onSnapshot` non sovrascriva mai modifiche locali più recenti.
- **Decisione 2: Mappa Locandine per Scheda (`designsByWorkshopId`) con Auto-Sync Cloud**
  - *Approccio Scelto*: Archiviare un dizionario indicizzato per `workshopId` contenente `{ elements, clipboard, width, height, presetId, partnerId, clientUpdatedAt }`, persistito in `localStorage` e sincronizzato con la collezione Firestore `/templates/tpl-{workshopId}` tramite listener real-time `subscribeUserTemplates` e salvataggio automatico debounced.
  - *Perché*: Permette di lavorare su più laboratori contemporaneamente (es. "Paint & Wine", "Rilega il tuo Diario", "Ceramica & Calici") ritrovando su qualsiasi dispositivo la locandina esatta di ciascun laboratorio.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                        App State & Sync Engine (App.tsx)                     │
│  • workshops[] + activeWorkshopId                                            │
│  • designsByWorkshopId[workshopId] (elements, clipboard, size, partnerId)    │
│  • partners[] & inventory[]                                                  │
│  • Auto-Save Debouncer (700ms) + Manual Save ("Salva su Account / Cloud")    │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │                                              │
                ▼                                              ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────┐
│     Persistenza Locale Immediata        │  │  Cloud Firestore Sync (Auth)    │
│  • localStorage (v3 keys + timestamps)  │  │  • /workshops/{id}              │
│  • Ripristino istantaneo offline/reload │  │  • /templates/tpl-{workshopId}  │
│  • Protezione anti-rollback su input    │  │  • /partners/{id}               │
└───────────────┬─────────────────────────┘  │  • /inventory/{id}              │
                │                            └─────────────────┬───────────────┘
                └──────────────────────┬───────────────────────┘
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 Moduli Operativi Sincronizzati Multi-Device                  │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────┐  │
│  │    LabManager ERP      │  │    GraphicBuilder      │  │ Font & Texture │  │
│  │ • Scheda + Fasi + ROI  │  │ • Canvas SVG per Lab   │  │ • Iniezione    │  │
│  │ • Ponte Data-Binding   │  │ • Livelli + Clipboard  │  │   diretta nel  │  │
│  │   preserva disegni     │  │ • Auto-save ogni tratto│  │   design attivo│  │
│  └────────────────────────┘  └────────────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Synchronization

1. **Allineamento `firebase-blueprint.json` + `firestore.rules` + Sanitizzazione**:
   - Ogni entità (`Workshop`, `Partner`, `InventoryItem`, `DesignTemplate`) include `clientUpdatedAt` (numero millisecondi) e tutte le chiavi effettivamente inviate dal client (`calendarEventUrl`, `unitCost`, `totalPiecesOrdered`, `piecesUsedTotal`, `piecesAvailable`, `clipboard`, `workshopId`, `partnerId`).
   - Nelle regole `firestore.rules`, le operazioni `create` e `update` validano lo schema completo e consentono l'aggiornamento atomico tramite `setDoc` mantenendo l'isolamento per `ownerId == request.auth.uid`.
2. **Sincronizzazione Intelligente Stato Locale ↔ Cloud (`onSnapshot`)**:
   - Quando l'utente modifica un campo nella Scheda Laboratorio o sposta/disegna un elemento nel Builder Grafico, viene aggiornato `clientUpdatedAt = Date.now()`.
   - Quando arriva un aggiornamento da `subscribeUserWorkshops` o `subscribeUserTemplates`, il sistema confronta `cloudDoc.clientUpdatedAt` con `localDoc.clientUpdatedAt`: se la versione locale è più recente (es. l'utente sta scrivendo o ha appena salvato), mantiene la versione locale e la spinge sul Cloud, evitando qualsiasi ripristino involontario.
   - Al primo login su un nuovo dispositivo (dove lo stato locale contiene solo i dati demo di default con `clientUpdatedAt = 0`), i documenti scaricati da Firestore sostituiscono immediatamente i dati demo caricando sia le Schede Laboratorio sia le rispettive locandine del Builder Grafico.
