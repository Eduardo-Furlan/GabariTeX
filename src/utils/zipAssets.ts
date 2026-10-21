import { unzipSync } from 'fflate';
import { sha256Hex } from './crypto';
import {
  collectQuestionImageRefs,
  QuestionWithLegacyFigures,
} from './bank/figures';

export interface ZipLimits {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 5000,
  maxEntryBytes: 50 * 1024 * 1024,
  maxTotalBytes: 500 * 1024 * 1024,
};

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function parseDataUrl(
  dataUrl: string
): { mime: string; ext: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  const bytes = base64ToBytes(base64);
  let ext = 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg';
  else if (mime === 'image/webp') ext = 'webp';
  else if (mime === 'image/gif') ext = 'gif';
  else if (mime === 'image/svg+xml') ext = 'svg';
  return { mime, ext, bytes };
}

export function assetToDataUrl(bytes: Uint8Array, ext: string): string {
  let mime = 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
  else if (ext === 'webp') mime = 'image/webp';
  else if (ext === 'gif') mime = 'image/gif';
  else if (ext === 'svg') mime = 'image/svg+xml';
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

/**
 * Safely unzips bytes with bounds checking against zip bombs.
 */
export function safeUnzip(
  zipBytes: Uint8Array,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS
): Record<string, Uint8Array> {
  let unzipped: Record<string, Uint8Array>;
  let entryCount = 0;
  let totalBytes = 0;
  let limitError: Error | null = null;

  try {
    unzipped = unzipSync(zipBytes, {
      filter(file) {
        entryCount++;
        totalBytes += file.originalSize;
        if (
          entryCount > limits.maxEntries ||
          file.originalSize > limits.maxEntryBytes ||
          totalBytes > limits.maxTotalBytes
        ) {
          limitError = new Error('Arquivo de perfil grande demais ou com arquivos demais.');
          return false;
        }
        return true;
      },
    });
  } catch (err) {
    if (limitError) {
      throw limitError;
    }
    throw new Error('Arquivo corrompido ou formato ZIP inválido.');
  }

  if (limitError) {
    throw limitError;
  }

  return unzipped;
}

/**
 * Validates manifest files hash dictionary against unzipped contents.
 */
export async function verifyManifestFiles(
  files: Record<string, string>,
  unzipped: Record<string, Uint8Array>
): Promise<void> {
  if (!files || typeof files !== 'object') {
    throw new Error('manifest.json incompleto: lista de arquivos ausente.');
  }

  for (const [relPath, expectedHash] of Object.entries(files)) {
    const fileBytes = unzipped[relPath];
    if (!fileBytes) {
      throw new Error(`Arquivo corrompido ou incompleto: arquivo ausente no ZIP: ${relPath}`);
    }
    const computedHash = await sha256Hex(fileBytes);
    if (computedHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`Arquivo corrompido ou incompleto: divergência no hash de ${relPath}`);
    }
  }
}

/**
 * Externalizes all question image data URLs into the assetsMap with SHA256 hashes
 * and replaces image refs with `asset:<hash>.<ext>`.
 */
export async function externalizeQuestionImages(
  questions: QuestionWithLegacyFigures[],
  assetsMap: Map<string, Uint8Array>
): Promise<void> {
  for (const q of questions) {
    for (const ref of collectQuestionImageRefs(q)) {
      if (ref.url.startsWith('data:')) {
        const parsed = parseDataUrl(ref.url);
        if (parsed) {
          const hash = (await sha256Hex(parsed.bytes)).slice(0, 16);
          const assetRelPath = `assets/${hash}.${parsed.ext}`;
          if (!assetsMap.has(assetRelPath)) {
            assetsMap.set(assetRelPath, parsed.bytes);
          }
          ref.setUrl(`asset:${hash}.${parsed.ext}`);
        }
      }
    }
  }
}

/**
 * Restores question images that point to `asset:<hash>.<ext>` by reading from unzipped entries
 * and converting back to data URLs.
 */
export function restoreQuestionImages(
  questions: QuestionWithLegacyFigures[],
  unzipped: Record<string, Uint8Array>
): void {
  for (const q of questions) {
    for (const ref of collectQuestionImageRefs(q)) {
      if (ref.url.startsWith('asset:')) {
        const assetName = ref.url.slice('asset:'.length);
        const assetRelPath = `assets/${assetName}`;
        const assetBytes = unzipped[assetRelPath];
        if (assetBytes) {
          const ext = assetName.split('.').pop() || 'png';
          ref.setUrl(assetToDataUrl(assetBytes, ext));
        }
      }
    }
  }
}
