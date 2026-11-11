import React, { useEffect, useRef, useState } from 'react';
import {
  AlignOperationId,
  AlignTargetMode,
  BezierNode,
  BlobDrawMode,
  BRAND_PALETTE,
  BrandColorHex,
  BuilderFontFamily,
  BuilderFontWeight,
  CANVAS_PRESETS,
  CanvasPresetId,
  DrawingToolId,
  FONT_DECLINATIONS,
  PartnerProfile,
  PointerSample,
  ShapePrimitiveKind,
  StampKind,
  TextureFilterType,
  UploadedPngAsset,
  VectorElement,
  WorkshopCard,
} from '../types/erp';
import {
  alignAndDistributeElements,
  buildBezierPathFromNodes,
  buildPartnerVectorAssets,
  compressImageFileToDataUrl,
  computeSamplePressure,
  generateBrandStamp,
  generateFreeformCursorBlobPath,
  generateOrganicBlobPath,
  generateShapePrimitivePath,
  generateSmoothedBrushPath,
  generateTextVectorBackdropPath,
  generateWavyCheckerboardPath,
  rebuildPathFromControlPoints,
  translateVectorElementByDelta,
  wrapPosterText,
} from '../utils/vectorMath';
import { exportSvgCanvas } from '../utils/pdfExporter';
import { SvgTextureDefs, getFilterUrl } from './SvgTextureDefs';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  Combine,
  Copy,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Grid,
  ImagePlus,
  KeyRound,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  MousePointer,
  Paintbrush,
  PenTool,
  Pipette,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Shapes,
  Sparkles,
  Stamp,
  Sun,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
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
  backgroundColor?: BrandColorHex;
  setBackgroundColor?: (color: BrandColorHex) => void;
  workshops?: WorkshopCard[];
  activeWorkshopId?: string;
  onSelectWorkshop?: (workshopId: string) => void;
  onResetToWorkshopDefault?: () => void;
  partners: PartnerProfile[];
  selectedPartnerId: string;
  onSelectPartner: (partnerId: string) => void;
  onSavePartner?: (partner: PartnerProfile) => void;
  onOpenFontModal?: () => void;
  onSaveTemplateCloud?: () => void;
  isSavingCloud?: boolean;
  lastSavedLabel?: string;
}

const STAMP_CATALOG: Array<{ id: StampKind; label: string }> = [
  { id: 'seal-fatti-a-mano', label: 'Timbro "Fatti a mano"' },
  { id: 'matisse-leaf', label: 'Foglia Matisse' },
  { id: 'ink-splatter', label: 'Schizzo Inchiostro' },
  { id: 'craft-star', label: 'Stella Artigianale' },
  { id: 'brush-zig', label: 'Tratto Pennello' },
  { id: 'thread-loop', label: 'Filo Legatoria' },
];

const SHAPE_CATALOG: Array<{ id: ShapePrimitiveKind; label: string }> = [
  { id: 'rect', label: 'Rettangolo / Box' },
  { id: 'ellipse', label: 'Ellisse / Cerchio' },
  { id: 'polygon', label: 'Esagono Vettoriale' },
  { id: 'star', label: 'Stella a 5 Punte' },
];

const BUILDER_FONT_FAMILIES: Array<{
  id: BuilderFontFamily;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'Montserrat',
    label: 'Montserrat',
    subtitle: 'Geometric Sans-Serif · 18 Declinazioni (Thin 100 – Black 900 + Italic)',
  },
  {
    id: 'Akena Otos',
    label: 'Akena Otos',
    subtitle: 'Editorial Display Serif · 18 Declinazioni (Thin 100 – Black 900 + Italic)',
  },
];

const CUSTOM_FONT_STORAGE_KEYS: Record<BuilderFontFamily, string> = {
  'Akena Otos': 'fatti_a_mano_custom_font_akena_otos',
  Montserrat: 'fatti_a_mano_custom_font_montserrat',
};

const UPLOADED_PNGS_STORAGE_KEY = 'fatti_a_mano_uploaded_pngs_v1';

const DEFAULT_UPLOADED_PNGS: UploadedPngAsset[] = [
  {
    id: 'default-png-monstera',
    name: 'Foglia Botanica PNG',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240"><path d="M118 215 C90 190 42 155 46 112 C49 85 88 108 94 94 C72 64 60 28 84 18 C104 10 112 58 122 64 C122 25 138 6 158 14 C176 22 154 68 160 80 C182 52 212 42 218 66 C224 88 176 110 170 124 C196 118 220 135 208 162 C196 188 148 186 134 215 Z" fill="#4A6B53"/></svg>`
      ),
    width: 240,
    height: 240,
    createdAt: 1700000000000,
  },
  {
    id: 'default-png-vaso-terracotta',
    name: 'Anfora Ceramica PNG',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240"><path d="M88 34 H152 L142 68 C178 88 192 128 176 174 C164 204 144 216 120 216 C96 216 76 204 64 174 C48 128 62 88 98 68 Z" fill="#B85B43"/><path d="M82 52 C62 54 54 74 68 92" fill="none" stroke="#1A2B4C" stroke-width="10" stroke-linecap="round"/><path d="M158 52 C178 54 186 74 172 92" fill="none" stroke="#1A2B4C" stroke-width="10" stroke-linecap="round"/></svg>`
      ),
    width: 240,
    height: 240,
    createdAt: 1700000001000,
  },
];

