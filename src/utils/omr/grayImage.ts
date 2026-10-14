export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Converte ImageData RGBA para escala de cinza utilizando os coeficientes ITU-R BT.601.
 */
export function toGray(imageData: ImageData): GrayImage {
  const { width, height, data } = imageData;
  const grayData = new Uint8Array(width * height);
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    grayData[i] = Math.round(
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    );
  }

  return {
    data: grayData,
    width,
    height,
  };
}

/**
 * Redimensiona a imagem para que o lado maior tenha no máximo `targetMaxDim` pixels.
 */
export function resize(
  img: GrayImage,
  targetMaxDim: number = 1600
): { image: GrayImage; scale: number } {
  const maxDim = Math.max(img.width, img.height);
  if (maxDim === targetMaxDim) {
    return { image: img, scale: 1.0 };
  }

  const scale = targetMaxDim / maxDim;
  const newWidth = Math.max(1, Math.round(img.width * scale));
  const newHeight = Math.max(1, Math.round(img.height * scale));
  const dst = new Uint8Array(newWidth * newHeight);

  if (scale < 1.0) {
    // Redução: média de caixa (área)
    const xRatio = img.width / newWidth;
    const yRatio = img.height / newHeight;

    for (let dy = 0; dy < newHeight; dy++) {
      const sy0 = Math.floor(dy * yRatio);
      const sy1 = Math.min(img.height, Math.floor((dy + 1) * yRatio));
      const rowOffset = dy * newWidth;

      for (let dx = 0; dx < newWidth; dx++) {
        const sx0 = Math.floor(dx * xRatio);
        const sx1 = Math.min(img.width, Math.floor((dx + 1) * xRatio));

        let sum = 0;
        let count = 0;
        for (let sy = sy0; sy < sy1; sy++) {
          const sRow = sy * img.width;
          for (let sx = sx0; sx < sx1; sx++) {
            sum += img.data[sRow + sx];
            count++;
          }
        }
        dst[rowOffset + dx] = count > 0 ? Math.round(sum / count) : img.data[sy0 * img.width + sx0];
      }
    }
  } else {
    // Ampliação: interpolação bilinear
    const xRatio = (img.width - 1) / Math.max(1, newWidth - 1);
    const yRatio = (img.height - 1) / Math.max(1, newHeight - 1);

    for (let dy = 0; dy < newHeight; dy++) {
      const sy = dy * yRatio;
      const y0 = Math.floor(sy);
      const y1 = Math.min(img.height - 1, y0 + 1);
      const yFrac = sy - y0;
      const rowOffset = dy * newWidth;

      for (let dx = 0; dx < newWidth; dx++) {
        const sx = dx * xRatio;
        const x0 = Math.floor(sx);
        const x1 = Math.min(img.width - 1, x0 + 1);
        const xFrac = sx - x0;

        const p00 = img.data[y0 * img.width + x0];
        const p10 = img.data[y0 * img.width + x1];
        const p01 = img.data[y1 * img.width + x0];
        const p11 = img.data[y1 * img.width + x1];

        const top = p00 + xFrac * (p10 - p00);
        const bot = p01 + xFrac * (p11 - p01);
        dst[rowOffset + dx] = Math.round(top + yFrac * (bot - top));
      }
    }
  }

  return {
    image: {
      data: dst,
      width: newWidth,
      height: newHeight,
    },
    scale,
  };
}

/**
 * Gera a imagem integral 2D em Float64Array com tamanho (width + 1) * (height + 1).
 */
export function computeIntegralImage(img: GrayImage): Float64Array {
  const { width, height, data } = img;
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const srcRow = y * width;
    const prevIntRow = y * stride;
    const currIntRow = (y + 1) * stride;

    for (let x = 0; x < width; x++) {
      rowSum += data[srcRow + x];
      integral[currIntRow + x + 1] = integral[prevIntRow + x + 1] + rowSum;
    }
  }

  return integral;
}

/**
 * Aplica filtro de caixa (média local) usando a imagem integral.
 */
export function boxFilter(
  integral: Float64Array,
  width: number,
  height: number,
  win: number
): Float32Array {
  const stride = width + 1;
  const output = new Float32Array(width * height);
  const r = Math.floor(win / 2);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height, y + r + 1);
    const outRow = y * width;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width, x + r + 1);

      const count = (y1 - y0) * (x1 - x0);
      const sum =
        integral[y1 * stride + x1] -
        integral[y0 * stride + x1] -
        integral[y1 * stride + x0] +
        integral[y0 * stride + x0];

      output[outRow + x] = sum / count;
    }
  }

  return output;
}

/**
 * Desfoque rápido 3x3 para redução de ruído fino.
 */
export function blur3x3(img: GrayImage): GrayImage {
  const { width, height, data } = img;
  const output = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(height - 1, y + 1);

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(width - 1, x + 1);

      let sum = 0;
      let count = 0;
      for (let sy = y0; sy <= y1; sy++) {
        const sRow = sy * width;
        for (let sx = x0; sx <= x1; sx++) {
          sum += data[sRow + sx];
          count++;
        }
      }
      output[y * width + x] = Math.round(sum / count);
    }
  }

  return {
    data: output,
    width,
    height,
  };
}

