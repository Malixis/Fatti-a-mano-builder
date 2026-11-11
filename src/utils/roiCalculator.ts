import {
  InventoryItem,
  MaterialItem,
  PartnerProfile,
  RoiMetrics,
  VectorElement,
  WorkshopCard,
  WorkshopPosterDesign,
} from '../types/erp';

/**
 * Calcola i pezzi totali ordinati, i pezzi usati per il laboratorio, i pezzi residui per l'inventario
 * e il costo totale della riga (rispettando la modalità Collegata vs Scollegata).
 */
export function computeMaterialRowBreakdown(
  item: MaterialItem,
  targetPax: number,
  calculatorLinked = true
): {
  packsOrdered: number;
  piecesPerPack: number;
  totalPiecesOrdered: number;
  piecesUsedInWorkshop: number;
  piecesRemainingForInventory: number;
  remainingPiecesForInventory: number;
  unitPieceCost: number;
  rowTotalCost: number;
} {
  const safePax = Math.max(1, Math.round(Number(targetPax) || 1));
  const unitCost = Math.max(0, Number(item.unitCost) || 0);

  const hasExplicitPacks =
    item.packsOrdered !== undefined || item.piecesPerPack !== undefined;

  const packsOrdered = hasExplicitPacks
    ? Math.max(1, Number(item.packsOrdered ?? 1) || 1)
    : Math.max(1, Number(item.quantity) || 1);

  const piecesPerPack = hasExplicitPacks
    ? Math.max(1, Number(item.piecesPerPack ?? item.quantity ?? 1) || 1)
    : 1;

  const totalPiecesOrdered = packsOrdered * piecesPerPack;

  const isFixed = item.costType === 'fixed';
  // Se è un materiale variabile con 1 conf da 1 pezzo (modalità unitaria per pax), i pezzi totali scalano con i pax in modalità collegata
  const isPerPaxUnit = !isFixed && packsOrdered === 1 && piecesPerPack === 1;

  const effectivePiecesOrdered =
    calculatorLinked && isPerPaxUnit ? safePax : totalPiecesOrdered;

  const piecesUsedInWorkshop = isFixed
    ? 0 // Le attrezzature fisse restano interamente disponibili nell'inventario del format
    : Math.min(effectivePiecesOrdered, safePax);

  const remainingPiecesForInventory = isFixed
    ? effectivePiecesOrdered
    : Math.max(0, effectivePiecesOrdered - piecesUsedInWorkshop);

  const unitPieceCost = unitCost;

  const calculatedRowTotal = unitCost * effectivePiecesOrdered;

  const rowTotalCost =
    !calculatorLinked &&
    typeof item.manualRowTotal === 'number' &&
    Number.isFinite(item.manualRowTotal)
      ? Math.max(0, item.manualRowTotal)
      : calculatedRowTotal;

  return {
    packsOrdered,
    piecesPerPack,
    totalPiecesOrdered: effectivePiecesOrdered,
    piecesUsedInWorkshop,
    piecesRemainingForInventory: remainingPiecesForInventory,
    remainingPiecesForInventory,
    unitPieceCost: round2(unitPieceCost),
    rowTotalCost: round2(rowTotalCost),
  };
}

/**
 * Calcola tutte le metriche economiche, il costo per partecipante, il punto di pareggio
 * e la differenza tra Utile Serata 1 (con ammortamento costi fissi) e Utile Serate Successive (margine puro).
 */
