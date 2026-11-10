import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWorkshopRoi,
  computeMaterialRowBreakdown,
  mergeConfirmedMaterialsIntoInventory,
  sanitizeDesignTemplateForFirestore,
  sanitizeWorkshopForFirestore,
} from './roiCalculator';
import {
  buildPartnerVectorAssets,
  buildPosterFromWorkshop,
  chaikinSmooth,
  computeSamplePressure,
  createDefaultWorkshopDesign,
  generateFreeformCursorBlobPath,
  generateOrganicBlobPath,
  generateShapePrimitivePath,
  generateSmoothedBrushPath,
  generateWavyCheckerboardPath,
  rebuildPathFromControlPoints,
  syncPosterElementsWithWorkshop,
} from './vectorMath';
import {
  FONT_DECLINATIONS,
  InventoryItem,
  MaterialItem,
  PartnerProfile,
  PointerSample,
  WorkshopCard,
} from '../types/erp';

test('calculateWorkshopRoi computes Event 1 vs Subsequent Events margins accurately for 20 pax', () => {
  const materials: MaterialItem[] = [
    { id: '1', name: 'Cavalletti da tavolo in faggio (x20)', unitCost: 8.5, quantity: 20, costType: 'fixed' }, // 170€ fixed
    { id: '2', name: 'Set pennelli sintetici & tavolozze', unitCost: 30, quantity: 1, costType: 'fixed' }, // 30€ fixed -> 200€ total fixed
    { id: '3', name: 'Tela cotone 30x40cm', unitCost: 2.2, quantity: 1, costType: 'variable' }, // 2.20€/pax
    { id: '4', name: 'Colori acrilici & carta assorbente', unitCost: 1.3, quantity: 1, costType: 'variable' }, // 1.30€/pax -> 3.50€/pax variable
  ];

  // Paint & Wine 20€, Quota Locale 7€/pax, 20 partecipanti
  const roi = calculateWorkshopRoi(materials, 20, 7, 20);

  assert.equal(roi.grossRevenue, 400); // 20€ * 20 pax
  assert.equal(roi.fixedCostsTotal, 200); // 170 + 30
  assert.equal(roi.variableCostPerPax, 3.5); // 2.2 + 1.3
  assert.equal(roi.totalVariableMaterialsCost, 70); // 3.5 * 20
  assert.equal(roi.totalVenueCost, 140); // 7 * 20
  assert.equal(roi.totalCostEvent1, 410); // 200 + 70 + 140
  assert.equal(roi.totalCostSubsequent, 210); // 70 + 140
  assert.equal(roi.costPerPaxEvent1, 20.5); // 410 / 20
  assert.equal(roi.costPerPaxSubsequent, 10.5); // 3.5 + 7
  assert.equal(roi.netProfitEvent1, -10); // 400 - 410
  assert.equal(roi.netProfitSubsequent, 190); // 400 - 210 (margine puro serate successive)
  assert.equal(roi.breakEvenPaxEvent1, 22); // ceil(200 / (20 - 10.5)) = ceil(200 / 9.5) = 22
});

test('computeMaterialRowBreakdown and mergeConfirmedMaterialsIntoInventory handle linked/unlinked mode and packs x pieces', () => {
  const packItem: MaterialItem = {
    id: 'm-pack',
    name: 'Scatola Tele 30x40',
    unitCost: 2.0,
    quantity: 30,
    packsOrdered: 3,
    piecesPerPack: 10,
    costType: 'variable',
    confirmedForInventory: true,
  };

  // Linked mode: 3 packs * 10 pieces = 30 total pieces ordered, 20 used for 20 pax, 10 remaining for inventory
  const linkedBreakdown = computeMaterialRowBreakdown(packItem, 20, true);
  assert.equal(linkedBreakdown.totalPiecesOrdered, 30);
  assert.equal(linkedBreakdown.piecesUsedInWorkshop, 20);
  assert.equal(linkedBreakdown.remainingPiecesForInventory, 10);
  assert.equal(linkedBreakdown.rowTotalCost, 60); // 30 * 2.0€

  // Unlinked mode with manualRowTotal override
  const unlinkedBreakdown = computeMaterialRowBreakdown(
    { ...packItem, manualRowTotal: 45 },
    20,
    false
  );
  assert.equal(unlinkedBreakdown.rowTotalCost, 45);

  // Merge into global format inventory
  const initialInv: InventoryItem[] = [];
  const updatedInv = mergeConfirmedMaterialsIntoInventory(
    initialInv,
    [packItem],
    20,
    'Paint & Wine'
  );
  assert.equal(updatedInv.length, 1);
  assert.equal(updatedInv[0].totalPiecesOrdered, 30);
  assert.equal(updatedInv[0].piecesUsedTotal, 20);
  assert.equal(updatedInv[0].piecesAvailable, 10);
});

