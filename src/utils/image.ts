/**
 * Utilitários para processamento e compressão de imagens do exame.
 */

/**
 * Reduz a resolução de uma imagem para upload seguro no banco de questões,
 * prevenindo estouro de cota do localStorage.
 *
 * - Limita o lado maior a maxSide (sem nunca ampliar imagens menores).
 * - Aplica fundo branco sólido.
 * - Preserva PNG se o tamanho for <= 300 KB (ideal para esquemas gráficos e vetores rasterizados);
 *   caso contrário, comprime como JPEG.
 *
 * @param file Arquivo de imagem enviado pelo usuário
 * @param maxSide Dimensão máxima em pixels para largura ou altura (padrão: 1200)
 * @param quality Qualidade de compressão para JPEG (padrão: 0.85)
 * @returns Promise com o DataURL da imagem resultante
 */
export async function downscaleImage(
  file: File,
  maxSide = 1200,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo fornecido não é uma imagem válida.'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let targetW = img.naturalWidth || img.width;
      let targetH = img.naturalHeight || img.height;

      // Nunca amplia imagens menores
      if (targetW > maxSide || targetH > maxSide) {
        if (targetW >= targetH) {
          targetH = Math.round((targetH * maxSide) / targetW);
          targetW = maxSide;
        } else {
          targetW = Math.round((targetW * maxSide) / targetH);
          targetH = maxSide;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, targetW);
      canvas.height = Math.max(1, targetH);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível obter contexto 2D para redimensionamento de imagem.'));
        return;
      }

      // Fundo branco sólido
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Se for PNG e <= 300 KB, mantém PNG
      if (file.type === 'image/png') {
        const pngDataUrl = canvas.toDataURL('image/png');
        const approxBytes = Math.round((pngDataUrl.length - 22) * 0.75);
        if (approxBytes <= 300 * 1024) {
          resolve(pngDataUrl);
          return;
        }
      }

      // Caso contrário, exporta como JPEG
      const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(jpegDataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar o arquivo de imagem para redimensionamento.'));
    };

    img.src = url;
  });
}