export const GraphicBuilder: React.FC<GraphicBuilderProps> = ({
  elements,
  setElements,
  clipboard,
  setClipboard,
  canvasSize,
  setCanvasSize,
  backgroundColor: externalBgColor,
  setBackgroundColor: setExternalBgColor,
  workshops = [],
  activeWorkshopId = '',
  onSelectWorkshop,
  onResetToWorkshopDefault,
  partners,
  selectedPartnerId,
  onSelectPartner,
  onSavePartner,
  onOpenFontModal,
  onSaveTemplateCloud,
  isSavingCloud,
  lastSavedLabel,
}) => {
  // Tema Interfaccia: 'adobe-dark' (Stile Adobe Illustrator Pro) | 'kraft-light' (Beige Kraft Fatti a mano)
  const [workspaceTheme, setWorkspaceTheme] = useState<'adobe-dark' | 'kraft-light'>(() => {
    try {
      const saved = localStorage.getItem('fatti_a_mano_builder_theme');
      return saved === 'kraft-light' ? 'kraft-light' : 'adobe-dark';
    } catch {
      return 'adobe-dark';
    }
  });

  // Modalità Schermo Intero (Fullscreen) vs Ridotta
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreenMode = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        setZoom((z) => (z < 0.56 ? 0.62 : z));
        try {
          if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } catch {
          // fallback CSS fixed inset-0
        }
      } else {
        try {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const toggleWorkspaceTheme = () => {
    setWorkspaceTheme((prev) => {
      const next = prev === 'adobe-dark' ? 'kraft-light' : 'adobe-dark';
      try {
        localStorage.setItem('fatti_a_mano_builder_theme', next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Strumento attivo stile Adobe Illustrator
  const [activeTool, setActiveTool] = useState<DrawingToolId>('select');
  const [blobMode, setBlobMode] = useState<BlobDrawMode>('freeform-lasso');
  const [mergeBlobBrushWithSameColor, setMergeBlobBrushWithSameColor] = useState<boolean>(true);
  const [blobRoughness, setBlobRoughness] = useState<number>(0.1);

  // Impostazioni Colore Riempimento (Fill) & Traccia (Stroke)
  const [activeColor, setActiveColor] = useState<BrandColorHex>('#B85B43');
  const [activeStrokeColor, setActiveStrokeColor] = useState<string>('none');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(0);
  const [activeStrokeDash, setActiveStrokeDash] = useState<string>('');
  const [localBgColor, setLocalBgColor] = useState<BrandColorHex>('#EADDCD');
  const backgroundColor = externalBgColor || localBgColor;
  const setBackgroundColor = (hex: BrandColorHex) => {
    setLocalBgColor(hex);
    if (setExternalBgColor) {
      setExternalBgColor(hex);
    }
  };

  // Impostazioni Tipografiche Casella di Testo (Solo Montserrat e Akena Otos)
  const [activeFontFamily, setActiveFontFamily] = useState<BuilderFontFamily>('Montserrat');
  const [activeFontWeight, setActiveFontWeight] = useState<BuilderFontWeight>(700);
  const [activeFontItalic, setActiveFontItalic] = useState<boolean>(false);
  const [activeFontSize, setActiveFontSize] = useState<number>(56);
  const [activeLineHeight, setActiveLineHeight] = useState<number>(1.2);
  const [activeLetterSpacing, setActiveLetterSpacing] = useState<number>(0);
  const [activeTextAlign, setActiveTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [activeTextTransform, setActiveTextTransform] = useState<
    'none' | 'uppercase' | 'lowercase'
  >('none');
  const [customLoadedFonts, setCustomLoadedFonts] = useState<Record<BuilderFontFamily, string>>({
    Montserrat: '',
    'Akena Otos': '',
  });

  // Impostazioni Forme, Timbri e Texture
  const [activeTexture, setActiveTexture] = useState<TextureFilterType>('none');
  const [activeStamp, setActiveStamp] = useState<StampKind>('seal-fatti-a-mano');
  const [activeShapeKind, setActiveShapeKind] = useState<ShapePrimitiveKind>('rect');
  const [activeCornerRadius, setActiveCornerRadius] = useState<number>(16);
  const [brushSize, setBrushSize] = useState<number>(28);

  // Selezione Singola & Multipla (Shift+Click) + Oggetto Chiave per Pannello Allinea Illustrator
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [keyObjectId, setKeyObjectId] = useState<string | null>(null);
  const [alignTargetMode, setAlignTargetMode] = useState<AlignTargetMode>('artboard');
  const [distributeSpacingValue, setDistributeSpacingValue] = useState<number>(0);

  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [rightDockTab, setRightDockTab] = useState<
    'character' | 'properties' | 'uploads' | 'layers'
  >('properties');
  const [zoom, setZoom] = useState<number>(0.48);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Libreria Caricamenti PNG (Stile Canva) salvata in localStorage
  const [uploadedPngs, setUploadedPngs] = useState<UploadedPngAsset[]>(() => {
    try {
      const raw = localStorage.getItem(UPLOADED_PNGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UploadedPngAsset[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_UPLOADED_PNGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(UPLOADED_PNGS_STORAGE_KEY, JSON.stringify(uploadedPngs));
    } catch {
      // ignore storage quota errors
    }
  }, [uploadedPngs]);

  // Bezier Pen Tool (P): punti di ancoraggio + maniglie direzionali (inX/inY, outX/outY)
  const [penDraftNodes, setPenDraftNodes] = useState<BezierNode[]>([]);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number }>({ x: 540, y: 675 });

  // Undo / Redo Stack (fino a 40 step)
  const [historyPast, setHistoryPast] = useState<VectorElement[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<VectorElement[][]>([]);

  // Input & Pointer telemetry per Apple Pencil / Trackpad / Palm Rejection
  const [pointerModeLabel, setPointerModeLabel] = useState<string>(
    'Illustrator Vector Engine · Penna Bézier, Allinea & Caricamenti PNG'
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
  const fontFileInputRef = useRef<HTMLInputElement | null>(null);
  const pngUploadInputRef = useRef<HTMLInputElement | null>(null);
  const partnerLogoInputRef = useRef<HTMLInputElement | null>(null);

  const isDrawingRef = useRef<boolean>(false);
  // Riferimento attivo mentre l'utente trascina per estrarre le maniglie di Bézier appena cliccato col Pen Tool (P)
  const isDraggingPenDraftHandleRef = useRef<{
    nodeIndex: number;
  } | null>(null);

  const isDraggingElementRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origControlPoints?: Array<{ x: number; y: number }>;
    origBezierNodes?: BezierNode[];
  } | null>(null);

  const isDraggingNodeRef = useRef<{
    elementId: string;
    nodeIndex: number;
    handleType: 'anchor' | 'in' | 'out';
  } | null>(null);

  const isResizingHandleRef = useRef<{
    elementId: string;
    handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    origFontSize: number;
  } | null>(null);

  const penActiveTimestampRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | null>(null);
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistanceRef = useRef<number | null>(null);

  const activePartner = partners.find((p) => p.id === selectedPartnerId) || null;
  const selectedElement = elements.find((el) => el.id === selectedId) || null;

  // Mantiene sincronizzati selectedId e selectedIds
  const selectSingleElement = (id: string | null) => {
    setSelectedId(id);
    setSelectedIds(id ? [id] : []);
    setKeyObjectId(null);
  };

  const toggleMultiSelectElement = (id: string) => {
    setSelectedIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
      setSelectedId(next[next.length - 1] || null);
      if (next.length >= 2 && alignTargetMode === 'artboard') {
        setAlignTargetMode('selection');
      }
      return next;
    });
  };

  const notify = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3200);
  };

  // Registra eventuali font OTF/TTF personalizzati salvati in precedenza in localStorage
  useEffect(() => {
    (['Akena Otos', 'Montserrat'] as BuilderFontFamily[]).forEach((family) => {
      try {
        const stored = localStorage.getItem(CUSTOM_FONT_STORAGE_KEYS[family]);
        if (stored) {
          const parsed = JSON.parse(stored) as { fileName: string; dataUrl: string };
          if (parsed?.dataUrl && typeof FontFace !== 'undefined') {
            const faceNormal = new FontFace(family, `url(${parsed.dataUrl})`, {
              weight: '100 900',
              style: 'normal',
            });
            const faceItalic = new FontFace(family, `url(${parsed.dataUrl})`, {
              weight: '100 900',
              style: 'italic',
            });
            Promise.all([faceNormal.load(), faceItalic.load()])
              .then(([loadedNormal, loadedItalic]) => {
                document.fonts.add(loadedNormal);
                document.fonts.add(loadedItalic);
                setCustomLoadedFonts((prev) => ({ ...prev, [family]: parsed.fileName }));
              })
              .catch(() => {
                // ignore invalid font blob
              });
          }
        }
      } catch {
        // ignore storage errors
      }
    });
  }, []);

  // Quando l'utente seleziona un elemento testuale, sincronizza i controlli del pannello Carattere
  useEffect(() => {
    if (!selectedElement) return;
    if (selectedElement.type === 'textured-text') {
      const resolvedFamily: BuilderFontFamily =
        selectedElement.fontFamily === 'Montserrat' || selectedElement.fontFamily === 'Akena Otos'
          ? selectedElement.fontFamily
          : selectedElement.fontStyle === 'editorial-serif'
          ? 'Akena Otos'
          : 'Montserrat';
      setActiveFontFamily(resolvedFamily);
      setActiveFontWeight((selectedElement.fontWeight as BuilderFontWeight) || 600);
      setActiveFontItalic(Boolean(selectedElement.fontItalic));
      setActiveFontSize(selectedElement.fontSize || 48);
      setActiveLineHeight(selectedElement.lineHeight || 1.2);
      setActiveLetterSpacing(selectedElement.letterSpacing ?? 0);
      setActiveTextAlign(selectedElement.textAlign || 'center');
      setActiveTextTransform(selectedElement.textTransform || 'none');
    }
  }, [selectedId]);

  // Funzione helper per salvare nello stack Undo prima di una modifica
  const commitElementsChange = (
    updater: (prev: VectorElement[]) => VectorElement[]
  ) => {
    setElements((prev) => {
      const next = updater(prev);
      if (next !== prev) {
        setHistoryPast((past) => [...past.slice(-39), prev]);
        setHistoryFuture([]);
      }
      return next;
    });
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((past) => past.slice(0, -1));
    setHistoryFuture((future) => [elements, ...future.slice(0, 39)]);
    setElements(previous);
    notify('Annullato (Undo)');
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((future) => future.slice(1));
    setHistoryPast((past) => [...past.slice(-39), elements]);
    setElements(next);
    notify('Ripristinato (Redo)');
  };

  // Caricamento file .otf / .ttf / .woff2 per Akena Otos o Montserrat
  const handleCustomFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetFamily = activeFontFamily;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl || typeof FontFace === 'undefined') return;
      try {
        const faceNormal = new FontFace(targetFamily, `url(${dataUrl})`, {
          weight: '100 900',
          style: 'normal',
        });
        const faceItalic = new FontFace(targetFamily, `url(${dataUrl})`, {
          weight: '100 900',
          style: 'italic',
        });
        const [loadedNormal, loadedItalic] = await Promise.all([
          faceNormal.load(),
          faceItalic.load(),
        ]);
        document.fonts.add(loadedNormal);
        document.fonts.add(loadedItalic);
        setCustomLoadedFonts((prev) => ({ ...prev, [targetFamily]: file.name }));
        try {
          localStorage.setItem(
            CUSTOM_FONT_STORAGE_KEYS[targetFamily],
            JSON.stringify({ fileName: file.name, dataUrl })
          );
        } catch {
          // Quota localStorage superata, il font resta comunque attivo nella sessione corrente
        }
        notify(`Font "${targetFamily}" (${file.name}) caricato e attivato su tutte le declinazioni!`);
      } catch {
        notify(`Impossibile leggere il file font ${file.name}. Usa un file .otf, .ttf o .woff2 valido.`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Caricamento file PNG nella Libreria "Caricamenti" (Stile Canva)
  const handleUploadPngFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAssets: UploadedPngAsset[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { dataUrl, width, height } = await compressImageFileToDataUrl(file, 720);
        const asset: UploadedPngAsset = {
          id: `png-${Date.now()}-${i}`,
          name: file.name.replace(/\.[^.]+$/, '') || 'Immagine PNG',
          dataUrl,
          width,
          height,
          createdAt: Date.now(),
        };
        newAssets.push(asset);
      } catch (err) {
        console.error('Errore caricamento PNG:', err);
      }
    }

    if (newAssets.length > 0) {
      setUploadedPngs((prev) => [...newAssets, ...prev]);
      // Inserisce subito il primo PNG caricato sulla tavola da disegno!
      insertPngAssetOnCanvas(newAssets[0]);
      notify(`Caricato "${newAssets[0].name}" in Caricamenti e aggiunto alla locandina!`);
    }
    e.target.value = '';
  };

  const insertPngAssetOnCanvas = (asset: UploadedPngAsset) => {
    const maxZ = elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);
    const maxSide = 340;
    const ratio = Math.min(1, maxSide / Math.max(asset.width || 240, asset.height || 240));
    const w = Math.max(80, Math.round((asset.width || 240) * ratio));
    const h = Math.max(80, Math.round((asset.height || 240) * ratio));

    const newImageLayer: VectorElement = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: `PNG: ${asset.name}`,
      type: 'image',
      x: Math.round(canvasSize.width / 2),
      y: Math.round(canvasSize.height / 2),
      width: w,
      height: h,
      rotation: 0,
      scale: 1,
      color: activeColor,
      opacity: 1,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      pathData: '',
      imageUrl: asset.dataUrl,
      textureType: 'none',
    };
    commitElementsChange((prev) => [...prev, newImageLayer]);
    selectSingleElement(newImageLayer.id);
    notify(`Inserito "${asset.name}" sulla tavola da disegno`);
  };

  const handleRemoveUploadedPng = (id: string) => {
    setUploadedPngs((prev) => prev.filter((item) => item.id !== id));
    notify('Immagine rimossa dalla libreria Caricamenti');
  };

  // Caricamento Logo Partner direttamente dal Builder Grafico
  const handleBuilderPartnerLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePartner) return;
    try {
      const { dataUrl } = await compressImageFileToDataUrl(file, 420);
      const updatedPartner: PartnerProfile = {
        ...activePartner,
        logoImageUrl: dataUrl,
        clientUpdatedAt: Date.now(),
      };
      if (onSavePartner) {
        onSavePartner(updatedPartner);
      }
      const { partnerElements } = buildPartnerVectorAssets(
        updatedPartner,
        canvasSize.width,
        canvasSize.height
      );
      commitElementsChange((prev) => {
        const withoutOld = prev.filter((el) => !el.id.startsWith('partner-badge-'));
        return [...withoutOld, partnerElements[0]];
      });
      selectSingleElement(partnerElements[0].id);
      notify(`Logo di ${activePartner.name} caricato e inserito sulla locandina!`);
    } catch (err) {
      console.error('Errore upload logo partner:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handlePartnerDropdownChange = (partnerId: string) => {
    onSelectPartner(partnerId);
    if (!partnerId) {
      notify('Nessun partner selezionato: ripristinata palette Fatti a mano');
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

    commitElementsChange((prev) => {
      const withoutOldPartnerBadge = prev.filter(
        (el) => !el.id.startsWith('partner-badge-')
      );
      return [...withoutOldPartnerBadge, partnerElements[0]];
    });

    setClipboard((prev) => {
      const withoutOldPartnerClips = prev.filter(
        (el) => !el.id.startsWith('clip-partner-')
      );
      return [...partnerClipboard, ...withoutOldPartnerClips].slice(0, 8);
    });

    notify(`Caricato Brand Kit "${chosen.name}"`);
  };

  const handleInsertFullPartnerKitOnCanvas = () => {
    if (!activePartner) return;
    const { partnerElements } = buildPartnerVectorAssets(
      activePartner,
      canvasSize.width,
      canvasSize.height
    );
    commitElementsChange((prev) => {
      const withoutOld = prev.filter(
        (el) =>
          !el.id.startsWith(`partner-badge-${activePartner.id}`) &&
          !el.id.startsWith(`partner-blob-${activePartner.id}`)
      );
      return [...withoutOld, ...partnerElements];
    });
    notify(`Inseriti Logo e Macchia Palette di ${activePartner.name}`);
  };

  // Finalizza il tracciato Penna Bézier (P) con punti di ancoraggio e maniglie direzionali
  const finishPenPath = (closed = true) => {
    isDraggingPenDraftHandleRef.current = null;
    if (penDraftNodes.length < 2) {
      setPenDraftNodes([]);
      return;
    }
    const maxZ = elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);
    const rebuilt = buildBezierPathFromNodes(penDraftNodes, closed);
    const newPenEl: VectorElement = {
      id: `pen-${Date.now()}`,
      name: closed ? 'Tracciato Penna Bézier Chiuso' : 'Tracciato Penna Bézier Aperto',
      type: 'pen-path',
      x: rebuilt.x,
      y: rebuilt.y,
      width: rebuilt.width,
      height: rebuilt.height,
      rotation: 0,
      scale: 1,
      color: closed ? activeColor : 'none',
      strokeColor: activeStrokeColor !== 'none' ? activeStrokeColor : activeColor,
      strokeWidth: activeStrokeWidth > 0 ? activeStrokeWidth : closed ? 3 : 5,
      strokeDasharray: activeStrokeDash,
      opacity: 0.96,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      pathData: rebuilt.pathData,
      controlPoints: rebuilt.controlPoints,
      bezierNodes: penDraftNodes,
      closedPath: closed,
      textureType: activeTexture,
    };
    commitElementsChange((prev) => [...prev, newPenEl]);
    selectSingleElement(newPenEl.id);
    setPenDraftNodes([]);
    notify('Tracciato Bézier completato (modificabile con ancore e maniglie "A")');
  };

  // Esegue un'operazione del Pannello "Allinea" di Adobe Illustrator
  const executeIllustratorAlign = (operation: AlignOperationId) => {
    const activeSelectionIds =
      selectedIds.length > 0
        ? selectedIds
        : selectedId
        ? [selectedId]
        : [];

    // Se è un'operazione di distribuzione e c'è solo 1 o 0 oggetti selezionati, ma ci sono più oggetti sulla tavola,
    // se in modalità 'artboard' distribuiamo tutti i livelli non bloccati oppure avvisiamo di fare Shift+Clic
    let targetIds = activeSelectionIds;
    if (
      (operation.startsWith('distribute-')) &&
      targetIds.length < 2
    ) {
      const unlockedIds = elements.filter((e) => !e.locked && e.visible).map((e) => e.id);
      if (unlockedIds.length >= 2 && alignTargetMode === 'artboard') {
        targetIds = unlockedIds;
      } else {
        notify('Seleziona 2 o più oggetti (Shift + Clic) per distribuirli tra loro');
        return;
      }
    }

    if (targetIds.length === 0) {
      notify('Seleziona almeno un oggetto sulla tavola per allinearlo');
      return;
    }

    commitElementsChange((prev) =>
      alignAndDistributeElements(
        prev,
        targetIds,
        operation,
        alignTargetMode,
        canvasSize.width,
        canvasSize.height,
        keyObjectId || targetIds[0],
        distributeSpacingValue
      )
    );
    notify(`Applicato allineamento Illustrator (${operation})`);
  };

  // Scorciatoie da tastiera stile Adobe Illustrator (V, A, P, B, Shift+B, T, M, W, S, I, F, Ctrl+Z, Ctrl+C, Ctrl+V, Invio, Canc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (selectedId) {
          const found = elements.find((el) => el.id === selectedId);
          if (found) {
            setClipboard((prev) => [{ ...found, id: `clip-${Date.now()}` }, ...prev.slice(0, 7)]);
            notify(`Copiato "${found.name}" negli appunti`);
          }
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
          e.preventDefault();
          pasteFromClipboard(clipboard[0]);
        }
        return;
      }

      if (e.key === 'Enter' && activeTool === 'pen' && penDraftNodes.length >= 2) {
        e.preventDefault();
        finishPenPath(true);
        return;
      }

      if (e.key === 'Escape') {
        isDraggingPenDraftHandleRef.current = null;
        setPenDraftNodes([]);
        selectSingleElement(null);
        setSelectedNodeIndex(null);
        if (isFullscreen) {
          setIsFullscreen(false);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const idsToRemove = new Set(
          selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : []
        );
        if (idsToRemove.size > 0) {
          commitElementsChange((prev) =>
            prev.filter((el) => !idsToRemove.has(el.id) || el.locked)
          );
          selectSingleElement(null);
          setSelectedNodeIndex(null);
        }
        return;
      }

      // Single-key Illustrator tool shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'v') setActiveTool('select');
        else if (k === 'a') setActiveTool('direct-select');
        else if (k === 'p') setActiveTool('pen');
        else if (k === 'b' && e.shiftKey) setActiveTool('blob');
        else if (k === 'b' && !e.shiftKey) setActiveTool('brush');
        else if (k === 't') {
          setActiveTool('text-box');
          setRightDockTab('character');
        } else if (k === 'm') setActiveTool('shape');
        else if (k === 'w') setActiveTool('checkerboard');
        else if (k === 's') setActiveTool('stamp');
        else if (k === 'i') setActiveTool('eyedropper');
        else if (k === 'f') toggleFullscreenMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedId,
    selectedIds,
    elements,
    clipboard,
    activeTool,
    penDraftNodes,
    historyPast,
    historyFuture,
    isFullscreen,
  ]);

  const toCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvasSize.width;
    const y = ((clientY - rect.top) / rect.height) * canvasSize.height;
    return { x: Math.round(x), y: Math.round(y) };
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
    commitElementsChange((prev) => [...prev, cloned]);
    selectSingleElement(cloned.id);
    notify(`Incollato "${item.name}"`);
  };

  // Crea una nuova Casella di Testo con Montserrat o Akena Otos e la declinazione scelta
  const createNewTextBoxAt = (x: number, y: number, boxWidth = 520) => {
    const maxZ = elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);
    const defaultText = 'Nuova Casella di Testo\nModifica con Montserrat o Akena Otos';
    const wrapped = wrapPosterText(
      defaultText,
      Math.max(12, Math.floor(boxWidth / (activeFontSize * 0.55)))
    );
    const meta =
      activeTexture !== 'none'
        ? generateTextVectorBackdropPath(wrapped, x, y, activeFontSize, activeTexture)
        : {
            width: Math.max(260, boxWidth),
            height: Math.max(110, Math.round(activeFontSize * activeLineHeight * 2.4)),
            pathData: '',
          };

    const declLabel =
      FONT_DECLINATIONS.find(
        (d) => d.weight === activeFontWeight && d.italic === activeFontItalic
      )?.label || `${activeFontWeight}`;

    const newTextBox: VectorElement = {
      id: `textbox-${Date.now()}`,
      name: `Testo ${activeFontFamily} (${declLabel})`,
      type: 'textured-text',
      x,
      y,
      width: meta.width,
      height: meta.height,
      rotation: 0,
      scale: 1,
      color: activeColor,
      secondaryColor: activePartner?.palette?.[1] || '#D4A373',
      strokeColor: activeStrokeColor,
      strokeWidth: activeStrokeWidth,
      opacity: 1,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      pathData: meta.pathData,
      textureType: activeTexture,
      textContent: defaultText,
      fontStyle: activeFontFamily === 'Akena Otos' ? 'editorial-serif' : 'craft-rounded',
      fontFamily: activeFontFamily,
      fontWeight: activeFontWeight,
      fontItalic: activeFontItalic,
      fontSize: activeFontSize,
      lineHeight: activeLineHeight,
      letterSpacing: activeLetterSpacing,
      textAlign: activeTextAlign,
      textTransform: activeTextTransform,
      textBoxWidth: boxWidth,
    };

    commitElementsChange((prev) => [...prev, newTextBox]);
    selectSingleElement(newTextBox.id);
    setRightDockTab('character');
    setActiveTool('select');
    notify(`Aggiunta Casella di Testo in ${activeFontFamily} (${declLabel})`);
  };

  // Aggiorna una proprietà dell'elemento testuale selezionato e ricalcola eventuale fondino
  const updateSelectedTextProperty = (patch: Partial<VectorElement>) => {
    if (!selectedElement) return;
    commitElementsChange((prev) =>
      prev.map((el) => {
        if (el.id !== selectedElement.id || el.locked) return el;
        const merged: VectorElement = { ...el, ...patch };
        const fSize = merged.fontSize || 48;
        const lHeight = merged.lineHeight || 1.2;
        const rawText = merged.textContent || 'Testo';
        const boxW = merged.textBoxWidth || merged.width || 480;
        const maxChars = Math.max(8, Math.floor(boxW / Math.max(10, fSize * 0.54)));
        const wrapped = wrapPosterText(rawText, maxChars);
        const linesCount = wrapped.split('\n').length;

        if (merged.textureType === 'materic-blob' || merged.pathData) {
          const meta = generateTextVectorBackdropPath(
            wrapped,
            merged.x,
            merged.y,
            fSize,
            merged.textureType
          );
          return {
            ...merged,
            width: Math.max(boxW, meta.width),
            height: Math.max(Math.round(linesCount * fSize * lHeight + 36), meta.height),
            pathData: merged.textureType === 'none' ? '' : meta.pathData,
          };
        }

        return {
          ...merged,
          width: Math.max(180, boxW),
          height: Math.max(70, Math.round(linesCount * fSize * lHeight + 32)),
        };
      })
    );
  };

  // Pathfinder: Unisci Tracciato Selezionato col livello sottostante (Unite / Compound Path)
  const handlePathfinderUnite = () => {
    if (!selectedElement) return;
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((el) => el.id === selectedElement.id);
    if (idx <= 0) {
      notify('Seleziona un livello sopra un altro tracciato per unirli con Pathfinder');
      return;
    }
    const targetBelow = sorted[idx - 1];
    if (!targetBelow.pathData || !selectedElement.pathData) {
      notify('Entrambi i livelli devono avere un tracciato vettoriale per essere uniti');
      return;
    }

    const minX = Math.min(
      selectedElement.x - selectedElement.width / 2,
      targetBelow.x - targetBelow.width / 2
    );
    const maxX = Math.max(
      selectedElement.x + selectedElement.width / 2,
      targetBelow.x + targetBelow.width / 2
    );
    const minY = Math.min(
      selectedElement.y - selectedElement.height / 2,
      targetBelow.y - targetBelow.height / 2
    );
    const maxY = Math.max(
      selectedElement.y + selectedElement.height / 2,
      targetBelow.y + targetBelow.height / 2
    );

    const mergedControlPoints = [
      ...(targetBelow.controlPoints || []),
      ...(selectedElement.controlPoints || []),
    ].slice(0, 36);

    const unitedElement: VectorElement = {
      ...targetBelow,
      id: `united-${Date.now()}`,
      name: `Unione: ${targetBelow.name} + ${selectedElement.name}`,
      type: 'blob',
      x: Math.round((minX + maxX) / 2),
      y: Math.round((minY + maxY) / 2),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
      color: selectedElement.color,
      pathData: `${targetBelow.pathData} ${selectedElement.pathData}`,
      controlPoints: mergedControlPoints,
    };

    commitElementsChange((prev) =>
      prev
        .filter((el) => el.id !== selectedElement.id && el.id !== targetBelow.id)
        .concat(unitedElement)
    );
    selectSingleElement(unitedElement.id);
    notify('Pathfinder: Tracciati uniti in una forma composta!');
  };

  // Converte qualsiasi forma selezionata in un tracciato Bézier con maniglie modificabili (A)
  const handleConvertSelectedToOrganicBlob = () => {
    if (!selectedElement || selectedElement.locked) return;
    const rx = Math.max(40, selectedElement.width / 2);
    const ry = Math.max(40, selectedElement.height / 2);
    const lobes = 8;
    const bezierNodes: BezierNode[] = [];
    for (let i = 0; i < lobes; i++) {
      const angle = (i / lobes) * Math.PI * 2;
      const factor = 1 + Math.sin(angle * 2 + i) * 0.14;
      const ax = Math.round(selectedElement.x + Math.cos(angle) * rx * factor);
      const ay = Math.round(selectedElement.y + Math.sin(angle) * ry * factor);
      const tangentX = -Math.sin(angle) * rx * 0.28;
      const tangentY = Math.cos(angle) * ry * 0.28;
      bezierNodes.push({
        x: ax,
        y: ay,
        inX: Math.round(ax - tangentX),
        inY: Math.round(ay - tangentY),
        outX: Math.round(ax + tangentX),
        outY: Math.round(ay + tangentY),
      });
    }
    const rebuilt = buildBezierPathFromNodes(bezierNodes, true);
    commitElementsChange((prev) =>
      prev.map((el) =>
        el.id === selectedElement.id
          ? {
              ...el,
              type: 'pen-path',
              pathData: rebuilt.pathData,
              controlPoints: rebuilt.controlPoints,
              bezierNodes,
              closedPath: true,
            }
          : el
      )
    );
    setActiveTool('direct-select');
    notify('Convertito in Tracciato Bézier con ancore e maniglie direzionali (trascinale con A)');
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchesRef.current.size === 2) {
        const pts = Array.from(activeTouchesRef.current.values());
        pinchDistanceRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        isDrawingRef.current = false;
        return;
      }
      if (performance.now() - penActiveTimestampRef.current < 800) {
        setPointerModeLabel('Palm Rejection attivo (Apple Pencil prioritaria)');
        return;
      }
    }

    if (e.pointerType === 'pen') {
      penActiveTimestampRef.current = performance.now();
      setPointerModeLabel(`Apple Pencil · Pressione ${(e.pressure * 100).toFixed(0)}%`);
    } else if (e.pointerType === 'mouse') {
      setPointerModeLabel('Cursore Precisione Illustrator · Penna Bézier & Allinea');
    } else {
      setPointerModeLabel('Touch iPad · Gesture & Disegno');
    }

    const coords = toCanvasCoords(e.clientX, e.clientY);
    setCursorCoords(coords);

    if (activeTool === 'select' || activeTool === 'direct-select') {
      if (e.target === svgRef.current || (e.target as SVGElement).dataset.bg === 'true') {
        selectSingleElement(null);
        setSelectedNodeIndex(null);
      }
      return;
    }

    // Strumento Penna di Bézier (P): clic per posizionare ancora, trascina per estrarre le maniglie direzionali!
    if (activeTool === 'pen') {
      if (
        penDraftNodes.length >= 2 &&
        Math.hypot(coords.x - penDraftNodes[0].x, coords.y - penDraftNodes[0].y) < 28
      ) {
        finishPenPath(true);
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      const nextIndex = penDraftNodes.length;
      const newNode: BezierNode = {
        x: coords.x,
        y: coords.y,
        inX: coords.x,
        inY: coords.y,
        outX: coords.x,
        outY: coords.y,
      };
      setPenDraftNodes((prev) => [...prev, newNode]);
      isDraggingPenDraftHandleRef.current = { nodeIndex: nextIndex };
      return;
    }

    // Strumento Casella di Testo (T) con Montserrat / Akena Otos
    if (activeTool === 'text-box' || activeTool === 'textured-text') {
      createNewTextBoxAt(coords.x, coords.y, 520);
      return;
    }

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
      commitElementsChange((prev) => [...prev, newStamp]);
      selectSingleElement(newStamp.id);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    // Forme Geometriche (M) o Wavy Checkerboard (W) usano drag di dimensionamento
    if (activeTool === 'shape' || activeTool === 'checkerboard') {
      isDrawingRef.current = true;
      setDragBox({
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x + 12,
        currentY: coords.y + 12,
      });
      return;
    }

    // MACCHIA BLOB COL CURSORE (Shift+B) E PENNELLO FLUIDO (B):
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
        setZoom((z) => Math.min(1.5, Math.max(0.25, z * ratio)));
        pinchDistanceRef.current = dist;
        return;
      }
    }

    const coords = toCanvasCoords(e.clientX, e.clientY);
    setCursorCoords(coords);

    // 0. Estrazione simmetrica delle maniglie direzionali durante il clic-e-trascina col Pen Tool (P)
    if (isDraggingPenDraftHandleRef.current) {
      const { nodeIndex } = isDraggingPenDraftHandleRef.current;
      setPenDraftNodes((prev) =>
        prev.map((node, idx) => {
          if (idx !== nodeIndex) return node;
          return {
            ...node,
            outX: coords.x,
            outY: coords.y,
            inX: Math.round(2 * node.x - coords.x),
            inY: Math.round(2 * node.y - coords.y),
          };
        })
      );
      return;
    }

    // 1. Trascinamento di un Punto di Ancoraggio o di una Maniglia di Bézier con Selezione Diretta (A)
    if (isDraggingNodeRef.current) {
      const { elementId, nodeIndex, handleType } = isDraggingNodeRef.current;
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== elementId || el.locked) return el;

          // Se l'elemento possiede nodi Bézier completi con maniglie (inX/inY, outX/outY)
          if (Array.isArray(el.bezierNodes) && el.bezierNodes.length > 0) {
            const nextBezierNodes = el.bezierNodes.map((n, idx) => {
              if (idx !== nodeIndex) return n;
              if (handleType === 'anchor') {
                const dx = coords.x - n.x;
                const dy = coords.y - n.y;
                return {
                  x: coords.x,
                  y: coords.y,
                  inX: Math.round(n.inX + dx),
                  inY: Math.round(n.inY + dy),
                  outX: Math.round(n.outX + dx),
                  outY: Math.round(n.outY + dy),
                };
              }
              if (handleType === 'out') {
                return {
                  ...n,
                  outX: coords.x,
                  outY: coords.y,
                  inX: e.altKey ? n.inX : Math.round(2 * n.x - coords.x),
                  inY: e.altKey ? n.inY : Math.round(2 * n.y - coords.y),
                };
              }
              // handleType === 'in'
              return {
                ...n,
                inX: coords.x,
                inY: coords.y,
                outX: e.altKey ? n.outX : Math.round(2 * n.x - coords.x),
                outY: e.altKey ? n.outY : Math.round(2 * n.y - coords.y),
              };
            });

            const rebuilt = buildBezierPathFromNodes(
              nextBezierNodes,
              el.closedPath !== false
            );
            return {
              ...el,
              x: rebuilt.x,
              y: rebuilt.y,
              width: rebuilt.width,
              height: rebuilt.height,
              pathData: rebuilt.pathData,
              controlPoints: rebuilt.controlPoints,
              bezierNodes: nextBezierNodes,
            };
          }

          if (!el.controlPoints) return el;
          const nextPts = el.controlPoints.map((pt, idx) =>
            idx === nodeIndex ? { x: coords.x, y: coords.y } : pt
          );
          const rebuilt = rebuildPathFromControlPoints(
            nextPts,
            el.closedPath !== false
          );
          return {
            ...el,
            x: rebuilt.x,
            y: rebuilt.y,
            width: rebuilt.width,
            height: rebuilt.height,
            pathData: rebuilt.pathData,
            controlPoints: nextPts,
          };
        })
      );
      return;
    }

    // 2. Ridimensionamento tramite le 8 maniglie del Bounding Box Illustrator
    if (isResizingHandleRef.current) {
      const resize = isResizingHandleRef.current;
      const dx = coords.x - resize.startX;
      const dy = coords.y - resize.startY;
      const scaleFactorX =
        resize.handle.includes('e')
          ? (resize.origW + dx * 2) / Math.max(20, resize.origW)
          : resize.handle.includes('w')
          ? (resize.origW - dx * 2) / Math.max(20, resize.origW)
          : 1;
      const scaleFactorY =
        resize.handle.includes('s')
          ? (resize.origH + dy * 2) / Math.max(20, resize.origH)
          : resize.handle.includes('n')
          ? (resize.origH - dy * 2) / Math.max(20, resize.origH)
          : 1;

      const clampedScaleX = Math.max(0.25, Math.min(4, scaleFactorX));
      const clampedScaleY = Math.max(0.25, Math.min(4, scaleFactorY));
      const newW = Math.max(40, Math.round(resize.origW * clampedScaleX));
      const newH = Math.max(40, Math.round(resize.origH * clampedScaleY));

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== resize.elementId || el.locked) return el;
          if (Array.isArray(el.bezierNodes) && el.bezierNodes.length >= 2) {
            const sx = newW / Math.max(20, el.width);
            const sy = newH / Math.max(20, el.height);
            const scaledNodes = el.bezierNodes.map((n) => ({
              x: Math.round(el.x + (n.x - el.x) * sx),
              y: Math.round(el.y + (n.y - el.y) * sy),
              inX: Math.round(el.x + (n.inX - el.x) * sx),
              inY: Math.round(el.y + (n.inY - el.y) * sy),
              outX: Math.round(el.x + (n.outX - el.x) * sx),
              outY: Math.round(el.y + (n.outY - el.y) * sy),
            }));
            const rebuilt = buildBezierPathFromNodes(
              scaledNodes,
              el.closedPath !== false
            );
            return {
              ...el,
              width: newW,
              height: newH,
              pathData: rebuilt.pathData,
              controlPoints: rebuilt.controlPoints,
              bezierNodes: scaledNodes,
            };
          }
          if (el.controlPoints && el.controlPoints.length >= 3) {
            const scaledPts = el.controlPoints.map((pt) => ({
              x: Math.round(el.x + (pt.x - el.x) * (newW / Math.max(20, el.width))),
              y: Math.round(el.y + (pt.y - el.y) * (newH / Math.max(20, el.height))),
            }));
            const rebuilt = rebuildPathFromControlPoints(scaledPts, true);
            return {
              ...el,
              width: newW,
              height: newH,
              pathData: rebuilt.pathData,
              controlPoints: scaledPts,
            };
          }
          if (el.type === 'textured-text') {
            const nextFontSize = Math.max(
              14,
              Math.min(180, Math.round(resize.origFontSize * ((clampedScaleX + clampedScaleY) / 2)))
            );
            return {
              ...el,
              width: newW,
              height: newH,
              textBoxWidth: newW,
              fontSize: nextFontSize,
            };
          }
          if (el.type === 'blob') {
            return {
              ...el,
              width: newW,
              height: newH,
              pathData: generateOrganicBlobPath(el.x, el.y, newW / 2, newH / 2, 2.5),
            };
          }
          return { ...el, width: newW, height: newH };
        })
      );
      return;
    }

    // 3. Trascinamento dell'intero elemento selezionato
    if (isDraggingElementRef.current) {
      const drag = isDraggingElementRef.current;
      const dx = coords.x - drag.startX;
      const dy = coords.y - drag.startY;
      if (Math.hypot(dx, dy) > 4 && longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== drag.id || el.locked) return el;
          const baseEl: VectorElement = {
            ...el,
            x: drag.origX,
            y: drag.origY,
            controlPoints: drag.origControlPoints || el.controlPoints,
            bezierNodes: drag.origBezierNodes || el.bezierNodes,
          };
          return translateVectorElementByDelta(baseEl, dx, dy);
        })
      );
      return;
    }

    if (!isDrawingRef.current) return;

    if (activeTool === 'shape' || activeTool === 'checkerboard') {
      setDragBox((prev) =>
        prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null
      );
      return;
    }

    if (activeTool === 'blob' || activeTool === 'brush') {
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

    if (isDraggingPenDraftHandleRef.current) {
      isDraggingPenDraftHandleRef.current = null;
      return;
    }
    if (isDraggingNodeRef.current) {
      isDraggingNodeRef.current = null;
      return;
    }
    if (isResizingHandleRef.current) {
      isResizingHandleRef.current = null;
      return;
    }
    if (isDraggingElementRef.current) {
      isDraggingElementRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const maxZ = elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0);

    // Creazione Forme Geometriche (M) o Wavy Checkerboard (W)
    if ((activeTool === 'shape' || activeTool === 'checkerboard') && dragBox) {
      const minX = Math.min(dragBox.startX, dragBox.currentX);
      const minY = Math.min(dragBox.startY, dragBox.currentY);
      const w = Math.max(90, Math.abs(dragBox.currentX - dragBox.startX));
      const h = Math.max(90, Math.abs(dragBox.currentY - dragBox.startY));
      const cx = Math.round(minX + w / 2);
      const cy = Math.round(minY + h / 2);

      if (activeTool === 'shape') {
        const shapeData = generateShapePrimitivePath(
          activeShapeKind,
          cx,
          cy,
          w,
          h,
          activeCornerRadius
        );
        const newShape: VectorElement = {
          id: `shape-${Date.now()}`,
          name: `Forma ${activeShapeKind.toUpperCase()}`,
          type: 'shape',
          shapeKind: activeShapeKind,
          cornerRadius: activeCornerRadius,
          x: cx,
          y: cy,
          width: w,
          height: h,
          rotation: 0,
          scale: 1,
          color: activeColor,
          strokeColor: activeStrokeColor,
          strokeWidth: activeStrokeWidth,
          strokeDasharray: activeStrokeDash,
          opacity: 0.95,
          zIndex: maxZ + 1,
          visible: true,
          locked: false,
          pathData: shapeData.pathData,
          controlPoints: shapeData.controlPoints,
          textureType: activeTexture,
        };
        commitElementsChange((prev) => [...prev, newShape]);
        selectSingleElement(newShape.id);
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
        commitElementsChange((prev) => [...prev, newCheck]);
        selectSingleElement(newCheck.id);
      }
      setDragBox(null);
      return;
    }

    // Creazione MACCHIA BLOB COL CURSORE
    if (activeTool === 'blob' && liveSamples.length > 0) {
      const freeformBlob = generateFreeformCursorBlobPath(
        liveSamples,
        blobMode,
        Math.max(36, brushSize * 1.8),
        blobRoughness
      );

      if (freeformBlob.pathData) {
        if (blobMode === 'blob-brush-merge' && mergeBlobBrushWithSameColor) {
          const targetBlob = [...elements]
            .reverse()
            .find(
              (el) =>
                el.type === 'blob' &&
                !el.locked &&
                el.visible &&
                el.color.toLowerCase() === activeColor.toLowerCase() &&
                Math.abs(el.x - freeformBlob.x) < (el.width + freeformBlob.width) * 0.55 &&
                Math.abs(el.y - freeformBlob.y) < (el.height + freeformBlob.height) * 0.55
            );

          if (targetBlob) {
            const minX = Math.min(
              targetBlob.x - targetBlob.width / 2,
              freeformBlob.x - freeformBlob.width / 2
            );
            const maxX = Math.max(
              targetBlob.x + targetBlob.width / 2,
              freeformBlob.x + freeformBlob.width / 2
            );
            const minY = Math.min(
              targetBlob.y - targetBlob.height / 2,
              freeformBlob.y - freeformBlob.height / 2
            );
            const maxY = Math.max(
              targetBlob.y + targetBlob.height / 2,
              freeformBlob.y + freeformBlob.height / 2
            );
            const mergedPts = [
              ...(targetBlob.controlPoints || []),
              ...freeformBlob.controlPoints,
            ].slice(0, 36);

            commitElementsChange((prev) =>
              prev.map((el) =>
                el.id === targetBlob.id
                  ? {
                      ...el,
                      x: Math.round((minX + maxX) / 2),
                      y: Math.round((minY + maxY) / 2),
                      width: Math.round(maxX - minX),
                      height: Math.round(maxY - minY),
                      pathData: `${el.pathData} ${freeformBlob.pathData}`,
                      controlPoints: mergedPts,
                    }
                  : el
              )
            );
            selectSingleElement(targetBlob.id);
            setLiveSamples([]);
            notify('Pennello Blob: macchia fusa con la forma adiacente dello stesso colore!');
            return;
          }
        }

        const newBlob: VectorElement = {
          id: `blob-${Date.now()}`,
          name:
            blobMode === 'freeform-lasso'
              ? 'Macchia Lazo Libera'
              : 'Macchia Pennello Blob',
          type: 'blob',
          x: freeformBlob.x,
          y: freeformBlob.y,
          width: freeformBlob.width,
          height: freeformBlob.height,
          rotation: 0,
          scale: 1,
          color: activeColor,
          strokeColor: activeStrokeColor,
          strokeWidth: activeStrokeWidth,
          strokeDasharray: activeStrokeDash,
          opacity: 0.94,
          zIndex: maxZ + 1,
          visible: true,
          locked: false,
          pathData: freeformBlob.pathData,
          controlPoints: freeformBlob.controlPoints,
          textureType: activeTexture,
        };
        commitElementsChange((prev) => [...prev, newBlob]);
        selectSingleElement(newBlob.id);
        notify(
          `Macchia Blob disegnata col cursore (${freeformBlob.controlPoints.length} nodi modificabili con "A")`
        );
      }
      setLiveSamples([]);
      return;
    }

    // Creazione Pennellata Calligrafica Fluida (B)
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
          name: isPenInput ? 'Pennellata Apple Pencil' : 'Pennellata Calligrafica',
          type: 'freehand',
          x: Math.round((minX + maxX) / 2),
          y: Math.round((minY + maxY) / 2),
          width: Math.max(40, Math.round(maxX - minX)),
          height: Math.max(40, Math.round(maxY - minY)),
          rotation: 0,
          scale: 1,
          color: activeColor,
          strokeColor: activeStrokeColor,
          strokeWidth: activeStrokeWidth,
          opacity: isPenInput ? Math.min(1, Math.max(0.55, avgPressure * 1.15)) : 0.95,
          zIndex: maxZ + 1,
          visible: true,
          locked: false,
          pathData,
          textureType: activeTexture,
        };
        commitElementsChange((prev) => [...prev, newStroke]);
        selectSingleElement(newStroke.id);
      }
      setLiveSamples([]);
    }
  };

  const handleElementPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    el: VectorElement
  ) => {
    if (activeTool === 'eyedropper') {
      e.stopPropagation();
      if (el.color && el.color !== 'none') {
        setActiveColor(el.color as BrandColorHex);
      }
      if (el.strokeColor) setActiveStrokeColor(el.strokeColor);
      if (typeof el.strokeWidth === 'number') setActiveStrokeWidth(el.strokeWidth);
      if (el.fontFamily) setActiveFontFamily(el.fontFamily);
      if (el.fontWeight) setActiveFontWeight(el.fontWeight);
      if (typeof el.fontItalic === 'boolean') setActiveFontItalic(el.fontItalic);
      notify(`Campionato stile da "${el.name}" (${el.color})`);
      setActiveTool('select');
      return;
    }

    if (activeTool !== 'select' && activeTool !== 'direct-select') return;
    e.stopPropagation();

    // Selezione Multipla con Shift+Clic per il pannello Allinea/Distribuisci di Illustrator
    if (e.shiftKey) {
      toggleMultiSelectElement(el.id);
      return;
    }

    // Se siamo in modalità 'key-object' e l'elemento fa già parte di una selezione multipla, impostalo come Oggetto Chiave!
    if (alignTargetMode === 'key-object' && selectedIds.includes(el.id) && selectedIds.length > 1) {
      setKeyObjectId(el.id);
      setSelectedId(el.id);
      notify(`Oggetto chiave impostato: "${el.name}"`);
      return;
    }

    selectSingleElement(el.id);
    setSelectedNodeIndex(null);

    if (el.type === 'textured-text') {
      setRightDockTab('character');
    }

    if (activeTool === 'direct-select') {
      if (
        (!el.controlPoints || el.controlPoints.length === 0) &&
        (!el.bezierNodes || el.bezierNodes.length === 0)
      ) {
        const rx = Math.max(36, el.width / 2);
        const ry = Math.max(36, el.height / 2);
        const pts: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          pts.push({
            x: Math.round(el.x + Math.cos(a) * rx),
            y: Math.round(el.y + Math.sin(a) * ry),
          });
        }
        setElements((prev) =>
          prev.map((item) => (item.id === el.id ? { ...item, controlPoints: pts } : item))
        );
      }
      return;
    }

    const coords = toCanvasCoords(e.clientX, e.clientY);
    if (!el.locked) {
      setHistoryPast((past) => [...past.slice(-39), elements]);
      setHistoryFuture([]);
      isDraggingElementRef.current = {
        id: el.id,
        startX: coords.x,
        startY: coords.y,
        origX: el.x,
        origY: el.y,
        origControlPoints: el.controlPoints ? [...el.controlPoints] : undefined,
        origBezierNodes: el.bezierNodes ? [...el.bezierNodes] : undefined,
      };
    }

    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setClipboard((prev) => [{ ...el, id: `clip-${Date.now()}` }, ...prev.slice(0, 7)]);
      pasteFromClipboard(el);
      isDraggingElementRef.current = null;
    }, 650);
  };

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  const moveLayerZIndex = (id: string, direction: 'up' | 'down') => {
    commitElementsChange((prev) => {
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

  // Anteprima live durante il disegno a mano libera (sia per Pennello che per Macchia Blob col cursore!)
  const livePreviewData = React.useMemo(() => {
    if (liveSamples.length < 2) return null;
    if (activeTool === 'blob') {
      const blobRes = generateFreeformCursorBlobPath(
        liveSamples,
        blobMode,
        Math.max(36, brushSize * 1.8),
        blobRoughness
      );
      return {
        pathData: blobRes.pathData,
        controlPoints: blobRes.controlPoints,
        isBlob: true,
      };
    }
    if (activeTool === 'brush') {
      return {
        pathData: generateSmoothedBrushPath(liveSamples, brushSize, 1).pathData,
        controlPoints: [],
        isBlob: false,
      };
    }
    return null;
  }, [liveSamples, activeTool, blobMode, brushSize, blobRoughness]);

  // Anteprima live della curva di Bézier del Pen Tool (P)
  const livePenPreviewPath = React.useMemo(() => {
    if (activeTool !== 'pen' || penDraftNodes.length === 0) return '';
    const previewNodes: BezierNode[] = isDraggingPenDraftHandleRef.current
      ? penDraftNodes
      : [
          ...penDraftNodes,
          {
            x: cursorCoords.x,
            y: cursorCoords.y,
            inX: cursorCoords.x,
            inY: cursorCoords.y,
            outX: cursorCoords.x,
            outY: cursorCoords.y,
          },
        ];
    return buildBezierPathFromNodes(previewNodes, false).pathData;
  }, [activeTool, penDraftNodes, cursorCoords]);

  const getElementFontCss = (el: VectorElement): string => {
    if (el.fontFamily === 'Montserrat') {
      return '"Montserrat", sans-serif';
    }
    if (el.fontFamily === 'Akena Otos') {
      return '"Akena Otos", "Fraunces", "Cormorant Garamond", Georgia, serif';
    }
    if (el.fontStyle === 'craft-rounded') return '"Montserrat", "Bricolage Grotesque", sans-serif';
    if (el.fontStyle === 'mono-label') return '"Montserrat", "JetBrains Mono", monospace';
    return '"Akena Otos", "Fraunces", Georgia, serif';
  };

  const formatElementTextLine = (line: string, transform?: 'none' | 'uppercase' | 'lowercase') => {
    if (transform === 'uppercase') return line.toUpperCase();
    if (transform === 'lowercase') return line.toLowerCase();
    return line;
  };

  // Classi dinamiche per Tema Scuro Adobe Illustrator Pro vs Tema Beige Kraft Studio
  const isDark = workspaceTheme === 'adobe-dark';
  const shellBg = isDark
    ? 'bg-[#1E1E1E] text-[#E6E6E6] border-[#333337]'
    : 'bg-[#F4ECE1] text-[#1A2B4C] border-[#1A2B4C]/20';
  const panelBg = isDark
    ? 'bg-[#252526] text-[#E6E6E6] border-[#38383D]'
    : 'bg-[#F4ECE1] text-[#1A2B4C] border-[#1A2B4C]/15';
  const inputBg = isDark
    ? 'bg-[#18181A] text-[#F0F0F0] border-[#3E3E44]'
    : 'bg-[#EADDCD] text-[#1A2B4C] border-[#1A2B4C]/20';
  const mutedText = isDark ? 'text-[#9DA0A6]' : 'text-[#1A2B4C]/65';
  const artboardSurroundBg = isDark ? 'bg-[#141416]' : 'bg-[#1A2B4C]/10';

  const ILLUSTRATOR_TOOLS: Array<{
    id: DrawingToolId;
    shortcut: string;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'select',
      shortcut: 'V',
      label: 'Selezione & Trasforma (V · Shift+Clic per Selezione Multipla)',
      icon: <MousePointer className="w-4 h-4" />,
    },
    {
      id: 'direct-select',
      shortcut: 'A',
      label: 'Selezione Diretta Ancore & Maniglie Bézier (A)',
      icon: <Crosshair className="w-4 h-4" />,
    },
    {
      id: 'pen',
      shortcut: 'P',
      label: 'Penna di Bézier · Clic per Ancora, Trascina per Maniglie (P)',
      icon: <PenTool className="w-4 h-4" />,
    },
    {
      id: 'blob',
      shortcut: '⇧B',
      label: 'Macchia Blob col Cursore Libero (Shift+B)',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'brush',
      shortcut: 'B',
      label: 'Pennello Calligrafico Fluido (B)',
      icon: <Paintbrush className="w-4 h-4" />,
    },
    {
      id: 'text-box',
      shortcut: 'T',
      label: 'Casella di Testo · Montserrat & Akena Otos (T)',
      icon: <Type className="w-4 h-4" />,
    },
    {
      id: 'shape',
      shortcut: 'M',
      label: 'Forme Geometriche Vettoriali (M)',
      icon: <Shapes className="w-4 h-4" />,
    },
    {
      id: 'checkerboard',
      shortcut: 'W',
      label: 'Scacchiera Ondulata Wavy Checker (W)',
      icon: <Grid className="w-4 h-4" />,
    },
    {
      id: 'stamp',
      shortcut: 'S',
      label: 'Timbri Ufficiali Fatti a mano (S)',
      icon: <Stamp className="w-4 h-4" />,
    },
    {
      id: 'eyedropper',
      shortcut: 'I',
      label: 'Contagocce Colore & Font (I)',
      icon: <Pipette className="w-4 h-4" />,
    },
  ];

  // Calcolo Bounding Box Multi-Selezione quando sono selezionati più oggetti (Shift+Clic)
  const multiSelectionBounds = React.useMemo(() => {
    if (selectedIds.length < 2) return null;
    const selEls = elements.filter((el) => selectedIds.includes(el.id));
    if (selEls.length < 2) return null;
    const left = Math.min(...selEls.map((e) => e.x - e.width / 2));
    const right = Math.max(...selEls.map((e) => e.x + e.width / 2));
    const top = Math.min(...selEls.map((e) => e.y - e.height / 2));
    const bottom = Math.max(...selEls.map((e) => e.y + e.height / 2));
    return { left, top, width: right - left, height: bottom - top };
  }, [elements, selectedIds]);

  return (
    <div
      data-testid="illustrator-workspace"
      className={`border shadow-xl overflow-hidden transition-all ${shellBg} ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen rounded-none flex flex-col'
          : 'rounded-xl'
      }`}
    >
      {/* Hidden inputs per caricamento Font (.OTF/.TTF), Caricamenti PNG (Canva) e Logo Partner */}
      <input
        ref={fontFileInputRef}
        type="file"
        accept=".otf,.ttf,.woff,.woff2"
        onChange={handleCustomFontUpload}
        className="hidden"
      />
      <input
        ref={pngUploadInputRef}
        type="file"
        multiple
        accept="image/png,image/webp,image/svg+xml,image/jpeg"
        onChange={handleUploadPngFiles}
        className="hidden"
      />
      <input
        ref={partnerLogoInputRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp,image/jpeg"
        onChange={handleBuilderPartnerLogoUpload}
        className="hidden"
      />

      {/* BARRA SUPERIORE CONTESTUALE ADOBE ILLUSTRATOR (Control Bar) */}
      <div
        className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${panelBg}`}
      >
        {/* Blocco Sinistro: Badge Ai + Selettore Scheda + Formato + Undo/Redo + Allinea Rapido */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FF9A00]/15 border border-[#FF9A00]/40 text-[#FF9A00] text-xs font-bold tracking-tight">
            <span className="font-mono font-extrabold">Ai</span>
            <span className="hidden sm:inline">Vector Studio</span>
          </div>

          {workshops.length > 0 && onSelectWorkshop && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${inputBg}`}>
              <label
                htmlFor="builder-workshop-select"
                className="text-[11px] font-bold whitespace-nowrap opacity-80"
              >
                Scheda:
              </label>
              <select
                id="builder-workshop-select"
                data-testid="builder-workshop-select"
                value={activeWorkshopId}
                onChange={(e) => {
                  selectSingleElement(null);
                  setSelectedNodeIndex(null);
                  onSelectWorkshop(e.target.value);
                }}
                className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[190px] truncate"
              >
                {workshops.map((ws) => (
                  <option key={ws.id} value={ws.id} className="bg-[#252526] text-white">
                    {ws.title} ({ws.ticketPrice}€)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preset Dimensioni Tavola */}
          <div className="flex items-center gap-1">
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
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  canvasSize.presetId === preset.id
                    ? 'bg-[#B85B43] text-white'
                    : `${inputBg} hover:opacity-85`
                }`}
              >
                {preset.id}
              </button>
            ))}
          </div>

          {/* Undo / Redo */}
          <div className={`flex items-center rounded border p-0.5 ${inputBg}`}>
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              title="Annulla (Ctrl+Z)"
              aria-label="Annulla ultima modifica"
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyFuture.length === 0}
              title="Ripristina (Ctrl+Y)"
              aria-label="Ripristina modifica"
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Barra Allineamento Rapido Illustrator (7 direzioni come nella foto) */}
          <div
            className={`hidden xl:flex items-center gap-0.5 rounded border px-1.5 py-0.5 ${inputBg}`}
            title="Allinea oggetti (clicca per allineare o apri il pannello Allinea)"
          >
            <span className="text-[10px] font-bold text-[#FF9A00] mr-1">Allinea:</span>
            <button
              type="button"
              onClick={() => executeIllustratorAlign('align-left')}
              title="Allinea a sinistra"
              className="p-1 rounded hover:bg-white/10 text-[10px] font-mono"
            >
              ⇤
            </button>
            <button
              type="button"
              onClick={() => executeIllustratorAlign('align-center-h')}
              title="Allinea al centro orizzontale"
              className="p-1 rounded hover:bg-white/10 text-[10px] font-mono"
            >
              ⇹
            </button>
            <button
              type="button"
              onClick={() => executeIllustratorAlign('align-right')}
              title="Allinea a destra"
              className="p-1 rounded hover:bg-white/10 text-[10px] font-mono"
            >
              ⇥
            </button>
            <button
              type="button"
              onClick={() => executeIllustratorAlign('align-center-both')}
              title="Allinea al centro assoluto (Croce)"
              className="p-1 rounded hover:bg-white/10 text-[10px] font-mono text-[#FF9A00] font-bold"
            >
              ✚
            </button>
            <button
              type="button"
              onClick={() => executeIllustratorAlign('align-top')}
              title="Allinea in alto"
              className="p-1 rounded hover:bg-white/10 text-[10px] font-mono"
            >
              ⇡
            </button>
            <button
              type="button"
              onClick={() => executeIllustratorAlign('align-center-v')}
              title="Allinea al centro verticale"
              className="p-1 rounded hover:bg-white/10 text-[10px] font-mono"
            >
              ⇳
            </button>
            <button
              type="button"
              onClick={() => executeIllustratorAlign('align-bottom')}
              title="Allinea in basso"
              className="p-1 rounded hover:bg-white/10 text-[10px] font-mono"
            >
              ⇣
            </button>
          </div>

          {/* Controlli Contestuali per lo Strumento Attivo */}
          {activeTool === 'blob' && (
            <div
              data-testid="blob-tool-context-bar"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#B85B43]/20 border border-[#B85B43]/50 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#B85B43]" />
              <span className="font-bold text-[11px]">Macchia col Cursore:</span>
              <button
                type="button"
                data-testid="blob-mode-lasso-btn"
                onClick={() => setBlobMode('freeform-lasso')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  blobMode === 'freeform-lasso'
                    ? 'bg-[#B85B43] text-white'
                    : 'hover:bg-white/10'
                }`}
              >
                Lazo Forma Libera
              </button>
              <button
                type="button"
                data-testid="blob-mode-brush-btn"
                onClick={() => setBlobMode('blob-brush-merge')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  blobMode === 'blob-brush-merge'
                    ? 'bg-[#B85B43] text-white'
                    : 'hover:bg-white/10'
                }`}
              >
                Pennello Blob Unione
              </button>
            </div>
          )}

          {activeTool === 'pen' && (
            <div
              data-testid="pen-tool-context-bar"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0D66D0]/20 border border-[#0D66D0]/50 text-xs"
            >
              <PenTool className="w-3.5 h-3.5 text-[#3B9EFF]" />
              <span className="text-[11px] font-semibold">
                Penna Bézier: clicca per ancora, trascina per curvare ({penDraftNodes.length} nodi)
              </span>
              {penDraftNodes.length >= 2 && (
                <>
                  <button
                    type="button"
                    data-testid="pen-close-path-btn"
                    onClick={() => finishPenPath(true)}
                    className="px-2 py-0.5 rounded bg-[#0D66D0] text-white text-[11px] font-semibold"
                  >
                    Chiudi Curva (Invio)
                  </button>
                  <button
                    type="button"
                    data-testid="pen-open-path-btn"
                    onClick={() => finishPenPath(false)}
                    className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-semibold"
                  >
                    Tracciato Aperto
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Blocco Destro: Schermo Intero, Righelli, Griglia, Tema, Zoom, Export e Salva Cloud */}
        <div className="flex flex-wrap items-center gap-1.5">
          {lastSavedLabel && (
            <span
              data-testid="builder-autosave-status"
              className="text-[11px] font-medium text-[#4A6B53] whitespace-nowrap mr-1"
            >
              {lastSavedLabel}
            </span>
          )}

          {/* BOTTONE SCHERMO INTERO / RIDUCI (Tasto F) */}
          <button
            type="button"
            data-testid="builder-fullscreen-toggle"
            onClick={toggleFullscreenMode}
            title="Passa tra modalità Schermo Intero e vista ridotta (Tasto F)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-bold transition-colors ${
              isFullscreen
                ? 'bg-[#FF9A00] text-black border-[#FF9A00]'
                : `${inputBg} hover:border-[#FF9A00]`
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Riduci Finestra</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#FF9A00]" />
                <span>Schermo Intero</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowRulers((r) => !r)}
            title="Mostra/Nascondi Righelli Pixel"
            className={`p-1.5 rounded border text-xs ${
              showRulers ? 'bg-[#0D66D0] text-white border-[#0D66D0]' : inputBg
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            title="Mostra/Nascondi Griglia Tavola"
            className={`p-1.5 rounded border text-xs ${
              showGrid ? 'bg-[#0D66D0] text-white border-[#0D66D0]' : inputBg
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Switch Tema Adobe Dark Pro vs Beige Kraft */}
          <button
            type="button"
            data-testid="builder-theme-toggle"
            onClick={toggleWorkspaceTheme}
            title="Cambia interfaccia tra Tema Scuro Adobe Pro e Tema Beige Kraft"
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-semibold ${inputBg}`}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#D4A373]" />
                <span className="hidden md:inline">Tema Kraft</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#1A2B4C]" />
                <span className="hidden md:inline">Tema Adobe Pro</span>
              </>
            )}
          </button>

          {/* Zoom */}
          <div className={`flex items-center rounded border p-0.5 ${inputBg}`}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.08).toFixed(2)))}
              aria-label="Riduci zoom"
              className="p-1 rounded hover:bg-white/10"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono tabular-nums font-semibold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.08).toFixed(2)))}
              aria-label="Aumenta zoom"
              className="p-1 rounded hover:bg-white/10"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {onResetToWorkshopDefault && (
            <button
              type="button"
              onClick={() => {
                selectSingleElement(null);
                onResetToWorkshopDefault();
              }}
              title="Rigenera il layout predefinito dai dati della scheda"
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-semibold ${inputBg} hover:opacity-85`}
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Rigenera</span>
            </button>
          )}

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
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-semibold ${inputBg} hover:opacity-85`}
          >
            <Download className="w-3 h-3" />
            <span>SVG</span>
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
            className="flex items-center gap-1 px-2.5 py-1 bg-[#B85B43] text-white text-[11px] font-semibold rounded hover:bg-[#a04c36] transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>PNG HD</span>
          </button>

          {onSaveTemplateCloud && (
            <button
              type="button"
              data-testid="builder-save-cloud-btn"
              onClick={onSaveTemplateCloud}
              disabled={isSavingCloud}
              className="px-2.5 py-1 bg-[#4A6B53] text-white text-[11px] font-semibold rounded hover:bg-[#3d5945] transition-colors disabled:opacity-50"
            >
              {isSavingCloud ? 'Salvataggio...' : 'Salva Cloud'}
            </button>
          )}
        </div>
      </div>

      {/* WORKSPACE PRINCIPALE A 3 COLONNE STILE ADOBE ILLUSTRATOR */}
      <div
        className={`flex flex-col lg:flex-row ${
          isFullscreen ? 'flex-1 min-h-0 overflow-hidden' : 'min-h-[720px]'
        }`}
      >
        {/* 1. LEFT VERTICAL TOOL DOCK (Stile Adobe Illustrator + Bottone Rapido Caricamenti PNG) */}
        <div
          data-testid="illustrator-left-toolbar"
          className={`flex lg:flex-col items-center justify-between lg:justify-start gap-1.5 p-2 border-b lg:border-b-0 lg:border-r shrink-0 ${panelBg}`}
        >
          <div className="flex lg:flex-col items-center gap-1 flex-wrap">
            {ILLUSTRATOR_TOOLS.map((tool) => {
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  data-testid={`tool-btn-${tool.id}`}
                  onClick={() => {
                    setActiveTool(tool.id);
                    if (tool.id === 'text-box') {
                      setRightDockTab('character');
                    } else if (tool.id === 'direct-select' || tool.id === 'shape') {
                      setRightDockTab('properties');
                    }
                  }}
                  title={tool.label}
                  className={`relative group w-10 h-10 rounded-lg flex flex-col items-center justify-center transition-all ${
                    isActive
                      ? 'bg-[#0D66D0] text-white shadow-inner ring-1 ring-white/30'
                      : 'hover:bg-white/10 opacity-85 hover:opacity-100'
                  }`}
                >
                  {tool.icon}
                  <span className="text-[9px] font-mono leading-none mt-0.5 opacity-75">
                    {tool.shortcut}
                  </span>
                </button>
              );
            })}

            {/* Bottone Rapido "Caricamenti PNG" stile Canva nel dock sinistro */}
            <button
              type="button"
              data-testid="left-dock-uploads-btn"
              onClick={() => setRightDockTab('uploads')}
              title="Caricamenti PNG · Inserisci immagini e sticker trasparenti nella locandina"
              className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center transition-all mt-1 border ${
                rightDockTab === 'uploads'
                  ? 'bg-[#FF9A00] text-black border-[#FF9A00]'
                  : 'border-white/15 hover:bg-white/10'
              }`}
            >
              <ImagePlus className="w-4 h-4" />
              <span className="text-[8px] font-mono leading-none mt-0.5">PNG</span>
            </button>
          </div>

          {/* Doppio Selettore Riempimento (Fill) / Traccia (Stroke) stile Illustrator in fondo al dock */}
          <div className="hidden lg:flex flex-col items-center gap-2 mt-4 pt-3 border-t border-white/10">
            <div
              className="relative w-10 h-10"
              title={`Riempimento: ${activeColor} · Traccia: ${activeStrokeColor}`}
            >
              {/* Quadrato Riempimento (Fill) */}
              <div
                className="w-6 h-6 rounded-sm border-2 border-white shadow cursor-pointer"
                style={{ backgroundColor: activeColor }}
                onClick={() => setRightDockTab('properties')}
              />
              {/* Quadrato Forato Traccia (Stroke) */}
              <div
                className="w-6 h-6 rounded-sm border-2 border-white/80 absolute bottom-0 right-0 flex items-center justify-center cursor-pointer"
                style={{
                  backgroundColor:
                    activeStrokeColor && activeStrokeColor !== 'none'
                      ? activeStrokeColor
                      : 'transparent',
                }}
                onClick={() => {
                  const nextStroke = activeStrokeColor === 'none' ? '#1A2B4C' : 'none';
                  setActiveStrokeColor(nextStroke);
                  if (nextStroke !== 'none' && activeStrokeWidth === 0) {
                    setActiveStrokeWidth(4);
                  }
                  if (selectedElement && !selectedElement.locked) {
                    commitElementsChange((prev) =>
                      prev.map((el) =>
                        el.id === selectedElement.id
                          ? {
                              ...el,
                              strokeColor: nextStroke,
                              strokeWidth:
                                nextStroke !== 'none' ? Math.max(3, el.strokeWidth || 4) : 0,
                            }
                          : el
                      )
                    );
                  }
                }}
              >
                <div className="w-2.5 h-2.5 bg-[#252526]" />
              </div>
            </div>

            {/* Swatches rapidi Brand-Safe nel dock */}
            <div className="grid grid-cols-2 gap-1">
              {BRAND_PALETTE.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  title={`${sw.name} (${sw.hex})`}
                  onClick={() => {
                    setActiveColor(sw.hex);
                    if (selectedElement && !selectedElement.locked) {
                      commitElementsChange((prev) =>
                        prev.map((el) =>
                          el.id === selectedElement.id ? { ...el, color: sw.hex } : el
                        )
                      );
                    }
                  }}
                  className={`w-4 h-4 rounded-sm border ${
                    activeColor === sw.hex
                      ? 'border-white scale-110 ring-1 ring-[#0D66D0]'
                      : 'border-black/40'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                />
              ))}
            </div>

            {onOpenFontModal && (
              <button
                type="button"
                onClick={onOpenFontModal}
                title="Laboratorio Glifi Vettoriali & Font Custom"
                className="w-9 h-9 rounded-lg bg-[#4A6B53] text-white flex items-center justify-center hover:bg-[#3d5945] mt-1"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 2. CENTER ARTBOARD VIEWPORT CON RIGHELLI PIXEL E BOUNDING BOX ILLUSTRATOR */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${artboardSurroundBg}`}>
          {/* Sotto-barra stato e scorciatoie contestuali */}
          <div
            className={`px-3 py-1.5 border-b text-[11px] flex flex-wrap items-center justify-between gap-2 shrink-0 ${panelBg}`}
          >
            <div className="flex items-center gap-3 truncate">
              <span className="font-semibold text-[#FF9A00]">
                {ILLUSTRATOR_TOOLS.find((t) => t.id === activeTool)?.label}
              </span>
              {selectedIds.length > 1 && (
                <span className="px-2 py-0.5 rounded bg-[#0D66D0] text-white font-semibold">
                  {selectedIds.length} oggetti selezionati (Shift+Clic)
                </span>
              )}
              <span className={`hidden md:inline ${mutedText}`}>{pointerModeLabel}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 font-mono">
              <span className={mutedText}>
                X: {cursorCoords.x}px · Y: {cursorCoords.y}px
              </span>
              <span className="text-[#B85B43]">
                Pressione: {Math.round(livePressure * 100)}%
              </span>
              {statusNotice && (
                <span className="text-[#4A6B53] font-sans font-bold">{statusNotice}</span>
              )}
            </div>
          </div>

          {/* Contenitore Righelli + Artboard */}
          <div className="relative flex-1 overflow-auto flex items-center justify-center p-6 sm:p-10 min-h-[540px]">
            {/* Righello Orizzontale Superiore */}
            {showRulers && (
              <div
                className={`absolute top-0 left-6 right-0 h-5 border-b flex items-end px-2 select-none pointer-events-none text-[9px] font-mono ${panelBg} opacity-90 z-10`}
              >
                {[0, 200, 400, 540, 600, 800, 1000, 1080].map((tick) => (
                  <span key={tick} className="mr-12 opacity-70">
                    |{tick}
                  </span>
                ))}
              </div>
            )}

            {/* Righello Verticale Sinistro */}
            {showRulers && (
              <div
                className={`absolute top-5 bottom-0 left-0 w-6 border-r flex flex-col items-center py-2 select-none pointer-events-none text-[9px] font-mono ${panelBg} opacity-90 z-10`}
              >
                {[0, 200, 400, 675, 800, 1000, 1200, 1350].map((tick) => (
                  <span key={tick} className="mb-10 opacity-70">
                    —{tick}
                  </span>
                ))}
              </div>
            )}

            {/* Artboard Tavola da Disegno */}
            <div
              style={{
                width: Math.round(canvasSize.width * zoom),
                height: Math.round(canvasSize.height * zoom),
                transform: `translate(${pan.x}px, ${pan.y}px)`,
              }}
              className="relative shadow-2xl border border-black/50 bg-[#EADDCD] shrink-0"
            >
              {/* Etichetta Tavola stile Adobe Illustrator in alto a sinistra */}
              <div className="absolute -top-6 left-0 flex items-center gap-2 text-[11px] font-mono opacity-75 pointer-events-none whitespace-nowrap">
                <span>
                  01 · Tavola {canvasSize.width}×{canvasSize.height}px
                </span>
                {selectedElement && (
                  <span className="text-[#3B9EFF]">
                    [{selectedElement.name} · {selectedElement.width}×{selectedElement.height}px]
                  </span>
                )}
              </div>

              <svg
                ref={svgRef}
                data-testid="vector-canvas-svg"
                viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                className={`w-full h-full block select-none touch-none ${
                  activeTool === 'select'
                    ? 'cursor-default'
                    : activeTool === 'direct-select'
                    ? 'cursor-pointer'
                    : 'cursor-crosshair'
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

                {/* Griglia Vettoriale Smart Illustrator */}
                {showGrid && (
                  <g data-ui-overlay="true" className="pointer-events-none opacity-25">
                    {Array.from({ length: Math.floor(canvasSize.width / 135) + 1 }).map(
                      (_, i) => (
                        <line
                          key={`vg-${i}`}
                          x1={i * 135}
                          y1={0}
                          x2={i * 135}
                          y2={canvasSize.height}
                          stroke="#1A2B4C"
                          strokeWidth={i * 135 === canvasSize.width / 2 ? 2 : 1}
                          strokeDasharray={i * 135 === canvasSize.width / 2 ? '8 6' : '3 6'}
                        />
                      )
                    )}
                    {Array.from({ length: Math.floor(canvasSize.height / 135) + 1 }).map(
                      (_, i) => (
                        <line
                          key={`hg-${i}`}
                          x1={0}
                          y1={i * 135}
                          x2={canvasSize.width}
                          y2={i * 135}
                          stroke="#1A2B4C"
                          strokeWidth={i * 135 === canvasSize.height / 2 ? 2 : 1}
                          strokeDasharray={i * 135 === canvasSize.height / 2 ? '8 6' : '3 6'}
                        />
                      )
                    )}
                  </g>
                )}

                {/* Rendering Livelli Vettoriali e PNG ordinati per Z-Index */}
                {sortedElements.map((el) => {
                  if (!el.visible) return null;
                  const isSelected = el.id === selectedId || selectedIds.includes(el.id);
                  const isKeyObj =
                    alignTargetMode === 'key-object' &&
                    selectedIds.length > 1 &&
                    (keyObjectId ? el.id === keyObjectId : el.id === selectedIds[0]);
                  const filterAttr = getFilterUrl(el.textureType);

                  const transforms: string[] = [];
                  if (el.rotation) {
                    transforms.push(`rotate(${el.rotation} ${el.x} ${el.y})`);
                  }
                  if (el.flipX || el.flipY) {
                    const sx = el.flipX ? -1 : 1;
                    const sy = el.flipY ? -1 : 1;
                    transforms.push(
                      `translate(${el.x} ${el.y}) scale(${sx} ${sy}) translate(${-el.x} ${-el.y})`
                    );
                  }

                  return (
                    <g
                      key={el.id}
                      filter={filterAttr}
                      opacity={el.opacity}
                      transform={transforms.length ? transforms.join(' ') : undefined}
                      onPointerDown={(e) => handleElementPointerDown(e, el)}
                      className={
                        activeTool === 'select' ||
                        activeTool === 'direct-select' ||
                        activeTool === 'eyedropper'
                          ? 'cursor-pointer'
                          : undefined
                      }
                    >
                      {/* Caso 1: Pennello, Macchia Blob Libera, Forme Geometriche, Penna Bézier, Wavy Checkerboard */}
                      {(el.type === 'freehand' ||
                        el.type === 'blob' ||
                        el.type === 'shape' ||
                        el.type === 'pen-path' ||
                        el.type === 'checkerboard') && (
                        <path
                          d={el.pathData}
                          fill={el.color || 'none'}
                          stroke={
                            el.strokeColor && el.strokeColor !== 'none'
                              ? el.strokeColor
                              : undefined
                          }
                          strokeWidth={el.strokeWidth || undefined}
                          strokeDasharray={el.strokeDasharray || undefined}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
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
                                style={{ fontFamily: '"Akena Otos", "Fraunces", Georgia, serif' }}
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
                                style={{ fontFamily: '"Akena Otos", "Fraunces", Georgia, serif' }}
                              >
                                a mano
                              </text>
                            </>
                          )}
                        </g>
                      )}

                      {/* Caso 3: Casella di Testo Tipografica (Montserrat & Akena Otos in tutte le declinazioni) */}
                      {el.type === 'textured-text' && (
                        <g>
                          {el.isHandDrawnText ? (
                            <g transform={`translate(${el.x - 380}, ${el.y - 160})`}>
                              <path d={el.pathData} fill={el.color} />
                            </g>
                          ) : (
                            <>
                              {el.pathData && el.textureType !== 'none' && (
                                <path
                                  d={el.pathData}
                                  fill={el.secondaryColor || '#B85B43'}
                                  fillOpacity={
                                    el.textureType === 'materic-blob' ? 0.95 : 0.85
                                  }
                                />
                              )}
                              {(() => {
                                const fSize = el.fontSize || 48;
                                const lHeight = el.lineHeight || 1.2;
                                const boxW = el.textBoxWidth || el.width || 520;
                                const maxChars = Math.max(
                                  8,
                                  Math.floor(boxW / Math.max(10, fSize * 0.54))
                                );
                                const wrapped = wrapPosterText(
                                  el.textContent || 'Fatti a mano',
                                  maxChars
                                );
                                const lines = wrapped.split('\n');
                                const align = el.textAlign || 'center';
                                const anchor =
                                  align === 'left'
                                    ? 'start'
                                    : align === 'right'
                                    ? 'end'
                                    : 'middle';
                                const textX =
                                  align === 'left'
                                    ? el.x - boxW / 2 + 16
                                    : align === 'right'
                                    ? el.x + boxW / 2 - 16
                                    : el.x;
                                const startY =
                                  el.y - ((lines.length - 1) * fSize * lHeight) / 2;

                                return lines.map((rawLine, idx) => {
                                  const displayLine = formatElementTextLine(
                                    rawLine,
                                    el.textTransform
                                  );
                                  return (
                                    <text
                                      key={idx}
                                      x={textX}
                                      y={startY + idx * fSize * lHeight}
                                      textAnchor={anchor}
                                      dominantBaseline="middle"
                                      fill={el.color}
                                      stroke={
                                        el.strokeColor && el.strokeColor !== 'none'
                                          ? el.strokeColor
                                          : undefined
                                      }
                                      strokeWidth={el.strokeWidth || undefined}
                                      fontSize={fSize}
                                      fontWeight={
                                        el.fontWeight ||
                                        (el.fontStyle === 'craft-rounded' ? 700 : 600)
                                      }
                                      fontStyle={el.fontItalic ? 'italic' : 'normal'}
                                      letterSpacing={
                                        el.letterSpacing ? `${el.letterSpacing}em` : undefined
                                      }
                                      style={{
                                        fontFamily: getElementFontCss(el),
                                      }}
                                    >
                                      {displayLine}
                                    </text>
                                  );
                                });
                              })()}
                            </>
                          )}
                        </g>
                      )}

                      {/* Caso 4: Immagini PNG Caricate (Sezione Caricamenti Canva & File Logo Partner) */}
                      {el.type === 'image' && el.imageUrl && (
                        <image
                          href={el.imageUrl}
                          x={el.x - el.width / 2}
                          y={el.y - el.height / 2}
                          width={el.width}
                          height={el.height}
                          preserveAspectRatio="xMidYMid meet"
                        />
                      )}

                      {/* BOUNDING BOX ADOBE ILLUSTRATOR CON 8 MANIGLIE + ANCORE E MANIGLIE DI BÉZIER (A) */}
                      {isSelected && (
                        <g data-ui-overlay="true">
                          <rect
                            x={el.x - el.width / 2 - 8}
                            y={el.y - el.height / 2 - 8}
                            width={el.width + 16}
                            height={el.height + 16}
                            fill="none"
                            stroke={isKeyObj ? '#FF9A00' : '#0D66D0'}
                            strokeWidth={isKeyObj ? 5 : 2.5}
                            strokeDasharray={activeTool === 'direct-select' ? '4 4' : undefined}
                          />

                          {/* 8 Maniglie di scala quando siamo nello strumento Selezione (V) */}
                          {activeTool === 'select' &&
                            el.id === selectedId &&
                            !el.locked &&
                            ([
                              ['nw', el.x - el.width / 2 - 8, el.y - el.height / 2 - 8],
                              ['n', el.x, el.y - el.height / 2 - 8],
                              ['ne', el.x + el.width / 2 + 8, el.y - el.height / 2 - 8],
                              ['e', el.x + el.width / 2 + 8, el.y],
                              ['se', el.x + el.width / 2 + 8, el.y + el.height / 2 + 8],
                              ['s', el.x, el.y + el.height / 2 + 8],
                              ['sw', el.x - el.width / 2 - 8, el.y + el.height / 2 + 8],
                              ['w', el.x - el.width / 2 - 8, el.y],
                            ] as const).map(([handleId, hx, hy]) => (
                              <rect
                                key={handleId}
                                x={hx - 8}
                                y={hy - 8}
                                width={16}
                                height={16}
                                fill="#FFFFFF"
                                stroke="#0D66D0"
                                strokeWidth={3}
                                className="cursor-nwse-resize"
                                onPointerDown={(ev) => {
                                  ev.stopPropagation();
                                  const pt = toCanvasCoords(ev.clientX, ev.clientY);
                                  setHistoryPast((past) => [...past.slice(-39), elements]);
                                  setHistoryFuture([]);
                                  isResizingHandleRef.current = {
                                    elementId: el.id,
                                    handle: handleId,
                                    startX: pt.x,
                                    startY: pt.y,
                                    origX: el.x,
                                    origY: el.y,
                                    origW: el.width,
                                    origH: el.height,
                                    origFontSize: el.fontSize || 48,
                                  };
                                }}
                              />
                            ))}

                          {/* NODI DI ANCORAGGIO E MANIGLIE DIREZIONALI BÉZIER in Selezione Diretta (A) */}
                          {activeTool === 'direct-select' &&
                            Array.isArray(el.bezierNodes) &&
                            el.bezierNodes.length > 0 &&
                            el.bezierNodes.map((node, nodeIdx) => {
                              const isNodeSel = selectedNodeIndex === nodeIdx;
                              return (
                                <g key={`bnode-${nodeIdx}`}>
                                  {/* Linea e Maniglia IN */}
                                  <line
                                    x1={node.x}
                                    y1={node.y}
                                    x2={node.inX}
                                    y2={node.inY}
                                    stroke="#FF9A00"
                                    strokeWidth={2}
                                  />
                                  <circle
                                    cx={node.inX}
                                    cy={node.inY}
                                    r={7}
                                    fill="#FF9A00"
                                    stroke="#FFFFFF"
                                    strokeWidth={2}
                                    className="cursor-move"
                                    onPointerDown={(ev) => {
                                      ev.stopPropagation();
                                      setSelectedNodeIndex(nodeIdx);
                                      setHistoryPast((past) => [...past.slice(-39), elements]);
                                      setHistoryFuture([]);
                                      isDraggingNodeRef.current = {
                                        elementId: el.id,
                                        nodeIndex: nodeIdx,
                                        handleType: 'in',
                                      };
                                    }}
                                  />

                                  {/* Linea e Maniglia OUT */}
                                  <line
                                    x1={node.x}
                                    y1={node.y}
                                    x2={node.outX}
                                    y2={node.outY}
                                    stroke="#FF9A00"
                                    strokeWidth={2}
                                  />
                                  <circle
                                    cx={node.outX}
                                    cy={node.outY}
                                    r={7}
                                    fill="#FF9A00"
                                    stroke="#FFFFFF"
                                    strokeWidth={2}
                                    className="cursor-move"
                                    onPointerDown={(ev) => {
                                      ev.stopPropagation();
                                      setSelectedNodeIndex(nodeIdx);
                                      setHistoryPast((past) => [...past.slice(-39), elements]);
                                      setHistoryFuture([]);
                                      isDraggingNodeRef.current = {
                                        elementId: el.id,
                                        nodeIndex: nodeIdx,
                                        handleType: 'out',
                                      };
                                    }}
                                  />

                                  {/* Punto di Ancoraggio Quadrato */}
                                  <rect
                                    x={node.x - 8}
                                    y={node.y - 8}
                                    width={16}
                                    height={16}
                                    fill={isNodeSel ? '#0D66D0' : '#FFFFFF'}
                                    stroke="#0D66D0"
                                    strokeWidth={3}
                                    className="cursor-move"
                                    onPointerDown={(ev) => {
                                      ev.stopPropagation();
                                      setSelectedNodeIndex(nodeIdx);
                                      setHistoryPast((past) => [...past.slice(-39), elements]);
                                      setHistoryFuture([]);
                                      isDraggingNodeRef.current = {
                                        elementId: el.id,
                                        nodeIndex: nodeIdx,
                                        handleType: 'anchor',
                                      };
                                    }}
                                  />
                                </g>
                              );
                            })}

                          {/* Fallback ControlPoints standard quando l'elemento non ha bezierNodes */}
                          {activeTool === 'direct-select' &&
                            (!el.bezierNodes || el.bezierNodes.length === 0) &&
                            el.controlPoints &&
                            el.controlPoints.map((pt, nodeIdx) => {
                              const isNodeSel = selectedNodeIndex === nodeIdx;
                              const nextPt =
                                el.controlPoints![(nodeIdx + 1) % el.controlPoints!.length];
                              return (
                                <g key={`node-${nodeIdx}`}>
                                  <line
                                    x1={pt.x}
                                    y1={pt.y}
                                    x2={nextPt.x}
                                    y2={nextPt.y}
                                    stroke="#3B9EFF"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 4"
                                  />
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={isNodeSel ? 12 : 9}
                                    fill={isNodeSel ? '#0D66D0' : '#FFFFFF'}
                                    stroke="#0D66D0"
                                    strokeWidth={3.5}
                                    className="cursor-move"
                                    onPointerDown={(ev) => {
                                      ev.stopPropagation();
                                      setSelectedNodeIndex(nodeIdx);
                                      setHistoryPast((past) => [...past.slice(-39), elements]);
                                      setHistoryFuture([]);
                                      isDraggingNodeRef.current = {
                                        elementId: el.id,
                                        nodeIndex: nodeIdx,
                                        handleType: 'anchor',
                                      };
                                    }}
                                  />
                                </g>
                              );
                            })}
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Contorno tratteggiato di Selezione Multipla (Shift+Clic) */}
                {multiSelectionBounds && (
                  <rect
                    data-ui-overlay="true"
                    x={multiSelectionBounds.left - 12}
                    y={multiSelectionBounds.top - 12}
                    width={multiSelectionBounds.width + 24}
                    height={multiSelectionBounds.height + 24}
                    fill="none"
                    stroke="#3B9EFF"
                    strokeWidth={2.5}
                    strokeDasharray="10 6"
                  />
                )}

                {/* ANTEPRIMA LIVE DURANTE IL DISEGNO (Macchia Blob col Cursore o Pennello Fluido) */}
                {livePreviewData && livePreviewData.pathData && (
                  <g data-ui-overlay="true">
                    <path
                      d={livePreviewData.pathData}
                      fill={activeColor}
                      fillOpacity={livePreviewData.isBlob ? 0.85 : 0.95}
                      stroke={livePreviewData.isBlob ? '#0D66D0' : undefined}
                      strokeWidth={livePreviewData.isBlob ? 2.5 : undefined}
                      strokeDasharray={
                        livePreviewData.isBlob && blobMode === 'freeform-lasso'
                          ? '8 5'
                          : undefined
                      }
                      filter={getFilterUrl(activeTexture)}
                    />
                    {livePreviewData.isBlob &&
                      livePreviewData.controlPoints.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={5}
                          fill="#FFFFFF"
                          stroke="#0D66D0"
                          strokeWidth={2}
                        />
                      ))}
                  </g>
                )}

                {/* ANTEPRIMA TRACCIATO PENNA DI BÉZIER (P) CON ANCORE E MANIGLIE DIREZIONALI IN TEMPO REALE */}
                {activeTool === 'pen' && penDraftNodes.length > 0 && (
                  <g data-ui-overlay="true">
                    <path
                      d={livePenPreviewPath}
                      fill={activeColor}
                      fillOpacity={0.18}
                      stroke="#0D66D0"
                      strokeWidth={3.5}
                      strokeDasharray="6 4"
                    />
                    {penDraftNodes.map((node, idx) => {
                      const hasHandles =
                        Math.hypot(node.outX - node.x, node.outY - node.y) > 1 ||
                        Math.hypot(node.inX - node.x, node.inY - node.y) > 1;
                      return (
                        <g key={idx}>
                          {hasHandles && (
                            <>
                              <line
                                x1={node.inX}
                                y1={node.inY}
                                x2={node.outX}
                                y2={node.outY}
                                stroke="#FF9A00"
                                strokeWidth={2.5}
                              />
                              <circle
                                cx={node.inX}
                                cy={node.inY}
                                r={6}
                                fill="#FF9A00"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                              />
                              <circle
                                cx={node.outX}
                                cy={node.outY}
                                r={6}
                                fill="#FF9A00"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                              />
                            </>
                          )}
                          <rect
                            x={node.x - 7}
                            y={node.y - 7}
                            width={14}
                            height={14}
                            fill={idx === 0 ? '#FF9A00' : '#FFFFFF'}
                            stroke="#0D66D0"
                            strokeWidth={3}
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Box di anteprima per Forme Geometriche (M) o Wavy Checkerboard (W) */}
                {dragBox && (
                  <rect
                    data-ui-overlay="true"
                    x={Math.min(dragBox.startX, dragBox.currentX)}
                    y={Math.min(dragBox.startY, dragBox.currentY)}
                    width={Math.abs(dragBox.currentX - dragBox.startX)}
                    height={Math.abs(dragBox.currentY - dragBox.startY)}
                    fill={activeColor}
                    fillOpacity={0.22}
                    stroke="#0D66D0"
                    strokeWidth={3}
                    strokeDasharray="6 6"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* 3. RIGHT DOCK STUDIO PANELS (Allinea & Proprietà, Carattere, Caricamenti PNG, Livelli) */}
        <div
          data-testid="illustrator-right-dock"
          className={`w-full lg:w-[390px] border-t lg:border-t-0 lg:border-l flex flex-col shrink-0 ${panelBg}`}
        >
          {/* Tab Header del Pannello Destro (4 Tab: Allinea & Propr., Carattere, Caricamenti, Livelli) */}
          <div className="grid grid-cols-4 border-b border-white/10 text-[11px] font-bold">
            <button
              type="button"
              data-testid="tab-properties-panel"
              onClick={() => setRightDockTab('properties')}
              className={`py-2.5 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
                rightDockTab === 'properties'
                  ? 'border-[#FF9A00] text-[#FF9A00] bg-white/5'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Combine className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Allinea</span>
            </button>
            <button
              type="button"
              data-testid="tab-character-panel"
              onClick={() => setRightDockTab('character')}
              className={`py-2.5 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
                rightDockTab === 'character'
                  ? 'border-[#FF9A00] text-[#FF9A00] bg-white/5'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Type className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Carattere</span>
            </button>
            <button
              type="button"
              data-testid="tab-uploads-panel"
              onClick={() => setRightDockTab('uploads')}
              className={`py-2.5 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
                rightDockTab === 'uploads'
                  ? 'border-[#FF9A00] text-[#FF9A00] bg-white/5'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <ImagePlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Caricamenti</span>
            </button>
            <button
              type="button"
              data-testid="tab-layers-panel"
              onClick={() => setRightDockTab('layers')}
              className={`py-2.5 px-1.5 flex items-center justify-center gap-1 border-b-2 transition-colors ${
                rightDockTab === 'layers'
                  ? 'border-[#FF9A00] text-[#FF9A00] bg-white/5'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Livelli ({elements.length})</span>
            </button>
          </div>

          {/* Contenuto Scrollabile del Pannello Attivo */}
          <div
            className={`p-4 space-y-4 overflow-y-auto ${
              isFullscreen ? 'flex-1' : 'max-h-[700px]'
            }`}
          >
            {/* ==================== TAB 1: PANNELLO "ALLINEA" DI ADOBE ILLUSTRATOR + PROPRIETÀ & BLOB ==================== */}
            {rightDockTab === 'properties' && (
              <div data-testid="properties-studio-panel" className="space-y-4">
                {/* PANNELLO ALLINEA FEDELE ALLA FOTO DI ADOBE ILLUSTRATOR */}
                <div
                  data-testid="illustrator-align-panel"
                  className="rounded-lg bg-[#383838] text-[#E8E8E8] border border-[#222222] shadow-lg overflow-hidden"
                >
                  {/* Barra Titolo "Allinea" */}
                  <div className="px-3 py-2 bg-[#424242] border-b border-[#2A2A2A] flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide text-[#F0F0F0]">
                      Allinea
                    </span>
                    <span className="text-[10px] text-[#BDBDBD]">
                      {selectedIds.length > 1
                        ? `${selectedIds.length} oggetti selezionati`
                        : selectedId
                        ? '1 oggetto selezionato'
                        : 'Shift+Clic per multi-selezione'}
                    </span>
                  </div>

                  <div className="p-3 space-y-3">
                    {/* 1. Allinea oggetti (7 icone come nello screenshot) */}
                    <div>
                      <div className="text-[11px] font-medium text-[#D6D6D6] mb-1.5">
                        Allinea oggetti:
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {/* 1. Allinea a sinistra */}
                        <button
                          type="button"
                          data-testid="align-btn-left"
                          onClick={() => executeIllustratorAlign('align-left')}
                          title="Allinea a sinistra"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="2" y="2" width="1.8" height="16" />
                            <rect x="5.5" y="4.5" width="7.5" height="4" />
                            <rect x="5.5" y="11" width="11.5" height="4" />
                          </svg>
                        </button>

                        {/* 2. Allinea al centro orizzontale */}
                        <button
                          type="button"
                          data-testid="align-btn-center-h"
                          onClick={() => executeIllustratorAlign('align-center-h')}
                          title="Allinea al centro orizzontale"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="9.1" y="2" width="1.8" height="16" />
                            <rect x="5.5" y="4.5" width="9" height="4" />
                            <rect x="3.5" y="11" width="13" height="4" />
                          </svg>
                        </button>

                        {/* 3. Allinea a destra */}
                        <button
                          type="button"
                          data-testid="align-btn-right"
                          onClick={() => executeIllustratorAlign('align-right')}
                          title="Allinea a destra"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="16.2" y="2" width="1.8" height="16" />
                            <rect x="7" y="4.5" width="7.5" height="4" />
                            <rect x="3" y="11" width="11.5" height="4" />
                          </svg>
                        </button>

                        {/* 4. Allinea al centro assoluto (Croce centrale come nella foto) */}
                        <button
                          type="button"
                          data-testid="align-btn-center-both"
                          onClick={() => executeIllustratorAlign('align-center-both')}
                          title="Allinea al centro assoluto della tavola/selezione"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="9.2" y="2" width="1.6" height="16" />
                            <rect x="2" y="9.2" width="16" height="1.6" />
                            <rect x="5.5" y="6" width="9" height="8" />
                          </svg>
                        </button>

                        {/* 5. Allinea in alto */}
                        <button
                          type="button"
                          data-testid="align-btn-top"
                          onClick={() => executeIllustratorAlign('align-top')}
                          title="Allinea in alto"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="2" y="2" width="16" height="1.8" />
                            <rect x="4.5" y="5.5" width="4" height="11" />
                            <rect x="11" y="5.5" width="4" height="7.5" />
                          </svg>
                        </button>

                        {/* 6. Allinea al centro verticale */}
                        <button
                          type="button"
                          data-testid="align-btn-center-v"
                          onClick={() => executeIllustratorAlign('align-center-v')}
                          title="Allinea al centro verticale"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="2" y="9.1" width="16" height="1.8" />
                            <rect x="4.5" y="3.5" width="4" height="13" />
                            <rect x="11" y="5.5" width="4" height="9" />
                          </svg>
                        </button>

                        {/* 7. Allinea in basso */}
                        <button
                          type="button"
                          data-testid="align-btn-bottom"
                          onClick={() => executeIllustratorAlign('align-bottom')}
                          title="Allinea in basso"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="2" y="16.2" width="16" height="1.8" />
                            <rect x="4.5" y="3.5" width="4" height="11" />
                            <rect x="11" y="7" width="4" height="7.5" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 2. Distribuisci oggetti (6 icone come nello screenshot) */}
                    <div className="pt-2 border-t border-[#4B4B4B]">
                      <div className="text-[11px] font-medium text-[#D6D6D6] mb-1.5">
                        Distribuisci oggetti:
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {/* Distribuisci in alto */}
                        <button
                          type="button"
                          data-testid="distribute-btn-top"
                          onClick={() => executeIllustratorAlign('distribute-top')}
                          title="Distribuisci in alto"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="2" y="3" width="16" height="1.4" />
                            <rect x="6" y="4.8" width="8" height="3.2" />
                            <rect x="2" y="11" width="16" height="1.4" />
                            <rect x="4.5" y="12.8" width="11" height="3.8" />
                          </svg>
                        </button>

                        {/* Distribuisci al centro verticale */}
                        <button
                          type="button"
                          data-testid="distribute-btn-center-v"
                          onClick={() => executeIllustratorAlign('distribute-center-v')}
                          title="Distribuisci al centro verticale"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="2" y="5.3" width="16" height="1.4" />
                            <rect x="6" y="3.8" width="8" height="4.4" />
                            <rect x="2" y="13.3" width="16" height="1.4" />
                            <rect x="4.5" y="11.8" width="11" height="4.4" />
                          </svg>
                        </button>

                        {/* Distribuisci in basso */}
                        <button
                          type="button"
                          data-testid="distribute-btn-bottom"
                          onClick={() => executeIllustratorAlign('distribute-bottom')}
                          title="Distribuisci in basso"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="6" y="3.2" width="8" height="3.5" />
                            <rect x="2" y="7.2" width="16" height="1.4" />
                            <rect x="4.5" y="11.5" width="11" height="3.8" />
                            <rect x="2" y="15.8" width="16" height="1.4" />
                          </svg>
                        </button>

                        {/* Distribuisci a sinistra */}
                        <button
                          type="button"
                          data-testid="distribute-btn-left"
                          onClick={() => executeIllustratorAlign('distribute-left')}
                          title="Distribuisci a sinistra"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="3" y="2" width="1.4" height="16" />
                            <rect x="4.8" y="4.5" width="3.5" height="11" />
                            <rect x="11" y="2" width="1.4" height="16" />
                            <rect x="12.8" y="6" width="3.5" height="8" />
                          </svg>
                        </button>

                        {/* Distribuisci al centro orizzontale */}
                        <button
                          type="button"
                          data-testid="distribute-btn-center-h"
                          onClick={() => executeIllustratorAlign('distribute-center-h')}
                          title="Distribuisci al centro orizzontale"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="5.3" y="2" width="1.4" height="16" />
                            <rect x="3.8" y="4.5" width="4.4" height="11" />
                            <rect x="13.3" y="2" width="1.4" height="16" />
                            <rect x="11.8" y="6" width="4.4" height="8" />
                          </svg>
                        </button>

                        {/* Distribuisci a destra */}
                        <button
                          type="button"
                          data-testid="distribute-btn-right"
                          onClick={() => executeIllustratorAlign('distribute-right')}
                          title="Distribuisci a destra"
                          className="h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center transition-colors"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                            <rect x="3.5" y="4.5" width="3.5" height="11" />
                            <rect x="7.5" y="2" width="1.4" height="16" />
                            <rect x="11.8" y="6" width="3.5" height="8" />
                            <rect x="15.8" y="2" width="1.4" height="16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 3. Riga Inferiore: "Distribuisci spaziatura:" (Sinistra) | "Allinea a:" (Destra) */}
                    <div className="pt-2 border-t border-[#4B4B4B] grid grid-cols-12 gap-2 items-end">
                      {/* Distribuisci spaziatura */}
                      <div className="col-span-7 space-y-1.5 pr-2 border-r border-[#4B4B4B]">
                        <div className="text-[11px] font-medium text-[#D6D6D6]">
                          Distribuisci spaziatura:
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            data-testid="distribute-spacing-v-btn"
                            onClick={() => executeIllustratorAlign('distribute-spacing-v')}
                            title="Distribuisci spaziatura verticale"
                            className="w-8 h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center shrink-0"
                          >
                            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                              <rect x="6" y="2.5" width="11" height="4.5" />
                              <rect x="6" y="13" width="11" height="4.5" />
                              <rect x="2" y="7" width="3" height="1.2" />
                              <rect x="2" y="11.8" width="3" height="1.2" />
                              <rect x="2.9" y="7" width="1.2" height="6" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            data-testid="distribute-spacing-h-btn"
                            onClick={() => executeIllustratorAlign('distribute-spacing-h')}
                            title="Distribuisci spaziatura orizzontale"
                            className="w-8 h-8 rounded bg-[#4A4A4A] hover:bg-[#5A5A5A] active:bg-[#0D66D0] flex items-center justify-center shrink-0"
                          >
                            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                              <rect x="2.5" y="6" width="4.5" height="11" />
                              <rect x="13" y="6" width="4.5" height="11" />
                              <rect x="7" y="2" width="1.2" height="3" />
                              <rect x="11.8" y="2" width="1.2" height="3" />
                              <rect x="7" y="2.9" width="6" height="1.2" />
                            </svg>
                          </button>

                          <div className="flex items-center bg-[#2B2B2B] border border-[#555555] rounded px-1.5 h-8 flex-1 min-w-0">
                            <input
                              type="number"
                              data-testid="distribute-spacing-input"
                              value={distributeSpacingValue}
                              onChange={(e) =>
                                setDistributeSpacingValue(Number(e.target.value) || 0)
                              }
                              aria-label="Valore spaziatura distribuzione"
                              className="w-full bg-transparent text-xs font-mono text-[#E8E8E8] focus:outline-none"
                            />
                            <span className="text-[10px] font-mono text-[#9E9E9E] ml-0.5">
                              mm
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Allinea a: (Tavola da disegno | Selezione | Oggetto chiave) */}
                      <div className="col-span-5 space-y-1.5 pl-1">
                        <div className="text-[11px] font-medium text-[#D6D6D6]">Allinea a:</div>
                        <div className="grid grid-cols-3 gap-1">
                          {/* Allinea a tavola da disegno */}
                          <button
                            type="button"
                            data-testid="align-target-artboard"
                            onClick={() => setAlignTargetMode('artboard')}
                            title="Allinea a tavola da disegno"
                            className={`h-8 rounded flex items-center justify-center border transition-colors ${
                              alignTargetMode === 'artboard'
                                ? 'bg-[#222222] border-[#FF9A00] text-white'
                                : 'bg-[#4A4A4A] border-transparent text-[#CCCCCC] hover:bg-[#5A5A5A]'
                            }`}
                          >
                            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                              <path d="M4 4 H13 L16 7 V16 H4 Z M5.5 5.5 V14.5 H14.5 V8 H12 V5.5 Z" />
                              <rect x="2" y="2" width="2" height="2" />
                            </svg>
                          </button>

                          {/* Allinea a selezione */}
                          <button
                            type="button"
                            data-testid="align-target-selection"
                            onClick={() => setAlignTargetMode('selection')}
                            title="Allinea a selezione (usa Shift+Clic per selezionare più oggetti)"
                            className={`h-8 rounded flex items-center justify-center border transition-colors ${
                              alignTargetMode === 'selection'
                                ? 'bg-[#222222] border-[#FF9A00] text-white'
                                : 'bg-[#4A4A4A] border-transparent text-[#CCCCCC] hover:bg-[#5A5A5A]'
                            }`}
                          >
                            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                              <rect
                                x="4"
                                y="4"
                                width="12"
                                height="12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeDasharray="2.5 2"
                              />
                              <rect x="3" y="3" width="2.4" height="2.4" />
                              <rect x="14.6" y="3" width="2.4" height="2.4" />
                              <rect x="3" y="14.6" width="2.4" height="2.4" />
                              <rect x="14.6" y="14.6" width="2.4" height="2.4" />
                            </svg>
                          </button>

                          {/* Allinea a oggetto chiave */}
                          <button
                            type="button"
                            data-testid="align-target-key-object"
                            onClick={() => {
                              setAlignTargetMode('key-object');
                              if (!keyObjectId && selectedId) {
                                setKeyObjectId(selectedId);
                              }
                            }}
                            title="Allinea a oggetto chiave"
                            className={`h-8 rounded flex items-center justify-center border transition-colors ${
                              alignTargetMode === 'key-object'
                                ? 'bg-[#222222] border-[#FF9A00] text-white'
                                : 'bg-[#4A4A4A] border-transparent text-[#CCCCCC] hover:bg-[#5A5A5A]'
                            }`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Box Dedicato: Impostazioni Macchia Blob col Cursore */}
                <div className={`p-3 rounded-lg border space-y-2.5 ${inputBg}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#FF9A00] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Macchia Blob col Cursore (Shift+B)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTool('blob')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeTool === 'blob'
                          ? 'bg-[#B85B43] text-white'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      {activeTool === 'blob' ? 'Strumento Attivo' : 'Attiva Ora'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool('blob');
                        setBlobMode('freeform-lasso');
                      }}
                      className={`p-2 rounded border text-left text-[11px] font-semibold ${
                        blobMode === 'freeform-lasso'
                          ? 'bg-[#B85B43] text-white border-[#B85B43]'
                          : 'border-white/15 hover:bg-white/5'
                      }`}
                    >
                      <div>1. Lazo Forma Chiusa</div>
                      <div className="text-[10px] opacity-80 font-normal">
                        Chiude il perimetro disegnato
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool('blob');
                        setBlobMode('blob-brush-merge');
                      }}
                      className={`p-2 rounded border text-left text-[11px] font-semibold ${
                        blobMode === 'blob-brush-merge'
                          ? 'bg-[#B85B43] text-white border-[#B85B43]'
                          : 'border-white/15 hover:bg-white/5'
                      }`}
                    >
                      <div>2. Pennello Blob Unione</div>
                      <div className="text-[10px] opacity-80 font-normal">
                        Fonde tratti dello stesso colore
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                        Calibro Tratto ({brushSize} px)
                      </label>
                      <input
                        type="range"
                        min={8}
                        max={80}
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-full accent-[#B85B43]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                        Organicità ({Math.round(blobRoughness * 100)}%)
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={0.45}
                        step={0.02}
                        value={blobRoughness}
                        onChange={(e) => setBlobRoughness(Number(e.target.value))}
                        className="w-full accent-[#B85B43]"
                      />
                    </div>
                  </div>

                  {blobMode === 'blob-brush-merge' && (
                    <label className="flex items-center gap-2 text-[11px] cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={mergeBlobBrushWithSameColor}
                        onChange={(e) => setMergeBlobBrushWithSameColor(e.target.checked)}
                        className="accent-[#B85B43]"
                      />
                      <span>Unisci automaticamente alle macchie dello stesso colore</span>
                    </label>
                  )}
                </div>

                {/* Selettore Forme Geometriche (M) e Timbri (S) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2.5 rounded-lg border space-y-1.5 ${inputBg}`}>
                    <span className="block text-[10px] font-bold uppercase opacity-80">
                      Forma Vettoriale (M)
                    </span>
                    <select
                      value={activeShapeKind}
                      onChange={(e) => {
                        setActiveShapeKind(e.target.value as ShapePrimitiveKind);
                        setActiveTool('shape');
                      }}
                      className="w-full bg-transparent text-xs font-semibold focus:outline-none"
                    >
                      {SHAPE_CATALOG.map((sh) => (
                        <option key={sh.id} value={sh.id} className="bg-[#252526] text-white">
                          {sh.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`p-2.5 rounded-lg border space-y-1.5 ${inputBg}`}>
                    <span className="block text-[10px] font-bold uppercase opacity-80">
                      Timbro Brand (S)
                    </span>
                    <select
                      value={activeStamp}
                      onChange={(e) => {
                        setActiveStamp(e.target.value as StampKind);
                        setActiveTool('stamp');
                      }}
                      className="w-full bg-transparent text-xs font-semibold focus:outline-none"
                    >
                      {STAMP_CATALOG.map((st) => (
                        <option key={st.id} value={st.id} className="bg-[#252526] text-white">
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Riempimento (Fill) & Traccia (Stroke) */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider opacity-80">
                    Aspetto: Riempimento (Fill) &amp; Traccia (Stroke)
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {BRAND_PALETTE.map((swatch) => (
                      <button
                        key={swatch.id}
                        type="button"
                        onClick={() => {
                          setActiveColor(swatch.hex);
                          if (selectedElement && !selectedElement.locked) {
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id ? { ...el, color: swatch.hex } : el
                              )
                            );
                          }
                        }}
                        className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 ${
                          (selectedElement?.color || activeColor) === swatch.hex
                            ? 'border-[#FF9A00] ring-1 ring-[#FF9A00] bg-white/10'
                            : 'border-white/15'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full border border-black/30"
                          style={{ backgroundColor: swatch.hex }}
                        />
                        <span className="text-[9px] font-mono">{swatch.hex}</span>
                      </button>
                    ))}
                  </div>

                  {/* Spessore Traccia & Tratteggio */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                        Spessore Traccia ({selectedElement?.strokeWidth ?? activeStrokeWidth} pt)
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={28}
                        value={selectedElement?.strokeWidth ?? activeStrokeWidth}
                        onChange={(e) => {
                          const sw = Number(e.target.value);
                          setActiveStrokeWidth(sw);
                          const sCol =
                            activeStrokeColor === 'none' && sw > 0
                              ? '#1A2B4C'
                              : activeStrokeColor;
                          setActiveStrokeColor(sCol);
                          if (selectedElement && !selectedElement.locked) {
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id
                                  ? {
                                      ...el,
                                      strokeWidth: sw,
                                      strokeColor:
                                        sw > 0 && (!el.strokeColor || el.strokeColor === 'none')
                                          ? '#1A2B4C'
                                          : el.strokeColor,
                                    }
                                  : el
                              )
                            );
                          }
                        }}
                        className="w-full accent-[#0D66D0]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                        Stile Linea
                      </label>
                      <select
                        value={selectedElement?.strokeDasharray ?? activeStrokeDash}
                        onChange={(e) => {
                          const dash = e.target.value;
                          setActiveStrokeDash(dash);
                          if (selectedElement && !selectedElement.locked) {
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id
                                  ? { ...el, strokeDasharray: dash }
                                  : el
                              )
                            );
                          }
                        }}
                        className={`w-full px-2 py-1.5 rounded border text-xs ${inputBg}`}
                      >
                        <option value="">Continua</option>
                        <option value="12 8">Tratteggiata</option>
                        <option value="4 8">Punteggiata</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Pannello Trasforma & Pathfinder per l'elemento selezionato */}
                {selectedElement && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-[#3B9EFF]">
                        Trasforma &amp; Pathfinder
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id
                                  ? { ...el, flipX: !el.flipX }
                                  : el
                              )
                            )
                          }
                          title="Rifletti Orizzontalmente"
                          className={`p-1.5 rounded border ${inputBg}`}
                        >
                          <FlipHorizontal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id
                                  ? { ...el, flipY: !el.flipY }
                                  : el
                              )
                            )
                          }
                          title="Rifletti Verticalmente"
                          className={`p-1.5 rounded border ${inputBg}`}
                        >
                          <FlipVertical className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => pasteFromClipboard(selectedElement)}
                          title="Duplica livello (Ctrl+V)"
                          className={`p-1.5 rounded border ${inputBg}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            commitElementsChange((prev) =>
                              prev.filter((el) => el.id !== selectedElement.id)
                            );
                            selectSingleElement(null);
                          }}
                          title="Elimina livello"
                          className="p-1.5 rounded bg-[#B85B43]/20 text-[#B85B43] hover:bg-[#B85B43] hover:text-white"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Coordinate X, Y, Rotazione, Opacità */}
                    <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                      <div className={`p-1.5 rounded border ${inputBg}`}>
                        <span className="block text-[9px] opacity-60">X</span>
                        <input
                          type="number"
                          value={Math.round(selectedElement.x)}
                          onChange={(e) => {
                            const nx = Number(e.target.value) || 0;
                            const dx = nx - selectedElement.x;
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id
                                  ? translateVectorElementByDelta(el, dx, 0)
                                  : el
                              )
                            );
                          }}
                          className="w-full bg-transparent focus:outline-none"
                        />
                      </div>
                      <div className={`p-1.5 rounded border ${inputBg}`}>
                        <span className="block text-[9px] opacity-60">Y</span>
                        <input
                          type="number"
                          value={Math.round(selectedElement.y)}
                          onChange={(e) => {
                            const ny = Number(e.target.value) || 0;
                            const dy = ny - selectedElement.y;
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id
                                  ? translateVectorElementByDelta(el, 0, dy)
                                  : el
                              )
                            );
                          }}
                          className="w-full bg-transparent focus:outline-none"
                        />
                      </div>
                      <div className={`p-1.5 rounded border ${inputBg}`}>
                        <span className="block text-[9px] opacity-60">Rot°</span>
                        <input
                          type="number"
                          min={-180}
                          max={180}
                          value={selectedElement.rotation}
                          onChange={(e) => {
                            const rot = Number(e.target.value) || 0;
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id ? { ...el, rotation: rot } : el
                              )
                            );
                          }}
                          className="w-full bg-transparent focus:outline-none"
                        />
                      </div>
                      <div className={`p-1.5 rounded border ${inputBg}`}>
                        <span className="block text-[9px] opacity-60">Opac%</span>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          step={5}
                          value={Math.round(selectedElement.opacity * 100)}
                          onChange={(e) => {
                            const op = Math.min(1, Math.max(0.1, Number(e.target.value) / 100));
                            commitElementsChange((prev) =>
                              prev.map((el) =>
                                el.id === selectedElement.id ? { ...el, opacity: op } : el
                              )
                            );
                          }}
                          className="w-full bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Bottoni Pathfinder & Nodi */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={handlePathfinderUnite}
                        className="py-1.5 px-2 rounded bg-[#0D66D0]/20 border border-[#0D66D0]/50 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-[#0D66D0] hover:text-white transition-colors"
                      >
                        <Combine className="w-3.5 h-3.5" />
                        <span>Unisci col Sottostante</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleConvertSelectedToOrganicBlob}
                        className="py-1.5 px-2 rounded bg-[#B85B43]/20 border border-[#B85B43]/50 text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-[#B85B43] hover:text-white transition-colors"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Converti in Maniglie Bézier</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Texture & Sfondo Carta */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label
                    htmlFor="builder-texture-select"
                    className="block text-[10px] font-bold uppercase opacity-75"
                  >
                    Filtro Texture Vettoriale
                  </label>
                  <select
                    id="builder-texture-select"
                    value={selectedElement ? selectedElement.textureType : activeTexture}
                    onChange={(e) => {
                      const val = e.target.value as TextureFilterType;
                      setActiveTexture(val);
                      if (selectedElement) {
                        updateSelectedTextProperty({ textureType: val });
                      }
                    }}
                    className={`w-full px-2.5 py-1.5 rounded border text-xs font-semibold ${inputBg}`}
                  >
                    <option value="none">Tracciato Vettoriale Puro (Nitido)</option>
                    <option value="rough-brush">Texture Pennellata Ruvida</option>
                    <option value="ink-porosity">Porosità dell&apos;Inchiostro</option>
                    <option value="cyanotype">Effetto Cianotipia Solare</option>
                    <option value="materic-blob">Riempimento Materico Blob</option>
                  </select>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold uppercase opacity-75">
                      Sfondo Tavola
                    </span>
                    <div className="flex items-center gap-1.5">
                      {BRAND_PALETTE.map((sw) => (
                        <button
                          key={sw.id}
                          type="button"
                          onClick={() => setBackgroundColor(sw.hex)}
                          aria-label={`Sfondo canvas ${sw.name}`}
                          className={`w-5 h-5 rounded border ${
                            backgroundColor === sw.hex
                              ? 'border-[#FF9A00] ring-2 ring-[#FF9A00]'
                              : 'border-white/30'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 2: CARATTERE & CASELLA DI TESTO (SOLO MONTSERRAT E AKENA OTOS) ==================== */}
            {rightDockTab === 'character' && (
              <div data-testid="character-studio-panel" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF9A00]">
                      Caselle di Testo &amp; Tipografia
                    </h3>
                    <p className={`text-[11px] ${mutedText}`}>
                      Due sole famiglie ufficiali: Montserrat &amp; Akena Otos
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="add-textbox-btn"
                    onClick={() =>
                      createNewTextBoxAt(
                        Math.round(canvasSize.width / 2),
                        Math.round(canvasSize.height / 2),
                        540
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D66D0] text-white text-xs font-bold hover:bg-[#0952a8] transition-colors shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Casella di Testo</span>
                  </button>
                </div>

                {/* Selettore Esclusivo delle 2 Famiglie Font: Montserrat vs Akena Otos */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider opacity-80">
                    1. Famiglia Font (Esclusiva 2 Font)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {BUILDER_FONT_FAMILIES.map((fam) => {
                      const currentFam =
                        selectedElement?.type === 'textured-text' && selectedElement.fontFamily
                          ? selectedElement.fontFamily
                          : activeFontFamily;
                      const isSel = currentFam === fam.id;
                      return (
                        <button
                          key={fam.id}
                          type="button"
                          data-testid={`font-family-btn-${fam.id === 'Montserrat' ? 'montserrat' : 'akena'}`}
                          onClick={() => {
                            setActiveFontFamily(fam.id);
                            if (selectedElement?.type === 'textured-text') {
                              updateSelectedTextProperty({
                                fontFamily: fam.id,
                                fontStyle:
                                  fam.id === 'Akena Otos' ? 'editorial-serif' : 'craft-rounded',
                              });
                            }
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSel
                              ? 'bg-[#0D66D0] text-white border-[#3B9EFF] shadow'
                              : `${inputBg} hover:opacity-90`
                          }`}
                        >
                          <div
                            className="text-sm font-bold truncate"
                            style={{
                              fontFamily:
                                fam.id === 'Montserrat'
                                  ? '"Montserrat", sans-serif'
                                  : '"Akena Otos", "Fraunces", Georgia, serif',
                            }}
                          >
                            {fam.label}
                          </div>
                          <div className="text-[10px] opacity-80 leading-tight mt-0.5">
                            18 Declinazioni
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selettore Tutte le 18 Declinazioni (100 Thin .. 900 Black, Normale & Italic) */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="font-declination-select"
                    className="block text-[11px] font-bold uppercase tracking-wider opacity-80"
                  >
                    2. Declinazione ({activeFontFamily} · 18 Varianti)
                  </label>
                  <select
                    id="font-declination-select"
                    data-testid="font-declination-select"
                    value={
                      selectedElement?.type === 'textured-text' && selectedElement.fontWeight
                        ? `${selectedElement.fontWeight}-${
                            selectedElement.fontItalic ? 'italic' : 'normal'
                          }`
                        : `${activeFontWeight}-${activeFontItalic ? 'italic' : 'normal'}`
                    }
                    onChange={(e) => {
                      const found = FONT_DECLINATIONS.find((d) => d.id === e.target.value);
                      if (!found) return;
                      setActiveFontWeight(found.weight);
                      setActiveFontItalic(found.italic);
                      if (selectedElement?.type === 'textured-text') {
                        updateSelectedTextProperty({
                          fontFamily: selectedElement.fontFamily || activeFontFamily,
                          fontWeight: found.weight,
                          fontItalic: found.italic,
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold ${inputBg}`}
                  >
                    {FONT_DECLINATIONS.map((decl) => (
                      <option
                        key={decl.id}
                        value={decl.id}
                        className="bg-[#252526] text-white"
                      >
                        {activeFontFamily} — {decl.label}
                      </option>
                    ))}
                  </select>

                  {/* Griglia Rapida Pesi 100–900 + Toggle Italic */}
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {([100, 200, 300, 400, 500, 600, 700, 800, 900] as BuilderFontWeight[]).map(
                      (w) => {
                        const curW =
                          selectedElement?.type === 'textured-text' && selectedElement.fontWeight
                            ? selectedElement.fontWeight
                            : activeFontWeight;
                        return (
                          <button
                            key={w}
                            type="button"
                            onClick={() => {
                              setActiveFontWeight(w);
                              if (selectedElement?.type === 'textured-text') {
                                updateSelectedTextProperty({
                                  fontFamily: selectedElement.fontFamily || activeFontFamily,
                                  fontWeight: w,
                                });
                              }
                            }}
                            className={`py-1 rounded text-[11px] font-mono font-semibold border ${
                              curW === w
                                ? 'bg-[#FF9A00] text-black border-[#FF9A00]'
                                : `${inputBg} opacity-80 hover:opacity-100`
                            }`}
                          >
                            {w}
                          </button>
                        );
                      }
                    )}
                    <button
                      type="button"
                      data-testid="font-italic-toggle"
                      onClick={() => {
                        const nextIt =
                          selectedElement?.type === 'textured-text'
                            ? !selectedElement.fontItalic
                            : !activeFontItalic;
                        setActiveFontItalic(nextIt);
                        if (selectedElement?.type === 'textured-text') {
                          updateSelectedTextProperty({
                            fontFamily: selectedElement.fontFamily || activeFontFamily,
                            fontItalic: nextIt,
                          });
                        }
                      }}
                      className={`py-1 rounded text-[11px] italic font-serif font-bold border ${
                        (
                          selectedElement?.type === 'textured-text'
                            ? selectedElement.fontItalic
                            : activeFontItalic
                        )
                          ? 'bg-[#FF9A00] text-black border-[#FF9A00]'
                          : `${inputBg} opacity-80 hover:opacity-100`
                      }`}
                    >
                      Italic
                    </button>
                  </div>
                </div>

                {/* Caricamento File Font Originale (.OTF / .TTF / .WOFF2) */}
                <div className={`p-2.5 rounded-lg border space-y-1.5 ${inputBg}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold">
                      File Font {activeFontFamily} (.OTF / .TTF)
                    </span>
                    {customLoadedFonts[activeFontFamily] ? (
                      <span className="flex items-center gap-1 text-[10px] text-[#4A6B53] font-semibold">
                        <Check className="w-3 h-3" />
                        {customLoadedFonts[activeFontFamily]}
                      </span>
                    ) : (
                      <span className={`text-[10px] ${mutedText}`}>Predefinito integrato</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fontFileInputRef.current?.click()}
                    className="w-full py-1.5 px-2.5 rounded bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#FF9A00]" />
                    <span>Carica file .OTF / .TTF per {activeFontFamily}</span>
                  </button>
                </div>

                {/* Editor Testo Contenuto Casella */}
                {selectedElement?.type === 'textured-text' && !selectedElement.isHandDrawnText ? (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div>
                      <label
                        htmlFor="textbox-content-textarea"
                        className="block text-[11px] font-bold uppercase tracking-wider mb-1"
                      >
                        Testo della Casella Selezionata
                      </label>
                      <textarea
                        id="textbox-content-textarea"
                        data-testid="textbox-content-textarea"
                        rows={3}
                        value={selectedElement.textContent || ''}
                        onChange={(e) =>
                          updateSelectedTextProperty({ textContent: e.target.value })
                        }
                        className={`w-full px-2.5 py-2 text-xs rounded-lg border ${inputBg}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                          Corpo Font ({selectedElement.fontSize || 48} pt)
                        </label>
                        <input
                          type="number"
                          min={12}
                          max={220}
                          value={selectedElement.fontSize || 48}
                          onChange={(e) => {
                            const v = Math.max(12, Number(e.target.value) || 48);
                            setActiveFontSize(v);
                            updateSelectedTextProperty({ fontSize: v });
                          }}
                          className={`w-full px-2.5 py-1.5 rounded border text-xs font-mono ${inputBg}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                          Larghezza Box ({selectedElement.textBoxWidth || selectedElement.width} px)
                        </label>
                        <input
                          type="number"
                          min={160}
                          max={1040}
                          step={20}
                          value={selectedElement.textBoxWidth || selectedElement.width || 520}
                          onChange={(e) => {
                            const w = Math.max(160, Number(e.target.value) || 520);
                            updateSelectedTextProperty({ textBoxWidth: w });
                          }}
                          className={`w-full px-2.5 py-1.5 rounded border text-xs font-mono ${inputBg}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                          Interlinea ({(selectedElement.lineHeight || 1.2).toFixed(2)})
                        </label>
                        <input
                          type="range"
                          min={0.85}
                          max={2.2}
                          step={0.05}
                          value={selectedElement.lineHeight || 1.2}
                          onChange={(e) => {
                            const lh = Number(e.target.value);
                            setActiveLineHeight(lh);
                            updateSelectedTextProperty({ lineHeight: lh });
                          }}
                          className="w-full accent-[#FF9A00]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                          Tracking ({Math.round((selectedElement.letterSpacing || 0) * 1000)})
                        </label>
                        <input
                          type="range"
                          min={-0.06}
                          max={0.35}
                          step={0.01}
                          value={selectedElement.letterSpacing || 0}
                          onChange={(e) => {
                            const ls = Number(e.target.value);
                            setActiveLetterSpacing(ls);
                            updateSelectedTextProperty({ letterSpacing: ls });
                          }}
                          className="w-full accent-[#FF9A00]"
                        />
                      </div>
                    </div>

                    {/* Allineamento Paragrafo & Trasformazione Maiuscole/Minuscole */}
                    <div className="flex items-center justify-between gap-2">
                      <div className={`flex items-center rounded border p-0.5 ${inputBg}`}>
                        <button
                          type="button"
                          onClick={() => updateSelectedTextProperty({ textAlign: 'left' })}
                          title="Allinea testo a sinistra"
                          className={`p-1.5 rounded ${
                            selectedElement.textAlign === 'left'
                              ? 'bg-[#0D66D0] text-white'
                              : 'hover:bg-white/10'
                          }`}
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedTextProperty({ textAlign: 'center' })}
                          title="Centra testo"
                          className={`p-1.5 rounded ${
                            (selectedElement.textAlign || 'center') === 'center'
                              ? 'bg-[#0D66D0] text-white'
                              : 'hover:bg-white/10'
                          }`}
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedTextProperty({ textAlign: 'right' })}
                          title="Allinea testo a destra"
                          className={`p-1.5 rounded ${
                            selectedElement.textAlign === 'right'
                              ? 'bg-[#0D66D0] text-white'
                              : 'hover:bg-white/10'
                          }`}
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div
                        className={`flex items-center rounded border p-0.5 text-[11px] font-mono ${inputBg}`}
                      >
                        <button
                          type="button"
                          onClick={() => updateSelectedTextProperty({ textTransform: 'none' })}
                          className={`px-2 py-1 rounded ${
                            (selectedElement.textTransform || 'none') === 'none'
                              ? 'bg-[#0D66D0] text-white'
                              : ''
                          }`}
                        >
                          Aa
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedTextProperty({ textTransform: 'uppercase' })}
                          className={`px-2 py-1 rounded ${
                            selectedElement.textTransform === 'uppercase'
                              ? 'bg-[#0D66D0] text-white'
                              : ''
                          }`}
                        >
                          AA
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedTextProperty({ textTransform: 'lowercase' })}
                          className={`px-2 py-1 rounded ${
                            selectedElement.textTransform === 'lowercase'
                              ? 'bg-[#0D66D0] text-white'
                              : ''
                          }`}
                        >
                          aa
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-3 rounded-lg border text-xs ${inputBg}`}>
                    Seleziona un livello di testo sulla tavola oppure clicca{' '}
                    <strong>&ldquo;+ Casella di Testo&rdquo;</strong> (tasto{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-black/30 font-mono">T</kbd>) per
                    scrivere con <strong>Montserrat</strong> o <strong>Akena Otos</strong>.
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 3: SEZIONE "CARICAMENTI" PNG STILE CANVA ==================== */}
            {rightDockTab === 'uploads' && (
              <div data-testid="uploads-studio-panel" className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#FF9A00]">
                    Caricamenti PNG &amp; Sticker (Stile Canva)
                  </h3>
                  <p className={`text-[11px] ${mutedText}`}>
                    Carica file PNG trasparenti, illustrazioni o loghi da usare liberamente nelle tue locandine.
                  </p>
                </div>

                {/* Dropzone / Bottone Carica File PNG */}
                <button
                  type="button"
                  data-testid="upload-png-trigger-btn"
                  onClick={() => pngUploadInputRef.current?.click()}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#0D66D0] hover:bg-[#0952a8] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Carica file PNG / Immagini</span>
                </button>

                {/* Se c'è un Partner attivo, mostra anche l'accesso rapido al Logo Partner */}
                {activePartner && (
                  <div className={`p-3 rounded-lg border space-y-2 ${inputBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#B85B43]">
                        Logo Partner: {activePartner.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => partnerLogoInputRef.current?.click()}
                        className="text-[10px] font-semibold text-[#3B9EFF] hover:underline"
                      >
                        {activePartner.logoImageUrl ? 'Cambia Logo' : '+ Carica Logo'}
                      </button>
                    </div>
                    {activePartner.logoImageUrl ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-12 h-12 rounded bg-white p-1 flex items-center justify-center shrink-0">
                          <img
                            src={activePartner.logoImageUrl}
                            alt={activePartner.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            insertPngAssetOnCanvas({
                              id: `partner-logo-${activePartner.id}`,
                              name: `Logo ${activePartner.name}`,
                              dataUrl: activePartner.logoImageUrl!,
                              width: 260,
                              height: 160,
                              createdAt: Date.now(),
                            })
                          }
                          className="flex-1 py-1.5 px-2.5 rounded bg-[#B85B43] text-white text-[11px] font-semibold"
                        >
                          + Inserisci Logo {activePartner.name}
                        </button>
                      </div>
                    ) : (
                      <p className={`text-[10px] ${mutedText}`}>
                        Nessun file logo caricato per {activePartner.name}. Clicca &ldquo;+ Carica Logo&rdquo; per aggiungerlo.
                      </p>
                    )}
                  </div>
                )}

                {/* Griglia Libreria Caricamenti PNG */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                      La tua Libreria PNG ({uploadedPngs.length})
                    </span>
                    <span className={`text-[10px] ${mutedText}`}>Clicca per inserire</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {uploadedPngs.map((asset) => (
                      <div
                        key={asset.id}
                        data-testid={`uploaded-png-card-${asset.id}`}
                        className={`group relative rounded-lg border overflow-hidden flex flex-col ${inputBg}`}
                      >
                        <button
                          type="button"
                          onClick={() => insertPngAssetOnCanvas(asset)}
                          className="h-28 w-full p-2 flex items-center justify-center bg-[radial-gradient(#88888833_1px,transparent_1px)] [background-size:10px_10px] hover:scale-105 transition-transform"
                        >
                          <img
                            src={asset.dataUrl}
                            alt={asset.name}
                            className="max-h-full max-w-full object-contain drop-shadow"
                          />
                        </button>
                        <div className="p-2 border-t border-white/10 flex items-center justify-between gap-1">
                          <span className="text-[11px] font-semibold truncate">{asset.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => insertPngAssetOnCanvas(asset)}
                              title="Inserisci sulla locandina"
                              className="px-1.5 py-0.5 rounded bg-[#0D66D0] text-white text-[10px] font-bold"
                            >
                              + Usa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveUploadedPng(asset.id)}
                              title="Elimina dalla libreria"
                              className="p-1 rounded text-[#B85B43] hover:bg-[#B85B43]/20"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 4: LIVELLI Z-INDEX, PARTNER KIT & CLIPBOARD ==================== */}
            {rightDockTab === 'layers' && (
              <div data-testid="layers-studio-panel" className="space-y-4">
                {/* Partner Brand Kit Selector + Caricamento File Logo Partner */}
                <div className={`p-3 rounded-lg border space-y-2.5 ${inputBg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#B85B43]" />
                      <label
                        htmlFor="builder-partner-dropdown"
                        className="text-[11px] font-bold uppercase"
                      >
                        Partner Brand &amp; Logo
                      </label>
                    </div>
                    {activePartner && (
                      <button
                        type="button"
                        data-testid="builder-upload-partner-logo-btn"
                        onClick={() => partnerLogoInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0D66D0] text-white text-[10px] font-semibold"
                      >
                        <Upload className="w-3 h-3" />
                        <span>
                          {activePartner.logoImageUrl ? 'Cambia Logo' : 'Carica Logo Partner'}
                        </span>
                      </button>
                    )}
                  </div>

                  <select
                    id="builder-partner-dropdown"
                    data-testid="builder-partner-dropdown"
                    value={selectedPartnerId}
                    onChange={(e) => handlePartnerDropdownChange(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold focus:outline-none"
                  >
                    <option value="" className="bg-[#252526] text-white">
                      — Nessun Partner (Solo Fatti a mano) —
                    </option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#252526] text-white">
                        {p.name} ({p.logoImageUrl ? 'Logo File + ' : ''}
                        {p.logoText})
                      </option>
                    ))}
                  </select>

                  {activePartner && (
                    <div className="space-y-2 pt-1">
                      {activePartner.logoImageUrl && (
                        <div className="flex items-center gap-2 p-2 rounded bg-black/20 border border-white/10">
                          <div className="w-10 h-10 rounded bg-white p-1 flex items-center justify-center shrink-0">
                            <img
                              src={activePartner.logoImageUrl}
                              alt={`Logo ${activePartner.name}`}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold truncate">
                              Logo {activePartner.name}
                            </div>
                            <div className={`text-[10px] ${mutedText}`}>
                              Pronto per la locandina
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleInsertFullPartnerKitOnCanvas}
                        className="w-full py-1.5 px-2 bg-[#B85B43] text-white rounded text-[11px] font-semibold"
                      >
                        + Inserisci Logo &amp; Macchia {activePartner.name}
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista Livelli Vettoriali (Supporta anche Shift+Clic per Selezione Multipla) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                      Gerarchia Livelli (Shift+Clic multipli)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        commitElementsChange(() => []);
                        selectSingleElement(null);
                      }}
                      className="text-[11px] font-semibold text-[#B85B43] hover:underline"
                    >
                      Svuota Tavola
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                    {[...sortedElements].reverse().map((el) => {
                      const isSel = el.id === selectedId || selectedIds.includes(el.id);
                      return (
                        <div
                          key={el.id}
                          onClick={(ev) => {
                            if (ev.shiftKey) {
                              toggleMultiSelectElement(el.id);
                            } else {
                              selectSingleElement(el.id);
                              if (el.type === 'textured-text') {
                                setRightDockTab('character');
                              }
                            }
                          }}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-[#0D66D0] text-white border-[#3B9EFF]'
                              : `${inputBg} hover:opacity-90`
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-sm border border-white/40 shrink-0"
                              style={{
                                backgroundColor:
                                  el.color && el.color !== 'none' ? el.color : '#FF9A00',
                              }}
                            />
                            <span className="truncate font-medium">{el.name}</span>
                          </div>
                          <div
                            className="flex items-center gap-0.5 shrink-0 ml-1"
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
                                commitElementsChange((prev) =>
                                  prev.map((item) =>
                                    item.id === el.id
                                      ? { ...item, visible: !item.visible }
                                      : item
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
                                commitElementsChange((prev) =>
                                  prev.map((item) =>
                                    item.id === el.id ? { ...item, locked: !item.locked } : item
                                  )
                                )
                              }
                              aria-label={`Blocca o sblocca ${el.name}`}
                              className="p-1 hover:opacity-75"
                            >
                              {el.locked ? (
                                <Lock className="w-3 h-3 text-[#FF9A00]" />
                              ) : (
                                <Unlock className="w-3 h-3 opacity-50" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Clipboard Vettoriale */}
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#4A6B53]">
                    Appunti &amp; Simboli Vettoriali ({clipboard.length})
                  </span>
                  <div className="space-y-1">
                    {clipboard.map((clipItem) => (
                      <button
                        key={clipItem.id}
                        type="button"
                        onClick={() => pasteFromClipboard(clipItem)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded border text-xs font-medium ${inputBg} hover:opacity-90`}
                      >
                        <span className="truncate">{clipItem.name}</span>
                        <span className="text-[10px] text-[#FF9A00] font-bold ml-2">
                          + Incolla
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
