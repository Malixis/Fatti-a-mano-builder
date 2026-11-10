import React, { useRef, useState } from 'react';
import {
  BRAND_PALETTE,
  BrandColorHex,
  FontStyleId,
  PointerSample,
  TextureFilterType,
  VectorElement,
} from '../types/erp';
import {
  computeSamplePressure,
  generateSmoothedBrushPath,
  generateTextVectorBackdropPath,
} from '../utils/vectorMath';
import { SvgTextureDefs, getFilterUrl } from './SvgTextureDefs';
import { Check, Eraser, PenTool, Sparkles, Type as TypeIcon, Undo2 } from 'lucide-react';

interface FontTextureEngineProps {
  onInsertElement: (element: VectorElement) => void;
  onAddToClipboard: (element: VectorElement) => void;
  canvasCenter: { x: number; y: number };
}

const TEXTURE_OPTIONS: Array<{
  id: TextureFilterType;
  label: string;
  desc: string;
}> = [
  {
    id: 'ink-porosity',
    label: 'Porosità Inchiostro',
    desc: 'Micro-foratura da timbro su carta cotone',
  },
  {
    id: 'rough-brush',
    label: 'Pennellata Ruvida',
    desc: 'Bordo frastagliato a setola asciutta',
  },
  {
    id: 'cyanotype',
    label: 'Effetto Cianotipia',
    desc: 'Viraggio solare Blu di Prussia e fibra UV',
  },
  {
    id: 'materic-blob',
    label: 'Riempimento Materico Blob',
    desc: 'Sagoma organica ritagliata a mano',
  },
  {
    id: 'none',
    label: 'Vettoriale Nitido',
    desc: 'Curva Bezier pura senza distorsione',
  },
];

const FONT_STYLE_OPTIONS: Array<{
  id: FontStyleId;
  label: string;
  cssFont: string;
  sample: string;
}> = [
  {
    id: 'editorial-serif',
    label: 'Fraunces Serif Editoriale',
    cssFont: '"Fraunces", Georgia, serif',
    sample: 'Fatti a mano',
  },
  {
    id: 'craft-rounded',
    label: 'Bricolage Display Morbido',
    cssFont: '"Bricolage Grotesque", sans-serif',
    sample: 'FATTI A MANO',
  },
  {
    id: 'mono-label',
    label: 'JetBrains Mono Tecnico',
    cssFont: '"JetBrains Mono", monospace',
    sample: 'LAB · 20€',
  },
];