test('buildPartnerVectorAssets generates Partner logo badge, palette blob, and clipboard kit', () => {
  const samplePartner: PartnerProfile = {
    id: 'p-serra',
    name: 'Spazio Serra',
    whoTheyAre: 'Serra urbana e forno',
    address: 'Via Maroncelli 12',
    commercialDealType: 'Revenue Share 70/30',
    commercialDealNotes: 'Calice + focaccia',
    defaultVenueFee: 8,
    logoText: 'SERRA',
    logoShape: 'botanical-crest',
    fontStyle: 'craft-rounded',
    palette: ['#2D5A3C', '#D97742', '#1E3A5F'],
  };

  const { partnerElements, partnerClipboard } = buildPartnerVectorAssets(samplePartner, 1080, 1350);
  assert.equal(partnerElements.length, 2);
  assert.equal(partnerClipboard.length, 3);
  assert.ok(partnerElements[0].textContent?.includes('SERRA'));
  assert.equal(partnerElements[0].secondaryColor, '#2D5A3C');
  assert.equal(partnerElements[0].fontStyle, 'craft-rounded');
});

test('chaikinSmooth and generateSmoothedBrushPath refine vertices and respect Apple Pencil vs Trackpad', () => {
  const raw = [
    { x: 10, y: 10, pressure: 0.3, timestamp: 0, pointerType: 'pen' as const },
    { x: 60, y: 40, pressure: 0.85, timestamp: 16, pointerType: 'pen' as const },
    { x: 120, y: 20, pressure: 0.5, timestamp: 32, pointerType: 'pen' as const },
  ];

  const smoothed = chaikinSmooth(raw, 2);
  assert.ok(smoothed.length > raw.length, 'Chaikin should subdivide control points');

  const brush = generateSmoothedBrushPath(raw, 20, 1);
  assert.equal(brush.isPenInput, true);
  assert.ok(brush.pathData.startsWith('M'), 'SVG path must start with M command');
  assert.ok(brush.pathData.endsWith('Z'), 'Closed stroke polygon must end with Z');

  // Velocity-to-pressure for trackpad/mouse
  const slowTrackpadPressure = computeSamplePressure(
    { x: 0, y: 0, pressure: 0.5, timestamp: 0, pointerType: 'mouse' },
    { x: 2, y: 2, pressure: 0.5, timestamp: 50, pointerType: 'mouse' }
  );
  const fastTrackpadPressure = computeSamplePressure(
    { x: 0, y: 0, pressure: 0.5, timestamp: 0, pointerType: 'mouse' },
    { x: 120, y: 120, pressure: 0.5, timestamp: 10, pointerType: 'mouse' }
  );
  assert.ok(
    slowTrackpadPressure > fastTrackpadPressure,
    'Slow trackpad movement should yield thicker simulated pressure than fast flick'
  );
});

