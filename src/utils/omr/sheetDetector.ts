import {
  GrayImage,
  resize,
  blur3x3,
  computeIntegralImage,
  boxFilter,
} from './grayImage';
import { findSquareCandidates } from './components';
import {
  Point2D,
  solveHomography,
  applyHomography,
  isConvexQuad,
  quadArea,
} from './homography';
import { OmrDetectionError } from './errors';

export interface SheetDetectionResult {
  corners: [Point2D, Point2D, Point2D, Point2D];
  columns: [Point2D, Point2D][][];
  scale: number;
}

/**
 * Agrupa valores 1D ordenados quando a distância entre consecutivos excede `gap`.
 */
function cluster1d(vals: number[], gap: number): number[][] {
  const indices = vals.map((_, i) => i);
  indices.sort((a, b) => vals[a] - vals[b]);
  if (indices.length === 0) return [];

  const groups: number[][] = [[indices[0]]];
  for (let i = 1; i < indices.length; i++) {
    const prevIdx = indices[i - 1];
    const currIdx = indices[i];
    if (vals[currIdx] - vals[prevIdx] > gap) {
      groups.push([]);
    }
    groups[groups.length - 1].push(currIdx);
  }
  return groups;
}

/**
 * Gera todas as combinações de tamanho k a partir de um array.
 */
function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];

  function helper(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      helper(i + 1, current);
      current.pop();
    }
  }

  helper(0, []);
  return result;
}

/**
 * Detecta a folha OMR através dos 4 fiduciais de canto e sincronizadores de linha.
 */