export const FontTextureEngine: React.FC<FontTextureEngineProps> = ({
  onInsertElement,
  onAddToClipboard,
  canvasCenter,
}) => {
  const [inputMode, setInputMode] = useState<'keyboard' | 'freehand'>('keyboard');
  const [typedText, setTypedText] = useState<string>('Fatti a mano\nBotanica & Vino');
  const [fontStyle, setFontStyle] = useState<FontStyleId>('editorial-serif');
  const [fontSize, setFontSize] = useState<number>(64);
  const [primaryColor, setPrimaryColor] = useState<BrandColorHex>('#1A2B4C');
  const [secondaryColor, setSecondaryColor] = useState<BrandColorHex>('#B85B43');
  const [selectedTexture, setSelectedTexture] = useState<TextureFilterType>('ink-porosity');
  const [brushWeight, setBrushWeight] = useState<number>(18);

  // Stato per il disegno di lettere a mano libera (Apple Pencil / Trackpad)
  const [drawnStrokes, setDrawnStrokes] = useState<string[]>([]);
  const [activeStrokeSamples, setActiveStrokeSamples] = useState<PointerSample[]>([]);
  const [lastPointerType, setLastPointerType] = useState<string>('mouse');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const padSvgRef = useRef<SVGSVGElement | null>(null);
  const isDrawingRef = useRef(false);

  const getPadPoint = (e: React.PointerEvent<SVGSVGElement>): PointerSample => {
    const svg = padSvgRef.current;
    if (!svg) {
      return { x: 0, y: 0, pressure: 0.5, timestamp: performance.now(), pointerType: 'mouse' };
    }
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 760;
    const y = ((e.clientY - rect.top) / rect.height) * 320;
    const prev =
      activeStrokeSamples.length > 0 ? activeStrokeSamples[activeStrokeSamples.length - 1] : null;
    const pointerType =
      e.pointerType === 'pen' || e.pointerType === 'touch' ? e.pointerType : 'mouse';
    const pressure = computeSamplePressure(prev, {
      x,
      y,
      pressure: e.pressure,
      timestamp: e.timeStamp || performance.now(),
      pointerType,
    });
    return {
      x,
      y,
      pressure,
      timestamp: e.timeStamp || performance.now(),
      pointerType,
    };
  };

  const handlePadPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setLastPointerType(e.pointerType || 'mouse');
    isDrawingRef.current = true;
    const pt = getPadPoint(e);
    setActiveStrokeSamples([pt]);
  };

  const handlePadPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getPadPoint(e);
    setActiveStrokeSamples((prev) => [...prev, pt]);
  };

  const handlePadPointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (activeStrokeSamples.length > 1) {
      const { pathData } = generateSmoothedBrushPath(activeStrokeSamples, brushWeight, 2);
      if (pathData) {
        setDrawnStrokes((prev) => [...prev, pathData]);
      }
    }
    setActiveStrokeSamples([]);
  };

  const currentLivePath =
    activeStrokeSamples.length > 1
      ? generateSmoothedBrushPath(activeStrokeSamples, brushWeight, 1).pathData
      : '';

  const buildVectorElementFromCurrent = (): VectorElement => {
    if (inputMode === 'freehand' && drawnStrokes.length > 0) {
      const combinedPath = drawnStrokes.join(' ');
      return {
        id: `glyph-hand-${Date.now()}`,
        name: `Lettere a Mano (${selectedTexture})`,
        type: 'textured-text',
        x: canvasCenter.x,
        y: canvasCenter.y,
        width: 560,
        height: 240,
        rotation: 0,
        scale: 1,
        color: primaryColor,
        secondaryColor,
        opacity: 1,
        zIndex: Date.now() % 1000,
        visible: true,
        locked: false,
        pathData: combinedPath,
        textureType: selectedTexture,
        isHandDrawnText: true,
        fontStyle: 'freehand-glyphs',
      };
    }

    const backdrop = generateTextVectorBackdropPath(
      typedText,
      canvasCenter.x,
      canvasCenter.y,
      fontSize,
      selectedTexture
    );

    return {
      id: `txt-vec-${Date.now()}`,
      name: `Testo: ${typedText.split('\n')[0].slice(0, 22)}`,
      type: 'textured-text',
      x: canvasCenter.x,
      y: canvasCenter.y,
      width: backdrop.width,
      height: backdrop.height,
      rotation: 0,
      scale: 1,
      color: primaryColor,
      secondaryColor,
      opacity: 1,
      zIndex: Date.now() % 1000,
      visible: true,
      locked: false,
      pathData: backdrop.pathData,
      textureType: selectedTexture,
      textContent: typedText,
      fontStyle,
      fontSize,
      isHandDrawnText: false,
    };
  };

  const handleInsertToCanvas = () => {
    const el = buildVectorElementFromCurrent();
    onInsertElement(el);
    setFeedbackToast('Tracciato testuale texturizzato inserito sul Canvas!');
    setTimeout(() => setFeedbackToast(null), 2600);
  };

  const handleSaveToClipboard = () => {
    const el = buildVectorElementFromCurrent();
    onAddToClipboard(el);
    setFeedbackToast('Salvato nella Clipboard vettoriale (pronto per Incolla)');
    setTimeout(() => setFeedbackToast(null), 2600);
  };

  const loadPresetHandCalligraphy = () => {
    // Carica una scritta calligrafica "Fatti a mano" pre-tracciata con curve organiche
    const s1 = generateSmoothedBrushPath(
      [
        { x: 110, y: 210, pressure: 0.7, timestamp: 0, pointerType: 'pen' },
        { x: 115, y: 95, pressure: 0.9, timestamp: 20, pointerType: 'pen' },
        { x: 175, y: 92, pressure: 0.6, timestamp: 40, pointerType: 'pen' },
      ],
      18,
      2
    ).pathData;
    const s2 = generateSmoothedBrushPath(
      [
        { x: 108, y: 152, pressure: 0.6, timestamp: 0, pointerType: 'pen' },
        { x: 158, y: 148, pressure: 0.7, timestamp: 20, pointerType: 'pen' },
      ],
      15,
      2
    ).pathData;
    const s3 = generateSmoothedBrushPath(
      [
        { x: 210, y: 195, pressure: 0.5, timestamp: 0, pointerType: 'pen' },
        { x: 245, y: 125, pressure: 0.85, timestamp: 20, pointerType: 'pen' },
        { x: 280, y: 198, pressure: 0.7, timestamp: 40, pointerType: 'pen' },
        { x: 330, y: 110, pressure: 0.9, timestamp: 60, pointerType: 'pen' },
        { x: 345, y: 198, pressure: 0.6, timestamp: 80, pointerType: 'pen' },
        { x: 410, y: 112, pressure: 0.85, timestamp: 100, pointerType: 'pen' },
        { x: 420, y: 198, pressure: 0.65, timestamp: 120, pointerType: 'pen' },
        { x: 485, y: 135, pressure: 0.8, timestamp: 140, pointerType: 'pen' },
        { x: 545, y: 195, pressure: 0.75, timestamp: 160, pointerType: 'pen' },
        { x: 625, y: 155, pressure: 0.5, timestamp: 180, pointerType: 'pen' },
      ],
      17,
      2
    ).pathData;
    setDrawnStrokes([s1, s2, s3]);
  };

  const activeFontCss =
    FONT_STYLE_OPTIONS.find((f) => f.id === fontStyle)?.cssFont || '"Fraunces", serif';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Colonna Sinistra: Controlli Scrittura Ibrida e Texture */}
      <div className="lg:col-span-5 bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-[#1A2B4C]/10 pb-3">
          <div>
            <h2
              className="text-xl font-bold text-[#1A2B4C]"
              style={{ fontFamily: '"Fraunces", serif' }}
            >
              Font Creator & Motore Texturizzato
            </h2>
            <p className="text-xs text-[#1A2B4C]/70 mt-0.5">
              Scrittura ibrida (Tastiera o Apple Pencil) convertita in tracciati SVG con filtri materici
            </p>
          </div>
        </div>

        {/* Selettore Modalità Scrittura Ibrida */}
        <div>
          <label className="block text-xs font-semibold text-[#1A2B4C] mb-2">
            1. Modalità di Input Tipografico
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#EADDCD] rounded-lg border border-[#1A2B4C]/10">
            <button
              type="button"
              onClick={() => setInputMode('keyboard')}
              className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                inputMode === 'keyboard'
                  ? 'bg-[#1A2B4C] text-[#EADDCD]'
                  : 'text-[#1A2B4C] hover:bg-[#1A2B4C]/5'
              }`}
            >
              <TypeIcon className="w-3.5 h-3.5" />
              <span>Tastiera (Font Brand)</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('freehand')}
              className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                inputMode === 'freehand'
                  ? 'bg-[#B85B43] text-[#EADDCD]'
                  : 'text-[#1A2B4C] hover:bg-[#1A2B4C]/5'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Disegna Lettere (Pencil)</span>
            </button>
          </div>
        </div>

        {inputMode === 'keyboard' ? (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="hybrid-text-input"
                className="block text-xs font-semibold text-[#1A2B4C] mb-1.5"
              >
                Testo della Locandina / Titolo
              </label>
              <textarea
                id="hybrid-text-input"
                rows={2}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="Scrivi il titolo o il payoff..."
                className="w-full px-3 py-2 bg-[#EADDCD]/60 border border-[#1A2B4C]/20 rounded-lg text-sm text-[#1A2B4C] focus:outline-none focus:border-[#B85B43]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A2B4C] mb-1.5">
                Famiglia Tipografica Preimpostata
              </label>
              <div className="space-y-1.5">
                {FONT_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFontStyle(opt.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                      fontStyle === opt.id
                        ? 'bg-[#1A2B4C] text-[#EADDCD] border-[#1A2B4C]'
                        : 'bg-[#EADDCD]/50 text-[#1A2B4C] border-[#1A2B4C]/15 hover:border-[#1A2B4C]/40'
                    }`}
                  >
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-sm font-bold" style={{ fontFamily: opt.cssFont }}>
                      {opt.sample}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[#1A2B4C] mb-1">
                <label htmlFor="font-size-slider">Corpo Tipografico (Scala SVG)</label>
                <span className="font-mono tabular-nums">{fontSize} px</span>
              </div>
              <input
                id="font-size-slider"
                type="range"
                min={24}
                max={120}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-[#B85B43]"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1A2B4C]">
                Spessore Pennino Calligrafico
              </span>
              <span className="text-xs font-mono tabular-nums text-[#B85B43] font-semibold">
                {brushWeight} px · Input: {lastPointerType === 'pen' ? 'Apple Pencil' : 'Trackpad Velocity'}
              </span>
            </div>
            <input
              type="range"
              min={6}
              max={38}
              value={brushWeight}
              onChange={(e) => setBrushWeight(Number(e.target.value))}
              className="w-full accent-[#B85B43]"
              aria-label="Spessore pennino calligrafico"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadPresetHandCalligraphy}
                className="px-3 py-1.5 text-xs font-medium bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-[#1A2B4C] hover:bg-[#D4A373]/30 transition-colors"
              >
                Carica Esempio Calligrafico
              </button>
              <button
                type="button"
                onClick={() => setDrawnStrokes((prev) => prev.slice(0, -1))}
                disabled={drawnStrokes.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-[#1A2B4C] disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Annulla Tratto</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawnStrokes([])}
                disabled={drawnStrokes.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#B85B43]/15 border border-[#B85B43]/30 rounded-lg text-[#B85B43] disabled:opacity-40"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Pulisci Tavoletta</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Selettore Texture Vettoriale */}
        <div>
          <label className="block text-xs font-semibold text-[#1A2B4C] mb-2">
            2. Applica Filtro / Maschera Texture Vettoriale (SVG)
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {TEXTURE_OPTIONS.map((tex) => (
              <button
                key={tex.id}
                type="button"
                onClick={() => setSelectedTexture(tex.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                  selectedTexture === tex.id
                    ? 'bg-[#4A6B53] text-[#EADDCD] border-[#4A6B53]'
                    : 'bg-[#EADDCD]/50 text-[#1A2B4C] border-[#1A2B4C]/15 hover:border-[#4A6B53]'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold">{tex.label}</div>
                  <div
                    className={`text-[11px] ${
                      selectedTexture === tex.id ? 'text-[#EADDCD]/85' : 'text-[#1A2B4C]/65'
                    }`}
                  >
                    {tex.desc}
                  </div>
                </div>
                {selectedTexture === tex.id && <Check className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Palette Brand-Safe */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-xs font-semibold text-[#1A2B4C] mb-1.5">
              Colore Inchiostro Testo
            </span>
            <div className="flex items-center gap-1.5">
              {BRAND_PALETTE.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  onClick={() => setPrimaryColor(sw.hex)}
                  title={`${sw.name} (${sw.hex})`}
                  aria-label={`Colore primario ${sw.name}`}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    primaryColor === sw.hex
                      ? 'border-[#1A2B4C] scale-110 ring-2 ring-[#B85B43]'
                      : 'border-[#1A2B4C]/25'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#1A2B4C] mb-1.5">
              Colore Macchia / Sottolineatura
            </span>
            <div className="flex items-center gap-1.5">
              {BRAND_PALETTE.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  onClick={() => setSecondaryColor(sw.hex)}
                  title={`Sfondo ${sw.name}`}
                  aria-label={`Colore secondario ${sw.name}`}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    secondaryColor === sw.hex
                      ? 'border-[#1A2B4C] scale-110 ring-2 ring-[#4A6B53]'
                      : 'border-[#1A2B4C]/25'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Azioni di Inserimento nel Builder */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleInsertToCanvas}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#B85B43] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#a04c36] transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>Inserisci nel Canvas (Livello SVG)</span>
          </button>
          <button
            type="button"
            onClick={handleSaveToClipboard}
            className="px-4 py-2.5 bg-[#1A2B4C] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#1A2B4C]/90 transition-colors whitespace-nowrap"
          >
            Copia negli Appunti
          </button>
        </div>

        {feedbackToast && (
          <div
            role="status"
            className="px-3 py-2 bg-[#4A6B53] text-[#EADDCD] text-xs font-medium rounded-lg"
          >
            {feedbackToast}
          </div>
        )}
      </div>

      {/* Colonna Destra: Anteprima Vettoriale Live & Tavoletta Calligrafica */}
      <div className="lg:col-span-7 bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1A2B4C]">
              {inputMode === 'keyboard'
                ? 'Anteprima Tracciato Vettoriale + Maschera Texture'
                : 'Tavoletta Lettering a Mano Libera (Apple Pencil / Trackpad)'}
            </h3>
            <p className="text-xs text-[#1A2B4C]/70">
              {inputMode === 'keyboard'
                ? 'Il testo viene incapsulato in un gruppo SVG con tracciato materico e filtro procedurale.'
                : 'Disegna direttamente qui sotto: lo smoothing di Chaikin trasforma i tratti in glifi vettoriali.'}
            </p>
          </div>
          <span className="text-xs font-mono text-[#4A6B53]">
            Filtro attivo: {selectedTexture}
          </span>
        </div>

        <div className="relative rounded-xl overflow-hidden border-2 border-[#1A2B4C]/20 bg-[#EADDCD]">
          <svg
            ref={padSvgRef}
            viewBox="0 0 760 320"
            className={`w-full h-[320px] block select-none ${
              inputMode === 'freehand' ? 'cursor-crosshair touch-none' : 'cursor-default'
            }`}
            onPointerDown={inputMode === 'freehand' ? handlePadPointerDown : undefined}
            onPointerMove={inputMode === 'freehand' ? handlePadPointerMove : undefined}
            onPointerUp={inputMode === 'freehand' ? handlePadPointerUp : undefined}
            onPointerCancel={inputMode === 'freehand' ? handlePadPointerUp : undefined}
          >
            <SvgTextureDefs />
            <rect width="760" height="320" fill="#EADDCD" />
            <rect width="760" height="320" fill="url(#kraft-paper-grain)" />

            {/* Guide tipografiche calligrafiche (Ascendente, Occhio medio, Linea di base) */}
            <line
              x1="40"
              y1="85"
              x2="720"
              y2="85"
              stroke="#1A2B4C"
              strokeOpacity="0.12"
              strokeDasharray="6 6"
            />
            <line
              x1="40"
              y1="145"
              x2="720"
              y2="145"
              stroke="#B85B43"
              strokeOpacity="0.18"
              strokeDasharray="4 4"
            />
            <line
              x1="40"
              y1="215"
              x2="720"
              y2="215"
              stroke="#1A2B4C"
              strokeOpacity="0.22"
              strokeWidth="1.2"
            />
            <text
              x="44"
              y="232"
              fill="#1A2B4C"
              fillOpacity="0.4"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              BASELINE VETTORIALE · SVG PATH ENGINE
            </text>

            {inputMode === 'keyboard' ? (
              <g filter={getFilterUrl(selectedTexture)}>
                {/* Tracciato vettoriale materico di supporto (Blob o Pennellata) */}
                <path
                  d={
                    generateTextVectorBackdropPath(
                      typedText,
                      380,
                      155,
                      Math.min(76, fontSize),
                      selectedTexture
                    ).pathData
                  }
                  fill={secondaryColor}
                  fillOpacity={selectedTexture === 'materic-blob' ? 0.92 : 0.78}
                />
                {typedText.split('\n').map((line, idx, arr) => {
                  const previewSize = Math.min(76, fontSize);
                  const startY = 155 - ((arr.length - 1) * previewSize * 0.58);
                  return (
                    <text
                      key={idx}
                      x="380"
                      y={startY + idx * previewSize * 1.15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={primaryColor}
                      fontSize={previewSize}
                      fontWeight={fontStyle === 'craft-rounded' ? 700 : 600}
                      style={{ fontFamily: activeFontCss }}
                    >
                      {line}
                    </text>
                  );
                })}
              </g>
            ) : (
              <g filter={getFilterUrl(selectedTexture)}>
                {drawnStrokes.length === 0 && !currentLivePath && (
                  <text
                    x="380"
                    y="155"
                    textAnchor="middle"
                    fill="#1A2B4C"
                    fillOpacity="0.35"
                    fontSize="20"
                    style={{ fontFamily: '"Fraunces", serif' }}
                  >
                    Traccia qui le tue lettere con Apple Pencil o Trackpad...
                  </text>
                )}
                {drawnStrokes.map((d, i) => (
                  <path key={i} d={d} fill={primaryColor} />
                ))}
                {currentLivePath && <path d={currentLivePath} fill={secondaryColor} />}
              </g>
            )}
          </svg>
        </div>

        {/* Scheda Tecnica di come lavora il motore SVG */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#EADDCD]/70 border border-[#1A2B4C]/10">
            <div className="font-bold text-[#1A2B4C]">Chaikin + Perfect-Freehand</div>
            <p className="text-[#1A2B4C]/75 mt-0.5">
              Suddivisione quadratica dei nodi per eliminare il tremolio della mano su schermo lucido.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[#EADDCD]/70 border border-[#1A2B4C]/10">
            <div className="font-bold text-[#1A2B4C]">Pressione & Velocità</div>
            <p className="text-[#1A2B4C]/75 mt-0.5">
              Rileva `e.pointerType === 'pen'` per pressione nativa o calcola `px/ms` su Trackpad.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[#EADDCD]/70 border border-[#1A2B4C]/10">
            <div className="font-bold text-[#1A2B4C]">Filtri SVG Nativi</div>
            <p className="text-[#1A2B4C]/75 mt-0.5">
              `feTurbulence` e `feDisplacementMap` vettoriali esportabili ad alta risoluzione.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
