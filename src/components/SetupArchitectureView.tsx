import React from 'react';
import { CheckCircle2, Code2, Cpu, Layers, Terminal } from 'lucide-react';

export const SetupArchitectureView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-6 space-y-4">
        <div className="border-b border-[#1A2B4C]/10 pb-4">
          <h2
            className="text-2xl font-bold text-[#1A2B4C]"
            style={{ fontFamily: '"Fraunces", serif' }}
          >
            Setup Completo Applicazione Locale & Architettura Tecnica
          </h2>
          <p className="text-sm text-[#1A2B4C]/75 mt-1">
            Guida operativa per eseguire o estendere in locale &ldquo;Fatti a mano — Lab &amp; Design ERP&rdquo; su Mac, PC e iPad Pro (tramite rete locale).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Comandi da Terminale */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#B85B43]">
              <Terminal className="w-4 h-4" />
              <span>01. Comandi da Terminale (Setup & Avvio)</span>
            </div>
            <pre className="p-4 rounded-xl bg-[#1A2B4C] text-[#EADDCD] font-mono text-xs overflow-x-auto leading-relaxed">
{`# 1. Crea il progetto (Vite + React + TypeScript)
npm create vite@latest fatti-a-mano-erp -- --template react-ts
cd fatti-a-mano-erp

# 2. Installa il motore vettoriale, PDF, Firebase e Google Gemini SDK
npm install perfect-freehand jspdf html2canvas firebase @google/genai lucide-react express dotenv

# 3. Installa Tailwind CSS e i tipi TypeScript
npm install -D tailwindcss @tailwindcss/vite tsx @types/express @types/node

# 4. Configura la chiave API Gemini in .env
echo 'GEMINI_API_KEY="LA_TUA_CHIAVE_GEMINI"' > .env

# 5. Avvia il server full-stack (accessibile anche da iPad Pro su Wi-Fi)
npm run dev`}
            </pre>
          </div>

          {/* Architettura dei Componenti Principali */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#4A6B53]">
              <Layers className="w-4 h-4" />
              <span>02. Architettura Componenti & Flusso Dati</span>
            </div>
            <div className="space-y-2.5 text-xs text-[#1A2B4C]">
              <div className="p-3 bg-[#EADDCD]/70 rounded-lg border border-[#1A2B4C]/15">
                <div className="font-mono font-bold text-[#1A2B4C]">
                  src/components/GraphicBuilder.tsx
                </div>
                <p className="text-[#1A2B4C]/80 mt-0.5">
                  Canvas vettoriale SVG cross-device con preset (1080×1080, 1080×1350, A4), Pointer Events API (`pointerdown`, `pointermove`, `pointerup`), sensibilità alla pressione per Apple Pencil, dinamica velocity-to-width per Trackpad, palm-rejection e gestione livelli Z-Index + Copia/Incolla.
                </p>
              </div>

              <div className="p-3 bg-[#EADDCD]/70 rounded-lg border border-[#1A2B4C]/15">
                <div className="font-mono font-bold text-[#1A2B4C]">
                  src/components/FontTextureEngine.tsx
                </div>
                <p className="text-[#1A2B4C]/80 mt-0.5">
                  Motore di scrittura ibrida (Tastiera con font serif/display oppure mano libera con Apple Pencil) convertito in tracciati SVG con filtri procedurali (`feTurbulence` + `feDisplacementMap`) per Pennellata Ruvida, Porosità Inchiostro, Cianotipia e Riempimento Materico Blob.
                </p>
              </div>

              <div className="p-3 bg-[#EADDCD]/70 rounded-lg border border-[#1A2B4C]/15">
                <div className="font-mono font-bold text-[#1A2B4C]">
                  src/components/LabManager.tsx &amp; src/utils/roiCalculator.ts
                </div>
                <p className="text-[#1A2B4C]/80 mt-0.5">
                  ERP per laboratori creativi diviso in 3 fasi operative, tabella dinamica costi Fissi vs. Variabili, calcolo automatico Utile Serata 1 vs. Serate Successive, esportazione Packing List PDF, Data-Binding automatico locandina 1080×1350 e integrazione server-side Google Gemini API.
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
              <span>03. Tavole di Riferimento Brand &ldquo;Fatti a mano&rdquo; Integrate</span>
            </div>
            <span className="text-xs text-[#1A2B4C]/70">
              Palette: #EADDCD · #B85B43 · #4A6B53 · #D4A373 · #1A2B4C
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#EADDCD] border border-[#1A2B4C]/15 rounded-xl p-3 space-y-2">
              <img
                src="/assets/aistudio/Gemini_Generated_Image_p48yjdp48yjdp48y_dac7fe9f.jpeg"
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
                src="/assets/aistudio/Gemini_Generated_Image_65e3b465e3b465e3_af5b8320.jpeg"
                alt="Riferimento tipografico Fatti a mano con lettering organico arrotondato"
                referrerPolicy="no-referrer"
                className="w-full h-56 object-cover rounded-lg border border-[#1A2B4C]/10"
              />
              <div className="flex items-center justify-between text-xs text-[#1A2B4C]">
                <span className="font-semibold">
                  Specimen Tipografico: Lettering Morbido &amp; Riempimento Materico
                </span>
                <span className="flex items-center gap-1 text-[#4A6B53] font-medium">
                  < Code2 className="w-3.5 h-3.5" /> Attivo in Font &amp; Texture
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
