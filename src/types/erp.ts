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
  | 'brush'
  | 'blob'
  | 'checkerboard'
  | 'stamp'
  | 'textured-text';

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

export type FontStyleId = 'editorial-serif' | 'craft-rounded' | 'mono-label' | 'freehand-glyphs';

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
  type: 'freehand' | 'blob' | 'checkerboard' | 'stamp' | 'textured-text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  color: BrandColorHex;
  secondaryColor?: BrandColorHex;
  opacity: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  pathData: string;
  secondaryPathData?: string;
  subPaths?: Array<{ d: string; fill?: string; stroke?: string; strokeWidth?: number }>;
  strokeWidth?: number;
  stampKind?: StampKind;
  textureType: TextureFilterType;
  textContent?: string;
  fontStyle?: FontStyleId;
  fontSize?: number;
  isHandDrawnText?: boolean;
  partnerId?: string;
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
