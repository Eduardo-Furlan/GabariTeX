import { zipSync, unzipSync, strToU8, strFromU8, Zippable } from 'fflate';
import { Exam, Classroom, GradingRecord } from '../types/exam';
import {
  ProfileData,
  ProfileSettings,
  ProfileManifest,
  ProfileExportOptions,
  ProfileImportSummary,
} from '../types/profile';
import { sha256Hex, generateExamPassword } from './crypto';

function base64ToBytes(base64: string): Uint8Array {
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

function bytesToBase64(bytes: Uint8Array): string {
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

function parseDataUrl(dataUrl: string): { mime: string; ext: string; bytes: Uint8Array } | null {
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

function assetToDataUrl(bytes: Uint8Array, ext: string): string {
  let mime = 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
  else if (ext === 'webp') mime = 'image/webp';
  else if (ext === 'gif') mime = 'image/gif';
  else if (ext === 'svg') mime = 'image/svg+xml';
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

export interface ProfileZipPayload {
  manifest: ProfileManifest;
  profile: ProfileData;
  settings: ProfileSettings;
  passwordsGenerated: string[];
}

/**
 * Constrói um contêiner ZIP de perfil contendo manifest.json, profile.json e imagens em assets/.
 */
export async function buildProfileZip(
  data: ProfileData,
  settings: ProfileSettings = {},
  options: ProfileExportOptions = {}
): Promise<Uint8Array> {
  const includeRecords = options.includeRecords !== false;
  const includeClasses = options.includeClasses !== false;
  const includePasswords = options.includePasswords !== false;

  // Filtrar exames se selecionados
  let selectedExams = data.exams;
  if (options.examIds && options.examIds.length > 0) {
    const idSet = new Set(options.examIds);
    selectedExams = data.exams.filter((e) => idSet.has(e.id));
  }

  // Filtrar turmas se selecionadas
  let selectedClasses = includeClasses ? data.classes : [];
  if (includeClasses && options.classIds && options.classIds.length > 0) {
    const idSet = new Set(options.classIds);
    selectedClasses = data.classes.filter((c) => idSet.has(c.id));
  }

  // Filtrar notas
  let selectedRecords = includeRecords ? data.records : [];
  if (includeRecords && options.examIds && options.examIds.length > 0) {
    const examIdSet = new Set(options.examIds);
    selectedRecords = data.records.filter((r) => r.examId && examIdSet.has(r.examId));
  }

  // Clona para transformar imagens e senhas sem afetar o estado em memória
  const clonedExams: Exam[] = JSON.parse(JSON.stringify(selectedExams));
  const assetsMap = new Map<string, Uint8Array>();

  for (const exam of clonedExams) {
    if (!includePasswords) {
      exam.password = '';
    }
    if (!exam.updatedAt) {
      exam.updatedAt = new Date().toISOString();
    }

    if (exam.questions) {
      for (const q of exam.questions) {
        if (q.imageUrl && q.imageUrl.startsWith('data:')) {
          const parsed = parseDataUrl(q.imageUrl);
          if (parsed) {
            const hash = (await sha256Hex(parsed.bytes)).slice(0, 16);
            const assetRelPath = `assets/${hash}.${parsed.ext}`;
            if (!assetsMap.has(assetRelPath)) {
              assetsMap.set(assetRelPath, parsed.bytes);
            }
            q.imageUrl = `asset:${hash}.${parsed.ext}`;
          }
        }
      }
    }
  }

  const profilePayload = {
    exams: clonedExams,
    classes: selectedClasses,
    records: selectedRecords,
    settings,
  };

  const profileJsonStr = JSON.stringify(profilePayload, null, 2);
  const profileJsonBytes = strToU8(profileJsonStr);
  const profileHash = await sha256Hex(profileJsonBytes);

  const fileHashes: Record<string, string> = {
    'profile.json': profileHash,
  };

  const zipEntries: Zippable = {
    'profile.json': profileJsonBytes,
  };

  for (const [relPath, bytes] of assetsMap.entries()) {
    fileHashes[relPath] = await sha256Hex(bytes);
    zipEntries[relPath] = [bytes, { level: 0 }]; // sem recompressão
  }

  const manifest: ProfileManifest = {
    app: 'gabaritex',
    kind: 'profile',
    schema: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      exams: clonedExams.length,
      classes: selectedClasses.length,
      records: selectedRecords.length,
      assets: assetsMap.size,
    },
    includes: {
      records: includeRecords,
      classes: includeClasses,
      passwords: includePasswords,
    },
    files: fileHashes,
  };

  const manifestJsonStr = JSON.stringify(manifest, null, 2);
  zipEntries['manifest.json'] = strToU8(manifestJsonStr);

  return zipSync(zipEntries);
}

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

/**
 * Lê e valida um contêiner ZIP de perfil, validando integridade SHA-256 e reconstruindo imagens.
 */
export async function parseProfileZip(
  zipBytes: Uint8Array,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS
): Promise<ProfileZipPayload> {
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

  const manifestBytes = unzipped['manifest.json'];
  if (!manifestBytes) {
    throw new Error('Arquivo não reconhecido como perfil do GabariTeX: manifest.json ausente.');
  }

  let manifest: ProfileManifest;
  try {
    const manifestStr = strFromU8(manifestBytes);
    manifest = JSON.parse(manifestStr);
  } catch {
    throw new Error('manifest.json corrompido ou inválido.');
  }

  if (manifest.app !== 'gabaritex') {
    throw new Error('Arquivo não reconhecido como perfil do GabariTeX.');
  }
  if (manifest.kind !== 'profile') {
    throw new Error(`Tipo de contêiner inválido: esperado 'profile', recebido '${manifest.kind}'.`);
  }
  if (manifest.schema !== 1) {
    throw new Error(
      `Versão de esquema ${manifest.schema} incompatível com esta versão do GabariTeX (suportado: 1).`
    );
  }

  // Validação estrita de integridade de hashes
  if (!manifest.files || typeof manifest.files !== 'object') {
    throw new Error('manifest.json incompleto: lista de arquivos ausente.');
  }

  for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
    const fileBytes = unzipped[relPath];
    if (!fileBytes) {
      throw new Error(`Arquivo corrompido ou incompleto: arquivo ausente no ZIP: ${relPath}`);
    }
    const computedHash = await sha256Hex(fileBytes);
    if (computedHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`Arquivo corrompido ou incompleto: divergência no hash de ${relPath}`);
    }
  }

  // Parse do profile.json
  const profileBytes = unzipped['profile.json'];
  if (!profileBytes) {
    throw new Error('Arquivo profile.json ausente no contêiner ZIP.');
  }

  let profileData: {
    exams?: Exam[];
    classes?: Classroom[];
    records?: GradingRecord[];
    settings?: ProfileSettings;
  };
  try {
    const profileStr = strFromU8(profileBytes);
    profileData = JSON.parse(profileStr);
  } catch {
    throw new Error('profile.json corrompido.');
  }

  const exams: Exam[] = profileData.exams || [];
  const classes: Classroom[] = profileData.classes || [];
  const records: GradingRecord[] = profileData.records || [];
  const settings: ProfileSettings = profileData.settings || {};

  const passwordsGenerated: string[] = [];

  // Reconstrói imagens e valida senhas das provas
  for (const exam of exams) {
    if (!exam.password || exam.password.trim() === '') {
      exam.password = generateExamPassword();
      passwordsGenerated.push(exam.header.examTitle || exam.id);
    }
    if (!exam.updatedAt) {
      exam.updatedAt = new Date().toISOString();
    }

    if (exam.questions) {
      for (const q of exam.questions) {
        if (q.imageUrl && q.imageUrl.startsWith('asset:')) {
          const assetName = q.imageUrl.slice('asset:'.length);
          const assetRelPath = `assets/${assetName}`;
          const assetBytes = unzipped[assetRelPath];
          if (assetBytes) {
            const ext = assetName.split('.').pop() || 'png';
            q.imageUrl = assetToDataUrl(assetBytes, ext);
          }
        }
      }
    }
  }

  return {
    manifest,
    profile: {
      exams,
      classes,
      records,
    },
    settings,
    passwordsGenerated,
  };
}

/**
 * Compara o perfil atual com o importado e gera um resumo para visualização prévia.
 */
export function summarizeProfileImport(
  currentData: ProfileData,
  importedData: ProfileData
): ProfileImportSummary {
  const currentExamMap = new Map<string, Exam>(currentData.exams.map((e) => [e.id, e]));
  const currentClassMap = new Map<string, Classroom>(currentData.classes.map((c) => [c.id, c]));
  const currentRecordIds = new Set<string>(currentData.records.map((r) => r.id));

  let newExams = 0;
  let existingExams = 0;
  let newerExams = 0;

  for (const impExam of importedData.exams) {
    const cur = currentExamMap.get(impExam.id);
    if (!cur) {
      newExams++;
    } else {
      existingExams++;
      const curDate = cur.updatedAt ? Date.parse(cur.updatedAt) : 0;
      const impDate = impExam.updatedAt ? Date.parse(impExam.updatedAt) : 0;
      if (impDate > curDate) {
        newerExams++;
      }
    }
  }

  let newClasses = 0;
  for (const impClass of importedData.classes) {
    if (!currentClassMap.has(impClass.id)) {
      newClasses++;
    }
  }

  let newRecords = 0;
  for (const impRec of importedData.records) {
    if (!currentRecordIds.has(impRec.id)) {
      newRecords++;
    }
  }

  return {
    examsCount: importedData.exams.length,
    classesCount: importedData.classes.length,
    recordsCount: importedData.records.length,
    newExams,
    existingExams,
    newerExams,
    newClasses,
    newRecords,
  };
}

/**
 * Mescla dois perfis (modo padrão "Mesclar"):
 * - Provas e turmas por ID, mantendo a de updatedAt mais recente.
 * - Notas por ID, sem duplicar registros existentes.
 */
export function mergeProfiles(
  currentData: ProfileData,
  importedData: ProfileData,
  currentSettings: ProfileSettings = {},
  importedSettings: ProfileSettings = {}
): { mergedData: ProfileData; mergedSettings: ProfileSettings } {
  const examMap = new Map<string, Exam>();
  for (const exam of currentData.exams) {
    examMap.set(exam.id, { ...exam });
  }
  for (const impExam of importedData.exams) {
    const existing = examMap.get(impExam.id);
    if (!existing) {
      examMap.set(impExam.id, { ...impExam });
    } else {
      const curDate = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      const impDate = impExam.updatedAt ? Date.parse(impExam.updatedAt) : 0;
      if (impDate > curDate) {
        examMap.set(impExam.id, { ...impExam });
      }
    }
  }

  const classMap = new Map<string, Classroom>();
  for (const c of currentData.classes) {
    classMap.set(c.id, { ...c });
  }
  for (const impClass of importedData.classes) {
    const existing = classMap.get(impClass.id);
    if (!existing) {
      classMap.set(impClass.id, { ...impClass });
    } else {
      const curDate = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      const impDate = impClass.updatedAt ? Date.parse(impClass.updatedAt) : 0;
      if (impDate > curDate) {
        classMap.set(impClass.id, { ...impClass });
      }
    }
  }

  const recordMap = new Map<string, GradingRecord>();
  for (const rec of currentData.records) {
    recordMap.set(rec.id, { ...rec });
  }
  for (const impRec of importedData.records) {
    if (!recordMap.has(impRec.id)) {
      recordMap.set(impRec.id, { ...impRec });
    }
  }

  const mergedSettings: ProfileSettings = {
    activeExamId: currentSettings.activeExamId || importedSettings.activeExamId,
    activeClassId: currentSettings.activeClassId || importedSettings.activeClassId,
  };

  return {
    mergedData: {
      exams: Array.from(examMap.values()),
      classes: Array.from(classMap.values()),
      records: Array.from(recordMap.values()),
    },
    mergedSettings,
  };
}
