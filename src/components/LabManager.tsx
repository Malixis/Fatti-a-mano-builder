import React, { useMemo, useState } from 'react';
import {
  ExtractedInvoiceLineItem,
  FontStyleId,
  GeminiAssistResult,
  InventoryItem,
  MaterialItem,
  OperationalPhase,
  PartnerLogoShape,
  PartnerProfile,
  RoiMetrics,
  WorkshopCard,
} from '../types/erp';
import {
  calculateWorkshopRoi,
  computeMaterialRowBreakdown,
} from '../utils/roiCalculator';
import { compressImageFileToDataUrl } from '../utils/vectorMath';
import {
  buildPartnerSummaryText,
  exportPackingListPdf,
  exportPartnerSummaryPdf,
} from '../utils/pdfExporter';
import {
  requestAmazonInvoiceExtraction,
  requestPhaseTextImprovement,
  requestWorkshopAiAssist,
} from '../utils/aiClient';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  Calculator,
  Calendar,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  ImagePlus,
  Link2,
  Link2Off,
  PackageCheck,
  Palette,
  Plus,
  Receipt,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

interface LabManagerProps {
  workshops: WorkshopCard[];
  activeWorkshopId: string;
  onSelectWorkshop: (id: string) => void;
  onUpdateWorkshop: (updated: WorkshopCard) => void;
  onCreateWorkshop: () => void;
  onDeleteWorkshop: (id: string) => void;
  onGeneratePosterBridge: (workshop: WorkshopCard, partner?: PartnerProfile) => void;
  partners: PartnerProfile[];
  onSavePartner: (partner: PartnerProfile) => void;
  onDeletePartner: (partnerId: string) => void;
  inventory: InventoryItem[];
  onConfirmWorkshopInventory: (workshop: WorkshopCard) => void;
  onUpdateInventoryItem?: (updated: InventoryItem) => void;
  onImportAmazonInvoice?: (payload: {
    supplier: string;
    invoiceNumber: string;
    invoiceDate: string;
    items: ExtractedInvoiceLineItem[];
    workshopTitle: string;
    workshopId: string;
  }) => void;
  onDeleteInventoryItem: (itemId: string) => void;
  onSyncGoogleCalendar: (
    workshop: WorkshopCard,
    partner?: PartnerProfile
  ) => Promise<{ eventId: string; htmlLink: string }>;
  onSaveWorkshopCloud?: (workshop: WorkshopCard) => void;
  isSavingCloud?: boolean;
  lastSavedLabel?: string;
}

