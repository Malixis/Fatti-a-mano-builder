import {
  InventoryItem,
  MaterialItem,
  PartnerProfile,
  RoiMetrics,
  WorkshopCard,
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
    logoShape: (partner.logoShape || 'circle-seal').slice(0, 40),
    fontStyle: (partner.fontStyle || 'editorial-serif').slice(0, 40),
    palette: (partner.palette && partner.palette.length > 0
      ? partner.palette
      : ['#B85B43', '#4A6B53', '#1A2B4C']
    )
      .slice(0, 6)
      .map((c) => String(c || '#1A2B4C').slice(0, 16)),
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
    ownerId: ownerId.slice(0, 128),
  };
}
