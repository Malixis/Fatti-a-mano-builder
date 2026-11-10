import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  GitBranch,
  Layers,
  Terminal,
} from 'lucide-react';

const GITHUB_WORKFLOW_SNIPPET = `name: Deploy Fatti a mano ERP to GitHub Pages

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install --legacy-peer-deps
      - run: npx tsx --test src/utils/erpLogic.test.ts
      - run: npm run lint
      - name: Build production bundle for GitHub Pages
        env:
          GITHUB_PAGES: 'true'
          VITE_GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
        run: |
          npm run build
          cp dist/index.html dist/404.html
          touch dist/.nojekyll
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4`;

export const SetupArchitectureView: React.FC = () => {
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  const handleCopyWorkflow = () => {
    navigator.clipboard?.writeText(GITHUB_WORKFLOW_SNIPPET).catch(() => {});
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 2200);
  };

  const baseUrl = import.meta.env.BASE_URL || '/';

  return (
    <div className="space-y-6">
      <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-6 space-y-6">
        <div className="border-b border-[#1A2B4C]/10 pb-4">
          <h2
            className="text-2xl font-bold text-[#1A2B4C]"
            style={{ fontFamily: '"Fraunces", serif' }}
          >
            Setup Locale, Pubblicazione GitHub Actions &amp; Architettura Tecnica
          </h2>
          <p className="text-sm text-[#1A2B4C]/75 mt-1">
            Il progetto include già tutti i file pronti per il deploy automatico su GitHub Pages tramite GitHub Actions (`.github/workflows/deploy.yml`, `public/.nojekyll` e `vite.config.ts`).
          </p>
        </div>

        {/* Sezione Deploy GitHub Actions */}
        <div
          data-testid="github-actions-guide"
          className="p-5 bg-[#EADDCD]/80 border border-[#B85B43]/35 rounded-xl space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#B85B43]">
              <GitBranch className="w-4 h-4" />
              <span>01. Pubblicazione Automatica con GitHub Actions (File Già Creati nel Repo)</span>
            </div>
            <button
              type="button"
              onClick={handleCopyWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A2B4C] text-[#EADDCD] rounded-lg text-xs font-semibold hover:bg-[#1A2B4C]/90 transition-colors"
            >
              {copiedWorkflow ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#D4A373]" />
                  <span>Workflow YAML Copiato</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copia .github/workflows/deploy.yml</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-5 space-y-2.5 text-xs text-[#1A2B4C]">
              <div className="p-3 bg-[#F4ECE1] rounded-lg border border-[#1A2B4C]/15 space-y-1.5">
                <div className="font-bold text-[#1A2B4C]">
                  Passaggio A — Attiva GitHub Actions su GitHub Pages
                </div>
                <p className="text-[#1A2B4C]/80 leading-relaxed">
                  Nel tuo repository GitHub vai su <strong>Settings &rarr; Pages</strong> e sotto{' '}
                  <strong>Build and deployment &rarr; Source</strong> seleziona{' '}
                  <strong className="text-[#B85B43]">GitHub Actions</strong>.
                </p>
              </div>

              <div className="p-3 bg-[#F4ECE1] rounded-lg border border-[#1A2B4C]/15 space-y-1.5">
                <div className="font-bold text-[#1A2B4C]">
                  Passaggio B — Autorizza il dominio GitHub su Firebase Auth
                </div>
                <p className="text-[#1A2B4C]/80 leading-relaxed">
                  Per far funzionare <strong>Accedi con Google</strong> e <strong>Google Calendar</strong> sul sito pubblicato, apri la{' '}
                  <strong>Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains</strong> e aggiungi il tuo dominio{' '}
                  <code className="font-mono bg-[#EADDCD] px-1 py-0.5 rounded">
                    tuo-username.github.io
                  </code>.
                </p>
              </div>

              <div className="p-3 bg-[#F4ECE1] rounded-lg border border-[#1A2B4C]/15 space-y-1.5">
                <div className="font-bold text-[#1A2B4C]">
                  Passaggio C — (Opzionale) Secret GEMINI_API_KEY
                </div>
                <p className="text-[#1A2B4C]/80 leading-relaxed">
                  In <strong>Settings &rarr; Secrets and variables &rarr; Actions</strong> puoi aggiungere{' '}
                  <code className="font-mono bg-[#EADDCD] px-1 py-0.5 rounded">GEMINI_API_KEY</code>. Anche senza secret, il motore IA ha un fallback locale integrato.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7">
              <pre className="p-3.5 rounded-xl bg-[#1A2B4C] text-[#EADDCD] font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                {GITHUB_WORKFLOW_SNIPPET}
              </pre>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Comandi da Terminale */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#B85B43]">
              <Terminal className="w-4 h-4" />
              <span>02. Comandi Git &amp; Sviluppo Locale</span>
            </div>
            <pre className="p-4 rounded-xl bg-[#1A2B4C] text-[#EADDCD] font-mono text-xs overflow-x-auto leading-relaxed">
{`# 1. Esegui il push sul tuo repository GitHub collegato
git add .
git commit -m "Deploy Fatti a mano Lab & Design ERP"
git push origin main

# 2. (Sviluppo in locale) Installa dipendenze e avvia
npm install
npm run dev

# 3. Test di build statica identica a GitHub Actions
GITHUB_PAGES=true npm run build`}
            </pre>
          </div>

          {/* Architettura dei Componenti Principali */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#4A6B53]">
              <Layers className="w-4 h-4" />
              <span>03. Architettura Componenti &amp; File Creati</span>
            </div>
            <div className="space-y-2.5 text-xs text-[#1A2B4C]">
              <div className="p-3 bg-[#EADDCD]/70 rounded-lg border border-[#1A2B4C]/15">
                <div className="font-mono font-bold text-[#1A2B4C]">
                  .github/workflows/deploy.yml &amp; vite.config.ts
                </div>
                <p className="text-[#1A2B4C]/80 mt-0.5">
                  Pipeline CI/CD che esegue i test unitari ERP, verifica i tipi TypeScript, compila il bundle con base relativa (<code className="font-mono">base: &apos;./&apos;</code>), genera <code className="font-mono">404.html</code> e <code className="font-mono">.nojekyll</code> e pubblica automaticamente su GitHub Pages.
                </p>
              </div>

              <div className="p-3 bg-[#EADDCD]/70 rounded-lg border border-[#1A2B4C]/15">
                <div className="font-mono font-bold text-[#1A2B4C]">
                  src/components/GraphicBuilder.tsx &amp; FontTextureEngine.tsx
                </div>
                <p className="text-[#1A2B4C]/80 mt-0.5">
                  Canvas vettoriale SVG cross-device con Pointer Events API (Apple Pencil pressure + Trackpad velocity), dropdown Partner Brand Kit automatico, filtri texture SVG e livelli Z-Index.
                </p>
              </div>

              <div className="p-3 bg-[#EADDCD]/70 rounded-lg border border-[#1A2B4C]/15">
                <div className="font-mono font-bold text-[#1A2B4C]">
                  src/components/LabManager.tsx &amp; src/firebase.ts
                </div>
                <p className="text-[#1A2B4C]/80 mt-0.5">
                  ERP con Gestione Partner, sincronizzazione Google Calendar OAuth, fasi operative dinamiche con miglioramento IA, calcolatore Collegato/Scollegato (Confezioni × Pezzi) e Inventario Totale del Format su Cloud Firestore.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Showcase degli Asset Brand Caricati */}
        <div className="pt-4 border-t border-[#1A2B4C]/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A2B4C]">
              <Cpu className="w-4 h-4 text-[#B85B43]" />
              <span>04. Tavole di Riferimento Brand &ldquo;Fatti a mano&rdquo; Integrate</span>
            </div>
            <span className="text-xs text-[#1A2B4C]/70">
              Palette: #EADDCD · #B85B43 · #4A6B53 · #D4A373 · #1A2B4C
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#EADDCD] border border-[#1A2B4C]/15 rounded-xl p-3 space-y-2">
              <img
                src={`${baseUrl}assets/aistudio/Gemini_Generated_Image_p48yjdp48yjdp48y_dac7fe9f.jpeg`}
                alt="Abaco elementi vettoriali Fatti a mano: foglie Matisse, Wavy Checkerboard, timbri circolari e macchie"
                referrerPolicy="no-referrer"
                className="w-full h-56 object-cover rounded-lg border border-[#1A2B4C]/10"
              />
              <div className="flex items-center justify-between text-xs text-[#1A2B4C]">
                <span className="font-semibold">
                  Abaco Vettoriale: Timbri, Foglie Matisse &amp; Wavy Checkerboard
                </span>
                <span className="flex items-center gap-1 text-[#4A6B53] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Attivo nel Builder
                </span>
              </div>
            </div>

            <div className="bg-[#EADDCD] border border-[#1A2B4C]/15 rounded-xl p-3 space-y-2">
              <img
                src={`${baseUrl}assets/aistudio/Gemini_Generated_Image_65e3b465e3b465e3_af5b8320.jpeg`}
                alt="Riferimento tipografico Fatti a mano con lettering organico arrotondato"
                referrerPolicy="no-referrer"
                className="w-full h-56 object-cover rounded-lg border border-[#1A2B4C]/10"
              />
              <div className="flex items-center justify-between text-xs text-[#1A2B4C]">
                <span className="font-semibold">
                  Specimen Tipografico: Lettering Morbido &amp; Riempimento Materico
                </span>
                <span className="flex items-center gap-1 text-[#4A6B53] font-medium">
                  <Code2 className="w-3.5 h-3.5" /> Attivo in Font &amp; Texture
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
