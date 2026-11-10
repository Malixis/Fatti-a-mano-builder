import getStroke from 'perfect-freehand';
import {
  BlobDrawMode,
  PartnerProfile,
  PointerSample,
  ShapePrimitiveKind,
  StampKind,
  TextureFilterType,
  VectorElement,
  WorkshopCard,
  WorkshopPosterDesign,
} from '../types/erp';

/**
 * Algoritmo di Chaikin per lo smoothing iterativo dei vertici (trasforma movimenti incerti in curve organiche).
 */
export function chaikinSmooth(
  points: Array<{ x: number; y: number; pressure?: number }>,
  iterations = 2
): Array<{ x: number; y: number; pressure: number }> {
  if (points.length <= 2 || iterations <= 0) {
    return points.map((p) => ({ x: p.x, y: p.y, pressure: p.pressure ?? 0.5 }));
  }

  let current = points.map((p) => ({ x: p.x, y: p.y, pressure: p.pressure ?? 0.5 }));

  for (let iter = 0; iter < iterations; iter++) {
    const next: Array<{ x: number; y: number; pressure: number }> = [];
    next.push(current[0]);
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
        pressure: 0.75 * p0.pressure + 0.25 * p1.pressure,
      });
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
        pressure: 0.25 * p0.pressure + 0.75 * p1.pressure,
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }

  return current;
}

/**
 * Calcola la pressione simulata basata sulla velocità per input Trackpad/Mouse (velocity-to-width)
 * oppure preserva la pressione nativa di Apple Pencil (pointerType === 'pen').
 */
export function computeSamplePressure(
  prev: PointerSample | null,
  current: { x: number; y: number; pressure: number; timestamp: number; pointerType: string }
): number {
  if (current.pointerType === 'pen' && current.pressure > 0 && current.pressure !== 0.5) {
    return Math.min(1, Math.max(0.08, current.pressure));
  }
  if (!prev) {
    return 0.55;
  }
  const dt = Math.max(8, current.timestamp - prev.timestamp);
  const dist = Math.hypot(current.x - prev.x, current.y - prev.y);
  const velocity = dist / dt; // px per ms
  const simulated = 0.82 - Math.min(0.62, velocity * 0.28);
  return prev.pressure * 0.6 + simulated * 0.4;
}

/**
 * Converte il poligono restituito da perfect-freehand in una curva SVG Bezier quadratica morbida.
 */
export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

/**
 * Genera il tracciato SVG smoothed combinando Chaikin + Perfect-Freehand.
 * Distingue automaticamente tra Apple Pencil (simulatePressure: false) e Trackpad/Mouse (simulatePressure: true).
 */
export function generateSmoothedBrushPath(
  samples: PointerSample[],
  baseSize = 18,
  smoothingIterations = 1
): { pathData: string; avgPressure: number; isPenInput: boolean } {
  if (samples.length === 0) {
    return { pathData: '', avgPressure: 0.5, isPenInput: false };
  }

  const isPenInput = samples.some((s) => s.pointerType === 'pen');
  const smoothed = chaikinSmooth(samples, smoothingIterations);
  const avgPressure =
    smoothed.reduce((acc, s) => acc + s.pressure, 0) / Math.max(1, smoothed.length);

  const inputPoints = smoothed.map((pt) => [pt.x, pt.y, pt.pressure]);

  const outlinePoints = getStroke(inputPoints, {
    size: baseSize,
    thinning: isPenInput ? 0.68 : 0.52,
    smoothing: 0.65,
    streamline: 0.62,
    simulatePressure: !isPenInput,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
  });

  return {
    pathData: getSvgPathFromStroke(outlinePoints),
    avgPressure,
    isPenInput,
  };
}

/**
 * Genera una "Macchia (Auto-Blob)" organica stile ritaglio Matisse / Fatti a mano.
 */
export function generateOrganicBlobPath(
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  seed = 1,
  lobes = 9
): string {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2;
    const wave1 = Math.sin(angle * 2 + seed * 1.7) * 0.18;
    const wave2 = Math.cos(angle * 3 - seed * 2.3) * 0.11;
    const rFactor = 1 + wave1 + wave2;
    pts.push({
      x: cx + Math.cos(angle) * radiusX * rFactor,
      y: cy + Math.sin(angle) * radiusY * rFactor,
    });
  }
  return closedCatmullRomToBezier(pts);
}

/**
 * Converte una lista chiusa di punti in una curva Bezier cubica continua.
 */
export function closedCatmullRomToBezier(points: Array<{ x: number; y: number }>): string {
  const n = points.length;
  if (n < 3) return '';

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + ' Z';
}

/**
 * Converte una lista aperta di punti in una curva Bezier cubica continua.
 */
export function openCatmullRomToBezier(points: Array<{ x: number; y: number }>): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (n === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function computePointsBoundingBox(points: Array<{ x: number; y: number }>): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!points.length) {
    return { x: 540, y: 675, width: 120, height: 120 };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: Math.round((minX + maxX) / 2),
    y: Math.round((minY + maxY) / 2),
    width: Math.max(40, Math.round(maxX - minX)),
    height: Math.max(40, Math.round(maxY - minY)),
  };
}

/**
 * Sottocampiona una lista di punti del cursore per estrarre nodi di controllo (`controlPoints`)
 * ben distanziati e facilmente modificabili con lo strumento Selezione Diretta (A).
 */
