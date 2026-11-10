export type BrandColorHex =
  | '#EADDCD' // Beige Kraft
  | '#B85B43' // Terracotta
  | '#4A6B53' // Verde Bosco
  | '#D4A373' // Ocra
  | '#1A2B4C' // Blu Notte
  | string; // Supporta anche i colori custom della Palette Partner

export interface BrandColorSwatch {
  id: string;
  name: string;
  hex: string;
  role: string;
}

export const BRAND_PALETTE: BrandColorSwatch[] = [
  { id: 'kraft', name: 'Beige Kraft', hex: '#EADDCD', role: 'Carta Naturale / Sfondo' },
  { id: 'terracotta', name: 'Terracotta', hex: '#B85B43', role: 'Accento Primario / Argilla' },
  { id: 'bosco', name: 'Verde Bosco', hex: '#4A6B53', role: 'Botanico / Matisse' },
  { id: 'ocra', name: 'Ocra Dorata', hex: '#D4A373', role: 'Calore / Dettagli' },
  { id: 'notte', name: 'Blu Notte', hex: '#1A2B4C', role: 'Inchiostro / Tipografia' },
];

export type CanvasPresetId = '1080x1080' | '1080x1350' | 'A4' | 'custom';

export interface CanvasPreset {
  id: CanvasPresetId;
  label: string;
  sublabel: string;
  width: number;
  height: number;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: '1080x1080', label: '1080 × 1080', sublabel: 'Social Post Square', width: 1080, height: 1080 },
  { id: '1080x1350', label: '1080 × 1350', sublabel: 'Locandina IG Portrait', width: 1080, height: 1350 },
  { id: 'A4', label: 'A4 Stampa', sublabel: '1240 × 1754 px (150 DPI)', width: 1240, height: 1754 },
];

export type DrawingToolId =
  | 'select'
  | 'direct-select'
  | 'pen'
  | 'blob'
  | 'brush'
  | 'text-box'
  | 'shape'
  | 'checkerboard'
  | 'stamp'
  | 'eyedropper'
  | 'textured-text';

export type BlobDrawMode = 'freeform-lasso' | 'blob-brush-merge';

export type ShapePrimitiveKind = 'rect' | 'ellipse' | 'polygon' | 'star';

export type BuilderFontFamily = 'Montserrat' | 'Akena Otos';

export type BuilderFontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface FontDeclinationOption {
  id: string;
  label: string;
  weight: BuilderFontWeight;
  italic: boolean;
}

export const FONT_DECLINATIONS: FontDeclinationOption[] = [
  { id: '100-normal', label: 'Thin (100)', weight: 100, italic: false },
  { id: '100-italic', label: 'Thin Italic (100i)', weight: 100, italic: true },
  { id: '200-normal', label: 'ExtraLight (200)', weight: 200, italic: false },
  { id: '200-italic', label: 'ExtraLight Italic (200i)', weight: 200, italic: true },
  { id: '300-normal', label: 'Light (300)', weight: 300, italic: false },
  { id: '300-italic', label: 'Light Italic (300i)', weight: 300, italic: true },
  { id: '400-normal', label: 'Regular (400)', weight: 400, italic: false },
  { id: '400-italic', label: 'Italic (400i)', weight: 400, italic: true },
  { id: '500-normal', label: 'Medium (500)', weight: 500, italic: false },
  { id: '500-italic', label: 'Medium Italic (500i)', weight: 500, italic: true },
  { id: '600-normal', label: 'SemiBold (600)', weight: 600, italic: false },
  { id: '600-italic', label: 'SemiBold Italic (600i)', weight: 600, italic: true },
  { id: '700-normal', label: 'Bold (700)', weight: 700, italic: false },
  { id: '700-italic', label: 'Bold Italic (700i)', weight: 700, italic: true },
  { id: '800-normal', label: 'ExtraBold (800)', weight: 800, italic: false },
  { id: '800-italic', label: 'ExtraBold Italic (800i)', weight: 800, italic: true },
  { id: '900-normal', label: 'Black (900)', weight: 900, italic: false },
  { id: '900-italic', label: 'Black Italic (900i)', weight: 900, italic: true },
];

export type TextureFilterType =
  | 'none'
  | 'rough-brush'
  | 'ink-porosity'
  | 'cyanotype'
  | 'materic-blob';

export type StampKind =
  | 'seal-fatti-a-mano'
  | 'matisse-leaf'
  | 'ink-splatter'
  | 'craft-star'
  | 'brush-zig'
  | 'thread-loop';

export type FontStyleId =
  | 'Montserrat'
  | 'Akena Otos'
  | 'editorial-serif'
  | 'craft-rounded'
  | 'mono-label'
  | 'freehand-glyphs';

export type PartnerLogoShape = 'circle-seal' | 'arch-badge' | 'botanical-crest' | 'minimal-box';

