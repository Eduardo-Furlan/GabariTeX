import { GrayImage } from './grayImage';

export interface SquareCandidate {
  cx: number;
  cy: number;
  width: number;
  height: number;
  area: number;
  fill: number;
  hole: number;
  ring: number;
}

/**
 * Encontra componentes conectados em uma imagem binária booleana (8-conectividade)
 * e extrai estatísticas morfológicas e fotométricas (furo central / anel).
 */
export function findSquareCandidates(
  binary: Uint8Array,
  gray: GrayImage
): SquareCandidate[] {
  const { width, height, data: grayData } = gray;
  const S = Math.min(width, height);
  const minSide = 0.008 * S;
  const maxSide = 0.06 * S;

  const visited = new Uint8Array(width * height);
  const candidates: SquareCandidate[] = [];

  // Amostra papel (mediana a cada 7 pixels)
  const paperSamples: number[] = [];
  for (let y = 0; y < height; y += 7) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 7) {
      paperSamples.push(grayData[rowOffset + x]);
    }
  }
  paperSamples.sort((a, b) => a - b);
  const paper = paperSamples[Math.floor(paperSamples.length / 2)] || 200;

  // 8-vizinhança
  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

  // Fila de BFS reutilizável para performance
  const queueX = new Int32Array(width * height);
  const queueY = new Int32Array(width * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (binary[idx] && !visited[idx]) {
        visited[idx] = 1;

        let head = 0;
        let tail = 0;
        queueX[tail] = x;
        queueY[tail] = y;
        tail++;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let sumX = 0;
        let sumY = 0;
        let sumRingGray = 0;

        while (head < tail) {
          const cx = queueX[head];
          const cy = queueY[head];
          head++;

          sumX += cx;
          sumY += cy;
          sumRingGray += grayData[cy * width + cx];

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let d = 0; d < 8; d++) {
            const nx = cx + dx[d];
            const ny = cy + dy[d];
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (binary[nIdx] && !visited[nIdx]) {
                visited[nIdx] = 1;
                queueX[tail] = nx;
                queueY[tail] = ny;
                tail++;
              }
            }
          }
        }

        const area = tail;
        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;

        // Filtro de tamanho para quadrados fiduciais e marcas
        if (bw < minSide || bw > maxSide || bh < minSide || bh > maxSide) {
          continue;
        }

        const aspect = bw / bh;
        if (aspect < 0.70 || aspect > 1.43) {
          continue;
        }

        const fill = area / (bw * bh);
        if (fill < 0.50) {
          continue;
        }

        const centroidX = sumX / area;
        const centroidY = sumY / area;
        const ring = sumRingGray / area;

        // Mede a escuridão no centro para avaliar o "furo" branco interno
        const rHole = Math.max(1, Math.round(0.12 * (bw + bh) / 2));
        const cxInt = Math.round(centroidX);
        const cyInt = Math.round(centroidY);

        let sumCentre = 0;
        let countCentre = 0;
        const y0 = Math.max(0, cyInt - rHole);
        const y1 = Math.min(height - 1, cyInt + rHole);
        const x0 = Math.max(0, cxInt - rHole);
        const x1 = Math.min(width - 1, cxInt + rHole);

        for (let sy = y0; sy <= y1; sy++) {
          const sRow = sy * width;
          for (let sx = x0; sx <= x1; sx++) {
            sumCentre += grayData[sRow + sx];
            countCentre++;
          }
        }
        const centre = countCentre > 0 ? sumCentre / countCentre : ring;

        // hole: ~0 em quadrado sólido; ~0.4 a 1.0 em fiduciais com furo branco
        const hole = (centre - ring) / Math.max(1.0, paper - ring);

        candidates.push({
          cx: centroidX,
          cy: centroidY,
          width: bw,
          height: bh,
          area,
          fill,
          hole,
          ring,
        });
      }
    }
  }

  return candidates;
}