export function extractEditableControlPoints(
  rawPoints: Array<{ x: number; y: number }>,
  minDistance = 24,
  maxNodes = 24
): Array<{ x: number; y: number }> {
  if (rawPoints.length <= 3) {
    return rawPoints.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  }

  const filtered: Array<{ x: number; y: number }> = [
    { x: Math.round(rawPoints[0].x), y: Math.round(rawPoints[0].y) },
  ];

  for (let i = 1; i < rawPoints.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = rawPoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= minDistance) {
      filtered.push({ x: Math.round(curr.x), y: Math.round(curr.y) });
    }
  }

  // Se l'ultimo punto è troppo vicino al primo (chiusura), rimuoviamolo per evitare nodi sovrapposti
  if (
    filtered.length > 3 &&
    Math.hypot(
      filtered[filtered.length - 1].x - filtered[0].x,
      filtered[filtered.length - 1].y - filtered[0].y
    ) < minDistance * 0.75
  ) {
    filtered.pop();
  }

  if (filtered.length <= maxNodes) {
    return filtered;
  }

  const step = filtered.length / maxNodes;
  const decimated: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < maxNodes; i++) {
    decimated.push(filtered[Math.min(filtered.length - 1, Math.floor(i * step))]);
  }
  return decimated;
}

/**
 * MACCHIA BLOB COL CURSORE (Nessun vincolo rettangolare):
 * - Modalità 'freeform-lasso': trasforma qualsiasi traiettoria disegnata a mano libera col cursore
 *   in una forma organica chiusa morbida (Matisse Cutout / Lazo organico) con nodi modificabili.
 * - Modalità 'blob-brush-merge': genera una macchia pennello spessa organica (stile Illustrator Shift+B)
 *   che segue la traiettoria del cursore e può fondersi con le macchie esistenti.
 */
export function generateFreeformCursorBlobPath(
  samples: PointerSample[],
  mode: BlobDrawMode = 'freeform-lasso',
  brushSize = 54,
  organicWobble = 0.12
): {
  pathData: string;
  controlPoints: Array<{ x: number; y: number }>;
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (samples.length === 0) {
    return { pathData: '', controlPoints: [], x: 540, y: 675, width: 120, height: 120 };
  }

  // Se l'utente ha fatto un singolo clic o un micro-tratto, crea una macchia organica centrata sul cursore
  if (samples.length < 3) {
    const cx = samples[0].x;
    const cy = samples[0].y;
    const r = Math.max(36, brushSize);
    const pts: Array<{ x: number; y: number }> = [];
    const lobes = 8;
    for (let i = 0; i < lobes; i++) {
      const angle = (i / lobes) * Math.PI * 2;
      const rad = r * (1 + Math.sin(angle * 3 + cx * 0.05) * 0.16);
      pts.push({
        x: Math.round(cx + Math.cos(angle) * rad),
        y: Math.round(cy + Math.sin(angle) * rad),
      });
    }
    return {
      pathData: closedCatmullRomToBezier(pts),
      controlPoints: pts,
      x: Math.round(cx),
      y: Math.round(cy),
      width: Math.round(r * 2.2),
      height: Math.round(r * 2.2),
    };
  }

  if (mode === 'blob-brush-merge') {
    const isPenInput = samples.some((s) => s.pointerType === 'pen');
    const smoothed = chaikinSmooth(samples, 2);
    const inputPoints = smoothed.map((pt) => [pt.x, pt.y, pt.pressure]);
    const outlinePoints = getStroke(inputPoints, {
      size: Math.max(24, brushSize),
      thinning: isPenInput ? 0.35 : 0.22,
      smoothing: 0.78,
      streamline: 0.68,
      simulatePressure: !isPenInput,
      start: { taper: 0, cap: true },
      end: { taper: 0, cap: true },
    });
    const contourPts = outlinePoints.map(([px, py]) => ({ x: px, y: py }));
    const controlPoints = extractEditableControlPoints(contourPts, 28, 22);
    const pathData =
      controlPoints.length >= 4
        ? closedCatmullRomToBezier(controlPoints)
        : getSvgPathFromStroke(outlinePoints);
    const bbox = computePointsBoundingBox(contourPts.length ? contourPts : samples);
    return {
      pathData,
      controlPoints,
      ...bbox,
    };
  }

  // Modalità 'freeform-lasso': la traiettoria del cursore definisce direttamente il perimetro della forma libera
  const smoothed = chaikinSmooth(samples, 1);
  const rawControlPoints = extractEditableControlPoints(smoothed, 22, 26);

  // Assicura almeno 4 punti per una curva chiusa Catmull-Rom morbida
  let controlPoints = rawControlPoints;
  if (controlPoints.length === 3) {
    const mid = {
      x: Math.round((controlPoints[0].x + controlPoints[2].x) / 2),
      y: Math.round((controlPoints[0].y + controlPoints[2].y) / 2),
    };
    controlPoints = [controlPoints[0], controlPoints[1], controlPoints[2], mid];
  } else if (controlPoints.length < 3) {
    const c = samples[0];
    controlPoints = [
      { x: Math.round(c.x - 45), y: Math.round(c.y - 35) },
      { x: Math.round(c.x + 48), y: Math.round(c.y - 30) },
      { x: Math.round(c.x + 40), y: Math.round(c.y + 42) },
      { x: Math.round(c.x - 42), y: Math.round(c.y + 38) },
    ];
  }

  // Applica una lieve modulazione organica opzionale ai nodi se richiesta
  if (organicWobble > 0) {
    const bboxTemp = computePointsBoundingBox(controlPoints);
    const avgRadius = Math.max(20, (bboxTemp.width + bboxTemp.height) * 0.25);
    controlPoints = controlPoints.map((pt, idx) => {
      const angle = Math.atan2(pt.y - bboxTemp.y, pt.x - bboxTemp.x);
      const offset = Math.sin(idx * 2.1 + angle * 2) * avgRadius * organicWobble * 0.15;
      return {
        x: Math.round(pt.x + Math.cos(angle) * offset),
        y: Math.round(pt.y + Math.sin(angle) * offset),
      };
    });
  }

  const pathData = closedCatmullRomToBezier(controlPoints);
  const bbox = computePointsBoundingBox(controlPoints);
  return {
    pathData,
    controlPoints,
    ...bbox,
  };
}

/**
 * Ricalcola il tracciato SVG e il bounding box quando l'utente sposta i singoli nodi (`controlPoints`)
 * con lo strumento Selezione Diretta (A) o Penna Bezier (P).
 */
