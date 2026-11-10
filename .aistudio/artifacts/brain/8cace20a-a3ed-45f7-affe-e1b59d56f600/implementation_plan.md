# Risoluzione Errore `Firebase: Error (auth/unauthorized-domain)` su GitHub Pages

## Perché compare questo errore?
Per motivi di sicurezza, **Firebase Authentication** accetta il login con Google solo dai domini esplicitamente autorizzati nel tuo progetto Firebase (`gen-lang-client-0326884444`). Di default sono autorizzati `localhost` e l'anteprima di AI Studio (`*.run.app`), ma **non** il dominio pubblico di GitHub Pages (`<tuo-username>.github.io`).

---

## 1. Come risolverlo in 30 secondi nella Console Firebase
1. Apri direttamente la pagina **Impostazioni Authentication** del tuo progetto Firebase cliccando qui:
   👉 **[Apri Firebase Console — Authentication Settings (gen-lang-client-0326884444)](https://console.firebase.google.com/project/gen-lang-client-0326884444/authentication/settings)**
2. Scorri o seleziona la scheda **Domini autorizzati** (*Authorized domains*).
3. Clicca sul pulsante **Aggiungi dominio** (*Add domain*).
4. Inserisci il tuo dominio GitHub Pages (solo il dominio principale, **senza** `https://` e **senza** `/Fatti-a-mano-builder`):
   - Esempio: `tuo-username.github.io`
5. Clicca su **Aggiungi** (*Add*). L'attivazione è istantanea: ricarica la pagina su GitHub Pages e il pulsante **Accedi con Google** funzionerà subito.

---

## 2. Miglioramento Automatico nell'Applicazione (Piano di Implementazione)
Per rendere la configurazione ancora più immediata direttamente dentro il sito pubblicato su GitHub Pages, aggiorneremo l'applicazione con:

- **Rilevamento Automatico dell'Errore `auth/unauthorized-domain` (`src/firebase.ts` & `src/App.tsx`)**:
  - Quando clicchi su **Accedi con Google** o **Sincronizza su Google Calendar** da un nuovo dominio (come GitHub Pages) non ancora autorizzato, invece di bloccarsi silenziosamente, l'app aprirà una **Finestra Guidata di Autorizzazione Dominio**.
- **Copia Dominio in 1 Clic + Link Diretto al Progetto Firebase**:
  - La finestra rileverà automaticamente il dominio esatto da cui stai aprendo il sito (`window.location.hostname`, es. `tuo-username.github.io`), permettendoti di copiarlo con un clic e di aprire direttamente la schermata **Authorized domains** del progetto `gen-lang-client-0326884444`.
- **Fallback con Redirect (`signInWithRedirect`) se il Popup viene bloccato su iPad Safari**:
  - Se il browser su iPad o iPhone blocca l'apertura del popup (`auth/popup-blocked`), l'app proporrà o avvierà automaticamente il flusso alternativo compatibile.