test('buildPosterFromWorkshop binds Workshop data into 1080x1350 poster layers and clipboard assets', () => {
  const sampleWorkshop: WorkshopCard = {
    id: 'w-test',
    title: 'Rilega il tuo diario',
    subtitle: 'Legatoria giapponese & vino naturale',
    location: 'Bottega Caffè, Milano',
    dateLabel: 'Giovedì 24 Novembre · 19:30',
    category: 'Legatoria Artigianale',
    ticketPrice: 30,
    venueFeePerPax: 8,
    targetPax: 20,
    phase1Setup: 'Setup tavoli',
    phase2Execution: 'Cucitura a 4 fori',
    phase3Closing: 'Aperitivo',
    materials: [],
  };

  const { canvasElements, clipboardAssets } = buildPosterFromWorkshop(sampleWorkshop);
  assert.ok(canvasElements.length >= 8);
  assert.ok(clipboardAssets.length >= 3);
  assert.ok(
    canvasElements.some((el) => el.textContent?.includes('Rilega il tuo diario')),
    'Poster must include workshop title'
  );
  assert.ok(
    canvasElements.some((el) => el.textContent?.includes('30€')),
    'Poster must include formatted ticket price'
  );
  assert.ok(
    canvasElements.some((el) => el.textContent?.includes('Bottega Caffè, Milano')),
    'Poster must include location'
  );

  const sanitized = sanitizeWorkshopForFirestore(sampleWorkshop, 'user_123');
  assert.equal(sanitized.ownerId, 'user_123');
  assert.equal(sanitized.ticketPrice, 30);

  const blob = generateOrganicBlobPath(100, 100, 50, 40, 1);
  const check = generateWavyCheckerboardPath(0, 0, 200, 200, 4, 4, 10, 1);
  assert.ok(blob.includes('C'));
  assert.ok(check.includes('M'));

  // Verify createDefaultWorkshopDesign and non-destructive syncPosterElementsWithWorkshop
  const initialDesign = createDefaultWorkshopDesign(sampleWorkshop);
  initialDesign.elements.push({
    id: 'stroke-custom-apple-pencil',
    name: 'Pennellata Apple Pencil Custom',
    type: 'freehand',
    x: 400,
    y: 400,
    width: 120,
    height: 80,
    rotation: 0,
    scale: 1,
    color: '#4A6B53',
    opacity: 0.95,
    zIndex: 99,
    visible: true,
    locked: false,
    pathData: 'M 10 10 Q 50 50 90 90 Z',
    textureType: 'rough-brush',
  });

  const updatedWorkshop: WorkshopCard = {
    ...sampleWorkshop,
    title: 'Rilega il tuo diario — Edizione Inverno',
    ticketPrice: 35,
  };

  const syncedDesign = syncPosterElementsWithWorkshop(initialDesign, updatedWorkshop);
  assert.ok(
    syncedDesign.elements.some((el) => el.id === 'stroke-custom-apple-pencil'),
    'Custom Apple Pencil stroke in Builder must be preserved when workshop is updated'
  );
  assert.ok(
    syncedDesign.elements.some((el) => el.textContent?.includes('Edizione Inverno')),
    'Updated workshop title must be reflected in the poster design'
  );
  assert.ok(
    syncedDesign.elements.some((el) => el.textContent?.includes('35€')),
    'Updated workshop price must be reflected in the poster design'
  );

  const sanitizedTemplate = sanitizeDesignTemplateForFirestore(syncedDesign, 'user_123');
  assert.equal(sanitizedTemplate.workshopId, 'w-test');
  assert.equal(sanitizedTemplate.ownerId, 'user_123');
  assert.ok(sanitizedTemplate.clientUpdatedAt > 0);
});

test('generateFreeformCursorBlobPath, rebuildPathFromControlPoints, and Montserrat/Akena Otos declinations work as expected', () => {
  assert.equal(FONT_DECLINATIONS.length, 18, 'Must support all 18 declinations (100-900 normal + italic)');

  const cursorSamples: PointerSample[] = [
    { x: 200, y: 200, pressure: 0.6, timestamp: 0, pointerType: 'mouse' },
    { x: 340, y: 180, pressure: 0.7, timestamp: 16, pointerType: 'mouse' },
    { x: 420, y: 290, pressure: 0.8, timestamp: 32, pointerType: 'mouse' },
    { x: 310, y: 410, pressure: 0.7, timestamp: 48, pointerType: 'mouse' },
    { x: 180, y: 350, pressure: 0.6, timestamp: 64, pointerType: 'mouse' },
  ];

  const lassoBlob = generateFreeformCursorBlobPath(cursorSamples, 'freeform-lasso', 48, 0.12);
  assert.ok(lassoBlob.pathData.startsWith('M'), 'Freeform lasso blob must produce an SVG path');
  assert.ok(lassoBlob.pathData.endsWith('Z'), 'Freeform lasso blob must be a closed contour');
  assert.ok(lassoBlob.controlPoints.length >= 4, 'Must extract editable Bezier control points');

  const brushBlob = generateFreeformCursorBlobPath(cursorSamples, 'blob-brush-merge', 54, 0.1);
  assert.ok(brushBlob.pathData.startsWith('M'), 'Blob brush merge must produce an SVG path');
  assert.ok(brushBlob.width >= 40 && brushBlob.height >= 40);

  // Node editing via Direct Selection (A)
  const modifiedNodes = lassoBlob.controlPoints.map((pt, i) =>
    i === 0 ? { x: pt.x + 50, y: pt.y - 30 } : pt
  );
  const rebuilt = rebuildPathFromControlPoints(modifiedNodes, true);
  assert.ok(rebuilt.pathData.includes('C'), 'Rebuilt path must use cubic Bezier curves');
  assert.notEqual(rebuilt.pathData, lassoBlob.pathData);

  // Geometric shape primitive with control points
  const starShape = generateShapePrimitivePath('star', 540, 675, 240, 240);
  assert.equal(starShape.controlPoints.length, 10);
  assert.ok(starShape.pathData.endsWith('Z'));
});