export function rebuildPathFromControlPoints(
  controlPoints: Array<{ x: number; y: number }>,
  closed = true
): {
  pathData: string;
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const pathData = closed
    ? closedCatmullRomToBezier(controlPoints)
    : openCatmullRomToBezier(controlPoints);
  const bbox = computePointsBoundingBox(controlPoints);
  return {
    pathData,
    ...bbox,
  };
}

/**
 * Genera forme geometriche vettoriali (Rettangolo/Arrotondato, Ellisse, Poligono/Esagono, Stella)
 * complete di `controlPoints` per poterle poi deformare nodo per nodo con Selezione Diretta (A).
 */
export function generateShapePrimitivePath(
  kind: ShapePrimitiveKind,
  cx: number,
  cy: number,
  width: number,
  height: number,
  cornerRadius = 0
): {
  pathData: string;
  controlPoints: Array<{ x: number; y: number }>;
} {
  const rx = Math.max(20, width / 2);
  const ry = Math.max(20, height / 2);

  if (kind === 'ellipse') {
    const pts: Array<{ x: number; y: number }> = [];
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push({
        x: Math.round(cx + Math.cos(a) * rx),
        y: Math.round(cy + Math.sin(a) * ry),
      });
    }
    return {
      pathData: closedCatmullRomToBezier(pts),
      controlPoints: pts,
    };
  }

  if (kind === 'polygon') {
    const sides = 6;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      pts.push({
        x: Math.round(cx + Math.cos(a) * rx),
        y: Math.round(cy + Math.sin(a) * ry),
      });
    }
    const d =
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
      ' Z';
    return { pathData: d, controlPoints: pts };
  }

  if (kind === 'star') {
    const pointsCount = 10;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < pointsCount; i++) {
      const a = (i / pointsCount) * Math.PI * 2 - Math.PI / 2;
      const factor = i % 2 === 0 ? 1 : 0.44;
      pts.push({
        x: Math.round(cx + Math.cos(a) * rx * factor),
        y: Math.round(cy + Math.sin(a) * ry * factor),
      });
    }
    const d =
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
      ' Z';
    return { pathData: d, controlPoints: pts };
  }

  // Default: rect (con supporto cornerRadius)
  const left = cx - rx;
  const right = cx + rx;
  const top = cy - ry;
  const bottom = cy + ry;
  const r = Math.min(Math.max(0, cornerRadius), rx * 0.8, ry * 0.8);

  const pts: Array<{ x: number; y: number }> = [
    { x: Math.round(left), y: Math.round(top) },
    { x: Math.round(right), y: Math.round(top) },
    { x: Math.round(right), y: Math.round(bottom) },
    { x: Math.round(left), y: Math.round(bottom) },
  ];

  if (r <= 1) {
    const d = `M ${left.toFixed(1)} ${top.toFixed(1)} L ${right.toFixed(1)} ${top.toFixed(1)} L ${right.toFixed(1)} ${bottom.toFixed(1)} L ${left.toFixed(1)} ${bottom.toFixed(1)} Z`;
    return { pathData: d, controlPoints: pts };
  }

  const d = [
    `M ${(left + r).toFixed(1)} ${top.toFixed(1)}`,
    `L ${(right - r).toFixed(1)} ${top.toFixed(1)}`,
    `Q ${right.toFixed(1)} ${top.toFixed(1)} ${right.toFixed(1)} ${(top + r).toFixed(1)}`,
    `L ${right.toFixed(1)} ${(bottom - r).toFixed(1)}`,
    `Q ${right.toFixed(1)} ${bottom.toFixed(1)} ${(right - r).toFixed(1)} ${bottom.toFixed(1)}`,
    `L ${(left + r).toFixed(1)} ${bottom.toFixed(1)}`,
    `Q ${left.toFixed(1)} ${bottom.toFixed(1)} ${left.toFixed(1)} ${(bottom - r).toFixed(1)}`,
    `L ${left.toFixed(1)} ${(top + r).toFixed(1)}`,
    `Q ${left.toFixed(1)} ${top.toFixed(1)} ${(left + r).toFixed(1)} ${top.toFixed(1)}`,
    'Z',
  ].join(' ');
  return { pathData: d, controlPoints: pts };
}

/**
 * Genera una scacchiera ondulata ("Wavy Checkerboard") come unico tracciato composto SVG
 * fedele al visual system "Fatti a mano".
 */
export function generateWavyCheckerboardPath(
  originX: number,
  originY: number,
  width: number,
  height: number,
  rows = 6,
  cols = 7,
  waveAmp = 14,
  seed = 1
): string {
  const grid: Array<Array<{ x: number; y: number }>> = [];
  for (let r = 0; r <= rows; r++) {
    const rowPts: Array<{ x: number; y: number }> = [];
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const v = r / rows;
      const dx = Math.sin(v * Math.PI * 2 + seed) * waveAmp * Math.sin(u * Math.PI);
      const dy = Math.cos(u * Math.PI * 2 + seed * 0.7) * waveAmp;
      rowPts.push({
        x: originX + u * width + dx,
        y: originY + v * height + dy,
      });
    }
    grid.push(rowPts);
  }

  const paths: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 0) {
        const tl = grid[r][c];
        const tr = grid[r][c + 1];
        const br = grid[r + 1][c + 1];
        const bl = grid[r + 1][c];
        paths.push(
          `M ${tl.x.toFixed(1)} ${tl.y.toFixed(1)} L ${tr.x.toFixed(1)} ${tr.y.toFixed(1)} L ${br.x.toFixed(1)} ${br.y.toFixed(1)} L ${bl.x.toFixed(1)} ${bl.y.toFixed(1)} Z`
        );
      }
    }
  }
  return paths.join(' ');
}

/**
 * Genera i timbri vettoriali ("Stamps") iconici del brand Fatti a mano.
 */
