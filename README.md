# Fatti a mano — Lab & Design ERP

Web-App gestionale ed editor vettoriale cross-device (ottimizzato per **Mac/PC Trackpad** e **iPad Pro + Apple Pencil**) per la gestione a 360° dei laboratori creativi edutainment **Fatti a mano**.

---

## Pubblicazione Automatica su GitHub Pages (GitHub Actions)

Il repository include già tutti i file necessari per il deploy automatico tramite **GitHub Actions**:

- `.github/workflows/deploy.yml`: esegue i test unitari (`src/utils/erpLogic.test.ts`), controlla i tipi TypeScript (`npm run lint`), compila il bundle di produzione con percorsi relativi (`GITHUB_PAGES=true npm run build`), prepara `404.html` + `.nojekyll` e pubblica su **GitHub Pages**.
- `vite.config.ts`: imposta automaticamente `base: './'` quando viene eseguito da GitHub Actions, rendendo il sito compatibile con qualsiasi nome di repository (`https://<tuo-username>.github.io/<nome-repo>/`).
- `src/utils/aiClient.ts`: garantisce il funzionamento dell'assistente IA sia con server Node.js attivo sia su hosting statico GitHub Pages.

### Passaggi per attivare la pubblicazione sul tuo repository GitHub

1. **Sincronizza / fai Push del codice sul repository GitHub** (dalla barra in alto di AI Studio clicca sull'icona GitHub per fare commit & push sul tuo repository collegato, oppure da terminale `git push origin main`).
2. **Abilita GitHub Actions nelle impostazioni di GitHub Pages**:
   - Apri il tuo repository su GitHub.
   - Vai in **Settings** → **Pages** (nel menu laterale sinistro).
   - Sotto **Build and deployment** → **Source**, seleziona **GitHub Actions**.
3. **Autorizza il dominio GitHub Pages su Firebase (per Login Google & Calendar)**:
   - Apri la [Firebase Console](https://console.firebase.google.com/) sul progetto collegato (`gen-lang-client-0326884444`).
   - Vai in **Authentication** → **Settings** → **Authorized domains** e aggiungi `<tuo-username>.github.io`.
4. **(Opzionale) Configura la chiave Gemini nei Secrets di GitHub**:
   - Nel repository GitHub vai in **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Nome: `GEMINI_API_KEY` — Valore: la tua chiave API Google Gemini.

---

## Sviluppo Locale

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo (porta 3000)
npm run dev

# Esegui i test unitari (calcolatore ROI, inventario format e matematica vettoriale)
npx tsx --test src/utils/erpLogic.test.ts

# Esegui la build di produzione per GitHub Pages
GITHUB_PAGES=true npm run build
```
