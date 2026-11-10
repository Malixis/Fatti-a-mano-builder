import React, { useEffect, useRef, useState } from 'react';
import {
  BRAND_PALETTE,
  BrandColorHex,
  CANVAS_PRESETS,
  CanvasPresetId,
  DrawingToolId,
  PartnerProfile,
  PointerSample,
  StampKind,
  TextureFilterType,
  VectorElement,
} from '../types/erp';
import {
  buildPartnerVectorAssets,
  computeSamplePressure,
  generateBrandStamp,
  generateOrganicBlobPath,
  generateSmoothedBrushPath,
  generateTextVectorBackdropPath,
  generateWavyCheckerboardPath,
} from '../utils/vectorMath';
import { exportSvgCanvas } from '../utils/pdfExporter';
import { SvgTextureDefs, getFilterUrl } from './SvgTextureDefs';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  EyeOff,
  Grid,
  Layers,
  Lock,
  Maximize2,
  MousePointer,
  Paintbrush,
  Plus,
  RotateCcw,
  Sparkles,
  Stamp,
  Trash2,
  Type,
  Unlock,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface GraphicBuilderProps {
  elements: VectorElement[];
  setElements: React.Dispatch<React.SetStateAction<VectorElement[]>>;
  clipboard: VectorElement[];
  setClipboard: React.Dispatch<React.SetStateAction<VectorElement[]>>;
  canvasSize: { width: number; height: number; presetId: CanvasPresetId };
  setCanvasSize: React.Dispatch<
    React.SetStateAction<{ width: number; height: number; presetId: CanvasPresetId }>
  >;
  partners: PartnerProfile[];
  selectedPartnerId: string;
  onSelectPartner: (partnerId: string) => void;
  onOpenFontModal: () => void;
  onSaveTemplateCloud?: () => void;
  isSavingCloud?: boolean;
}

const STAMP_CATALOG: Array<{ id: StampKind; label: string }> = [
  { id: 'seal-fatti-a-mano', label: 'Timbro "Fatti a mano"' },
  { id: 'matisse-leaf', label: 'Foglia Matisse' },
  { id: 'ink-splatter', label: 'Schizzo Inchiostro' },
  { id: 'craft-star', label: 'Stella Artigianale' },
  { id: 'brush-zig', label: 'Tratto Pennello' },
  { id: 'thread-loop', label: 'Filo Legatoria' },
];