export function generateBrandStamp(
  kind: StampKind,
  cx: number,
  cy: number,
  size = 220
): {
  pathData: string;
  subPaths: Array<{ d: string; fill?: string; stroke?: string; strokeWidth?: number }>;
  defaultText?: string;
} {
  const half = size / 2;
  if (kind === 'seal-fatti-a-mano') {
    const ring1 = generateOrganicBlobPath(cx, cy, half * 0.95, half * 0.92, 2.1, 14);
    const ring2 = generateOrganicBlobPath(cx, cy, half * 0.91, half * 0.96, 4.7, 14);
    return {
      pathData: `${ring1} ${ring2}`,
      subPaths: [
        { d: ring1, fill: 'none', stroke: 'currentColor', strokeWidth: 3.2 },
        { d: ring2, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2 },
      ],
      defaultText: 'Fatti a mano',
    };
  }

  if (kind === 'matisse-leaf') {
    const s = size / 200;
    const leafPath = [
      `M ${(cx - 10 * s).toFixed(1)} ${(cy + 85 * s).toFixed(1)}`,
      `C ${(cx - 35 * s).toFixed(1)} ${(cy + 65 * s).toFixed(1)}, ${(cx - 85 * s).toFixed(1)} ${(cy + 40 * s).toFixed(1)}, ${(cx - 80 * s).toFixed(1)} ${(cy + 10 * s).toFixed(1)}`,
      `C ${(cx - 75 * s).toFixed(1)} ${(cy - 10 * s).toFixed(1)}, ${(cx - 40 * s).toFixed(1)} ${(cy + 15 * s).toFixed(1)}, ${(cx - 35 * s).toFixed(1)} ${(cy + 5 * s).toFixed(1)}`,
      `C ${(cx - 55 * s).toFixed(1)} ${(cy - 25 * s).toFixed(1)}, ${(cx - 65 * s).toFixed(1)} ${(cy - 70 * s).toFixed(1)}, ${(cx - 42 * s).toFixed(1)} ${(cy - 78 * s).toFixed(1)}`,
      `C ${(cx - 22 * s).toFixed(1)} ${(cy - 84 * s).toFixed(1)}, ${(cx - 18 * s).toFixed(1)} ${(cy - 30 * s).toFixed(1)}, ${(cx - 8 * s).toFixed(1)} ${(cy - 25 * s).toFixed(1)}`,
      `C ${(cx - 10 * s).toFixed(1)} ${(cy - 65 * s).toFixed(1)}, ${(cx + 5 * s).toFixed(1)} ${(cy - 95 * s).toFixed(1)}, ${(cx + 22 * s).toFixed(1)} ${(cy - 88 * s).toFixed(1)}`,
      `C ${(cx + 38 * s).toFixed(1)} ${(cy - 80 * s).toFixed(1)}, ${(cx + 18 * s).toFixed(1)} ${(cy - 30 * s).toFixed(1)}, ${(cx + 22 * s).toFixed(1)} ${(cy - 20 * s).toFixed(1)}`,
      `C ${(cx + 42 * s).toFixed(1)} ${(cy - 48 * s).toFixed(1)}, ${(cx + 75 * s).toFixed(1)} ${(cy - 62 * s).toFixed(1)}, ${(cx + 82 * s).toFixed(1)} ${(cy - 40 * s).toFixed(1)}`,
      `C ${(cx + 88 * s).toFixed(1)} ${(cy - 18 * s).toFixed(1)}, ${(cx + 40 * s).toFixed(1)} ${(cy + 2 * s).toFixed(1)}, ${(cx + 35 * s).toFixed(1)} ${(cy + 14 * s).toFixed(1)}`,
      `C ${(cx + 62 * s).toFixed(1)} ${(cy + 8 * s).toFixed(1)}, ${(cx + 88 * s).toFixed(1)} ${(cy + 22 * s).toFixed(1)}, ${(cx + 78 * s).toFixed(1)} ${(cy + 46 * s).toFixed(1)}`,
      `C ${(cx + 68 * s).toFixed(1)} ${(cy + 68 * s).toFixed(1)}, ${(cx + 25 * s).toFixed(1)} ${(cy + 65 * s).toFixed(1)}, ${(cx + 12 * s).toFixed(1)} ${(cy + 85 * s).toFixed(1)}`,
      `Z`,
    ].join(' ');
    return {
      pathData: leafPath,
      subPaths: [{ d: leafPath, fill: 'currentColor' }],
    };
  }

  if (kind === 'ink-splatter') {
    const core = generateOrganicBlobPath(cx, cy, half * 0.52, half * 0.48, 8.4, 16);
    const drops: string[] = [core];
    const dropOffsets = [
      [-0.65, -0.55, 0.11],
      [0.68, -0.48, 0.14],
      [0.74, 0.35, 0.09],
      [-0.58, 0.62, 0.12],
      [0.15, -0.78, 0.08],
      [-0.78, 0.05, 0.07],
      [0.38, 0.72, 0.1],
    ];
    for (const [dx, dy, r] of dropOffsets) {
      drops.push(
        generateOrganicBlobPath(cx + dx * half, cy + dy * half, half * r, half * r * 0.9, dx * 10, 7)
      );
    }
    const combined = drops.join(' ');
    return {
      pathData: combined,
      subPaths: [{ d: combined, fill: 'currentColor' }],
    };
  }

  if (kind === 'craft-star') {
    const rOuter = half * 0.85;
    const rInner = half * 0.24;
    const pts: string[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? rOuter : rInner;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    const starPath = pts.join(' ') + ' Z';
    return {
      pathData: starPath,
      subPaths: [{ d: starPath, fill: 'currentColor' }],
    };
  }

  if (kind === 'brush-zig') {
    const s = size / 200;
    const zigSamples: PointerSample[] = [
      { x: cx - 75 * s, y: cy + 55 * s, pressure: 0.4, timestamp: 0, pointerType: 'pen' },
      { x: cx - 20 * s, y: cy - 45 * s, pressure: 0.85, timestamp: 20, pointerType: 'pen' },
      { x: cx + 5 * s, y: cy + 25 * s, pressure: 0.75, timestamp: 40, pointerType: 'pen' },
      { x: cx + 75 * s, y: cy - 55 * s, pressure: 0.9, timestamp: 60, pointerType: 'pen' },
      { x: cx + 35 * s, y: cy + 35 * s, pressure: 0.5, timestamp: 80, pointerType: 'pen' },
    ];
    const { pathData } = generateSmoothedBrushPath(zigSamples, 18 * s, 2);
    return {
      pathData,
      subPaths: [{ d: pathData, fill: 'currentColor' }],
    };
  }

  // thread-loop
  const s = size / 200;
  const loopPath = [
    `M ${(cx - 85 * s).toFixed(1)} ${(cy + 15 * s).toFixed(1)}`,
    `C ${(cx - 55 * s).toFixed(1)} ${(cy - 45 * s).toFixed(1)}, ${(cx - 25 * s).toFixed(1)} ${(cy + 45 * s).toFixed(1)}, ${(cx - 45 * s).toFixed(1)} ${(cy - 10 * s).toFixed(1)}`,
    `C ${(cx - 15 * s).toFixed(1)} ${(cy - 55 * s).toFixed(1)}, ${(cx + 15 * s).toFixed(1)} ${(cy + 45 * s).toFixed(1)}, ${(cx - 5 * s).toFixed(1)} ${(cy - 10 * s).toFixed(1)}`,
    `C ${(cx + 25 * s).toFixed(1)} ${(cy - 55 * s).toFixed(1)}, ${(cx + 55 * s).toFixed(1)} ${(cy + 45 * s).toFixed(1)}, ${(cx + 35 * s).toFixed(1)} ${(cy - 10 * s).toFixed(1)}`,
    `C ${(cx + 60 * s).toFixed(1)} ${(cy - 45 * s).toFixed(1)}, ${(cx + 75 * s).toFixed(1)} ${(cy + 20 * s).toFixed(1)}, ${(cx + 90 * s).toFixed(1)} ${(cy - 5 * s).toFixed(1)}`,
  ].join(' ');
  return {
    pathData: loopPath,
    subPaths: [{ d: loopPath, fill: 'none', stroke: 'currentColor', strokeWidth: 7 * s }],
  };
}

export function wrapPosterText(text: string, maxCharsPerLine = 32): string {
  if (!text) return '';
  const explicitLines = text.split('\n');
  const wrappedLines: string[] = [];

  for (const rawLine of explicitLines) {
    const words = rawLine.trim().split(/\s+/);
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if ((current + ' ' + word).length <= maxCharsPerLine) {
        current += ' ' + word;
      } else {
        wrappedLines.push(current);
        current = word;
      }
    }
    if (current) wrappedLines.push(current);
  }
  return wrappedLines.join('\n');
}