export const LabManager: React.FC<LabManagerProps> = ({
  workshops,
  activeWorkshopId,
  onSelectWorkshop,
  onUpdateWorkshop,
  onCreateWorkshop,
  onDeleteWorkshop,
  onGeneratePosterBridge,
  partners,
  onSavePartner,
  onDeletePartner,
  inventory,
  onConfirmWorkshopInventory,
  onUpdateInventoryItem,
  onImportAmazonInvoice,
  onDeleteInventoryItem,
  onSyncGoogleCalendar,
  onSaveWorkshopCloud,
  isSavingCloud,
  lastSavedLabel,
}) => {
  const activeWorkshop = useMemo(
    () => workshops.find((w) => w.id === activeWorkshopId) || workshops[0],
    [workshops, activeWorkshopId]
  );

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === activeWorkshop.partnerId) || undefined,
    [partners, activeWorkshop.partnerId]
  );

  // Stato Gestione Partner (Editor Brand Kit + Accordo Commerciale)
  const [showPartnerEditor, setShowPartnerEditor] = useState<boolean>(false);
  const [editingPartner, setEditingPartner] = useState<PartnerProfile>(() =>
    selectedPartner || {
      id: `partner-${Date.now()}`,
      name: 'Nuovo Locale Partner',
      whoTheyAre: 'Enoteca letteraria e spazio culturale indipendente con tavoli condivisi.',
      address: 'Via Savona 24 · Milano',
      commercialDealType: 'Quota F&B Fissa a Partecipante',
      commercialDealNotes: 'Calice + tapas artigianali a 7€/pax senza costo affitto sala.',
      defaultVenueFee: 7.0,
      logoText: 'NLP',
      logoShape: 'circle-seal',
      fontStyle: 'editorial-serif',
      palette: ['#1A2B4C', '#B85B43', '#4A6B53'],
    }
  );

  // Stato Modale Conferma Google Calendar
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [calendarFeedback, setCalendarFeedback] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Stato Modale Scheda Riassuntiva Partner (senza margini interni)
  const [showPartnerSheetModal, setShowPartnerSheetModal] = useState<boolean>(false);
  const [copiedPartnerSummary, setCopiedPartnerSummary] = useState<boolean>(false);

  // Stato Miglioramento Fase con IA (Box Piccolo Inline sotto la casella di testo)
  const [improvingPhaseId, setImprovingPhaseId] = useState<string | null>(null);
  const [openAiPromptPhaseId, setOpenAiPromptPhaseId] = useState<string | null>(null);
  const [phaseAiInstructionMap, setPhaseAiInstructionMap] = useState<
    Record<string, string>
  >({});

  // Stato Caricamento Fattura Amazon (PDF / PNG / JPEG) & Anteprima Editabile Pre-Conferma
  const [isParsingInvoice, setIsParsingInvoice] = useState<boolean>(false);
  const [invoiceParseError, setInvoiceParseError] = useState<string | null>(null);
  const [invoiceDraftMeta, setInvoiceDraftMeta] = useState<{
    supplier: string;
    invoiceNumber: string;
    invoiceDate: string;
  } | null>(null);
  const [invoiceDraftItems, setInvoiceDraftItems] = useState<
    ExtractedInvoiceLineItem[]
  >([]);

  // Stato Form Nuovo Materiale
  const [newMatName, setNewMatName] = useState<string>('');
  const [newMatCost, setNewMatCost] = useState<string>('2.50');
  const [newMatPacks, setNewMatPacks] = useState<string>('1');
  const [newMatPiecesPerPack, setNewMatPiecesPerPack] = useState<string>('10');
  const [newMatType, setNewMatType] = useState<'fixed' | 'variable'>('variable');
  const [formError, setFormError] = useState<string | null>(null);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);

  // Stato Consulente IA Globale
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<GeminiAssistResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedCopy, setCopiedCopy] = useState<boolean>(false);

  const isCalculatorLinked = activeWorkshop.calculatorLinked ?? true;

  const metrics: RoiMetrics = useMemo(
    () =>
      calculateWorkshopRoi(
        activeWorkshop.materials,
        activeWorkshop.ticketPrice,
        activeWorkshop.venueFeePerPax,
        activeWorkshop.targetPax,
        isCalculatorLinked
      ),
    [
      activeWorkshop.materials,
      activeWorkshop.ticketPrice,
      activeWorkshop.venueFeePerPax,
      activeWorkshop.targetPax,
      isCalculatorLinked,
    ]
  );

  const activePhases: OperationalPhase[] = useMemo(() => {
    if (Array.isArray(activeWorkshop.phases) && activeWorkshop.phases.length > 0) {
      return activeWorkshop.phases;
    }
    return [
      {
        id: 'ph-1',
        numberLabel: '01',
        title: 'Accoglienza & Allestimento',
        durationLabel: 'Pre-evento (-30 min)',
        description: activeWorkshop.phase1Setup || '',
      },
      {
        id: 'ph-2',
        numberLabel: '02',
        title: 'Guida Tecnica & Creazione',
        durationLabel: 'Cuore del Lab (75 min)',
        description: activeWorkshop.phase2Execution || '',
      },
      {
        id: 'ph-3',
        numberLabel: '03',
        title: 'Punzonatura & Aperitivo',
        durationLabel: 'Chiusura (30 min)',
        description: activeWorkshop.phase3Closing || '',
      },
    ];
  }, [activeWorkshop]);

  const updateField = <K extends keyof WorkshopCard>(key: K, value: WorkshopCard[K]) => {
    onUpdateWorkshop({
      ...activeWorkshop,
      [key]: value,
    });
  };

  const updatePhases = (nextPhases: OperationalPhase[]) => {
    onUpdateWorkshop({
      ...activeWorkshop,
      phases: nextPhases,
      phase1Setup: nextPhases[0]?.description || activeWorkshop.phase1Setup,
      phase2Execution: nextPhases[1]?.description || activeWorkshop.phase2Execution,
      phase3Closing: nextPhases[2]?.description || activeWorkshop.phase3Closing,
    });
  };

  // Gestione Partner
  const handleSelectPartnerForWorkshop = (partnerId: string) => {
    if (!partnerId) {
      updateField('partnerId', '');
      return;
    }
    const found = partners.find((p) => p.id === partnerId);
    if (!found) return;
    onUpdateWorkshop({
      ...activeWorkshop,
      partnerId: found.id,
      location: `${found.name}, ${found.address}`,
      venueFeePerPax: found.defaultVenueFee,
    });
    setEditingPartner(found);
  };

  const handleOpenEditCurrentPartner = () => {
    if (selectedPartner) {
      setEditingPartner({ ...selectedPartner, palette: [...selectedPartner.palette] });
    } else {
      setEditingPartner({
        id: `partner-${Date.now()}`,
        name: 'Nuovo Locale Partner',
        whoTheyAre: 'Spazio ibrido artigianale, enoteca e laboratorio creativo.',
        address: 'Via Tortona 22 · Milano',
        commercialDealType: 'Quota F&B Fissa a Partecipante',
        commercialDealNotes: 'Calice di vino + accompagnamento salato incluso nella quota locale.',
        defaultVenueFee: 7.0,
        logoText: 'PARTNER',
        logoShape: 'circle-seal',
        fontStyle: 'editorial-serif',
        palette: ['#1A2B4C', '#B85B43', '#4A6B53'],
      });
    }
    setShowPartnerEditor(true);
  };

  const handleOpenCreateNewPartner = () => {
    setEditingPartner({
      id: `partner-${Date.now()}`,
      name: '',
      whoTheyAre: '',
      address: '',
      commercialDealType: 'Quota F&B Fissa a Partecipante',
      commercialDealNotes: '',
      defaultVenueFee: 7.0,
      logoText: 'LOGO',
      logoShape: 'circle-seal',
      fontStyle: 'editorial-serif',
      palette: ['#1A2B4C', '#B85B43', '#4A6B53'],
    });
    setShowPartnerEditor(true);
  };

  const handleSavePartnerForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner.name.trim()) return;
    const saved: PartnerProfile = {
      ...editingPartner,
      name: editingPartner.name.trim(),
      logoText: (editingPartner.logoText || editingPartner.name.slice(0, 5)).toUpperCase(),
    };
    onSavePartner(saved);
    onUpdateWorkshop({
      ...activeWorkshop,
      partnerId: saved.id,
      location: `${saved.name}, ${saved.address}`,
      venueFeePerPax: saved.defaultVenueFee,
    });
    setShowPartnerEditor(false);
  };

  const handleUploadPartnerLogoFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'editing' | 'selected'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await compressImageFileToDataUrl(file, 420);
      if (target === 'editing') {
        setEditingPartner((prev) => ({
          ...prev,
          logoImageUrl: dataUrl,
        }));
      } else if (selectedPartner) {
        const updatedPartner: PartnerProfile = {
          ...selectedPartner,
          logoImageUrl: dataUrl,
          clientUpdatedAt: Date.now(),
        };
        onSavePartner(updatedPartner);
        setEditingPartner(updatedPartner);
      }
    } catch (err) {
      console.error('Errore caricamento logo partner:', err);
    } finally {
      e.target.value = '';
    }
  };

  // Gestione Data & Orario + Google Calendar
  const handleDateOrTimeChange = (newDate: string, newTime: string) => {
    const formattedDate = newDate
      ? new Date(`${newDate}T12:00:00`).toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : activeWorkshop.dateLabel;
    const capitalized =
      formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    onUpdateWorkshop({
      ...activeWorkshop,
      eventDate: newDate,
      eventStartTime: newTime,
      dateLabel: `${capitalized} · Ore ${newTime}`,
    });
  };

  const handleConfirmCalendarSync = async () => {
    setIsSyncingCalendar(true);
    setCalendarError(null);
    setCalendarFeedback(null);
    try {
      const res = await onSyncGoogleCalendar(activeWorkshop, selectedPartner);
      onUpdateWorkshop({
        ...activeWorkshop,
        calendarEventId: res.eventId,
        calendarEventUrl: res.htmlLink,
      });
      setCalendarFeedback(
        'Evento sincronizzato con successo sul tuo Google Calendar primario!'
      );
      setShowCalendarModal(false);
    } catch (err) {
      setCalendarError(
        err instanceof Error
          ? err.message
          : 'Impossibile sincronizzare con Google Calendar.'
      );
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  // Gestione Protocollo Operativo Dinamico + IA
  const handleAddPhase = () => {
    const nextIdx = activePhases.length + 1;
    const numStr = nextIdx < 10 ? `0${nextIdx}` : `${nextIdx}`;
    const newPhase: OperationalPhase = {
      id: `ph-${Date.now()}`,
      numberLabel: numStr,
      title: `Nuova Fase Operativa ${numStr}`,
      durationLabel: '20 min',
      description:
        'Descrivi le azioni operative, gli strumenti sul tavolo e i tempi di questa fase.',
    };
    updatePhases([...activePhases, newPhase]);
  };

  const handleUpdatePhase = (
    phaseId: string,
    patch: Partial<OperationalPhase>
  ) => {
    updatePhases(
      activePhases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p))
    );
  };

  const handleRemovePhase = (phaseId: string) => {
    if (activePhases.length <= 1) return;
    updatePhases(activePhases.filter((p) => p.id !== phaseId));
  };

  const handleMovePhase = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= activePhases.length) return;
    const copy = [...activePhases];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    updatePhases(copy);
  };

  const handleImprovePhaseWithAi = async (
    phase: OperationalPhase,
    explicitInstruction?: string
  ) => {
    const customInstruction = (
      explicitInstruction ??
      phaseAiInstructionMap[phase.id] ??
      ''
    ).trim();
    setImprovingPhaseId(phase.id);
    try {
      const data = await requestPhaseTextImprovement({
        workshopTitle: activeWorkshop.title,
        category: activeWorkshop.category,
        targetPax: activeWorkshop.targetPax,
        phaseNumber: phase.numberLabel,
        phaseTitle: phase.title,
        currentDescription: phase.description,
        customInstruction: customInstruction || undefined,
      });
      handleUpdatePhase(phase.id, {
        description: data.improvedDescription,
      });
      setOpenAiPromptPhaseId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setImprovingPhaseId(null);
    }
  };

  // Gestione Caricamento Fattura Amazon (PDF / PNG / JPEG) e Modifica Inline Inventario
  const handleAmazonInvoiceFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingInvoice(true);
    setInvoiceParseError(null);

    try {
      let mimeType = file.type || 'image/png';
      let base64Data = '';

      if (mimeType.startsWith('image/')) {
        const compressed = await compressImageFileToDataUrl(file, 1400);
        const commaIdx = compressed.dataUrl.indexOf(',');
        base64Data =
          commaIdx >= 0
            ? compressed.dataUrl.slice(commaIdx + 1)
            : compressed.dataUrl;
        mimeType = 'image/png';
      } else {
        // Lettura diretta per PDF
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () =>
            reject(new Error('Impossibile leggere il file PDF.'));
          reader.readAsDataURL(file);
        });
        const commaIdx = dataUrl.indexOf(',');
        base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        mimeType = 'application/pdf';
      }

      const extracted = await requestAmazonInvoiceExtraction({
        mimeType,
        base64Data,
        fileName: file.name,
      });

      setInvoiceDraftMeta({
        supplier: 'Amazon EU S.à r.l.',
        invoiceNumber: extracted.invoiceNumber || `AMZ-${Date.now().toString().slice(-5)}`,
        invoiceDate:
          extracted.invoiceDate || new Date().toISOString().slice(0, 10),
      });
      setInvoiceDraftItems(
        extracted.items.map((it, idx) => ({
          ...it,
          id: it.id || `inv-ext-${Date.now()}-${idx}`,
          selected: true,
        }))
      );
    } catch (err) {
      setInvoiceParseError(
        err instanceof Error
          ? err.message
          : 'Errore durante la lettura della fattura Amazon.'
      );
    } finally {
      setIsParsingInvoice(false);
      e.target.value = '';
    }
  };

  const handleConfirmAmazonInvoiceImport = () => {
    const selectedItems = invoiceDraftItems.filter((it) => it.selected !== false);
    if (selectedItems.length === 0) return;

    const meta = invoiceDraftMeta || {
      supplier: 'Amazon EU S.à r.l.',
      invoiceNumber: `AMZ-${Date.now().toString().slice(-5)}`,
      invoiceDate: new Date().toISOString().slice(0, 10),
    };

    if (onImportAmazonInvoice) {
      onImportAmazonInvoice({
        supplier: meta.supplier,
        invoiceNumber: meta.invoiceNumber,
        invoiceDate: meta.invoiceDate,
        items: selectedItems,
        workshopTitle: activeWorkshop.title,
        workshopId: activeWorkshop.id,
      });
    }

    setInvoiceDraftMeta(null);
    setInvoiceDraftItems([]);
    setInventoryNotice(
      `${selectedItems.length} articoli della fattura ${meta.invoiceNumber} inseriti nell'Inventario Totale e registrati in Amministrazione per il Rimborso Spese!`
    );
    setTimeout(() => setInventoryNotice(null), 5000);
  };

  const handleInlineInventoryEdit = (
    inv: InventoryItem,
    patch: Partial<InventoryItem>
  ) => {
    if (!onUpdateInventoryItem) return;
    const nextPacks = Math.max(
      1,
      Number(patch.packsOrderedTotal ?? inv.packsOrderedTotal)
    );
    const nextPiecesPerPack = Math.max(
      1,
      Number(patch.piecesPerPack ?? inv.piecesPerPack)
    );
    const nextTotalOrdered = nextPacks * nextPiecesPerPack;
    const nextUsed = Math.max(
      0,
      Number(patch.piecesUsedTotal ?? inv.piecesUsedTotal)
    );
    const nextAvailable =
      (patch.costType ?? inv.costType) === 'fixed'
        ? nextTotalOrdered
        : Math.max(0, nextTotalOrdered - nextUsed);

    onUpdateInventoryItem({
      ...inv,
      ...patch,
      packsOrderedTotal: nextPacks,
      piecesPerPack: nextPiecesPerPack,
      totalPiecesOrdered: nextTotalOrdered,
      piecesUsedTotal: nextUsed,
      piecesAvailable: nextAvailable,
      updatedAt: new Date().toISOString().slice(0, 10),
      clientUpdatedAt: Date.now(),
    });
  };

  // Gestione Calcolatore Economico (Collegato vs Scollegato & Confezioni × Pezzi)
  const handleToggleCalculatorLinked = () => {
    const nextLinked = !isCalculatorLinked;
    updateField('calculatorLinked', nextLinked);
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMatName.trim();
    const parsedCost = Number(newMatCost);
    const parsedPacks = Math.max(1, Number(newMatPacks) || 1);
    const parsedPieces = Math.max(1, Number(newMatPiecesPerPack) || 1);

    if (!trimmed) {
      setFormError('Inserisci il nome del materiale o attrezzatura.');
      return;
    }
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setFormError('Inserisci un costo unitario valido (>= 0).');
      return;
    }

    setFormError(null);
    const totalOrdered = parsedPacks * parsedPieces;
    const newItem: MaterialItem = {
      id: `mat-${Date.now()}`,
      name: trimmed,
      unitCost: parsedCost,
      quantity: totalOrdered,
      packsOrdered: parsedPacks,
      piecesPerPack: parsedPieces,
      costType: newMatType,
      packed: true,
      confirmedForInventory: true,
    };

    updateField('materials', [...activeWorkshop.materials, newItem]);
    setNewMatName('');
    setNewMatCost('2.00');
    setNewMatPacks('1');
    setNewMatPiecesPerPack('10');
  };

  const handleUpdateMaterial = (id: string, patch: Partial<MaterialItem>) => {
    updateField(
      'materials',
      activeWorkshop.materials.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...patch };
        if (isCalculatorLinked) {
          // In modalità Collegata, sincronizza automaticamente quantity = packsOrdered * piecesPerPack e rimuove override manuale
          const packs = Math.max(1, Number(updated.packsOrdered ?? 1));
          const pieces = Math.max(1, Number(updated.piecesPerPack ?? updated.quantity ?? 1));
          updated.quantity = packs * pieces;
          delete updated.manualRowTotal;
        }
        return updated;
      })
    );
  };

  const handleRemoveMaterial = (id: string) => {
    updateField(
      'materials',
      activeWorkshop.materials.filter((m) => m.id !== id)
    );
  };

  const handleConfirmInventoryClick = () => {
    onConfirmWorkshopInventory(activeWorkshop);
    setInventoryNotice(
      `Materiali di "${activeWorkshop.title}" confermati e sincronizzati nell'Inventario Totale del Format!`
    );
    setTimeout(() => setInventoryNotice(null), 4000);
  };

  const handleLoadFromInventoryToWorkshop = (inv: InventoryItem) => {
    const newItem: MaterialItem = {
      id: `mat-${Date.now()}`,
      name: inv.name,
      unitCost: inv.unitCost,
      quantity: inv.piecesPerPack,
      packsOrdered: 1,
      piecesPerPack: inv.piecesPerPack,
      costType: inv.costType,
      packed: true,
      confirmedForInventory: true,
    };
    updateField('materials', [...activeWorkshop.materials, newItem]);
    setInventoryNotice(`Aggiunto "${inv.name}" dal magazzino format alla distinta del laboratorio.`);
    setTimeout(() => setInventoryNotice(null), 3500);
  };

  const handleAskGeminiAi = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await requestWorkshopAiAssist(
        activeWorkshop,
        metrics,
        activePhases
      );
      setAiResult(data);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Errore durante la consulenza IA.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyCaption = () => {
    if (!aiResult?.instagramCaption) return;
    navigator.clipboard?.writeText(aiResult.instagramCaption).catch(() => {});
    setCopiedCopy(true);
    setTimeout(() => setCopiedCopy(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Barra Selettore Schede Laboratorio & Ponte "Genera Locandina" */}
      <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1A2B4C]/70 mr-1">
            Format Attivi:
          </span>
          {workshops.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => {
                onSelectWorkshop(ws.id);
                setAiResult(null);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                ws.id === activeWorkshop.id
                  ? 'bg-[#1A2B4C] text-[#EADDCD]'
                  : 'bg-[#EADDCD] text-[#1A2B4C] hover:bg-[#1A2B4C]/10'
              }`}
            >
              {ws.title} · <span className="font-mono tabular-nums">{ws.ticketPrice}€</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onCreateWorkshop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#EADDCD] border border-[#1A2B4C]/25 text-[#1A2B4C] hover:bg-[#D4A373]/30 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Scheda Lab</span>
          </button>
        </div>

        {/* Azioni Principali: Salva Cloud, Esporta Packing List PDF, Genera Locandina (Ponte) */}
        <div className="flex flex-wrap items-center gap-2">
          {lastSavedLabel && (
            <span
              data-testid="lab-autosave-status"
              className="text-[11px] font-medium text-[#4A6B53] whitespace-nowrap mr-1"
            >
              {lastSavedLabel}
            </span>
          )}

          {onSaveWorkshopCloud && (
            <button
              type="button"
              data-testid="save-workshop-cloud-btn"
              onClick={() => onSaveWorkshopCloud(activeWorkshop)}
              disabled={isSavingCloud}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#EADDCD] border border-[#1A2B4C]/25 text-[#1A2B4C] text-xs font-semibold rounded-lg hover:bg-[#1A2B4C]/10 transition-colors whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingCloud ? 'Salvataggio...' : 'Salva su Account'}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="open-partner-summary-sheet-btn"
            onClick={() => setShowPartnerSheetModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1A2B4C] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#1A2B4C]/90 transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Scheda Partner (PDF / Riepilogo)</span>
          </button>

          <button
            type="button"
            onClick={() => exportPackingListPdf(activeWorkshop, metrics, selectedPartner)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4A6B53] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#3c5944] transition-colors whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Esporta Packing List PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onGeneratePosterBridge(activeWorkshop, selectedPartner)}
            className="flex items-center gap-2 px-4 py-2 bg-[#B85B43] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#a04c36] transition-colors whitespace-nowrap"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Genera Locandina (1080×1350)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Griglia Principale ERP: Anagrafica + Partner + Data/Calendar + Fasi Dinamiche (Sinistra) & Calcolatore + Inventario + IA (Destra) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonna Sinistra (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Scheda Laboratorio Operativa (Titolo, Payoff, Data & Orario + Google Calendar) */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A2B4C]/10 pb-3">
              <div>
                <h2
                  className="text-lg font-bold text-[#1A2B4C]"
                  style={{ fontFamily: '"Fraunces", serif' }}
                >
                  Scheda Laboratorio Operativa
                </h2>
                <p className="text-xs text-[#1A2B4C]/70">
                  Sincronizzata col tuo Account Google, Google Calendar e il Builder Grafico
                </p>
              </div>
              {workshops.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteWorkshop(activeWorkshop.id)}
                  title="Elimina scheda"
                  aria-label="Elimina scheda laboratorio"
                  className="p-1.5 text-[#B85B43] hover:bg-[#B85B43]/15 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="ws-title-input"
                  className="block text-xs font-semibold text-[#1A2B4C] mb-1"
                >
                  Titolo Laboratorio
                </label>
                <input
                  id="ws-title-input"
                  type="text"
                  value={activeWorkshop.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-3 py-2 bg-[#EADDCD]/70 border border-[#1A2B4C]/20 rounded-lg text-sm font-semibold text-[#1A2B4C]"
                />
              </div>

              <div>
                <label
                  htmlFor="ws-subtitle-input"
                  className="block text-xs font-semibold text-[#1A2B4C] mb-1"
                >
                  Payoff / Sottotitolo Esperienziale
                </label>
                <input
                  id="ws-subtitle-input"
                  type="text"
                  value={activeWorkshop.subtitle}
                  onChange={(e) => updateField('subtitle', e.target.value)}
                  className="w-full px-3 py-2 bg-[#EADDCD]/70 border border-[#1A2B4C]/20 rounded-lg text-xs text-[#1A2B4C]"
                />
              </div>

              {/* Blocco Data & Orario + Google Calendar Sync */}
              <div className="p-3.5 bg-[#EADDCD]/80 rounded-xl border border-[#1A2B4C]/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#B85B43]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1A2B4C]">
                      Data &amp; Orario · Google Calendar
                    </span>
                  </div>
                  {activeWorkshop.calendarEventId && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#4A6B53]/20 text-[#4A6B53]">
                      Sincronizzato GCal
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label
                      htmlFor="ws-event-date"
                      className="block text-[11px] font-semibold text-[#1A2B4C] mb-1"
                    >
                      Data Evento
                    </label>
                    <input
                      id="ws-event-date"
                      type="date"
                      value={activeWorkshop.eventDate || '2026-11-19'}
                      onChange={(e) =>
                        handleDateOrTimeChange(
                          e.target.value,
                          activeWorkshop.eventStartTime || '19:30'
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded-lg text-xs font-mono text-[#1A2B4C]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ws-event-time"
                      className="block text-[11px] font-semibold text-[#1A2B4C] mb-1"
                    >
                      Orario Inizio
                    </label>
                    <input
                      id="ws-event-time"
                      type="time"
                      value={activeWorkshop.eventStartTime || '19:30'}
                      onChange={(e) =>
                        handleDateOrTimeChange(
                          activeWorkshop.eventDate || '2026-11-19',
                          e.target.value
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded-lg text-xs font-mono text-[#1A2B4C]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ws-event-duration"
                      className="block text-[11px] font-semibold text-[#1A2B4C] mb-1"
                    >
                      Durata (min)
                    </label>
                    <input
                      id="ws-event-duration"
                      type="number"
                      min={30}
                      max={360}
                      step={15}
                      value={activeWorkshop.eventDurationMinutes || 120}
                      onChange={(e) =>
                        updateField('eventDurationMinutes', Math.max(30, Number(e.target.value)))
                      }
                      className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded-lg text-xs font-mono tabular-nums text-[#1A2B4C]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="ws-date-input"
                    className="block text-[11px] font-semibold text-[#1A2B4C] mb-1"
                  >
                    Etichetta Data in Locandina
                  </label>
                  <input
                    id="ws-date-input"
                    type="text"
                    value={activeWorkshop.dateLabel}
                    onChange={(e) => updateField('dateLabel', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded-lg text-xs text-[#1A2B4C]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="open-gcal-sync-btn"
                    onClick={() => {
                      setCalendarError(null);
                      setShowCalendarModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A2B4C] text-[#EADDCD] rounded-lg text-xs font-semibold hover:bg-[#1A2B4C]/90 transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>
                      {activeWorkshop.calendarEventId
                        ? 'Aggiorna Evento su Google Calendar'
                        : 'Sincronizza su Google Calendar'}
                    </span>
                  </button>

                  {activeWorkshop.calendarEventUrl && (
                    <a
                      href={activeWorkshop.calendarEventUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4A6B53] hover:underline"
                    >
                      <span>Apri in Calendar</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {calendarFeedback && (
                  <p className="text-[11px] font-semibold text-[#4A6B53]">{calendarFeedback}</p>
                )}
              </div>
            </div>
          </div>

          {/* 2. Sezione Dedicata "Location & Partner" (Logo, Font, Color Palette, Chi Sono, Rapporto Commerciale) */}
          <div
            data-testid="partner-management-section"
            className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A2B4C]/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#B85B43]" />
                <div>
                  <h3
                    className="text-base font-bold text-[#1A2B4C]"
                    style={{ fontFamily: '"Fraunces", serif' }}
                  >
                    Location &amp; Gestione Partner
                  </h3>
                  <p className="text-xs text-[#1A2B4C]/70">
                    Archivia loghi, font, palette colori, identità e accordi commerciali
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenEditCurrentPartner}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#EADDCD] border border-[#1A2B4C]/20 text-[#1A2B4C] hover:bg-[#1A2B4C]/10"
                >
                  Modifica Partner
                </button>
                <button
                  type="button"
                  data-testid="new-partner-btn"
                  onClick={handleOpenCreateNewPartner}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#B85B43] text-[#EADDCD] hover:bg-[#a04c36]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nuovo Partner</span>
                </button>
              </div>
            </div>

            {/* Selettore Partner Associato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ws-partner-select"
                  className="block text-xs font-semibold text-[#1A2B4C] mb-1"
                >
                  Partner Selezionato
                </label>
                <select
                  id="ws-partner-select"
                  value={activeWorkshop.partnerId || ''}
                  onChange={(e) => handleSelectPartnerForWorkshop(e.target.value)}
                  className="w-full px-3 py-2 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-xs font-semibold text-[#1A2B4C]"
                >
                  <option value="">— Location libera / Nessun partner —</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.commercialDealType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ws-location-input"
                  className="block text-xs font-semibold text-[#1A2B4C] mb-1"
                >
                  Indirizzo Location in Locandina
                </label>
                <input
                  id="ws-location-input"
                  type="text"
                  value={activeWorkshop.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  className="w-full px-3 py-2 bg-[#EADDCD]/70 border border-[#1A2B4C]/20 rounded-lg text-xs text-[#1A2B4C]"
                />
              </div>
            </div>

            {/* Scheda Identità, Brand Kit & Rapporto Commerciale del Partner Selezionato */}
            {selectedPartner && !showPartnerEditor && (
              <div className="p-3.5 bg-[#EADDCD]/85 rounded-xl border border-[#1A2B4C]/15 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {selectedPartner.logoImageUrl ? (
                      <div className="w-14 h-14 rounded-lg bg-white/90 border border-[#1A2B4C]/20 p-1.5 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                        <img
                          src={selectedPartner.logoImageUrl}
                          alt={`Logo ${selectedPartner.name}`}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xs text-[#EADDCD] shadow-sm shrink-0"
                        style={{
                          backgroundColor: selectedPartner.palette[0] || '#1A2B4C',
                          fontFamily:
                            selectedPartner.fontStyle === 'craft-rounded'
                              ? '"Bricolage Grotesque", sans-serif'
                              : selectedPartner.fontStyle === 'mono-label'
                              ? '"JetBrains Mono", monospace'
                              : '"Fraunces", serif',
                        }}
                      >
                        {selectedPartner.logoText}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-[#1A2B4C] flex items-center gap-2">
                        <span>{selectedPartner.name}</span>
                        {selectedPartner.logoImageUrl && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#4A6B53]/15 text-[#4A6B53]">
                            Logo Caricato
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#1A2B4C]/70">
                        {selectedPartner.address} · Font: <strong>{selectedPartner.fontStyle}</strong>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <label
                          data-testid="quick-upload-partner-logo-label"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#1A2B4C] text-[#EADDCD] hover:bg-[#1A2B4C]/90 cursor-pointer transition-colors"
                        >
                          <Upload className="w-3 h-3 text-[#D4A373]" />
                          <span>
                            {selectedPartner.logoImageUrl
                              ? 'Sostituisci Logo (PNG/SVG)'
                              : 'Carica Logo Partner (PNG/SVG)'}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/svg+xml,image/webp,image/jpeg"
                            onChange={(e) => handleUploadPartnerLogoFile(e, 'selected')}
                            className="hidden"
                          />
                        </label>
                        {selectedPartner.logoImageUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated: PartnerProfile = {
                                ...selectedPartner,
                                logoImageUrl: undefined,
                                clientUpdatedAt: Date.now(),
                              };
                              onSavePartner(updated);
                              setEditingPartner(updated);
                            }}
                            className="text-[10px] font-semibold text-[#B85B43] hover:underline"
                          >
                            Usa solo Monogramma
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Palette Colori Partner */}
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#1A2B4C]/60 mr-0.5" />
                    {selectedPartner.palette.map((hex, idx) => (
                      <span
                        key={`${hex}-${idx}`}
                        title={`Colore Partner ${hex}`}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold text-white border border-black/15"
                        style={{ backgroundColor: hex }}
                      >
                        {hex}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs text-[#1A2B4C] pt-1 border-t border-[#1A2B4C]/10">
                  <div>
                    <span className="font-bold text-[#4A6B53]">Chi sono &amp; cosa fanno: </span>
                    <span className="text-[#1A2B4C]/90">{selectedPartner.whoTheyAre}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#B85B43]">
                      Rapporto Commerciale ({selectedPartner.commercialDealType}):{' '}
                    </span>
                    <span className="text-[#1A2B4C]/90">{selectedPartner.commercialDealNotes}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Form Creazione / Modifica Partner (Grafiche + Info + Rapporto Commerciale) */}
            {showPartnerEditor && (
              <form
                onSubmit={handleSavePartnerForm}
                className="p-4 bg-[#EADDCD] rounded-xl border border-[#B85B43]/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#B85B43]">
                    Configurazione Partner &amp; Brand Kit
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPartnerEditor(false)}
                    className="p-1 text-[#1A2B4C]/60 hover:text-[#1A2B4C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                      Nome Partner / Locale
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Es. Libreria Verso / Botanico"
                      value={editingPartner.name}
                      onChange={(e) =>
                        setEditingPartner((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                      Indirizzo &amp; Città
                    </label>
                    <input
                      type="text"
                      placeholder="Via ..., Milano"
                      value={editingPartner.address}
                      onChange={(e) =>
                        setEditingPartner((prev) => ({ ...prev, address: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                    Chi sono e cosa fanno (Identità Partner)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Descrivi l'attività del partner, il pubblico e l'atmosfera..."
                    value={editingPartner.whoTheyAre}
                    onChange={(e) =>
                      setEditingPartner((prev) => ({ ...prev, whoTheyAre: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                      Tipo Rapporto Commerciale
                    </label>
                    <select
                      value={editingPartner.commercialDealType}
                      onChange={(e) =>
                        setEditingPartner((prev) => ({
                          ...prev,
                          commercialDealType: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-semibold text-[#1A2B4C]"
                    >
                      <option value="Quota F&B Fissa a Partecipante">
                        Quota F&amp;B Fissa a Partecipante
                      </option>
                      <option value="Revenue Share 70/30 + Consumazione Inclusa">
                        Revenue Share 70/30 + Consumazione
                      </option>
                      <option value="Minimo Garantito 15 Pax + Drink Botanico">
                        Minimo Garantito + Drink
                      </option>
                      <option value="Affitto Spazio Fisso + Bar Libero">
                        Affitto Spazio Fisso + Bar Libero
                      </option>
                      <option value="Sponsor Tecnico Materiali / Co-Marketing">
                        Sponsor Tecnico / Co-Marketing
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                      Quota Locale Concordata (€/pax)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editingPartner.defaultVenueFee}
                      onChange={(e) =>
                        setEditingPartner((prev) => ({
                          ...prev,
                          defaultVenueFee: Math.max(0, Number(e.target.value)),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-mono text-[#1A2B4C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                    Dettagli Accordo Commerciale Stipulato
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Condizioni economiche, orari esclusiva, benefit inclusi..."
                    value={editingPartner.commercialDealNotes}
                    onChange={(e) =>
                      setEditingPartner((prev) => ({
                        ...prev,
                        commercialDealNotes: e.target.value,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                  />
                </div>

                {/* Grafiche del Partner: Caricamento File Logo (PNG/SVG) + Monogramma Opzionale, Forma, Font e Color Palette */}
                <div className="pt-2 border-t border-[#1A2B4C]/15 space-y-2.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#4A6B53]">
                    Kit Grafico Partner &amp; Logo (per il Builder Grafico)
                  </span>

                  {/* Upload File Logo Partner (PNG / SVG / WebP) */}
                  <div className="p-2.5 rounded-lg bg-[#F4ECE1] border border-[#1A2B4C]/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {editingPartner.logoImageUrl ? (
                        <div className="w-12 h-12 rounded-md bg-white border border-[#1A2B4C]/20 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                          <img
                            src={editingPartner.logoImageUrl}
                            alt="Anteprima Logo Partner"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-[#EADDCD] border border-dashed border-[#1A2B4C]/30 flex items-center justify-center shrink-0 text-[#1A2B4C]/50">
                          <ImagePlus className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-[#1A2B4C]">
                          Logo Ufficiale Partner (PNG / SVG Trasparente)
                        </div>
                        <div className="text-[10px] text-[#1A2B4C]/70">
                          Viene inserito automaticamente nella Locandina e nel kit co-branding del Builder
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label
                        data-testid="partner-form-logo-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#1A2B4C] text-[#EADDCD] hover:bg-[#1A2B4C]/90 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span>
                          {editingPartner.logoImageUrl ? 'Cambia File Logo' : 'Carica Logo PNG/SVG'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/svg+xml,image/webp,image/jpeg"
                          onChange={(e) => handleUploadPartnerLogoFile(e, 'editing')}
                          className="hidden"
                        />
                      </label>
                      {editingPartner.logoImageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingPartner((prev) => ({
                              ...prev,
                              logoImageUrl: undefined,
                            }))
                          }
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-[#B85B43] hover:bg-[#B85B43]/10"
                        >
                          Rimuovi
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                        Sigla / Monogramma Opzionale
                      </label>
                      <input
                        type="text"
                        maxLength={14}
                        value={editingPartner.logoText}
                        onChange={(e) =>
                          setEditingPartner((prev) => ({ ...prev, logoText: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-mono font-bold text-[#1A2B4C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                        Stile Badge Logo
                      </label>
                      <select
                        value={editingPartner.logoShape}
                        onChange={(e) =>
                          setEditingPartner((prev) => ({
                            ...prev,
                            logoShape: e.target.value as PartnerLogoShape,
                          }))
                        }
                        className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                      >
                        <option value="circle-seal">Sigillo Circolare</option>
                        <option value="arch-badge">Badge ad Arco</option>
                        <option value="botanical-crest">Stemma Botanico</option>
                        <option value="minimal-box">Cornice Minimal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                        Font Partner
                      </label>
                      <select
                        value={editingPartner.fontStyle}
                        onChange={(e) =>
                          setEditingPartner((prev) => ({
                            ...prev,
                            fontStyle: e.target.value as FontStyleId,
                          }))
                        }
                        className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                      >
                        <option value="editorial-serif">Fraunces Editorial Serif</option>
                        <option value="craft-rounded">Bricolage Craft Rounded</option>
                        <option value="mono-label">JetBrains Mono Tecnico</option>
                      </select>
                    </div>
                  </div>

                  {/* 3 Color Pickers per la Palette Partner */}
                  <div>
                    <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                      Color Palette Partner (3 Tinte Brand)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((colorIdx) => (
                        <div
                          key={colorIdx}
                          className="flex items-center gap-1.5 bg-[#F4ECE1] p-1.5 rounded border border-[#1A2B4C]/20"
                        >
                          <input
                            type="color"
                            value={editingPartner.palette[colorIdx] || '#1A2B4C'}
                            onChange={(e) => {
                              const nextPalette = [...editingPartner.palette];
                              nextPalette[colorIdx] = e.target.value;
                              setEditingPartner((prev) => ({
                                ...prev,
                                palette: nextPalette,
                              }));
                            }}
                            aria-label={`Colore palette partner ${colorIdx + 1}`}
                            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={editingPartner.palette[colorIdx] || '#1A2B4C'}
                            onChange={(e) => {
                              const nextPalette = [...editingPartner.palette];
                              nextPalette[colorIdx] = e.target.value;
                              setEditingPartner((prev) => ({
                                ...prev,
                                palette: nextPalette,
                              }));
                            }}
                            className="w-full text-[11px] font-mono bg-transparent text-[#1A2B4C] focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {partners.some((p) => p.id === editingPartner.id) && partners.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDeletePartner(editingPartner.id);
                        setShowPartnerEditor(false);
                      }}
                      className="text-xs font-semibold text-[#B85B43] hover:underline"
                    >
                      Elimina Partner
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPartnerEditor(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1A2B4C] bg-[#F4ECE1]"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      data-testid="save-partner-submit-btn"
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1A2B4C] text-[#EADDCD] hover:bg-[#1A2B4C]/90"
                    >
                      Salva Partner &amp; Brand Kit
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* 3. Protocollo Operativo Dinamico (Fasi Numerabili, Titolabili + Migliora Testo con IA) */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A2B4C]/10 pb-3">
              <div>
                <h3
                  className="text-base font-bold text-[#1A2B4C]"
                  style={{ fontFamily: '"Fraunces", serif' }}
                >
                  Protocollo Operativo ({activePhases.length} Fasi)
                </h3>
                <p className="text-xs text-[#1A2B4C]/70">
                  Numera, rinomina o aggiungi fasi liberamente e perfeziona le descrizioni con l&apos;IA di Google
                </p>
              </div>
              <button
                type="button"
                data-testid="add-phase-btn"
                onClick={handleAddPhase}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A2B4C] text-[#EADDCD] hover:bg-[#1A2B4C]/90"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Aggiungi Fase</span>
              </button>
            </div>

            <div className="space-y-4">
              {activePhases.map((phase, idx) => {
                const isImprovingThis = improvingPhaseId === phase.id;
                return (
                  <div
                    key={phase.id}
                    data-testid={`operational-phase-card-${idx}`}
                    className="p-3.5 bg-[#EADDCD]/65 rounded-xl border border-[#1A2B4C]/15 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                        <input
                          type="text"
                          value={phase.numberLabel}
                          onChange={(e) =>
                            handleUpdatePhase(phase.id, { numberLabel: e.target.value })
                          }
                          aria-label={`Numero fase ${idx + 1}`}
                          className="w-11 px-2 py-1 text-center font-mono font-bold text-xs bg-[#1A2B4C] text-[#EADDCD] rounded"
                        />
                        <input
                          type="text"
                          value={phase.title}
                          onChange={(e) =>
                            handleUpdatePhase(phase.id, { title: e.target.value })
                          }
                          placeholder="Titolo della fase..."
                          aria-label={`Titolo fase ${idx + 1}`}
                          className="flex-1 px-2.5 py-1 text-xs font-bold text-[#1A2B4C] bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={phase.durationLabel || ''}
                          onChange={(e) =>
                            handleUpdatePhase(phase.id, { durationLabel: e.target.value })
                          }
                          placeholder="Durata / Note"
                          aria-label={`Durata fase ${idx + 1}`}
                          className="w-28 px-2 py-1 text-[11px] text-[#1A2B4C]/80 bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => handleMovePhase(idx, 'up')}
                          disabled={idx === 0}
                          aria-label="Sposta fase in alto"
                          className="p-1 text-[#1A2B4C] hover:bg-[#1A2B4C]/10 rounded disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePhase(idx, 'down')}
                          disabled={idx === activePhases.length - 1}
                          aria-label="Sposta fase in basso"
                          className="p-1 text-[#1A2B4C] hover:bg-[#1A2B4C]/10 rounded disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {activePhases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhase(phase.id)}
                            aria-label="Elimina fase"
                            className="p-1 text-[#B85B43] hover:bg-[#B85B43]/15 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      value={phase.description}
                      onChange={(e) =>
                        handleUpdatePhase(phase.id, { description: e.target.value })
                      }
                      aria-label={`Descrizione ${phase.title}`}
                      className="w-full px-3 py-2 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded-lg text-xs leading-relaxed text-[#1A2B4C]"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#1A2B4C]/60">
                        Fase {phase.numberLabel} · {phase.description.length} caratteri
                      </span>
                      <button
                        type="button"
                        data-testid={`improve-phase-ai-btn-${idx}`}
                        onClick={() =>
                          setOpenAiPromptPhaseId((prev) =>
                            prev === phase.id ? null : phase.id
                          )
                        }
                        disabled={isImprovingThis}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#4A6B53] text-[#EADDCD] hover:bg-[#3b5743] transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="w-3 h-3 text-[#D4A373]" />
                        <span>
                          {isImprovingThis
                            ? 'Miglioramento IA in corso...'
                            : openAiPromptPhaseId === phase.id
                            ? 'Chiudi Box IA'
                            : 'Migliora testo con IA'}
                        </span>
                      </button>
                    </div>

                    {/* Box Piccolo Inline sotto la casella di testo per manipolare il testo con IA Base Gratis */}
                    {openAiPromptPhaseId === phase.id && (
                      <div
                        data-testid={`phase-ai-inline-box-${idx}`}
                        className="p-3 bg-[#F4ECE1] border border-[#4A6B53]/40 rounded-lg space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#4A6B53] flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>
                              Richiesta di manipolazione testo (IA Base Gratis · Low-Token)
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenAiPromptPhaseId(null)}
                            className="text-[#1A2B4C]/60 hover:text-[#1A2B4C]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {[
                            'Spiega meglio gli strumenti usati e come verranno usati',
                            'Adatta il testo per la Scheda Riassuntiva Partner',
                            'Rendi più sintetico e schematico',
                            'Rendi il tono più caldo e conviviale',
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => {
                                setPhaseAiInstructionMap((prev) => ({
                                  ...prev,
                                  [phase.id]: chip,
                                }));
                                handleImprovePhaseWithAi(phase, chip);
                              }}
                              disabled={isImprovingThis}
                              className="px-2 py-1 rounded text-[10px] font-medium bg-[#EADDCD] hover:bg-[#1A2B4C] hover:text-[#EADDCD] text-[#1A2B4C] transition-colors"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            data-testid={`phase-ai-custom-input-${idx}`}
                            value={phaseAiInstructionMap[phase.id] || ''}
                            onChange={(e) =>
                              setPhaseAiInstructionMap((prev) => ({
                                ...prev,
                                [phase.id]: e.target.value,
                              }))
                            }
                            placeholder="Scrivi come vuoi modificare il testo (es. elenca pennelli e tempi)..."
                            className="flex-1 px-2.5 py-1.5 bg-[#EADDCD]/80 border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                          />
                          <button
                            type="button"
                            data-testid={`phase-ai-apply-btn-${idx}`}
                            onClick={() => handleImprovePhaseWithAi(phase)}
                            disabled={isImprovingThis}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#1A2B4C] text-[#EADDCD] text-xs font-semibold hover:bg-[#1A2B4C]/90 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Send className="w-3 h-3 text-[#D4A373]" />
                            <span>{isImprovingThis ? 'Applico...' : 'Applica IA'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colonna Destra (lg:col-span-7): Calcolatore Economico Dinamico, Inventario Format & Assistente Gemini AI */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card Parametri Economici & KPI ROI */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A2B4C]/10 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#B85B43]" />
                <div>
                  <h2
                    className="text-lg font-bold text-[#1A2B4C]"
                    style={{ fontFamily: '"Fraunces", serif' }}
                  >
                    Calcolatore Economico Dinamico &amp; ROI
                  </h2>
                  <p className="text-xs text-[#1A2B4C]/70">
                    Gestione Confezioni × Pezzi, modalità Collegata/Scollegata e passaggio diretto all&apos;Inventario del Format
                  </p>
                </div>
              </div>

              {/* Toggle Collegato vs Scollegato */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="toggle-calculator-link-btn"
                  onClick={handleToggleCalculatorLinked}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isCalculatorLinked
                      ? 'bg-[#4A6B53] text-[#EADDCD] border-[#4A6B53]'
                      : 'bg-[#B85B43] text-[#EADDCD] border-[#B85B43]'
                  }`}
                >
                  {isCalculatorLinked ? (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Valori Collegati (Auto)</span>
                    </>
                  ) : (
                    <>
                      <Link2Off className="w-3.5 h-3.5" />
                      <span>Valori Scollegati (Manuale)</span>
                    </>
                  )}
                </button>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#4A6B53]">
                  Break-Even S1: {metrics.breakEvenPaxEvent1} pax
                </span>
              </div>
            </div>

            {/* Campi Input: Prezzo Biglietto Pubblico, Quota Locale Food & Beverage, Numero Partecipanti X */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-[#EADDCD]/80 rounded-lg border border-[#1A2B4C]/15">
                <label
                  htmlFor="ticket-price-input"
                  className="block text-xs font-semibold text-[#1A2B4C] mb-1"
                >
                  Prezzo Biglietto Pubblico (€)
                </label>
                <input
                  id="ticket-price-input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={activeWorkshop.ticketPrice}
                  onChange={(e) => updateField('ticketPrice', Math.max(0, Number(e.target.value)))}
                  className="w-full text-xl font-bold font-mono tabular-nums text-[#1A2B4C] bg-transparent focus:outline-none"
                />
                <span className="text-[11px] text-[#1A2B4C]/65">
                  Incasso lordo: €{metrics.grossRevenue.toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-[#EADDCD]/80 rounded-lg border border-[#1A2B4C]/15">
                <label
                  htmlFor="venue-fee-input"
                  className="block text-xs font-semibold text-[#1A2B4C] mb-1"
                >
                  Quota Locale F&amp;B (€/pax)
                </label>
                <input
                  id="venue-fee-input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={activeWorkshop.venueFeePerPax}
                  onChange={(e) =>
                    updateField('venueFeePerPax', Math.max(0, Number(e.target.value)))
                  }
                  className="w-full text-xl font-bold font-mono tabular-nums text-[#B85B43] bg-transparent focus:outline-none"
                />
                <span className="text-[11px] text-[#1A2B4C]/65">
                  Totale locale: €{metrics.totalVenueCost.toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-[#EADDCD]/80 rounded-lg border border-[#1A2B4C]/15">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="target-pax-input"
                    className="text-xs font-semibold text-[#1A2B4C]"
                  >
                    Partecipanti (Pax)
                  </label>
                  <span className="text-sm font-bold font-mono tabular-nums text-[#4A6B53]">
                    {activeWorkshop.targetPax} pax
                  </span>
                </div>
                <input
                  id="target-pax-input"
                  type="range"
                  min={5}
                  max={50}
                  value={activeWorkshop.targetPax}
                  onChange={(e) => updateField('targetPax', Number(e.target.value))}
                  className="w-full accent-[#4A6B53]"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#1A2B4C]/60">
                  <span>5 pax</span>
                  <span>20 pax (Target)</span>
                  <span>50 pax</span>
                </div>
              </div>
            </div>

            {/* 4 KPI Strip: Costo Totale, Costo per Pax, Utile Serata 1, Utile Serate Successive */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-[#EADDCD] border border-[#1A2B4C]/15">
                <div className="text-[11px] font-semibold text-[#1A2B4C]/70">
                  Costo Totale (S1)
                </div>
                <div
                  data-testid="metric-total-cost"
                  className="text-lg font-bold font-mono tabular-nums text-[#1A2B4C] mt-0.5"
                >
                  €{metrics.totalCostEvent1.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#1A2B4C]/65 mt-0.5">
                  Fissi €{metrics.fixedCostsTotal.toFixed(0)} · Var €
                  {(metrics.totalVariableMaterialsCost + metrics.totalVenueCost).toFixed(0)}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#EADDCD] border border-[#1A2B4C]/15">
                <div className="text-[11px] font-semibold text-[#1A2B4C]/70">
                  Costo per Pax
                </div>
                <div
                  data-testid="metric-cost-per-pax"
                  className="text-lg font-bold font-mono tabular-nums text-[#1A2B4C] mt-0.5"
                >
                  €{metrics.costPerPaxEvent1.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#4A6B53] mt-0.5">
                  Da S2: €{metrics.costPerPaxSubsequent.toFixed(2)}/pax
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#EADDCD] border border-[#1A2B4C]/15">
                <div className="text-[11px] font-semibold text-[#1A2B4C]/70">
                  Utile Serata 1 (con fissi)
                </div>
                <div
                  data-testid="metric-profit-event1"
                  className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                    metrics.netProfitEvent1 >= 0 ? 'text-[#1A2B4C]' : 'text-[#B85B43]'
                  }`}
                >
                  {metrics.netProfitEvent1 >= 0 ? '+' : ''}€{metrics.netProfitEvent1.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#1A2B4C]/65 mt-0.5">
                  Margine {metrics.marginPercentEvent1.toFixed(1)}%
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#1A2B4C] text-[#EADDCD]">
                <div className="text-[11px] font-semibold text-[#EADDCD]/80">
                  Utile Serate Successive
                </div>
                <div
                  data-testid="metric-profit-subsequent"
                  className="text-lg font-bold font-mono tabular-nums text-[#D4A373] mt-0.5"
                >
                  +€{metrics.netProfitSubsequent.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#EADDCD]/80 mt-0.5">
                  Margine puro {metrics.marginPercentSubsequent.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Tabella Interattiva Materiali & Costi (Confezioni Ordinate × Pezzi per Confezione + Collegato/Scollegato) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A2B4C]">
                    Distinta Base Materiali ({activeWorkshop.materials.length} voci)
                  </h3>
                  <p className="text-[11px] text-[#1A2B4C]/70">
                    {isCalculatorLinked
                      ? 'Modalità Collegata: cambiando Confezioni, Pezzi o Costo il Subtotale si ricalcola automaticamente.'
                      : 'Modalità Scollegata: puoi modificare liberamente ogni cella (incluso il Subtotale) senza sovrascrivere gli altri campi.'}
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="confirm-inventory-btn"
                  onClick={handleConfirmInventoryClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A6B53] text-[#EADDCD] rounded-lg text-xs font-semibold hover:bg-[#3b5743] transition-colors"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Conferma Materiali nell&apos;Inventario Format</span>
                </button>
              </div>

              {inventoryNotice && (
                <div
                  role="status"
                  className="px-3 py-2 bg-[#4A6B53]/15 border border-[#4A6B53]/30 rounded-lg text-xs font-semibold text-[#4A6B53]"
                >
                  {inventoryNotice}
                </div>
              )}

              <div className="overflow-x-auto border border-[#1A2B4C]/15 rounded-lg bg-[#EADDCD]/50">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1A2B4C]/15 bg-[#EADDCD] text-[#1A2B4C]">
                      <th className="py-2.5 px-2.5 font-semibold" title="Includi nell'inventario format">
                        Inv.
                      </th>
                      <th className="py-2.5 px-2.5 font-semibold">Materiale / Prodotto</th>
                      <th className="py-2.5 px-2 font-semibold">Tipo</th>
                      <th className="py-2.5 px-2 font-semibold text-right">Costo Unit.</th>
                      <th className="py-2.5 px-2 font-semibold text-right">Conf. Ord.</th>
                      <th className="py-2.5 px-2 font-semibold text-right">Pezzi/Conf.</th>
                      <th className="py-2.5 px-2 font-semibold text-right">Tot. Pezzi (Scorta)</th>
                      <th className="py-2.5 px-2.5 font-semibold text-right">
                        Subtotale ({activeWorkshop.targetPax} pax)
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2B4C]/10">
                    {activeWorkshop.materials.map((mat) => {
                      const isFixed = mat.costType === 'fixed';
                      const breakdown = computeMaterialRowBreakdown(
                        mat,
                        activeWorkshop.targetPax,
                        isCalculatorLinked
                      );

                      return (
                        <tr key={mat.id} className="hover:bg-[#EADDCD]/80 transition-colors">
                          <td className="py-2 px-2.5">
                            <input
                              type="checkbox"
                              checked={mat.confirmedForInventory ?? true}
                              onChange={(e) =>
                                handleUpdateMaterial(mat.id, {
                                  confirmedForInventory: e.target.checked,
                                  packed: e.target.checked,
                                })
                              }
                              aria-label={`Conferma ${mat.name} per inventario`}
                              className="w-4 h-4 accent-[#4A6B53] rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2.5 min-w-[160px]">
                            <input
                              type="text"
                              value={mat.name}
                              onChange={(e) =>
                                handleUpdateMaterial(mat.id, { name: e.target.value })
                              }
                              aria-label={`Nome materiale ${mat.name}`}
                              className="w-full bg-transparent font-medium text-[#1A2B4C] focus:outline-none focus:underline"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={mat.costType}
                              onChange={(e) =>
                                handleUpdateMaterial(mat.id, {
                                  costType: e.target.value as 'fixed' | 'variable',
                                })
                              }
                              aria-label={`Tipologia costo per ${mat.name}`}
                              className={`px-1.5 py-1 rounded text-[11px] font-semibold border border-[#1A2B4C]/15 ${
                                isFixed
                                  ? 'bg-[#1A2B4C]/10 text-[#1A2B4C]'
                                  : 'bg-[#4A6B53]/15 text-[#4A6B53]'
                              }`}
                            >
                              <option value="fixed">Fisso</option>
                              <option value="variable">Variabile</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-0.5">
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={mat.unitCost}
                                onChange={(e) =>
                                  handleUpdateMaterial(mat.id, {
                                    unitCost: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                aria-label={`Costo unitario per ${mat.name}`}
                                className="w-14 text-right bg-[#F4ECE1]/70 px-1 py-0.5 rounded font-mono tabular-nums text-[#1A2B4C]"
                              />
                              <span>€</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={mat.packsOrdered ?? 1}
                              onChange={(e) =>
                                handleUpdateMaterial(mat.id, {
                                  packsOrdered: Math.max(1, Number(e.target.value)),
                                })
                              }
                              aria-label={`Quantità prodotto ordinato (confezioni) per ${mat.name}`}
                              className="w-12 text-right bg-[#F4ECE1]/70 px-1 py-0.5 rounded font-mono tabular-nums text-[#1A2B4C]"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={mat.piecesPerPack ?? mat.quantity}
                              onChange={(e) =>
                                handleUpdateMaterial(mat.id, {
                                  piecesPerPack: Math.max(1, Number(e.target.value)),
                                })
                              }
                              aria-label={`Pezzi contenuti nel prodotto ordinato per ${mat.name}`}
                              className="w-12 text-right bg-[#F4ECE1]/70 px-1 py-0.5 rounded font-mono tabular-nums text-[#1A2B4C]"
                            />
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className="font-semibold text-[#1A2B4C]">
                              {breakdown.totalPiecesOrdered} pz
                            </span>
                            <span className="block text-[10px] text-[#4A6B53]">
                              +{breakdown.remainingPiecesForInventory} scorta
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#1A2B4C]">
                            {isCalculatorLinked ? (
                              <span>€{breakdown.rowTotalCost.toFixed(2)}</span>
                            ) : (
                              <div className="inline-flex items-center justify-end gap-0.5">
                                <span>€</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={
                                    mat.manualRowTotal !== undefined
                                      ? mat.manualRowTotal
                                      : Number(breakdown.rowTotalCost.toFixed(2))
                                  }
                                  onChange={(e) =>
                                    handleUpdateMaterial(mat.id, {
                                      manualRowTotal: Math.max(0, Number(e.target.value)),
                                    })
                                  }
                                  aria-label={`Subtotale manuale per ${mat.name}`}
                                  className="w-16 text-right bg-[#B85B43]/15 border border-[#B85B43]/40 px-1 py-0.5 rounded font-mono tabular-nums text-[#B85B43]"
                                />
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterial(mat.id)}
                              aria-label={`Rimuovi ${mat.name}`}
                              className="p-1 text-[#B85B43] hover:bg-[#B85B43]/15 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Form Aggiunta Rapida Materiale con Confezioni e Pezzi per Confezione */}
              <form
                onSubmit={handleAddMaterial}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 items-center"
              >
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    placeholder="Nuovo prodotto (es. Scatola Tele, Pennelli...)"
                    value={newMatName}
                    onChange={(e) => setNewMatName(e.target.value)}
                    aria-label="Nome nuovo materiale"
                    className="w-full px-3 py-2 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-xs text-[#1A2B4C]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Costo €"
                    value={newMatCost}
                    onChange={(e) => setNewMatCost(e.target.value)}
                    aria-label="Costo unitario nuovo materiale"
                    className="w-full px-2 py-2 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-xs font-mono tabular-nums text-[#1A2B4C]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Conf. ord."
                    value={newMatPacks}
                    onChange={(e) => setNewMatPacks(e.target.value)}
                    aria-label="Confezioni ordinate nuovo materiale"
                    title="Quantità prodotto ordinato (confezioni)"
                    className="w-full px-2 py-2 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-xs font-mono tabular-nums text-[#1A2B4C]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Pezzi/Conf."
                    value={newMatPiecesPerPack}
                    onChange={(e) => setNewMatPiecesPerPack(e.target.value)}
                    aria-label="Pezzi per confezione nuovo materiale"
                    title="Quantità pezzi contenuti nel prodotto ordinato"
                    className="w-full px-2 py-2 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-xs font-mono tabular-nums text-[#1A2B4C]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-[#1A2B4C] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#1A2B4C]/90 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi</span>
                  </button>
                </div>
              </form>
              {formError && (
                <p role="alert" className="text-xs font-semibold text-[#B85B43]">
                  {formError}
                </p>
              )}
            </div>
          </div>

          {/* 4. Inventario Totale del Format (Magazzino Aggiornato tra i Laboratori + Lettura Fatture Amazon PDF/PNG/JPEG + Modifica Inline) */}
          <div
            data-testid="format-inventory-section"
            className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-[#4A6B53]" />
                <div>
                  <h3
                    className="text-base font-bold text-[#1A2B4C]"
                    style={{ fontFamily: '"Fraunces", serif' }}
                  >
                    Inventario Totale del Format ({inventory.length} referenze in magazzino)
                  </h3>
                  <p className="text-xs text-[#1A2B4C]/70">
                    Carica fatture Amazon (PDF, PNG, JPEG) per estrarre i materiali con l&apos;IA e modifica liberamente ogni cella della tabella
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label
                  data-testid="upload-amazon-invoice-label"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#B85B43] text-[#EADDCD] hover:bg-[#a04c36] cursor-pointer transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>
                    {isParsingInvoice
                      ? 'Lettura Fattura Amazon in corso...'
                      : 'Carica Fattura Amazon (PDF / PNG / JPEG)'}
                  </span>
                  <input
                    data-testid="upload-amazon-invoice-input"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={handleAmazonInvoiceFileUpload}
                    disabled={isParsingInvoice}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {invoiceParseError && (
              <div
                role="alert"
                className="p-3 bg-[#B85B43]/15 border border-[#B85B43]/30 rounded-lg text-xs font-semibold text-[#B85B43]"
              >
                {invoiceParseError}
              </div>
            )}

            {/* Pannello Anteprima Editabile Fattura Amazon Estratta prima della conferma in Inventario */}
            {invoiceDraftItems.length > 0 && invoiceDraftMeta && (
              <div
                data-testid="amazon-invoice-preview-panel"
                className="p-4 bg-[#EADDCD] border-2 border-[#B85B43]/50 rounded-xl space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A2B4C]/15 pb-2.5">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#B85B43]">
                      Anteprima Articoli Estratti dalla Fattura Amazon (Modifica prima di confermare)
                    </span>
                    <p className="text-[11px] text-[#1A2B4C]/75">
                      Verifica e correggi nomi, costi unitari, confezioni e pezzi per confezione prima di inserirli nell&apos;Inventario Totale.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceDraftMeta(null);
                      setInvoiceDraftItems([]);
                    }}
                    className="p-1 text-[#1A2B4C]/60 hover:text-[#1A2B4C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                      Fornitore Fattura
                    </label>
                    <input
                      type="text"
                      value={invoiceDraftMeta.supplier}
                      onChange={(e) =>
                        setInvoiceDraftMeta((prev) =>
                          prev ? { ...prev, supplier: e.target.value } : prev
                        )
                      }
                      className="w-full px-2.5 py-1 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                      Numero Fattura / Ordine Amazon
                    </label>
                    <input
                      type="text"
                      value={invoiceDraftMeta.invoiceNumber}
                      onChange={(e) =>
                        setInvoiceDraftMeta((prev) =>
                          prev ? { ...prev, invoiceNumber: e.target.value } : prev
                        )
                      }
                      className="w-full px-2.5 py-1 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-mono text-[#1A2B4C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                      Data Fattura
                    </label>
                    <input
                      type="date"
                      value={invoiceDraftMeta.invoiceDate}
                      onChange={(e) =>
                        setInvoiceDraftMeta((prev) =>
                          prev ? { ...prev, invoiceDate: e.target.value } : prev
                        )
                      }
                      className="w-full px-2.5 py-1 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-mono text-[#1A2B4C]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-[#1A2B4C]/15 rounded-lg bg-[#F4ECE1]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#1A2B4C]/15 bg-[#EADDCD] text-[#1A2B4C]">
                        <th className="py-2 px-2">Inc.</th>
                        <th className="py-2 px-2.5">Materiale Estratto</th>
                        <th className="py-2 px-2">Tipo</th>
                        <th className="py-2 px-2 text-right">Costo Conf. (€)</th>
                        <th className="py-2 px-2 text-right">Conf.</th>
                        <th className="py-2 px-2 text-right">Pezzi/Conf.</th>
                        <th className="py-2 px-2 text-right">Rimuovi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2B4C]/10">
                      {invoiceDraftItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="py-1.5 px-2">
                            <input
                              type="checkbox"
                              checked={item.selected !== false}
                              onChange={(e) =>
                                setInvoiceDraftItems((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, selected: e.target.checked } : r
                                  )
                                )
                              }
                              className="w-4 h-4 accent-[#4A6B53]"
                            />
                          </td>
                          <td className="py-1.5 px-2.5">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                setInvoiceDraftItems((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, name: e.target.value } : r
                                  )
                                )
                              }
                              className="w-full px-2 py-1 bg-[#EADDCD]/60 rounded text-xs font-semibold text-[#1A2B4C]"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <select
                              value={item.costType}
                              onChange={(e) =>
                                setInvoiceDraftItems((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          costType: e.target.value as 'fixed' | 'variable',
                                        }
                                      : r
                                  )
                                )
                              }
                              className="px-1.5 py-1 rounded bg-[#EADDCD] text-[11px] font-semibold text-[#1A2B4C]"
                            >
                              <option value="variable">Consumabile</option>
                              <option value="fixed">Fisso (Riutil.)</option>
                            </select>
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.unitCost}
                              onChange={(e) =>
                                setInvoiceDraftItems((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, unitCost: Math.max(0, Number(e.target.value)) }
                                      : r
                                  )
                                )
                              }
                              className="w-16 text-right px-1.5 py-1 bg-[#EADDCD]/60 rounded font-mono text-xs text-[#1A2B4C]"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={item.packsOrdered}
                              onChange={(e) =>
                                setInvoiceDraftItems((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          packsOrdered: Math.max(1, Number(e.target.value)),
                                        }
                                      : r
                                  )
                                )
                              }
                              className="w-12 text-right px-1.5 py-1 bg-[#EADDCD]/60 rounded font-mono text-xs text-[#1A2B4C]"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={item.piecesPerPack}
                              onChange={(e) =>
                                setInvoiceDraftItems((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          piecesPerPack: Math.max(1, Number(e.target.value)),
                                        }
                                      : r
                                  )
                                )
                              }
                              className="w-12 text-right px-1.5 py-1 bg-[#EADDCD]/60 rounded font-mono text-xs text-[#1A2B4C]"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setInvoiceDraftItems((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1 text-[#B85B43] hover:bg-[#B85B43]/15 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceDraftItems((prev) => [
                        ...prev,
                        {
                          id: `inv-ext-${Date.now()}`,
                          name: 'Nuovo Articolo Fattura',
                          unitCost: 12.0,
                          packsOrdered: 1,
                          piecesPerPack: 10,
                          costType: 'variable',
                          selected: true,
                        },
                      ])
                    }
                    className="px-2.5 py-1 rounded text-xs font-semibold bg-[#F4ECE1] text-[#1A2B4C] border border-[#1A2B4C]/20"
                  >
                    + Aggiungi Riga Fattura
                  </button>

                  <button
                    type="button"
                    data-testid="confirm-amazon-invoice-import-btn"
                    onClick={handleConfirmAmazonInvoiceImport}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#4A6B53] text-[#EADDCD] hover:bg-[#3c5944]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Conferma in Inventario e Registra Fattura in Amministrazione</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tabella Inventario Totale del Format con Modifica Inline di tutti i campi */}
            <div className="overflow-x-auto border border-[#1A2B4C]/15 rounded-lg bg-[#EADDCD]/50">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1A2B4C]/15 bg-[#EADDCD] text-[#1A2B4C]">
                    <th className="py-2 px-3 font-semibold">Articolo in Magazzino (Editabile)</th>
                    <th className="py-2 px-2 font-semibold">Tipo</th>
                    <th className="py-2 px-2 font-semibold text-right">Costo €</th>
                    <th className="py-2 px-2 font-semibold text-right">Conf. × Pz</th>
                    <th className="py-2 px-2 font-semibold text-right">Tot. Ord.</th>
                    <th className="py-2 px-2 font-semibold text-right">Usati</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Disponibili</th>
                    <th className="py-2 px-3 font-semibold text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2B4C]/10">
                  {inventory.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#EADDCD]/80">
                      <td className="py-2 px-3 min-w-[180px]">
                        <input
                          type="text"
                          value={inv.name}
                          onChange={(e) =>
                            handleInlineInventoryEdit(inv, { name: e.target.value })
                          }
                          aria-label={`Modifica nome articolo inventario ${inv.name}`}
                          className="w-full bg-transparent font-semibold text-[#1A2B4C] focus:outline-none focus:underline"
                        />
                        <div className="text-[10px] text-[#1A2B4C]/60">
                          Fonte: {inv.lastWorkshopTitle}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={inv.costType}
                          onChange={(e) =>
                            handleInlineInventoryEdit(inv, {
                              costType: e.target.value as 'fixed' | 'variable',
                            })
                          }
                          aria-label={`Tipo costo inventario ${inv.name}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            inv.costType === 'fixed'
                              ? 'bg-[#1A2B4C]/10 text-[#1A2B4C]'
                              : 'bg-[#4A6B53]/15 text-[#4A6B53]'
                          }`}
                        >
                          <option value="fixed">Fisso (Riutil.)</option>
                          <option value="variable">Consumabile</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={inv.unitCost}
                          onChange={(e) =>
                            handleInlineInventoryEdit(inv, {
                              unitCost: Math.max(0, Number(e.target.value)),
                            })
                          }
                          aria-label={`Costo unitario inventario ${inv.name}`}
                          className="w-14 text-right bg-[#F4ECE1]/80 px-1 py-0.5 rounded font-mono text-xs text-[#1A2B4C]"
                        />
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={inv.packsOrderedTotal}
                            onChange={(e) =>
                              handleInlineInventoryEdit(inv, {
                                packsOrderedTotal: Math.max(1, Number(e.target.value)),
                              })
                            }
                            aria-label={`Confezioni ordinate inventario ${inv.name}`}
                            className="w-11 text-right bg-[#F4ECE1]/80 px-1 py-0.5 rounded font-mono text-xs text-[#1A2B4C]"
                          />
                          <span>×</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={inv.piecesPerPack}
                            onChange={(e) =>
                              handleInlineInventoryEdit(inv, {
                                piecesPerPack: Math.max(1, Number(e.target.value)),
                              })
                            }
                            aria-label={`Pezzi per confezione inventario ${inv.name}`}
                            className="w-11 text-right bg-[#F4ECE1]/80 px-1 py-0.5 rounded font-mono text-xs text-[#1A2B4C]"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">
                        {inv.totalPiecesOrdered} pz
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-[#B85B43]">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={inv.piecesUsedTotal}
                          onChange={(e) =>
                            handleInlineInventoryEdit(inv, {
                              piecesUsedTotal: Math.max(0, Number(e.target.value)),
                            })
                          }
                          aria-label={`Pezzi usati inventario ${inv.name}`}
                          className="w-12 text-right bg-[#F4ECE1]/80 px-1 py-0.5 rounded font-mono text-xs text-[#B85B43]"
                        />
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#4A6B53]">
                        {inv.piecesAvailable} pz
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleLoadFromInventoryToWorkshop(inv)}
                          className="px-2 py-1 rounded bg-[#1A2B4C] text-[#EADDCD] text-[10px] font-semibold hover:bg-[#1A2B4C]/90 mr-1.5"
                        >
                          + Usa nel Lab
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteInventoryItem(inv.id)}
                          aria-label={`Rimuovi ${inv.name} dall'inventario`}
                          className="p-1 text-[#B85B43] hover:bg-[#B85B43]/15 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Integrazione Google Gemini API ("Chiedi all'IA") */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3
                  className="text-base font-bold text-[#1A2B4C]"
                  style={{ fontFamily: '"Fraunces", serif' }}
                >
                  Consulente IA Google Gemini · Costi &amp; Copy Instagram
                </h3>
                <p className="text-xs text-[#1A2B4C]/70">
                  L&apos;IA analizza la distinta materiali, il break-even e le fasi operative per ottimizzare i margini e scrivere il post Instagram
                </p>
              </div>
              <button
                type="button"
                onClick={handleAskGeminiAi}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1A2B4C] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#1A2B4C]/90 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-[#D4A373]" />
                <span>
                  {aiLoading ? 'Analisi Gemini in corso...' : "Chiedi all'IA (Gemini)"}
                </span>
              </button>
            </div>

            {aiError && (
              <div role="alert" className="p-3 bg-[#B85B43]/15 text-[#B85B43] text-xs rounded-lg">
                {aiError}
              </div>
            )}

            {aiResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-[#EADDCD]/80 rounded-xl border border-[#1A2B4C]/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#4A6B53]">
                      Ottimizzazione Costi &amp; Margini
                    </span>
                    <ClipboardCheck className="w-4 h-4 text-[#4A6B53]" />
                  </div>
                  <ul className="space-y-2 text-xs text-[#1A2B4C] leading-relaxed">
                    {aiResult.costOptimizations.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono font-bold text-[#B85B43]">0{i + 1}.</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t border-[#1A2B4C]/10 text-xs text-[#1A2B4C]/85">
                    <strong className="text-[#1A2B4C]">Strategia Prezzo: </strong>
                    {aiResult.pricingAdvice}
                  </div>
                </div>

                <div className="p-4 bg-[#EADDCD]/80 rounded-xl border border-[#1A2B4C]/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#B85B43]">
                      Copy Persuasivo Instagram &amp; Reel
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCaption}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#1A2B4C] text-[#EADDCD] rounded text-[11px] font-semibold"
                    >
                      {copiedCopy ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copiato</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copia Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-2.5 bg-[#F4ECE1] rounded border border-[#1A2B4C]/10 text-xs text-[#1A2B4C]">
                    <span className="font-bold text-[#B85B43]">Hook Reel (3 sec): </span>
                    {aiResult.reelHook}
                  </div>

                  <pre className="whitespace-pre-wrap font-sans text-xs text-[#1A2B4C] bg-[#F4ECE1] p-3 rounded border border-[#1A2B4C]/10 max-h-48 overflow-y-auto leading-relaxed">
                    {aiResult.instagramCaption}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modale di Conferma Sincronizzazione Google Calendar */}
      {showCalendarModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gcal-modal-title"
          className="fixed inset-0 z-50 bg-[#1A2B4C]/60 flex items-center justify-center p-4"
        >
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/25 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1A2B4C]/10 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#B85B43]" />
                <h3
                  id="gcal-modal-title"
                  className="text-base font-bold text-[#1A2B4C]"
                  style={{ fontFamily: '"Fraunces", serif' }}
                >
                  Conferma Sincronizzazione Google Calendar
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="p-1 text-[#1A2B4C]/60 hover:text-[#1A2B4C]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-[#EADDCD] rounded-xl border border-[#1A2B4C]/15 space-y-2 text-xs text-[#1A2B4C]">
              <div>
                <span className="font-bold">Titolo Evento: </span>
                <span>
                  Fatti a mano · {activeWorkshop.title} ({activeWorkshop.ticketPrice}€)
                </span>
              </div>
              <div>
                <span className="font-bold">Data &amp; Orario: </span>
                <span className="font-mono">
                  {activeWorkshop.eventDate || '2026-11-19'} ore{' '}
                  {activeWorkshop.eventStartTime || '19:30'} (
                  {activeWorkshop.eventDurationMinutes || 120} min)
                </span>
              </div>
              <div>
                <span className="font-bold">Location / Partner: </span>
                <span>{activeWorkshop.location}</span>
              </div>
              <div>
                <span className="font-bold">Protocollo incluso: </span>
                <span>{activePhases.length} fasi operative + accordo partner</span>
              </div>
            </div>

            {calendarError && (
              <div role="alert" className="p-2.5 bg-[#B85B43]/15 text-[#B85B43] text-xs rounded-lg">
                {calendarError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#1A2B4C] bg-[#EADDCD] hover:bg-[#1A2B4C]/10"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmCalendarSync}
                disabled={isSyncingCalendar}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1A2B4C] text-[#EADDCD] hover:bg-[#1A2B4C]/90 disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>
                  {isSyncingCalendar
                    ? 'Sincronizzazione...'
                    : 'Conferma e Salva su Google Calendar'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Scheda Riassuntiva per il Partner (PDF + Riepilogo WhatsApp/Email SENZA margini interni) */}
      {showPartnerSheetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="partner-sheet-modal-title"
          className="fixed inset-0 z-50 bg-[#1A2B4C]/65 flex items-center justify-center p-4"
        >
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/25 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1A2B4C]/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#B85B43]" />
                <div>
                  <h3
                    id="partner-sheet-modal-title"
                    className="text-base font-bold text-[#1A2B4C]"
                    style={{ fontFamily: '"Fraunces", serif' }}
                  >
                    Scheda Riassuntiva per il Partner ({selectedPartner?.name || activeWorkshop.location})
                  </h3>
                  <p className="text-[11px] text-[#4A6B53] font-semibold">
                    Zero dati riservati: costi materiali, break-even e margini del format sono completamente esclusi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPartnerSheetModal(false)}
                className="p-1 text-[#1A2B4C]/60 hover:text-[#1A2B4C]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre
              data-testid="partner-summary-preview-text"
              className="flex-1 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-[#1A2B4C] bg-[#EADDCD]/85 p-4 rounded-xl border border-[#1A2B4C]/15 leading-relaxed"
            >
              {buildPartnerSummaryText(activeWorkshop, selectedPartner)}
            </pre>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1A2B4C]/10">
              <button
                type="button"
                data-testid="copy-partner-summary-btn"
                onClick={() => {
                  const text = buildPartnerSummaryText(activeWorkshop, selectedPartner);
                  navigator.clipboard?.writeText(text).catch(() => {});
                  setCopiedPartnerSummary(true);
                  setTimeout(() => setCopiedPartnerSummary(false), 2200);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#EADDCD] border border-[#1A2B4C]/25 text-[#1A2B4C] hover:bg-[#1A2B4C]/10"
              >
                {copiedPartnerSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#4A6B53]" />
                    <span>Riepilogo Copiato per WhatsApp / Email!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copia Testo per WhatsApp / Email</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPartnerSheetModal(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#1A2B4C] bg-[#EADDCD]"
                >
                  Chiudi
                </button>
                <button
                  type="button"
                  data-testid="download-partner-summary-pdf-btn"
                  onClick={() =>
                    exportPartnerSummaryPdf(activeWorkshop, selectedPartner)
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1A2B4C] text-[#EADDCD] hover:bg-[#1A2B4C]/90"
                >
                  <FileDown className="w-3.5 h-3.5 text-[#D4A373]" />
                  <span>Scarica Scheda Partner PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