export function calculateWorkshopRoi(
  materials: MaterialItem[],
  ticketPrice: number,
  venueFeePerPax: number,
  targetPax: number,
  calculatorLinked = true
): RoiMetrics {
  const safePax = Math.max(1, Math.round(Number.isFinite(targetPax) ? targetPax : 1));
  const safeTicket = Math.max(0, Number.isFinite(ticketPrice) ? ticketPrice : 0);
  const safeVenueFee = Math.max(0, Number.isFinite(venueFeePerPax) ? venueFeePerPax : 0);

  let fixedCostsTotal = 0;
  let totalVariableMaterialsCost = 0;
  let totalPiecesOrdered = 0;
  let totalPiecesRemainingForInventory = 0;

  for (const item of materials) {
    const breakdown = computeMaterialRowBreakdown(item, safePax, calculatorLinked);
    totalPiecesOrdered += breakdown.totalPiecesOrdered;
    totalPiecesRemainingForInventory += breakdown.remainingPiecesForInventory;

    if (item.costType === 'fixed') {
      fixedCostsTotal += breakdown.rowTotalCost;
    } else {
      totalVariableMaterialsCost += breakdown.rowTotalCost;
    }
  }

  const variableCostPerPax = totalVariableMaterialsCost / safePax;
  const grossRevenue = safeTicket * safePax;
  const totalVenueCost = safeVenueFee * safePax;

  const totalCostEvent1 = fixedCostsTotal + totalVariableMaterialsCost + totalVenueCost;
  const totalCostSubsequent = totalVariableMaterialsCost + totalVenueCost;

  const costPerPaxEvent1 = totalCostEvent1 / safePax;
  const costPerPaxSubsequent = variableCostPerPax + safeVenueFee;

  const netProfitEvent1 = grossRevenue - totalCostEvent1;
  const netProfitSubsequent = grossRevenue - totalCostSubsequent;

  const marginPercentEvent1 = grossRevenue > 0 ? (netProfitEvent1 / grossRevenue) * 100 : 0;
  const marginPercentSubsequent = grossRevenue > 0 ? (netProfitSubsequent / grossRevenue) * 100 : 0;

  const contributionMarginPerPax = safeTicket - costPerPaxSubsequent;
  const breakEvenPaxEvent1 =
    contributionMarginPerPax > 0
      ? Math.ceil(fixedCostsTotal / contributionMarginPerPax)
      : safePax;

  return {
    pax: safePax,
    ticketPrice: round2(safeTicket),
    venueFeePerPax: round2(safeVenueFee),
    grossRevenue: round2(grossRevenue),
    fixedCostsTotal: round2(fixedCostsTotal),
    variableCostPerPax: round2(variableCostPerPax),
    totalVariableMaterialsCost: round2(totalVariableMaterialsCost),
    totalVenueCost: round2(totalVenueCost),
    totalCostEvent1: round2(totalCostEvent1),
    totalCostSubsequent: round2(totalCostSubsequent),
    costPerPaxEvent1: round2(costPerPaxEvent1),
    costPerPaxSubsequent: round2(costPerPaxSubsequent),
    netProfitEvent1: round2(netProfitEvent1),
    netProfitSubsequent: round2(netProfitSubsequent),
    marginPercentEvent1: round2(marginPercentEvent1),
    marginPercentSubsequent: round2(marginPercentSubsequent),
    contributionMarginPerPax: round2(contributionMarginPerPax),
    breakEvenPaxEvent1,
    totalPiecesOrdered,
    totalPiecesRemainingForInventory,
  };
}

/**
 * Aggiorna l'Inventario Totale del Format quando l'utente conferma i materiali di un laboratorio svolto.
 */