/**
 * Converte il testo digitato in un tracciato vettoriale SVG decorativo di supporto (sottolineatura organica o cornice blob)
 * così che ogni elemento testuale abbia sempre sia i tracciati SVG che il filtro/maschera texture applicabile.
 */
export function generateTextVectorBackdropPath(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  textureType: TextureFilterType
): { width: number; height: number; pathData: string } {
  const lines = (text || 'Fatti a mano').split('\n');
  const maxChars = Math.max(...lines.map((l) => l.length), 4);
  const width = Math.max(220, Math.round(maxChars * fontSize * 0.58 + 76));
  const height = Math.max(96, Math.round(lines.length * fontSize * 1.28 + 48));

  if (textureType === 'materic-blob') {
    return {
      width,
      height,
      pathData: generateOrganicBlobPath(x, y, width * 0.56, height * 0.68, text.length + 1.3, 12),
    };
  }

  // Tracciato pennellata organica sottostante
  const underlineSamples: PointerSample[] = [
    { x: x - width * 0.42, y: y + height * 0.38, pressure: 0.45, timestamp: 0, pointerType: 'pen' },
    { x: x - width * 0.12, y: y + height * 0.34, pressure: 0.85, timestamp: 16, pointerType: 'pen' },
    { x: x + width * 0.18, y: y + height * 0.40, pressure: 0.78, timestamp: 32, pointerType: 'pen' },
    { x: x + width * 0.42, y: y + height * 0.35, pressure: 0.5, timestamp: 48, pointerType: 'pen' },
  ];
  const { pathData } = generateSmoothedBrushPath(underlineSamples, Math.max(8, fontSize * 0.16), 1);
  return { width, height, pathData };
}

/**
 * Genera gli asset vettoriali specifici del Partner selezionato (Logo/Monogramma, Badge Co-Branding,
 * Macchia e Scacchiera nella Palette Colori del Partner e col suo Font).
 */