export function detectSheet(
  grayImg: GrayImage,
  cols: number = 1,
  expectedRows?: number
): SheetDetectionResult {
  // 1. Redimensiona para dimensão máxima de 1600 px
  const { image: scaledImg, scale } = resize(grayImg, 1600);
  const { width, height } = scaledImg;

  // 2. Filtro 3x3 para atenuar ruído de sensor
  const grayBlur = blur3x3(scaledImg);

  // 3. Limiarização adaptativa rápida via imagem integral
  const integral = computeIntegralImage(grayBlur);
  const win = Math.max(15, Math.floor(Math.min(width, height) / 20) | 1);
  const localMean = boxFilter(integral, width, height, win);
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    binary[i] = grayBlur.data[i] < localMean[i] - 12 ? 1 : 0;
  }

  // 4. Candidatos a quadrados fiduciais e marcas
  const sq = findSquareCandidates(binary, grayBlur);

  // Filtra fiduciais de canto (com furo interno claro)
  const big = sq
    .filter((q) => q.fill >= 0.55 && q.hole > 0.35)
    .sort((a, b) => b.area - a.area)
    .slice(0, 8);

  if (big.length < 4) {
    throw new OmrDetectionError(
      'NO_FIDUCIALS',
      `Fiduciais candidatos insuficientes: ${big.length} encontrados (mínimo 4).`
    );
  }

  let best: { area: number; quad: Point2D[]; fidA: number } | null = null;
  const combos = combinations(big, 4);

  for (const qs of combos) {
    const areas = qs.map((q) => q.area);
    const minA = Math.min(...areas);
    const maxA = Math.max(...areas);

    if (maxA > 1.5 * minA) {
      continue;
    }

    const pts: Point2D[] = qs.map((q) => ({ x: q.cx, y: q.cy }));
    const meanX = pts.reduce((sum, p) => sum + p.x, 0) / 4;
    const meanY = pts.reduce((sum, p) => sum + p.y, 0) / 4;

    const withAng = pts.map((p) => ({
      p,
      ang: Math.atan2(p.y - meanY, p.x - meanX),
    }));
    withAng.sort((a, b) => a.ang - b.ang);

    const ordered = withAng.map((item) => item.p);

    let minSum = Infinity;
    let minIdx = 0;
    for (let i = 0; i < 4; i++) {
      const sum = ordered[i].x + ordered[i].y;
      if (sum < minSum) {
        minSum = sum;
        minIdx = i;
      }
    }

    const quad: Point2D[] = [
      ordered[minIdx],
      ordered[(minIdx + 1) % 4],
      ordered[(minIdx + 2) % 4],
      ordered[(minIdx + 3) % 4],
    ];

    if (!isConvexQuad(quad)) {
      continue;
    }

    const a = quadArea(quad);
    if (!best || a > best.area) {
      const sortedA = [...areas].sort((x, y) => x - y);
      const medianA = (sortedA[1] + sortedA[2]) / 2;
      best = { area: a, quad, fidA: medianA };
    }
  }

  if (!best || best.area < 0.15 * width * height) {
    throw new OmrDetectionError(
      'NO_FIDUCIALS',
      'Fiduciais não formam uma folha válida (área insuficiente ou geometria inválida).'
    );
  }

  const { quad, fidA } = best;
  const dst: Point2D[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  const H = solveHomography(quad, dst);

  // 5. Filtra sincronizadores de linha sólidos
  const cand: { c: Point2D; u: number; v: number }[] = [];
  for (const q of sq) {
    if (q.hole > 0.35) continue;
    if (q.area < 0.3 * fidA || q.area > 0.75 * fidA) continue;

    const uv = applyHomography(H, { x: q.cx, y: q.cy });
    if (uv.x > 0.02 && uv.x < 0.98 && uv.y > 0.02 && uv.y < 0.98) {
      cand.push({ c: { x: q.cx, y: q.cy }, u: uv.x, v: uv.y });
    }
  }

  if (cand.length < 4) {
    throw new OmrDetectionError(
      'NO_MARK_COLUMNS',
      `Marcadores de linha insuficientes encontrados: ${cand.length} (mínimo 4).`
    );
  }

  // 6. Clusteriza as coordenadas u para identificar as colunas de marcas
  const us = cand.map((t) => t.u);
  let groups = cluster1d(us, 0.03).filter((gp) => gp.length >= 3);
  if (groups.length === 0) {
    throw new OmrDetectionError(
      'NO_MARK_COLUMNS',
      'Nenhuma coluna de sincronizadores de linha encontrada.'
    );
  }

  const maxLen = Math.max(...groups.map((gp) => gp.length));
  groups = groups.filter((gp) => gp.length >= 0.6 * maxLen);
  groups.sort((a, b) => {
    const meanA = a.reduce((sum, idx) => sum + us[idx], 0) / a.length;
    const meanB = b.reduce((sum, idx) => sum + us[idx], 0) / b.length;
    return meanA - meanB;
  });

  const expectedGroups = 2 * cols;
  if (groups.length !== expectedGroups) {
    throw new OmrDetectionError(
      'NO_MARK_COLUMNS',
      `Colunas de marcas detectadas: ${groups.length}, esperado: ${expectedGroups}.`
    );
  }

  const columns: [Point2D, Point2D][][] = [];
  for (let k = 0; k < cols; k++) {
    const L = groups[2 * k].map((i) => cand[i]).sort((a, b) => a.v - b.v);
    const R = groups[2 * k + 1].map((i) => cand[i]).sort((a, b) => a.v - b.v);

    const vDiffs: number[] = [];
    for (let i = 1; i < L.length; i++) {
      vDiffs.push(L[i].v - L[i - 1].v);
    }
    vDiffs.sort((a, b) => a - b);
    const pitch = vDiffs.length > 0 ? vDiffs[Math.floor(vDiffs.length / 2)] : 0.1;

    const pairs: [Point2D, Point2D][] = [];
    const usedR = new Set<number>();

    for (const l of L) {
      let bestJ: number | null = null;
      let minDiff = Infinity;
      for (let j = 0; j < R.length; j++) {
        if (!usedR.has(j)) {
          const diff = Math.abs(R[j].v - l.v);
          if (diff < minDiff) {
            minDiff = diff;
            bestJ = j;
          }
        }
      }

      if (bestJ !== null && minDiff < 0.35 * pitch) {
        usedR.add(bestJ);
        pairs.push([
          { x: l.c.x / scale, y: l.c.y / scale },
          { x: R[bestJ].c.x / scale, y: R[bestJ].c.y / scale },
        ]);
      }
    }

    if (expectedRows !== undefined && expectedRows > 0 && pairs.length !== expectedRows) {
      throw new OmrDetectionError(
        'ROWS_MISMATCH',
        `Linhas pareadas: ${pairs.length}, esperado: ${expectedRows}.`
      );
    }

    columns.push(pairs);
  }

  const corners: [Point2D, Point2D, Point2D, Point2D] = [
    { x: quad[0].x / scale, y: quad[0].y / scale },
    { x: quad[1].x / scale, y: quad[1].y / scale },
    { x: quad[2].x / scale, y: quad[2].y / scale },
    { x: quad[3].x / scale, y: quad[3].y / scale },
  ];

  return { corners, columns, scale };
}
