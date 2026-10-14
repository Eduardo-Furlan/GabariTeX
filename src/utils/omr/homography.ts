export interface Point2D {
  x: number;
  y: number;
}

/**
 * Resolve o sistema linear 8x8 para encontrar a matriz de homografia 3x3 H
 * que mapeia 4 pontos de origem em 4 pontos de destino.
 */
export function solveHomography(
  src: Point2D[],
  dst: Point2D[]
): number[][] {
  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const u = dst[i].x;
    const v = dst[i].y;

    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);

    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }

  // Eliminação gaussiana com pivoteamento parcial
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }

    // Troca linhas
    const tmpA = A[i];
    A[i] = A[maxRow];
    A[maxRow] = tmpA;

    const tmpB = B[i];
    B[i] = B[maxRow];
    B[maxRow] = tmpB;

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error('Matriz singular ao calcular homografia');
    }

    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / pivot;
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      B[k] -= factor * B[i];
    }
  }

  // Substituição regressiva
  const h = new Array(8);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * h[j];
    }
    h[i] = (B[i] - sum) / A[i][i];
  }

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1.0],
  ];
}

/**
 * Aplica a homografia H a um ponto (x, y) retornando (u, v) normalizado.
 */
export function applyHomography(H: number[][], p: Point2D): Point2D {
  const x = p.x;
  const y = p.y;
  const uPrime = H[0][0] * x + H[0][1] * y + H[0][2];
  const vPrime = H[1][0] * x + H[1][1] * y + H[1][2];
  const w = H[2][0] * x + H[2][1] * y + H[2][2];

  if (Math.abs(w) < 1e-12) {
    return { x: 0, y: 0 };
  }

  return {
    x: uPrime / w,
    y: vPrime / w,
  };
}

/**
 * Verifica se 4 pontos ordenados formam um quadrilátero convexo estrito.
 */
export function isConvexQuad(pts: Point2D[]): boolean {
  let prevSign: boolean | null = null;

  for (let i = 0; i < 4; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % 4];
    const p3 = pts[(i + 2) % 4];

    const cross =
      (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);

    if (Math.abs(cross) < 1e-7) return false;
    const sign = cross > 0;
    if (prevSign === null) {
      prevSign = sign;
    } else if (prevSign !== sign) {
      return false;
    }
  }

  return true;
}

/**
 * Calcula a área de um polígono de 4 vértices pela fórmula do cadarço (Shoelace).
 */
export function quadArea(pts: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return 0.5 * Math.abs(sum);
}