export function buildPartnerVectorAssets(
  partner: PartnerProfile,
  canvasWidth = 1080,
  canvasHeight = 1350
): {
  partnerElements: VectorElement[];
  partnerClipboard: VectorElement[];
} {
  const primaryColor = partner.palette?.[0] || '#1A2B4C';
  const secondaryColor = partner.palette?.[1] || '#B85B43';
  const accentColor = partner.palette?.[2] || '#4A6B53';

  const logoX = Math.round(canvasWidth * 0.5);
  const logoY = Math.round(canvasHeight * 0.17);
  const badgeText = `${partner.logoText} · ${partner.name.toUpperCase()}`;
  const badgeMeta = generateTextVectorBackdropPath(
    badgeText,
    logoX,
    logoY,
    26,
    partner.logoShape === 'minimal-box' ? 'rough-brush' : 'materic-blob'
  );

  const partnerBlobPath = generateOrganicBlobPath(
    Math.round(canvasWidth * 0.19),
    Math.round(canvasHeight * 0.84),
    150,
    115,
    partner.name.length + 2.4,
    partner.logoShape === 'botanical-crest' ? 12 : 9
  );

  const partnerCheckerPath = generateWavyCheckerboardPath(
    Math.round(canvasWidth * 0.65),
    Math.round(canvasHeight * 0.72),
    230,
    170,
    4,
    5,
    11,
    partner.name.length + 1.1
  );

  const partnerElements: VectorElement[] = [
    {
      id: `partner-badge-${partner.id}-${Date.now()}`,
      name: `Logo Partner: ${partner.name}`,
      type: 'textured-text',
      x: logoX,
      y: logoY,
      width: badgeMeta.width,
      height: badgeMeta.height,
      rotation: 0,
      scale: 1,
      color: '#EADDCD',
      secondaryColor: primaryColor,
      opacity: 0.98,
      zIndex: 14,
      visible: true,
      locked: false,
      pathData: badgeMeta.pathData,
      textureType: 'materic-blob',
      textContent: badgeText,
      fontStyle: partner.fontStyle,
      fontSize: 26,
    },
    {
      id: `partner-blob-${partner.id}-${Date.now() + 1}`,
      name: `Macchia Palette ${partner.name}`,
      type: 'blob',
      x: Math.round(canvasWidth * 0.19),
      y: Math.round(canvasHeight * 0.84),
      width: 300,
      height: 230,
      rotation: -6,
      scale: 1,
      color: secondaryColor,
      opacity: 0.9,
      zIndex: 12,
      visible: true,
      locked: false,
      pathData: partnerBlobPath,
      textureType: 'rough-brush',
    },
  ];

  const monogramMeta = generateTextVectorBackdropPath(
    partner.logoText,
    Math.round(canvasWidth * 0.5),
    Math.round(canvasHeight * 0.5),
    54,
    'materic-blob'
  );

  const partnerClipboard: VectorElement[] = [
    {
      id: `clip-partner-logo-${partner.id}`,
      name: `Monogramma "${partner.logoText}" (${partner.name})`,
      type: 'textured-text',
      x: Math.round(canvasWidth * 0.5),
      y: Math.round(canvasHeight * 0.5),
      width: monogramMeta.width,
      height: monogramMeta.height,
      rotation: 0,
      scale: 1,
      color: '#EADDCD',
      secondaryColor: primaryColor,
      opacity: 1,
      zIndex: 25,
      visible: true,
      locked: false,
      pathData: monogramMeta.pathData,
      textureType: 'materic-blob',
      textContent: partner.logoText,
      fontStyle: partner.fontStyle,
      fontSize: 54,
    },
    {
      id: `clip-partner-host-${partner.id}`,
      name: `Co-Branding: Ospitato da ${partner.name}`,
      type: 'textured-text',
      x: Math.round(canvasWidth * 0.5),
      y: Math.round(canvasHeight * 0.78),
      width: badgeMeta.width,
      height: badgeMeta.height,
      rotation: 0,
      scale: 1,
      color: primaryColor,
      secondaryColor: accentColor,
      opacity: 1,
      zIndex: 26,
      visible: true,
      locked: false,
      pathData: '',
      textureType: 'ink-porosity',
      textContent: `IN COLLABORAZIONE CON ${partner.name.toUpperCase()}`,
      fontStyle: partner.fontStyle,
      fontSize: 24,
    },
    {
      id: `clip-partner-check-${partner.id}`,
      name: `Checkerboard Palette ${partner.name}`,
      type: 'checkerboard',
      x: Math.round(canvasWidth * 0.5),
      y: Math.round(canvasHeight * 0.5),
      width: 230,
      height: 170,
      rotation: 4,
      scale: 1,
      color: accentColor,
      opacity: 0.92,
      zIndex: 27,
      visible: true,
      locked: false,
      pathData: partnerCheckerPath,
      textureType: 'rough-brush',
    },
  ];

  return { partnerElements, partnerClipboard };
}

/**
 * IL PONTE (Data-Binding): Genera automaticamente i livelli vettoriali 1080x1350 della Locandina
 * a partire dalla scheda del Lab Manager (e dall'eventuale Partner associato), più gli asset grafici per la Clipboard.
 */