export const GraphicBuilder: React.FC<GraphicBuilderProps> = ({
  elements,
  setElements,
  clipboard,
  setClipboard,
  canvasSize,
  setCanvasSize,
  partners,
  selectedPartnerId,
  onSelectPartner,
  onOpenFontModal,
  onSaveTemplateCloud,
  isSavingCloud,
}) => {
  const [activeTool, setActiveTool] = useState<DrawingToolId>('brush');
  const [activeColor, setActiveColor] = useState<BrandColorHex>('#B85B43');
  const [backgroundColor, setBackgroundColor] = useState<BrandColorHex>('#EADDCD');
  const [activeTexture, setActiveTexture] = useState<TextureFilterType>('rough-brush');
  const [activeStamp, setActiveStamp] = useState<StampKind>('seal-fatti-a-mano');
  const [brushSize, setBrushSize] = useState<number>(22);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(0.45);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Input & Pointer telemetry per Apple Pencil / Trackpad / Palm Rejection
  const [pointerModeLabel, setPointerModeLabel] = useState<string>(
    'Pronto · Supporto Trackpad & Apple Pencil'
  );
  const [livePressure, setLivePressure] = useState<number>(0.5);
  const [liveSamples, setLiveSamples] = useState<PointerSample[]>([]);
  const [dragBox, setDragBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const isDraggingElementRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const penActiveTimestampRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | null>(null);
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistanceRef = useRef<number | null>(null);

  const activePartner = partners.find((p) => p.id === selectedPartnerId) || null;

  const notify = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 2800);
  };

  /**
   * Carica in automatico gli asset grafici del Partner selezionato dal dropdown:
   * - Aggiorna la Clipboard con Monogramma/Logo, Co-branding e Checkerboard del Partner
   * - Inserisce/aggiorna il Badge Logo del Partner sul Canvas
   * - Imposta il colore primario del Partner come colore attivo
   */
  const handlePartnerDropdownChange = (partnerId: string) => {
    onSelectPartner(partnerId);
    if (!partnerId) {
      notify('Nessun partner selezionato: ripristinata solo palette Fatti a mano');
      return;
    }
    const chosen = partners.find((p) => p.id === partnerId);
    if (!chosen) return;

    const { partnerElements, partnerClipboard } = buildPartnerVectorAssets(
      chosen,
      canvasSize.width,
      canvasSize.height
    );

    if (chosen.palette?.[0]) {
      setActiveColor(chosen.palette[0]);
    }

    // Sostituisce eventuali badge partner precedenti sul canvas e aggiunge quello del partner scelto
    setElements((prev) => {
      const withoutOldPartnerBadge = prev.filter(
        (el) => !el.id.startsWith('partner-badge-')
      );
      return [...withoutOldPartnerBadge, partnerElements[0]];
    });

    // Pre-carica in cima alla clipboard i 3 asset vettoriali del partner
    setClipboard((prev) => {
      const withoutOldPartnerClips = prev.filter(
        (el) => !el.id.startsWith('clip-partner-')
      );
      return [...partnerClipboard, ...withoutOldPartnerClips].slice(0, 8);
    });

    notify(
      `Caricato Brand Kit "${chosen.name}": Logo ${chosen.logoText}, Font ${chosen.fontStyle} e Palette ${chosen.palette.join(' ')}`
    );
  };

  const handleInsertFullPartnerKitOnCanvas = () => {
    if (!activePartner) return;
    const { partnerElements } = buildPartnerVectorAssets(
      activePartner,
      canvasSize.width,
      canvasSize.height
    );
    setElements((prev) => {
      const withoutOld = prev.filter(
        (el) => !el.id.startsWith(`partner-badge-${activePartner.id}`) && !el.id.startsWith(`partner-blob-${activePartner.id}`)
      );
      return [...withoutOld, ...partnerElements];
    });
    notify(`Inseriti Logo "${activePartner.logoText}" e Macchia Palette di ${activePartner.name} sul Canvas!`);
  };

  // Supporto scorciatoie da tastiera Ctrl+C / Ctrl+V / Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (selectedId) {
          const found = elements.find((el) => el.id === selectedId);
          if (found) {
            setClipboard((prev) => [{ ...found, id: `clip-${Date.now()}` }, ...prev.slice(0, 7)]);
            notify(`Copiato "${found.name}" negli appunti vettoriali`);
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
          e.preventDefault();
          pasteFromClipboard(clipboard[0]);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          setElements((prev) => prev.filter((el) => el.id !== selectedId || el.locked));
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, elements, clipboard]);

  const toCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvasSize.width;
    const y = ((clientY - rect.top) / rect.height) * canvasSize.height;
    return { x, y };
  };

  const pasteFromClipboard = (item: VectorElement) => {
    const maxZ = elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);
    const cloned: VectorElement = {
      ...item,
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${item.name} (Copia)`,
      x: Math.min(canvasSize.width - 80, item.x + 36),
      y: Math.min(canvasSize.height - 80, item.y + 36),
      zIndex: maxZ + 1,
      locked: false,
    };
    setElements((prev) => [...prev, cloned]);
    setSelectedId(cloned.id);
    notify(`Incollato "${item.name}" mantenendo curve e colori originali`);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Gestione Pinch-to-Zoom a due dita su iPad
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchesRef.current.size === 2) {
        const pts = Array.from(activeTouchesRef.current.values());
        pinchDistanceRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        isDrawingRef.current = false;
        return;
      }
      // Palm-rejection naturale: se Apple Pencil è stata usata negli ultimi 800ms, ignora il palmo
      if (performance.now() - penActiveTimestampRef.current < 800) {
        setPointerModeLabel('Palm Rejection attivo (Apple Pencil prioritaria)');
        return;
      }
    }

    if (e.pointerType === 'pen') {
      penActiveTimestampRef.current = performance.now();
      setPointerModeLabel(
        `Apple Pencil · Pressione ${(e.pressure * 100).toFixed(0)}%`
      );
    } else if (e.pointerType === 'mouse') {
      setPointerModeLabel('Trackpad / Mouse · Dinamica Velocity-to-Width');
    } else {
      setPointerModeLabel('Touch su iPad · Gesture & Disegno');
    }

    const coords = toCanvasCoords(e.clientX, e.clientY);

    if (activeTool === 'select') {
      if (e.target === svgRef.current || (e.target as SVGElement).dataset.bg === 'true') {
        setSelectedId(null);
      }
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === 'stamp') {
      const maxZ = elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);
      const stampData = generateBrandStamp(activeStamp, coords.x, coords.y, 240);
      const newStamp: VectorElement = {
        id: `stamp-${Date.now()}`,
        name: `Timbro ${activeStamp}`,
        type: 'stamp',
        stampKind: activeStamp,
        x: coords.x,
        y: coords.y,
        width: 240,
        height: 240,
        rotation: 0,
        scale: 1,
        color: activeColor,
        opacity: 0.96,
        zIndex: maxZ + 1,
        visible: true,
        locked: false,
        pathData: stampData.pathData,
        subPaths: stampData.subPaths,
        textContent: stampData.defaultText,
        textureType: activeTexture,
      };
      setElements((prev) => [...prev, newStamp]);
      setSelectedId(newStamp.id);
      return;
    }

    if (activeTool === 'textured-text') {
      const maxZ = elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);
      const sampleText = activePartner ? `${activePartner.logoText} · Fatti a mano` : 'Fatti a mano';
      const meta = generateTextVectorBackdropPath(sampleText, coords.x, coords.y, 64, activeTexture);
      const newText: VectorElement = {
        id: `text-${Date.now()}`,
        name: 'Testo Vettoriale Brand',
        type: 'textured-text',
        x: coords.x,
        y: coords.y,
        width: meta.width,
        height: meta.height,
        rotation: 0,
        scale: 1,
        color: activeColor,
        secondaryColor: activePartner?.palette?.[1] || '#D4A373',
        opacity: 1,
        zIndex: maxZ + 1,
        visible: true,
        locked: false,
        pathData: meta.pathData,
        textureType: activeTexture,
        textContent: sampleText,
        fontStyle: activePartner?.fontStyle || 'editorial-serif',
        fontSize: 64,
      };
      setElements((prev) => [...prev, newText]);
      setSelectedId(newText.id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'blob' || activeTool === 'checkerboard') {
      isDrawingRef.current = true;
      setDragBox({
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x + 10,
        currentY: coords.y + 10,
      });
      return;
    }

    // Pennello Fluido (Brush)
    isDrawingRef.current = true;
    const pointerType =
      e.pointerType === 'pen' || e.pointerType === 'touch' ? e.pointerType : 'mouse';
    const initialPressure = computeSamplePressure(null, {
      x: coords.x,
      y: coords.y,
      pressure: e.pressure,
      timestamp: e.timeStamp || performance.now(),
      pointerType,
    });
    setLivePressure(initialPressure);
    setLiveSamples([
      {
        x: coords.x,
        y: coords.y,
        pressure: initialPressure,
        timestamp: e.timeStamp || performance.now(),
        pointerType,
      },
    ]);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch' && activeTouchesRef.current.has(e.pointerId)) {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchesRef.current.size === 2 && pinchDistanceRef.current) {
        const pts = Array.from(activeTouchesRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const ratio = dist / pinchDistanceRef.current;
        setZoom((z) => Math.min(1.4, Math.max(0.25, z * ratio)));
        pinchDistanceRef.current = dist;
        return;
      }
    }

    const coords = toCanvasCoords(e.clientX, e.clientY);

    // Trascinamento elemento selezionato
    if (isDraggingElementRef.current) {
      const drag = isDraggingElementRef.current;
      const dx = coords.x - drag.startX;
      const dy = coords.y - drag.startY;
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== drag.id || el.locked) return el;
          if (el.type === 'stamp' && el.stampKind) {
            const updatedStamp = generateBrandStamp(
              el.stampKind,
              drag.origX + dx,
              drag.origY + dy,
              el.width
            );
            return {
              ...el,
              x: drag.origX + dx,
              y: drag.origY + dy,
              pathData: updatedStamp.pathData,
              subPaths: updatedStamp.subPaths,
            };
          }
          if (el.type === 'blob') {
            return {
              ...el,
              x: drag.origX + dx,
              y: drag.origY + dy,
              pathData: generateOrganicBlobPath(
                drag.origX + dx,
                drag.origY + dy,
                el.width / 2,
                el.height / 2,
                2.5
              ),
            };
          }
          if (el.type === 'checkerboard') {
            return {
              ...el,
              x: drag.origX + dx,
              y: drag.origY + dy,
              pathData: generateWavyCheckerboardPath(
                drag.origX + dx - el.width / 2,
                drag.origY + dy - el.height / 2,
                el.width,
                el.height,
                5,
                6,
                12,
                2.1
              ),
            };
          }
          if (el.type === 'textured-text' && !el.isHandDrawnText) {
            const meta = generateTextVectorBackdropPath(
              el.textContent || 'Fatti a mano',
              drag.origX + dx,
              drag.origY + dy,
              el.fontSize || 64,
              el.textureType
            );
            return {
              ...el,
              x: drag.origX + dx,
              y: drag.origY + dy,
              pathData: meta.pathData,
            };
          }
          return {
            ...el,
            x: drag.origX + dx,
            y: drag.origY + dy,
          };
        })
      );
      return;
    }

    if (!isDrawingRef.current) return;

    if (activeTool === 'blob' || activeTool === 'checkerboard') {
      setDragBox((prev) =>
        prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null
      );
      return;
    }

    if (activeTool === 'brush') {
      const pointerType =
        e.pointerType === 'pen' || e.pointerType === 'touch' ? e.pointerType : 'mouse';
      setLiveSamples((prev) => {
        const last = prev.length > 0 ? prev[prev.length - 1] : null;
        const pressure = computeSamplePressure(last, {
          x: coords.x,
          y: coords.y,
          pressure: e.pressure,
          timestamp: e.timeStamp || performance.now(),
          pointerType,
        });
        setLivePressure(pressure);
        if (pointerType === 'pen') {
          setPointerModeLabel(
            `Apple Pencil · Pressione ${(pressure * 100).toFixed(0)}%`
          );
        }
        return [
          ...prev,
          {
            x: coords.x,
            y: coords.y,
            pressure,
            timestamp: e.timeStamp || performance.now(),
            pointerType,
          },
        ];
      });
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    activeTouchesRef.current.delete(e.pointerId);
    if (activeTouchesRef.current.size < 2) {
      pinchDistanceRef.current = null;
    }
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isDraggingElementRef.current) {
      isDraggingElementRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const maxZ = elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);

    if ((activeTool === 'blob' || activeTool === 'checkerboard') && dragBox) {
      const minX = Math.min(dragBox.startX, dragBox.currentX);
      const minY = Math.min(dragBox.startY, dragBox.currentY);
      const w = Math.max(140, Math.abs(dragBox.currentX - dragBox.startX));
      const h = Math.max(110, Math.abs(dragBox.currentY - dragBox.startY));
      const cx = minX + w / 2;
      const cy = minY + h / 2;

      if (activeTool === 'blob') {
        const pathData = generateOrganicBlobPath(cx, cy, w / 2, h / 2, Date.now() % 10, 10);
        const newBlob: VectorElement = {
          id: `blob-${Date.now()}`,
          name: 'Macchia Organica (Auto-Blob)',
          type: 'blob',
          x: cx,
          y: cy,
          width: w,
          height: h,
          rotation: 0,
          scale: 1,
          color: activeColor,
          opacity: 0.92,
          zIndex: maxZ + 1,
          visible: true,
          locked: false,
          pathData,
          textureType: activeTexture,
        };
        setElements((prev) => [...prev, newBlob]);
        setSelectedId(newBlob.id);
      } else {
        const pathData = generateWavyCheckerboardPath(minX, minY, w, h, 5, 6, 13, Date.now() % 7);
        const newCheck: VectorElement = {
          id: `check-${Date.now()}`,
          name: 'Wavy Checkerboard',
          type: 'checkerboard',
          x: cx,
          y: cy,
          width: w,
          height: h,
          rotation: 0,
          scale: 1,
          color: activeColor,
          opacity: 0.9,
          zIndex: maxZ + 1,
          visible: true,
          locked: false,
          pathData,
          textureType: activeTexture,
        };
        setElements((prev) => [...prev, newCheck]);
        setSelectedId(newCheck.id);
      }
      setDragBox(null);
      return;
    }

    if (activeTool === 'brush' && liveSamples.length > 1) {
      const { pathData, avgPressure, isPenInput } = generateSmoothedBrushPath(
        liveSamples,
        brushSize,
        2
      );
      if (pathData) {
        const xs = liveSamples.map((s) => s.x);
        const ys = liveSamples.map((s) => s.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const newStroke: VectorElement = {
          id: `stroke-${Date.now()}`,
          name: isPenInput ? 'Pennellata Apple Pencil' : 'Pennellata Fluida',
          type: 'freehand',
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          width: Math.max(40, maxX - minX),
          height: Math.max(40, maxY - minY),
          rotation: 0,
          scale: 1,
          color: activeColor,
          opacity: isPenInput ? Math.min(1, Math.max(0.55, avgPressure * 1.15)) : 0.95,
          zIndex: maxZ + 1,
          visible: true,
          locked: false,
          pathData,
          textureType: activeTexture,
        };
        setElements((prev) => [...prev, newStroke]);
        setSelectedId(newStroke.id);
      }
      setLiveSamples([]);
    }
  };

  const handleElementPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    el: VectorElement
  ) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    setSelectedId(el.id);

    const coords = toCanvasCoords(e.clientX, e.clientY);
    if (!el.locked) {
      isDraggingElementRef.current = {
        id: el.id,
        startX: coords.x,
        startY: coords.y,
        origX: el.x,
        origY: el.y,
      };
    }

    // Long-press (550ms) su iPad per Copia-Incolla rapido dell'elemento vettoriale
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setClipboard((prev) => [{ ...el, id: `clip-${Date.now()}` }, ...prev.slice(0, 7)]);
      pasteFromClipboard(el);
      isDraggingElementRef.current = null;
    }, 600);
  };

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const selectedElement = elements.find((el) => el.id === selectedId) || null;

  const moveLayerZIndex = (id: string, direction: 'up' | 'down') => {
    setElements((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const zA = sorted[idx].zIndex;
      const zB = sorted[swapIdx].zIndex;
      sorted[idx] = { ...sorted[idx], zIndex: zB };
      sorted[swapIdx] = { ...sorted[swapIdx], zIndex: zA };
      return sorted;
    });
  };

  const liveBrushPreviewPath =
    liveSamples.length > 1 ? generateSmoothedBrushPath(liveSamples, brushSize, 1).pathData : '';

  const getFontFamilyCss = (style?: string) => {
    if (style === 'craft-rounded') return '"Bricolage Grotesque", sans-serif';
    if (style === 'mono-label') return '"JetBrains Mono", monospace';
    return '"Fraunces", Georgia, serif';
  };

  return (
    <div className="space-y-4">
      {/* Barra Superiore del Builder: Preset Dimensioni, Dropdown Partner Brand Kit, Zoom e Esportazione */}
      <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Preset rapidi & Input L x A */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#1A2B4C] mr-1">Formato Canvas:</span>
          {CANVAS_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setCanvasSize({
                  width: preset.width,
                  height: preset.height,
                  presetId: preset.id,
                })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                canvasSize.presetId === preset.id
                  ? 'bg-[#1A2B4C] text-[#EADDCD]'
                  : 'bg-[#EADDCD] text-[#1A2B4C] hover:bg-[#1A2B4C]/10'
              }`}
            >
              {preset.label}
            </button>
          ))}

          <div className="flex items-center gap-1.5 ml-1 bg-[#EADDCD] px-2.5 py-1 rounded-lg border border-[#1A2B4C]/15">
            <label htmlFor="canvas-width-input" className="text-[11px] font-semibold text-[#1A2B4C]">
              L:
            </label>
            <input
              id="canvas-width-input"
              type="number"
              min={300}
              max={4000}
              value={canvasSize.width}
              onChange={(e) =>
                setCanvasSize((prev) => ({
                  ...prev,
                  width: Math.max(300, Number(e.target.value) || 1080),
                  presetId: 'custom',
                }))
              }
              className="w-16 text-xs font-mono tabular-nums bg-transparent text-[#1A2B4C] font-semibold focus:outline-none"
            />
            <span className="text-xs text-[#1A2B4C]/50">×</span>
            <label htmlFor="canvas-height-input" className="text-[11px] font-semibold text-[#1A2B4C]">
              A:
            </label>
            <input
              id="canvas-height-input"
              type="number"
              min={300}
              max={4000}
              value={canvasSize.height}
              onChange={(e) =>
                setCanvasSize((prev) => ({
                  ...prev,
                  height: Math.max(300, Number(e.target.value) || 1350),
                  presetId: 'custom',
                }))
              }
              className="w-16 text-xs font-mono tabular-nums bg-transparent text-[#1A2B4C] font-semibold focus:outline-none"
            />
            <span className="text-[11px] font-mono text-[#1A2B4C]/60">px</span>
          </div>

          {/* Menu a Tendina Partner nel Builder Grafico */}
          <div className="flex items-center gap-2 bg-[#EADDCD] px-3 py-1.5 rounded-lg border border-[#B85B43]/40">
            <Building2 className="w-3.5 h-3.5 text-[#B85B43] shrink-0" />
            <label
              htmlFor="builder-partner-dropdown"
              className="text-xs font-bold text-[#1A2B4C] whitespace-nowrap"
            >
              Partner Brand Kit:
            </label>
            <select
              id="builder-partner-dropdown"
              data-testid="builder-partner-dropdown"
              value={selectedPartnerId}
              onChange={(e) => handlePartnerDropdownChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#1A2B4C] focus:outline-none cursor-pointer"
            >
              <option value="">— Nessun Partner (Solo Fatti a mano) —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.logoText} · {p.fontStyle})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Controlli Zoom & Export Alta Risoluzione */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#EADDCD] rounded-lg border border-[#1A2B4C]/15 p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))}
              aria-label="Riduci zoom"
              className="p-1.5 text-[#1A2B4C] hover:bg-[#1A2B4C]/10 rounded"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-mono tabular-nums font-semibold text-[#1A2B4C]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))}
              aria-label="Aumenta zoom"
              className="p-1.5 text-[#1A2B4C] hover:bg-[#1A2B4C]/10 rounded"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(0.52);
                setPan({ x: 0, y: 0 });
              }}
              aria-label="Ripristina vista canvas"
              className="p-1.5 text-[#1A2B4C] hover:bg-[#1A2B4C]/10 rounded"
              title="Centra vista"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              exportSvgCanvas(
                svgRef.current,
                'fatti-a-mano-locandina',
                'svg',
                canvasSize.width,
                canvasSize.height
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EADDCD] border border-[#1A2B4C]/25 text-[#1A2B4C] text-xs font-semibold rounded-lg hover:bg-[#D4A373]/30 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Esporta SVG</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportSvgCanvas(
                svgRef.current,
                'fatti-a-mano-locandina',
                'png',
                canvasSize.width,
                canvasSize.height
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B85B43] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#a04c36] transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Esporta PNG HD</span>
          </button>

          {onSaveTemplateCloud && (
            <button
              type="button"
              onClick={onSaveTemplateCloud}
              disabled={isSavingCloud}
              className="px-3 py-1.5 bg-[#4A6B53] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#3d5945] transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {isSavingCloud ? 'Salvataggio...' : 'Salva Cloud'}
            </button>
          )}
        </div>
      </div>

      {/* Area Principale a 3 Zone: Floating Toolbar Brand-Safe | Viewport Canvas SVG | Livelli Z-Index & Clipboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Colonna 1 (lg:col-span-3): Toolbar "Brand-Safe" Floating Menu + Asset Partner */}
        <div className="lg:col-span-3 bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-4 space-y-5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1A2B4C]/70 mb-2.5">
              Strumenti Vettoriali
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTool('select')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTool === 'select'
                    ? 'bg-[#1A2B4C] text-[#EADDCD]'
                    : 'bg-[#EADDCD]/70 text-[#1A2B4C] hover:bg-[#EADDCD]'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Sposta / Modifica</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('brush')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTool === 'brush'
                    ? 'bg-[#B85B43] text-[#EADDCD]'
                    : 'bg-[#EADDCD]/70 text-[#1A2B4C] hover:bg-[#EADDCD]'
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Pennello Fluido</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('blob')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTool === 'blob'
                    ? 'bg-[#B85B43] text-[#EADDCD]'
                    : 'bg-[#EADDCD]/70 text-[#1A2B4C] hover:bg-[#EADDCD]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Macchia (Blob)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('checkerboard')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTool === 'checkerboard'
                    ? 'bg-[#B85B43] text-[#EADDCD]'
                    : 'bg-[#EADDCD]/70 text-[#1A2B4C] hover:bg-[#EADDCD]'
                }`}
              >
                <Grid className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Wavy Checker</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('stamp')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTool === 'stamp'
                    ? 'bg-[#B85B43] text-[#EADDCD]'
                    : 'bg-[#EADDCD]/70 text-[#1A2B4C] hover:bg-[#EADDCD]'
                }`}
              >
                <Stamp className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Timbri Brand</span>
              </button>

              <button
                type="button"
                onClick={onOpenFontModal}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-[#4A6B53] text-[#EADDCD] hover:bg-[#3d5945] transition-colors"
              >
                <Type className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Crea Glifi &amp; Font</span>
              </button>
            </div>
          </div>

          {/* Box Asset Grafici del Partner Selezionato */}
          {activePartner && (
            <div
              data-testid="active-partner-kit-panel"
              className="p-3 bg-[#EADDCD] rounded-xl border border-[#B85B43]/35 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B85B43]">
                  Asset Partner: {activePartner.name}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#1A2B4C] text-[#EADDCD] text-[10px] font-mono">
                  {activePartner.logoText}
                </span>
              </div>
              <p className="text-[11px] text-[#1A2B4C]/80 leading-snug">
                Font: <strong>{activePartner.fontStyle}</strong> · Forma:{' '}
                <strong>{activePartner.logoShape}</strong>
              </p>

              {/* Swatches Palette Partner */}
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#1A2B4C]/70 mb-1">
                  Palette Colori Partner (clicca per usare):
                </span>
                <div className="flex items-center gap-2">
                  {activePartner.palette.map((hex, i) => (
                    <button
                      key={`${hex}-${i}`}
                      type="button"
                      onClick={() => {
                        setActiveColor(hex);
                        if (selectedId) {
                          setElements((prev) =>
                            prev.map((el) =>
                              el.id === selectedId && !el.locked ? { ...el, color: hex } : el
                            )
                          );
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-mono font-semibold transition-all ${
                        activeColor === hex
                          ? 'bg-[#1A2B4C] text-[#EADDCD] border-[#1A2B4C]'
                          : 'bg-[#F4ECE1] text-[#1A2B4C] border-[#1A2B4C]/20'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <span>{hex}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleInsertFullPartnerKitOnCanvas}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#B85B43] text-[#EADDCD] rounded-lg text-xs font-semibold hover:bg-[#a04c36] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Inserisci Logo &amp; Macchia Partner</span>
              </button>
            </div>
          )}

          {/* Selettore Timbro quando lo strumento Timbro è attivo */}
          {activeTool === 'stamp' && (
            <div className="p-3 bg-[#EADDCD] rounded-lg border border-[#1A2B4C]/15 space-y-2">
              <span className="block text-xs font-bold text-[#1A2B4C]">
                Scegli Timbro Vettoriale (clicca sul canvas):
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {STAMP_CATALOG.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setActiveStamp(st.id)}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-semibold text-left truncate ${
                      activeStamp === st.id
                        ? 'bg-[#1A2B4C] text-[#EADDCD]'
                        : 'bg-[#F4ECE1] text-[#1A2B4C] hover:bg-[#1A2B4C]/10'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Palette Fissa "Brand-Safe" */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1A2B4C]/70">
                Palette Fissa Brand-Safe
              </span>
              <span className="text-[11px] font-mono text-[#1A2B4C]">{activeColor}</span>
            </div>
            <div className="space-y-1.5">
              {BRAND_PALETTE.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => {
                    setActiveColor(swatch.hex);
                    if (selectedId) {
                      setElements((prev) =>
                        prev.map((el) =>
                          el.id === selectedId && !el.locked ? { ...el, color: swatch.hex } : el
                        )
                      );
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all ${
                    activeColor === swatch.hex
                      ? 'bg-[#1A2B4C] text-[#EADDCD] border-[#1A2B4C]'
                      : 'bg-[#EADDCD]/60 text-[#1A2B4C] border-[#1A2B4C]/15 hover:border-[#1A2B4C]/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <div className="text-left">
                      <div className="text-xs font-semibold leading-tight">{swatch.name}</div>
                      <div
                        className={`text-[10px] ${
                          activeColor === swatch.hex ? 'text-[#EADDCD]/75' : 'text-[#1A2B4C]/60'
                        }`}
                      >
                        {swatch.role}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono">{swatch.hex}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Spessore Tratto e Texture Filtro */}
          <div className="space-y-3 pt-1 border-t border-[#1A2B4C]/10">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#1A2B4C] mb-1">
                <label htmlFor="builder-brush-size">Calibro Pennello / Smoothing</label>
                <span className="font-mono tabular-nums">{brushSize} px</span>
              </div>
              <input
                id="builder-brush-size"
                type="range"
                min={6}
                max={64}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-[#B85B43]"
              />
            </div>

            <div>
              <label
                htmlFor="builder-texture-select"
                className="block text-xs font-semibold text-[#1A2B4C] mb-1"
              >
                Texture Vettoriale Attiva
              </label>
              <select
                id="builder-texture-select"
                value={selectedElement ? selectedElement.textureType : activeTexture}
                onChange={(e) => {
                  const val = e.target.value as TextureFilterType;
                  setActiveTexture(val);
                  if (selectedId) {
                    setElements((prev) =>
                      prev.map((el) => (el.id === selectedId ? { ...el, textureType: val } : el))
                    );
                  }
                }}
                className="w-full px-2.5 py-2 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-xs font-semibold text-[#1A2B4C]"
              >
                <option value="rough-brush">Texture Pennellata Ruvida</option>
                <option value="ink-porosity">Porosità dell&apos;Inchiostro</option>
                <option value="cyanotype">Effetto Cianotipia Solare</option>
                <option value="materic-blob">Riempimento Materico Blob</option>
                <option value="none">Tracciato Vettoriale Puro</option>
              </select>
            </div>

            {/* Sfondo Carta */}
            <div>
              <span className="block text-xs font-semibold text-[#1A2B4C] mb-1.5">
                Sfondo Tavola da Disegno
              </span>
              <div className="flex items-center gap-1.5">
                {BRAND_PALETTE.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    onClick={() => setBackgroundColor(sw.hex)}
                    aria-label={`Sfondo canvas ${sw.name}`}
                    className={`w-6 h-6 rounded-md border ${
                      backgroundColor === sw.hex
                        ? 'border-[#1A2B4C] ring-2 ring-[#B85B43]'
                        : 'border-[#1A2B4C]/25'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Colonna 2 (lg:col-span-6): Area di Disegno Vettoriale Cross-Device */}
        <div className="lg:col-span-6 flex flex-col items-center">
          {/* Barra stato input Pointer Events & Feedback */}
          <div className="w-full flex items-center justify-between px-3 py-2 mb-2 bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-lg text-xs">
            <span className="font-medium text-[#1A2B4C] truncate">{pointerModeLabel}</span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono tabular-nums text-[#B85B43]">
                Pressione: {Math.round(livePressure * 100)}%
              </span>
              {statusNotice && (
                <span className="text-[#4A6B53] font-semibold">{statusNotice}</span>
              )}
            </div>
          </div>

          {/* Contenitore Viewport con Pan & Zoom */}
          <div className="w-full min-h-[540px] max-h-[740px] overflow-auto bg-[#1A2B4C]/10 border border-[#1A2B4C]/20 rounded-xl flex items-center justify-center p-6">
            <div
              style={{
                width: Math.round(canvasSize.width * zoom),
                height: Math.round(canvasSize.height * zoom),
                transform: `translate(${pan.x}px, ${pan.y}px)`,
              }}
              className="relative shadow-md border border-[#1A2B4C]/30 bg-[#EADDCD] shrink-0"
            >
              <svg
                ref={svgRef}
                data-testid="vector-canvas-svg"
                viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                className={`w-full h-full block select-none touch-none ${
                  activeTool === 'select' ? 'cursor-move' : 'cursor-crosshair'
                }`}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
              >
                <SvgTextureDefs />

                {/* Sfondo Brand + Grana Carta Kraft */}
                <rect
                  data-bg="true"
                  x={0}
                  y={0}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  fill={backgroundColor}
                />
                <rect
                  data-bg="true"
                  x={0}
                  y={0}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  fill="url(#kraft-paper-grain)"
                />

                {/* Rendering Livelli Vettoriali ordinati per Z-Index */}
                {sortedElements.map((el) => {
                  if (!el.visible) return null;
                  const isSelected = el.id === selectedId;
                  const filterAttr = getFilterUrl(el.textureType);

                  return (
                    <g
                      key={el.id}
                      filter={filterAttr}
                      opacity={el.opacity}
                      transform={
                        el.rotation
                          ? `rotate(${el.rotation} ${el.x} ${el.y})`
                          : undefined
                      }
                      onPointerDown={(e) => handleElementPointerDown(e, el)}
                      className={activeTool === 'select' ? 'cursor-pointer' : undefined}
                    >
                      {/* Caso 1: Pennello Fluido, Macchia (Blob), Wavy Checkerboard */}
                      {(el.type === 'freehand' ||
                        el.type === 'blob' ||
                        el.type === 'checkerboard') && (
                        <path d={el.pathData} fill={el.color} />
                      )}

                      {/* Caso 2: Timbri Vettoriali (Stamps) */}
                      {el.type === 'stamp' && (
                        <g style={{ color: el.color }}>
                          {el.subPaths ? (
                            el.subPaths.map((sp, idx) => (
                              <path
                                key={idx}
                                d={sp.d}
                                fill={sp.fill === 'currentColor' ? el.color : sp.fill || 'none'}
                                stroke={
                                  sp.stroke === 'currentColor' ? el.color : sp.stroke || 'none'
                                }
                                strokeWidth={sp.strokeWidth || 2}
                              />
                            ))
                          ) : (
                            <path d={el.pathData} fill={el.color} />
                          )}
                          {el.stampKind === 'seal-fatti-a-mano' && (
                            <>
                              <text
                                x={el.x}
                                y={el.y - 12}
                                textAnchor="middle"
                                fill={el.color}
                                fontSize={el.width * 0.22}
                                fontWeight={600}
                                style={{ fontFamily: '"Fraunces", Georgia, serif' }}
                              >
                                Fatti
                              </text>
                              <text
                                x={el.x}
                                y={el.y + 32}
                                textAnchor="middle"
                                fill={el.color}
                                fontSize={el.width * 0.16}
                                fontStyle="italic"
                                fontWeight={600}
                                style={{ fontFamily: '"Fraunces", Georgia, serif' }}
                              >
                                a mano
                              </text>
                            </>
                          )}
                        </g>
                      )}

                      {/* Caso 3: Motore Testuale Texturizzato (Tastiera o Glifi a mano libera) */}
                      {el.type === 'textured-text' && (
                        <g>
                          {el.isHandDrawnText ? (
                            <g
                              transform={`translate(${el.x - 380}, ${el.y - 160})`}
                            >
                              <path d={el.pathData} fill={el.color} />
                            </g>
                          ) : (
                            <>
                              {el.pathData && (
                                <path
                                  d={el.pathData}
                                  fill={el.secondaryColor || '#B85B43'}
                                  fillOpacity={
                                    el.textureType === 'materic-blob' ? 0.95 : 0.85
                                  }
                                />
                              )}
                              {(el.textContent || 'Fatti a mano')
                                .split('\n')
                                .map((line, idx, arr) => {
                                  const fSize = el.fontSize || 48;
                                  const startY =
                                    el.y - ((arr.length - 1) * fSize * 0.6);
                                  return (
                                    <text
                                      key={idx}
                                      x={el.x}
                                      y={startY + idx * fSize * 1.2}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      fill={el.color}
                                      fontSize={fSize}
                                      fontWeight={
                                        el.fontStyle === 'craft-rounded' ? 700 : 600
                                      }
                                      style={{
                                        fontFamily: getFontFamilyCss(el.fontStyle),
                                      }}
                                    >
                                      {line}
                                    </text>
                                  );
                                })}
                            </>
                          )}
                        </g>
                      )}

                      {/* Cornice di selezione quando l'elemento è attivo */}
                      {isSelected && (
                        <rect
                          x={el.x - el.width / 2 - 10}
                          y={el.y - el.height / 2 - 10}
                          width={el.width + 20}
                          height={el.height + 20}
                          fill="none"
                          stroke="#1A2B4C"
                          strokeWidth={2.5}
                          strokeDasharray="8 6"
                          rx={8}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Tratto live durante il disegno a mano libera */}
                {liveBrushPreviewPath && (
                  <path
                    d={liveBrushPreviewPath}
                    fill={activeColor}
                    filter={getFilterUrl(activeTexture)}
                  />
                )}

                {/* Box di anteprima durante creazione Auto-Blob o Wavy Checkerboard */}
                {dragBox && (
                  <rect
                    x={Math.min(dragBox.startX, dragBox.currentX)}
                    y={Math.min(dragBox.startY, dragBox.currentY)}
                    width={Math.abs(dragBox.currentX - dragBox.startX)}
                    height={Math.abs(dragBox.currentY - dragBox.startY)}
                    fill={activeColor}
                    fillOpacity={0.22}
                    stroke={activeColor}
                    strokeWidth={3}
                    strokeDasharray="6 6"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* Colonna 3 (lg:col-span-3): Sistema a Livelli (Z-Index), Proprietà Elemento & Clipboard */}
        <div className="lg:col-span-3 space-y-4">
          {/* Inspector Elemento Selezionato */}
          {selectedElement && (
            <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#B85B43]">
                  Elemento Selezionato
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setClipboard((prev) => [
                        { ...selectedElement, id: `clip-${Date.now()}` },
                        ...prev.slice(0, 7),
                      ]);
                      notify('Copiato negli appunti');
                    }}
                    title="Copia (Ctrl+C)"
                    aria-label="Copia elemento selezionato"
                    className="p-1.5 bg-[#EADDCD] rounded text-[#1A2B4C] hover:bg-[#1A2B4C] hover:text-[#EADDCD]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => pasteFromClipboard(selectedElement)}
                    title="Duplica / Incolla (Ctrl+V)"
                    aria-label="Duplica elemento selezionato"
                    className="p-1.5 bg-[#EADDCD] rounded text-[#1A2B4C] hover:bg-[#1A2B4C] hover:text-[#EADDCD]"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setElements((prev) => prev.filter((el) => el.id !== selectedElement.id));
                      setSelectedId(null);
                    }}
                    title="Elimina livello"
                    aria-label="Elimina elemento selezionato"
                    className="p-1.5 bg-[#B85B43]/15 rounded text-[#B85B43] hover:bg-[#B85B43] hover:text-[#EADDCD]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {selectedElement.type === 'textured-text' && !selectedElement.isHandDrawnText && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                    Modifica Testo Livello
                  </label>
                  <textarea
                    rows={2}
                    value={selectedElement.textContent || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setElements((prev) =>
                        prev.map((el) =>
                          el.id === selectedElement.id ? { ...el, textContent: val } : el
                        )
                      );
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#EADDCD] border border-[#1A2B4C]/20 rounded text-[#1A2B4C]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#1A2B4C]">
                    Rotazione ({selectedElement.rotation}°)
                  </label>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    value={selectedElement.rotation}
                    onChange={(e) => {
                      const rot = Number(e.target.value);
                      setElements((prev) =>
                        prev.map((el) =>
                          el.id === selectedElement.id ? { ...el, rotation: rot } : el
                        )
                      );
                    }}
                    className="w-full accent-[#B85B43]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#1A2B4C]">
                    Opacità ({Math.round(selectedElement.opacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={selectedElement.opacity}
                    onChange={(e) => {
                      const op = Number(e.target.value);
                      setElements((prev) =>
                        prev.map((el) =>
                          el.id === selectedElement.id ? { ...el, opacity: op } : el
                        )
                      );
                    }}
                    className="w-full accent-[#B85B43]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pannello Sistema a Livelli (Z-Index) */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#1A2B4C]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#1A2B4C]">
                  Livelli Vettoriali (Z-Index)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setElements([]);
                  setSelectedId(null);
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#B85B43] hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Svuota</span>
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {[...sortedElements].reverse().map((el) => {
                const isSel = el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    onClick={() => {
                      setSelectedId(el.id);
                      setActiveTool('select');
                    }}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-[#1A2B4C] text-[#EADDCD] border-[#1A2B4C]'
                        : 'bg-[#EADDCD]/70 text-[#1A2B4C] border-[#1A2B4C]/15 hover:bg-[#EADDCD]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                        style={{ backgroundColor: el.color }}
                      />
                      <span className="truncate font-medium">{el.name}</span>
                    </div>

                    <div
                      className="flex items-center gap-1 shrink-0 ml-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => moveLayerZIndex(el.id, 'up')}
                        aria-label={`Porta avanti ${el.name}`}
                        className="p-1 hover:opacity-75"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayerZIndex(el.id, 'down')}
                        aria-label={`Porta indietro ${el.name}`}
                        className="p-1 hover:opacity-75"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setElements((prev) =>
                            prev.map((item) =>
                              item.id === el.id ? { ...item, visible: !item.visible } : item
                            )
                          )
                        }
                        aria-label={`Mostra o nascondi ${el.name}`}
                        className="p-1 hover:opacity-75"
                      >
                        {el.visible ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setElements((prev) =>
                            prev.map((item) =>
                              item.id === el.id ? { ...item, locked: !item.locked } : item
                            )
                          )
                        }
                        aria-label={`Blocca o sblocca ${el.name}`}
                        className="p-1 hover:opacity-75"
                      >
                        {el.locked ? (
                          <Lock className="w-3 h-3 text-[#D4A373]" />
                        ) : (
                          <Unlock className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {sortedElements.length === 0 && (
                <p className="text-xs text-[#1A2B4C]/60 py-4 text-center">
                  Nessun livello sul canvas. Disegna col pennello o incolla un asset dalla Clipboard.
                </p>
              )}
            </div>
          </div>

          {/* Clipboard Vettoriale & Asset Pre-caricati dal Ponte Lab Manager + Partner */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4A6B53]">
                Clipboard &amp; Asset Pronti (Ctrl+V)
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[#1A2B4C]/60">
                {clipboard.length} item
              </span>
            </div>
            <p className="text-[11px] text-[#1A2B4C]/70">
              Tocca un elemento qui sotto (inclusi i kit Partner caricati) per incollarlo sul Canvas.
            </p>
            <div className="space-y-1.5">
              {clipboard.map((clipItem) => (
                <button
                  key={clipItem.id}
                  type="button"
                  onClick={() => pasteFromClipboard(clipItem)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#EADDCD] hover:bg-[#D4A373]/30 border border-[#1A2B4C]/15 rounded-lg text-xs font-semibold text-[#1A2B4C] transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: clipItem.secondaryColor || clipItem.color }}
                    />
                    <span className="truncate">{clipItem.name}</span>
                  </div>
                  <span className="text-[11px] text-[#B85B43] shrink-0 ml-2">+ Incolla</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