export interface PartnerProfile {
  id: string;
  name: string;
  whoTheyAre: string;
  address: string;
  commercialDealType: string;
  commercialDealNotes: string;
  defaultVenueFee: number;
  logoText: string;
  logoShape: PartnerLogoShape;
  fontStyle: FontStyleId;
  palette: string[]; // 3-4 colori esadecimali del partner
  clientUpdatedAt?: number;
}

export interface OperationalPhase {
  id: string;
  numberLabel: string; // es. "01", "02", "Fase A"
  title: string; // es. "Accoglienza & Calice", "Dimostrazione Tecnica"
  durationLabel?: string; // es. "20 min"
  description: string;
}

export interface PointerSample {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
  pointerType: 'mouse' | 'pen' | 'touch';
}

export interface VectorElement {
  id: string;
  name: string;
  type: 'freehand' | 'blob' | 'checkerboard' | 'stamp' | 'textured-text' | 'text-box' | 'shape' | 'pen-path';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  color: BrandColorHex;
  secondaryColor?: BrandColorHex;
  strokeColor?: BrandColorHex;
  strokeWidth?: number;
  strokeDasharray?: string;
  flipX?: boolean;
  flipY?: boolean;
  opacity: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  pathData: string;
  secondaryPathData?: string;
  subPaths?: Array<{ d: string; fill?: string; stroke?: string; strokeWidth?: number }>;
  controlPoints?: Array<{ x: number; y: number }>;
  shapeKind?: ShapePrimitiveKind;
  cornerRadius?: number;
  stampKind?: StampKind;
  textureType: TextureFilterType;
  textContent?: string;
  fontFamily?: BuilderFontFamily;
  fontWeight?: BuilderFontWeight;
  fontItalic?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  textBoxWidth?: number;
  fontStyle?: FontStyleId;
  fontSize?: number;
  isHandDrawnText?: boolean;
  partnerId?: string;
}

export interface WorkshopPosterDesign {
  id: string;
  workshopId: string;
  title: string;
  presetName: CanvasPresetId;
  width: number;
  height: number;
  backgroundColor: BrandColorHex;
  partnerId: string;
  elements: VectorElement[];
  clipboard: VectorElement[];
  clientUpdatedAt: number;
}

export interface MaterialItem {
  id: string;
  name: string;
  unitCost: number;
  quantity: number;
  packsOrdered?: number; // Quantità prodotto ordinato (confezioni)
  piecesPerPack?: number; // Quantità pezzi contenuti nel prodotto ordinato
  manualRowTotal?: number; // Subtotale manuale quando il calcolatore è in modalità scollegata
  costType: 'fixed' | 'variable';
  notes?: string;
  packed?: boolean;
  confirmedForInventory?: boolean;
  confirmedToInventory?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  costType: 'fixed' | 'variable';
  unitCost: number;
  packsOrderedTotal: number;
  piecesPerPack: number;
  totalPiecesOrdered: number;
  piecesUsedTotal: number;
  piecesAvailable: number;
  lastWorkshopTitle: string;
  updatedAt?: string;
  clientUpdatedAt?: number;
}

export interface WorkshopCard {
  id: string;
  title: string;
  subtitle: string;
  location: string;
  partnerId?: string;
  dateLabel: string;
  eventDate?: string; // YYYY-MM-DD
  eventStartTime?: string; // HH:MM
  eventDurationMinutes?: number; // es. 120
  calendarEventId?: string;
  calendarEventUrl?: string;
  calendarHtmlLink?: string;
  category: string;
  ticketPrice: number;
  venueFeePerPax: number;
  targetPax: number;
  calculatorLinked?: boolean; // true = collegato (default), false = scollegato
  phases?: OperationalPhase[];
  phase1Setup: string;
  phase2Execution: string;
  phase3Closing: string;
  materials: MaterialItem[];
  updatedAt?: string;
  clientUpdatedAt?: number;
}

export interface RoiMetrics {
  pax: number;
  ticketPrice: number;
  venueFeePerPax: number;
  grossRevenue: number;
  fixedCostsTotal: number;
  variableCostPerPax: number;
  totalVariableMaterialsCost: number;
  totalVenueCost: number;
  totalCostEvent1: number;
  totalCostSubsequent: number;
  costPerPaxEvent1: number;
  costPerPaxSubsequent: number;
  netProfitEvent1: number;
  netProfitSubsequent: number;
  marginPercentEvent1: number;
  marginPercentSubsequent: number;
  contributionMarginPerPax: number;
  breakEvenPaxEvent1: number;
  totalPiecesOrdered: number;
  totalPiecesRemainingForInventory: number;
}

export interface GeminiAssistResult {
  costOptimizations: string[];
  instagramCaption: string;
  reelHook: string;
  pricingAdvice: string;
  source?: string;
}