export function buildPosterFromWorkshop(
  workshop: WorkshopCard,
  partner?: PartnerProfile
): {
  canvasElements: VectorElement[];
  clipboardAssets: VectorElement[];
} {
  const blobColor = partner?.palette?.[1] || '#B85B43';
  const checkColor = partner?.palette?.[0] || '#B85B43';
  const leafColor = partner?.palette?.[2] || '#4A6B53';

  const blobTop = generateOrganicBlobPath(230, 235, 195, 145, 3.2, 10);
  const wavyCheck = generateWavyCheckerboardPath(650, 105, 320, 235, 5, 6, 12, 2.4);
  const matisseLeaf = generateBrandStamp('matisse-leaf', 200, 1115, 260);
  const sealStamp = generateBrandStamp('seal-fatti-a-mano', 865, 1125, 240);
  const splatter = generateBrandStamp('ink-splatter', 855, 435, 145);

  const wrappedTitle = wrapPosterText(workshop.title, 22);
  const wrappedSubtitle = wrapPosterText(workshop.subtitle, 36);

  const titleMeta = generateTextVectorBackdropPath(
    wrappedTitle,
    540,
    540,
    72,
    'ink-porosity'
  );
  const priceText = `${workshop.ticketPrice}€`;
  const badgeText = `Quota ${priceText} · Materiali + Aperitivo`;
  const priceMeta = generateTextVectorBackdropPath(
    badgeText,
    540,
    855,
    36,
    'materic-blob'
  );
  const infoText = `${workshop.dateLabel}\n📍 ${workshop.location}`;
  const infoMeta = generateTextVectorBackdropPath(infoText, 540, 1020, 30, 'rough-brush');

  const canvasElements: VectorElement[] = [
    {
      id: `bridge-blob-${Date.now()}-1`,
      name: partner ? `Macchia Top (${partner.name})` : 'Macchia Terracotta Top',
      type: 'blob',
      x: 230,
      y: 235,
      width: 390,
      height: 290,
      rotation: -8,
      scale: 1,
      color: blobColor,
      opacity: 0.92,
      zIndex: 1,
      visible: true,
      locked: false,
      pathData: blobTop,
      textureType: 'rough-brush',
    },
    {
      id: `bridge-check-${Date.now()}-2`,
      name: partner ? `Checkerboard (${partner.name})` : 'Wavy Checkerboard Terracotta',
      type: 'checkerboard',
      x: 810,
      y: 222,
      width: 320,
      height: 235,
      rotation: 4,
      scale: 1,
      color: checkColor,
      opacity: 0.88,
      zIndex: 2,
      visible: true,
      locked: false,
      pathData: wavyCheck,
      textureType: 'ink-porosity',
    },
    {
      id: `bridge-leaf-${Date.now()}-3`,
      name: 'Foglia Matisse Verde Bosco',
      type: 'stamp',
      stampKind: 'matisse-leaf',
      x: 200,
      y: 1115,
      width: 260,
      height: 260,
      rotation: -12,
      scale: 1,
      color: leafColor,
      opacity: 0.95,
      zIndex: 3,
      visible: true,
      locked: false,
      pathData: matisseLeaf.pathData,
      subPaths: matisseLeaf.subPaths,
      textureType: 'rough-brush',
    },
    {
      id: `bridge-splatter-${Date.now()}-4`,
      name: 'Schizzo Ocra Artigianale',
      type: 'stamp',
      stampKind: 'ink-splatter',
      x: 855,
      y: 435,
      width: 145,
      height: 145,
      rotation: 0,
      scale: 1,
      color: '#D4A373',
      opacity: 0.9,
      zIndex: 4,
      visible: true,
      locked: false,
      pathData: splatter.pathData,
      subPaths: splatter.subPaths,
      textureType: 'none',
    },
    {
      id: `bridge-kicker-${Date.now()}-5`,
      name: 'Kicker Categoria Lab',
      type: 'textured-text',
      x: 540,
      y: 410,
      width: 600,
      height: 60,
      rotation: 0,
      scale: 1,
      color: '#4A6B53',
      opacity: 1,
      zIndex: 5,
      visible: true,
      locked: false,
      pathData: '',
      textureType: 'ink-porosity',
      textContent: `LABORATORIO CREATIVO · ${workshop.category.toUpperCase()}`,
      fontStyle: 'mono-label',
      fontSize: 24,
    },
    {
      id: `bridge-title-${Date.now()}-6`,
      name: `Titolo: ${workshop.title}`,
      type: 'textured-text',
      x: 540,
      y: 540,
      width: titleMeta.width,
      height: titleMeta.height,
      rotation: 0,
      scale: 1,
      color: '#1A2B4C',
      secondaryColor: '#D4A373',
      opacity: 1,
      zIndex: 6,
      visible: true,
      locked: false,
      pathData: titleMeta.pathData,
      textureType: 'ink-porosity',
      textContent: wrappedTitle,
      fontStyle: partner?.fontStyle || 'editorial-serif',
      fontSize: 72,
    },
    {
      id: `bridge-sub-${Date.now()}-7`,
      name: 'Sottotitolo Evento',
      type: 'textured-text',
      x: 540,
      y: 695,
      width: 780,
      height: 100,
      rotation: 0,
      scale: 1,
      color: '#B85B43',
      opacity: 0.95,
      zIndex: 7,
      visible: true,
      locked: false,
      pathData: '',
      textureType: 'rough-brush',
      textContent: wrappedSubtitle,
      fontStyle: 'craft-rounded',
      fontSize: 32,
    },
    {
      id: `bridge-price-${Date.now()}-8`,
      name: `Badge Prezzo (${priceText})`,
      type: 'textured-text',
      x: 540,
      y: 855,
      width: priceMeta.width,
      height: priceMeta.height,
      rotation: -2,
      scale: 1,
      color: '#EADDCD',
      secondaryColor: blobColor,
      opacity: 1,
      zIndex: 8,
      visible: true,
      locked: false,
      pathData: priceMeta.pathData,
      textureType: 'materic-blob',
      textContent: badgeText,
      fontStyle: 'craft-rounded',
      fontSize: 36,
    },
    {
      id: `bridge-location-${Date.now()}-9`,
      name: `Location: ${workshop.location}`,
      type: 'textured-text',
      x: 540,
      y: 1015,
      width: infoMeta.width,
      height: infoMeta.height,
      rotation: 0,
      scale: 1,
      color: '#1A2B4C',
      secondaryColor: '#4A6B53',
      opacity: 1,
      zIndex: 9,
      visible: true,
      locked: false,
      pathData: infoMeta.pathData,
      textureType: 'none',
      textContent: infoText,
      fontStyle: 'editorial-serif',
      fontSize: 30,
    },
    {
      id: `bridge-seal-${Date.now()}-10`,
      name: 'Timbro Circolare Fatti a mano',
      type: 'stamp',
      stampKind: 'seal-fatti-a-mano',
      x: 865,
      y: 1135,
      width: 240,
      height: 240,
      rotation: 6,
      scale: 1,
      color: '#1A2B4C',
      opacity: 0.95,
      zIndex: 10,
      visible: true,
      locked: false,
      pathData: sealStamp.pathData,
      subPaths: sealStamp.subPaths,
      textContent: sealStamp.defaultText,
      textureType: 'ink-porosity',
    },
  ];

  // Carica in automatico nella clipboard gli asset grafici pertinenti al laboratorio
  const greenCheck = generateWavyCheckerboardPath(400, 400, 260, 200, 4, 5, 11, 5.1);
  const brushStroke = generateBrandStamp('brush-zig', 540, 675, 220);

  const clipboardAssets: VectorElement[] = [
    {
      id: `clip-stamp-seal`,
      name: 'Timbro Ufficiale Fatti a mano',
      type: 'stamp',
      stampKind: 'seal-fatti-a-mano',
      x: 540,
      y: 675,
      width: 240,
      height: 240,
      rotation: 0,
      scale: 1,
      color: '#1A2B4C',
      opacity: 1,
      zIndex: 20,
      visible: true,
      locked: false,
      pathData: sealStamp.pathData,
      subPaths: sealStamp.subPaths,
      textContent: 'Fatti a mano',
      textureType: 'ink-porosity',
    },
    {
      id: `clip-wavy-bosco`,
      name: 'Checkerboard Verde Bosco',
      type: 'checkerboard',
      x: 540,
      y: 675,
      width: 260,
      height: 200,
      rotation: -5,
      scale: 1,
      color: '#4A6B53',
      opacity: 0.92,
      zIndex: 21,
      visible: true,
      locked: false,
      pathData: greenCheck,
      textureType: 'rough-brush',
    },
    {
      id: `clip-brush-ocra`,
      name: 'Pennellata Dinamica Ocra',
      type: 'stamp',
      stampKind: 'brush-zig',
      x: 540,
      y: 675,
      width: 220,
      height: 220,
      rotation: 0,
      scale: 1,
      color: '#D4A373',
      opacity: 0.95,
      zIndex: 22,
      visible: true,
      locked: false,
      pathData: brushStroke.pathData,
      subPaths: brushStroke.subPaths,
      textureType: 'rough-brush',
    },
  ];

  if (partner) {
    const { partnerElements, partnerClipboard } = buildPartnerVectorAssets(partner, 1080, 1350);
    // Aggiunge il badge logo del Partner in alto nella locandina e i suoi asset nella clipboard
    canvasElements.push(partnerElements[0]);
    clipboardAssets.unshift(...partnerClipboard);
  }

  return { canvasElements, clipboardAssets };
}