export function mergeConfirmedMaterialsIntoInventory(
  currentInventory: InventoryItem[],
  materials: MaterialItem[],
  targetPax: number,
  workshopTitle: string,
  calculatorLinked = true
): InventoryItem[] {
  const map = new Map<string, InventoryItem>();
  for (const inv of currentInventory) {
    map.set(inv.name.trim().toLowerCase(), { ...inv });
  }

  for (const mat of materials) {
    if (mat.confirmedForInventory === false) continue;
    const key = mat.name.trim().toLowerCase();
    if (!key) continue;

    const breakdown = computeMaterialRowBreakdown(mat, targetPax, calculatorLinked);
    const existing = map.get(key);

    if (existing) {
      map.set(key, {
        ...existing,
        costType: mat.costType,
        unitCost: mat.unitCost,
        packsOrderedTotal: existing.packsOrderedTotal + breakdown.packsOrdered,
        piecesPerPack: breakdown.piecesPerPack,
        totalPiecesOrdered:
          existing.totalPiecesOrdered + breakdown.totalPiecesOrdered,
        piecesUsedTotal: existing.piecesUsedTotal + breakdown.piecesUsedInWorkshop,
        piecesAvailable:
          existing.piecesAvailable + breakdown.remainingPiecesForInventory,
        lastWorkshopTitle: workshopTitle,
        updatedAt: new Date().toISOString().slice(0, 10),
        clientUpdatedAt: Date.now(),
      });
    } else {
      map.set(key, {
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: mat.name.trim(),
        costType: mat.costType,
        unitCost: mat.unitCost,
        packsOrderedTotal: breakdown.packsOrdered,
        piecesPerPack: breakdown.piecesPerPack,
        totalPiecesOrdered: breakdown.totalPiecesOrdered,
        piecesUsedTotal: breakdown.piecesUsedInWorkshop,
        piecesAvailable: breakdown.remainingPiecesForInventory,
        lastWorkshopTitle: workshopTitle,
        updatedAt: new Date().toISOString().slice(0, 10),
        clientUpdatedAt: Date.now(),
      });
    }
  }

  return Array.from(map.values());
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Sanitizza e tronca i campi della scheda Workshop rispettando i vincoli di firebase-blueprint.json
 */
export function sanitizeWorkshopForFirestore(workshop: WorkshopCard, ownerId: string) {
  const phases = (workshop.phases || []).slice(0, 30).map((p, idx) => ({
    id: String(p.id || `phase-${idx + 1}`).slice(0, 64),
    numberLabel: String(p.numberLabel || `0${idx + 1}`).slice(0, 20),
    title: String(p.title || `Fase ${idx + 1}`).slice(0, 120),
    durationLabel: String(p.durationLabel || '').slice(0, 40),
    description: String(p.description || '').slice(0, 3000),
  }));

  return {
    title: (workshop.title || 'Laboratorio senza titolo').trim().slice(0, 120),
    subtitle: (workshop.subtitle || '').trim().slice(0, 200),
    location: (workshop.location || 'Studio Fatti a mano').trim().slice(0, 160),
    partnerId: String(workshop.partnerId || '').slice(0, 128),
    dateLabel: (workshop.dateLabel || 'Giovedì ore 19:30').trim().slice(0, 80),
    eventDate: String(workshop.eventDate || '2026-11-19').slice(0, 20),
    eventStartTime: String(workshop.eventStartTime || '19:30').slice(0, 12),
    eventDurationMinutes: Math.min(1440, Math.max(15, Number(workshop.eventDurationMinutes) || 120)),
    calendarEventId: String(workshop.calendarEventId || '').slice(0, 128),
    calendarEventUrl: String(workshop.calendarEventUrl || '').slice(0, 300),
    category: (workshop.category || 'Edutainment').trim().slice(0, 60),
    ticketPrice: Math.min(10000, Math.max(0, Number(workshop.ticketPrice) || 0)),
    venueFeePerPax: Math.min(10000, Math.max(0, Number(workshop.venueFeePerPax) || 0)),
    targetPax: Math.min(1000, Math.max(1, Math.round(Number(workshop.targetPax) || 1))),
    calculatorLinked: workshop.calculatorLinked !== false,
    phases,
    phase1Setup: (phases[0]?.description || workshop.phase1Setup || '').slice(0, 3000),
    phase2Execution: (phases[1]?.description || workshop.phase2Execution || '').slice(0, 3000),
    phase3Closing: (phases[2]?.description || workshop.phase3Closing || '').slice(0, 3000),
    materials: (workshop.materials || []).slice(0, 50).map((m) => ({
      id: String(m.id || 'mat').slice(0, 64),
      name: String(m.name || 'Materiale').slice(0, 120),
      unitCost: Math.min(10000, Math.max(0, Number(m.unitCost) || 0)),
      quantity: Math.min(10000, Math.max(1, Number(m.quantity) || 1)),
      packsOrdered: Math.min(10000, Math.max(1, Number(m.packsOrdered ?? 1) || 1)),
      piecesPerPack: Math.min(10000, Math.max(1, Number(m.piecesPerPack ?? m.quantity ?? 1) || 1)),
      manualRowTotal:
        typeof m.manualRowTotal === 'number'
          ? Math.min(100000, Math.max(0, m.manualRowTotal))
          : 0,
      costType: m.costType === 'fixed' ? 'fixed' : 'variable',
      packed: Boolean(m.packed),
      confirmedForInventory: Boolean(m.confirmedForInventory ?? true),
    })),
    clientUpdatedAt: Math.max(0, Number(workshop.clientUpdatedAt) || Date.now()),
    ownerId: ownerId.slice(0, 128),
  };
}

export function sanitizePartnerForFirestore(partner: PartnerProfile, ownerId: string) {
  return {
    name: (partner.name || 'Partner Fatti a mano').trim().slice(0, 120),
    whoTheyAre: (partner.whoTheyAre || '').trim().slice(0, 1000),
    address: (partner.address || 'Milano').trim().slice(0, 160),
    commercialDealType: (partner.commercialDealType || 'Quota F&B per Pax').trim().slice(0, 80),
    commercialDealNotes: (partner.commercialDealNotes || '').trim().slice(0, 1000),
    defaultVenueFee: Math.min(10000, Math.max(0, Number(partner.defaultVenueFee) || 0)),
    logoText: (partner.logoText || partner.name.slice(0, 14) || 'PARTNER').trim().slice(0, 40),
    logoImageUrl: String(partner.logoImageUrl || '').slice(0, 340000),
    logoShape: (partner.logoShape || 'circle-seal').slice(0, 40),
    fontStyle: (partner.fontStyle || 'editorial-serif').slice(0, 40),
    palette: (partner.palette && partner.palette.length > 0
      ? partner.palette
      : ['#B85B43', '#4A6B53', '#1A2B4C']
    )
      .slice(0, 6)
      .map((c) => String(c || '#1A2B4C').slice(0, 16)),
    clientUpdatedAt: Math.max(0, Number(partner.clientUpdatedAt) || Date.now()),
    ownerId: ownerId.slice(0, 128),
  };
}

export function sanitizeInventoryItemForFirestore(item: InventoryItem, ownerId: string) {
  return {
    name: (item.name || 'Materiale').trim().slice(0, 120),
    costType: (item.costType === 'fixed' ? 'fixed' : 'variable').slice(0, 20),
    unitCost: Math.min(100000, Math.max(0, Number(item.unitCost) || 0)),
    packsOrderedTotal: Math.min(100000, Math.max(0, Number(item.packsOrderedTotal) || 0)),
    piecesPerPack: Math.min(100000, Math.max(1, Number(item.piecesPerPack) || 1)),
    totalPiecesOrdered: Math.min(1000000, Math.max(0, Number(item.totalPiecesOrdered) || 0)),
    piecesUsedTotal: Math.min(1000000, Math.max(0, Number(item.piecesUsedTotal) || 0)),
    piecesAvailable: Math.min(1000000, Math.max(0, Number(item.piecesAvailable) || 0)),
    totalPiecesAvailable: Math.min(1000000, Math.max(0, Number(item.piecesAvailable) || 0)),
    totalPiecesUsed: Math.min(1000000, Math.max(0, Number(item.piecesUsedTotal) || 0)),
    unitCostPerPack: Math.min(100000, Math.max(0, Number(item.unitCost) || 0)),
    lastWorkshopTitle: (item.lastWorkshopTitle || 'Magazzino Iniziale').trim().slice(0, 120),
    clientUpdatedAt: Math.max(0, Number(item.clientUpdatedAt) || Date.now()),
    ownerId: ownerId.slice(0, 128),
  };
}

function sanitizeVectorElementsList(elements: VectorElement[], maxItems = 80) {
  return (elements || []).slice(0, maxItems).map((el) => ({
    id: String(el.id || 'el').slice(0, 80),
    name: String(el.name || 'Elemento').slice(0, 100),
    type: el.type || 'freehand',
    x: Math.round(Number(el.x) || 0),
    y: Math.round(Number(el.y) || 0),
    width: Math.round(Number(el.width) || 100),
    height: Math.round(Number(el.height) || 100),
    rotation: Math.round(Number(el.rotation) || 0),
    scale: Number(el.scale || 1),
    color: String(el.color || '#1A2B4C').slice(0, 16),
    secondaryColor: String(el.secondaryColor || '#B85B43').slice(0, 16),
    strokeColor: String(el.strokeColor || 'none').slice(0, 16),
    strokeWidth: Math.min(200, Math.max(0, Number(el.strokeWidth ?? 0))),
    strokeDasharray: String(el.strokeDasharray || '').slice(0, 40),
    flipX: Boolean(el.flipX ?? false),
    flipY: Boolean(el.flipY ?? false),
    opacity: Number(el.opacity ?? 1),
    zIndex: Number(el.zIndex || 1),
    visible: Boolean(el.visible ?? true),
    locked: Boolean(el.locked ?? false),
    pathData: String(el.pathData || '').slice(0, 8000),
    imageUrl: String(el.imageUrl || '').slice(0, 220000),
    closedPath: Boolean(el.closedPath ?? true),
    controlPoints: Array.isArray(el.controlPoints)
      ? el.controlPoints.slice(0, 40).map((pt) => ({
          x: Math.round(Number(pt.x) || 0),
          y: Math.round(Number(pt.y) || 0),
        }))
      : [],
    bezierNodes: Array.isArray(el.bezierNodes)
      ? el.bezierNodes.slice(0, 40).map((n) => ({
          x: Math.round(Number(n.x) || 0),
          y: Math.round(Number(n.y) || 0),
          inX: Math.round(Number(n.inX ?? n.x) || 0),
          inY: Math.round(Number(n.inY ?? n.y) || 0),
          outX: Math.round(Number(n.outX ?? n.x) || 0),
          outY: Math.round(Number(n.outY ?? n.y) || 0),
        }))
      : [],
    subPaths: Array.isArray(el.subPaths)
      ? el.subPaths.slice(0, 12).map((sp) => ({
          d: String(sp.d || '').slice(0, 4000),
          fill: String(sp.fill || 'none').slice(0, 24),
          stroke: String(sp.stroke || 'none').slice(0, 24),
          strokeWidth: Number(sp.strokeWidth || 2),
        }))
      : [],
    textureType: el.textureType || 'none',
    textContent: String(el.textContent || '').slice(0, 800),
    fontStyle: el.fontStyle || 'editorial-serif',
    fontFamily: el.fontFamily === 'Montserrat' ? 'Montserrat' : 'Akena Otos',
    fontWeight: Number(el.fontWeight || 400),
    fontItalic: Boolean(el.fontItalic ?? false),
    letterSpacing: Number(el.letterSpacing ?? 0),
    lineHeight: Number(el.lineHeight ?? 1.2),
    textAlign: el.textAlign || 'center',
    textTransform: el.textTransform || 'none',
    textBoxWidth: Number(el.textBoxWidth || 0),
    fontSize: Number(el.fontSize || 42),
    stampKind: el.stampKind || 'seal-fatti-a-mano',
    shapeKind: el.shapeKind || 'rect',
    cornerRadius: Number(el.cornerRadius || 0),
    isHandDrawnText: Boolean(el.isHandDrawnText ?? false),
    partnerId: String(el.partnerId || '').slice(0, 128),
  }));
}

export function sanitizeDesignTemplateForFirestore(
  design: WorkshopPosterDesign,
  ownerId: string
) {
  return {
    workshopId: String(design.workshopId || 'ws-1').slice(0, 128),
    title: (design.title || 'Locandina Fatti a mano').trim().slice(0, 120),
    presetName: String(design.presetName || '1080x1350').slice(0, 80),
    width: Math.min(10000, Math.max(100, Number(design.width) || 1080)),
    height: Math.min(10000, Math.max(100, Number(design.height) || 1350)),
    backgroundColor: String(design.backgroundColor || '#EADDCD').slice(0, 16),
    partnerId: String(design.partnerId || '').slice(0, 128),
    elements: sanitizeVectorElementsList(design.elements, 80),
    clipboard: sanitizeVectorElementsList(design.clipboard || [], 16),
    clientUpdatedAt: Math.max(0, Number(design.clientUpdatedAt) || Date.now()),
    ownerId: ownerId.slice(0, 128),
  };
}