/**
 * Crea il progetto grafico predefinito per una Scheda Laboratorio (con clientUpdatedAt = 0 finché non viene modificato).
 */
export function createDefaultWorkshopDesign(
  workshop: WorkshopCard,
  partner?: PartnerProfile,
  clientUpdatedAt = 0
): WorkshopPosterDesign {
  const { canvasElements, clipboardAssets } = buildPosterFromWorkshop(workshop, partner);
  return {
    id: `tpl-${workshop.id}`,
    workshopId: workshop.id,
    title: `Locandina ${workshop.title}`,
    presetName: '1080x1350',
    width: 1080,
    height: 1350,
    backgroundColor: '#EADDCD',
    partnerId: partner?.id || workshop.partnerId || '',
    elements: canvasElements,
    clipboard: clipboardAssets,
    clientUpdatedAt,
  };
}

/**
 * Aggiorna i testi collegati (Titolo, Sottotitolo, Prezzo, Location/Data, Categoria e Badge Partner)
 * all'interno di un progetto del Builder Grafico esistente SENZA cancellare i disegni a mano libera,
 * i timbri aggiunti, i colori o le posizioni personalizzate dall'utente.
 */
export function syncPosterElementsWithWorkshop(
  existingDesign: WorkshopPosterDesign,
  workshop: WorkshopCard,
  partner?: PartnerProfile
): WorkshopPosterDesign {
  const wrappedTitle = wrapPosterText(workshop.title, 22);
  const wrappedSubtitle = wrapPosterText(workshop.subtitle, 36);
  const priceText = `${workshop.ticketPrice}€`;
  const badgeText = `Quota ${priceText} · Materiali + Aperitivo`;
  const infoText = `${workshop.dateLabel}\n📍 ${workshop.location}`;
  const kickerText = `LABORATORIO CREATIVO · ${workshop.category.toUpperCase()}`;

  const updatedElements = existingDesign.elements.map((el) => {
    if (el.id.startsWith('bridge-title-')) {
      const meta = generateTextVectorBackdropPath(
        wrappedTitle,
        el.x,
        el.y,
        el.fontSize || 72,
        el.textureType
      );
      return {
        ...el,
        name: `Titolo: ${workshop.title}`,
        textContent: wrappedTitle,
        width: meta.width,
        height: meta.height,
        pathData: meta.pathData,
      };
    }
    if (el.id.startsWith('bridge-sub-')) {
      return {
        ...el,
        textContent: wrappedSubtitle,
      };
    }
    if (el.id.startsWith('bridge-price-')) {
      const meta = generateTextVectorBackdropPath(
        badgeText,
        el.x,
        el.y,
        el.fontSize || 36,
        el.textureType
      );
      return {
        ...el,
        name: `Badge Prezzo (${priceText})`,
        textContent: badgeText,
        width: meta.width,
        height: meta.height,
        pathData: meta.pathData,
      };
    }
    if (el.id.startsWith('bridge-location-')) {
      const meta = generateTextVectorBackdropPath(
        infoText,
        el.x,
        el.y,
        el.fontSize || 30,
        el.textureType
      );
      return {
        ...el,
        name: `Location: ${workshop.location}`,
        textContent: infoText,
        width: meta.width,
        height: meta.height,
        pathData: meta.pathData,
      };
    }
    if (el.id.startsWith('bridge-kicker-')) {
      return {
        ...el,
        textContent: kickerText,
      };
    }
    return el;
  });

  let nextClipboard = [...existingDesign.clipboard];
  let finalElements = updatedElements;

  if (partner) {
    const { partnerElements, partnerClipboard } = buildPartnerVectorAssets(
      partner,
      existingDesign.width,
      existingDesign.height
    );
    const hasPartnerBadge = finalElements.some((el) => el.id.startsWith('partner-badge-'));
    if (hasPartnerBadge) {
      finalElements = finalElements.map((el) =>
        el.id.startsWith('partner-badge-')
          ? {
              ...partnerElements[0],
              x: el.x,
              y: el.y,
              rotation: el.rotation,
              zIndex: el.zIndex,
            }
          : el
      );
    } else {
      finalElements = [...finalElements, partnerElements[0]];
    }
    const withoutOldPartnerClips = nextClipboard.filter(
      (el) => !el.id.startsWith('clip-partner-')
    );
    nextClipboard = [...partnerClipboard, ...withoutOldPartnerClips].slice(0, 8);
  }

  return {
    ...existingDesign,
    title: `Locandina ${workshop.title}`,
    partnerId: partner?.id || workshop.partnerId || existingDesign.partnerId || '',
    elements: finalElements,
    clipboard: nextClipboard,
    clientUpdatedAt: Date.now(),
  };
}

