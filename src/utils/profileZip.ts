import { zipSync, strToU8, strFromU8, Zippable } from 'fflate';
import { Exam, Classroom, GradingRecord } from '../types/exam';
import {
  ProfileData,
  ProfileSettings,
  ProfileManifest,
  ProfileExportOptions,
  ProfileImportSummary,
} from '../types/profile';
import { BankData, BankGroup, BankQuestion, Blueprint } from '../types/bank';
import { sha256Hex, generateExamPassword } from './crypto';
import { QuestionWithLegacyFigures } from './bank/figures';
import { importMergeTags } from './bank/tags';
import {
  ZipLimits,
  DEFAULT_ZIP_LIMITS,
  safeUnzip,
  verifyManifestFiles,
  externalizeQuestionImages,
  restoreQuestionImages,
} from './zipAssets';

export type { ZipLimits };
export { DEFAULT_ZIP_LIMITS };

function isBankNonEmpty(bank?: BankData): boolean {
  if (!bank) return false;
  return (
    (bank.questions && bank.questions.length > 0) ||
    (bank.groups && bank.groups.length > 0) ||
    (bank.tags && bank.tags.length > 0) ||
    (bank.blueprints && bank.blueprints.length > 0)
  );
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
  const includeBank = options.includeBank !== false;

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
  const questionsToExternalize: QuestionWithLegacyFigures[] = [];

  for (const exam of clonedExams) {
    if (!includePasswords) {
      exam.password = '';
    }
    if (!exam.updatedAt) {
      exam.updatedAt = new Date().toISOString();
    }
    if (exam.questions) {
      questionsToExternalize.push(...exam.questions);
    }
  }

  let clonedBank: BankData | undefined;
  if (includeBank && isBankNonEmpty(data.bank)) {
    clonedBank = JSON.parse(JSON.stringify(data.bank));
    if (clonedBank && clonedBank.questions) {
      questionsToExternalize.push(...clonedBank.questions);
    }
  }

  await externalizeQuestionImages(questionsToExternalize, assetsMap);

  const profilePayload = {
    exams: clonedExams,
    classes: selectedClasses,
    records: selectedRecords,
    settings,
    ...(clonedBank ? { bank: clonedBank } : {}),
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
      ...(clonedBank
        ? {
            bankQuestions: clonedBank.questions?.length ?? 0,
            bankGroups: clonedBank.groups?.length ?? 0,
            bankTags: clonedBank.tags?.length ?? 0,
            bankBlueprints: clonedBank.blueprints?.length ?? 0,
          }
        : {}),
    },
    includes: {
      records: includeRecords,
      classes: includeClasses,
      passwords: includePasswords,
      ...(clonedBank ? { bank: true } : {}),
    },
    files: fileHashes,
  };

  const manifestJsonStr = JSON.stringify(manifest, null, 2);
  zipEntries['manifest.json'] = strToU8(manifestJsonStr);

  return zipSync(zipEntries);
}

/**
 * Lê e valida um contêiner ZIP de perfil, validando integridade SHA-256 e reconstruindo imagens.
 */
export async function parseProfileZip(
  zipBytes: Uint8Array,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS
): Promise<ProfileZipPayload> {
  const unzipped = safeUnzip(zipBytes, limits);

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
  await verifyManifestFiles(manifest.files, unzipped);

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
    bank?: BankData;
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
  const questionsToRestore: QuestionWithLegacyFigures[] = [];

  for (const exam of exams) {
    if (!exam.password || exam.password.trim() === '') {
      exam.password = generateExamPassword();
      passwordsGenerated.push(exam.header.examTitle || exam.id);
    }
    if (!exam.updatedAt) {
      exam.updatedAt = new Date().toISOString();
    }

    if (exam.questions) {
      questionsToRestore.push(...exam.questions);
    }
  }

  if (profileData.bank && profileData.bank.questions) {
    questionsToRestore.push(...profileData.bank.questions);
  }

  restoreQuestionImages(questionsToRestore, unzipped);

  return {
    manifest,
    profile: {
      exams,
      classes,
      records,
      ...(profileData.bank ? { bank: profileData.bank } : {}),
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

  let newBankQuestions: number | undefined;
  let existingBankQuestions: number | undefined;
  let bankGroups: number | undefined;
  let bankTags: number | undefined;
  let bankBlueprints: number | undefined;

  if (importedData.bank) {
    const curQMap = new Map((currentData.bank?.questions || []).map((q) => [q.id, q]));
    let nQ = 0;
    let eQ = 0;
    for (const q of importedData.bank.questions || []) {
      if (curQMap.has(q.id)) {
        eQ++;
      } else {
        nQ++;
      }
    }
    newBankQuestions = nQ;
    existingBankQuestions = eQ;
    bankGroups = importedData.bank.groups?.length ?? 0;
    bankTags = importedData.bank.tags?.length ?? 0;
    bankBlueprints = importedData.bank.blueprints?.length ?? 0;
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
    ...(importedData.bank
      ? {
          newBankQuestions,
          existingBankQuestions,
          bankGroups,
          bankTags,
          bankBlueprints,
        }
      : {}),
  };
}

/**
 * Mescla dois conjuntos de dados do banco de questões:
 * - grupos, questões e modelos por id, mantendo o mais recente (updatedAt).
 * - etiquetas unificadas por nome case-insensitive, remapeando IDs em questões e modelos.
 * - preserva dados locais se não houver conflito.
 */
export function mergeBankData(
  currentBank?: BankData,
  importedBank?: BankData
): BankData | undefined {
  if (!currentBank && !importedBank) {
    return undefined;
  }
  if (!importedBank) {
    return currentBank ? JSON.parse(JSON.stringify(currentBank)) : undefined;
  }
  if (!currentBank) {
    return JSON.parse(JSON.stringify(importedBank));
  }

  // 1. Tags: merge by case-insensitive name, remapping IDs
  const { tags: mergedTags, idMap: tagIdMap } = importMergeTags(
    currentBank.tags || [],
    importedBank.tags || []
  );

  // 2. Groups: merge by id, newer updatedAt wins
  const groupMap = new Map<string, BankGroup>();
  for (const g of currentBank.groups || []) {
    groupMap.set(g.id, { ...g });
  }
  for (const impG of importedBank.groups || []) {
    const existing = groupMap.get(impG.id);
    if (!existing) {
      groupMap.set(impG.id, { ...impG });
    } else {
      const curDate = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      const impDate = impG.updatedAt ? Date.parse(impG.updatedAt) : 0;
      if (impDate > curDate) {
        groupMap.set(impG.id, { ...impG });
      }
    }
  }

  // 3. Questions: remap tagIds, merge by id, newer updatedAt wins
  const questionMap = new Map<string, BankQuestion>();
  for (const q of currentBank.questions || []) {
    questionMap.set(q.id, { ...q });
  }
  for (const impQ of importedBank.questions || []) {
    const remappedTagIds = (impQ.tagIds || []).map((tid) => tagIdMap.get(tid) || tid);
    const remappedQ: BankQuestion = {
      ...impQ,
      tagIds: Array.from(new Set(remappedTagIds)),
    };
    const existing = questionMap.get(remappedQ.id);
    if (!existing) {
      questionMap.set(remappedQ.id, remappedQ);
    } else {
      const curDate = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      const impDate = remappedQ.updatedAt ? Date.parse(remappedQ.updatedAt) : 0;
      if (impDate > curDate) {
        questionMap.set(remappedQ.id, remappedQ);
      }
    }
  }

  // 4. Blueprints: remap quota tagIds, merge by id, newer updatedAt wins
  const blueprintMap = new Map<string, Blueprint>();
  for (const bp of currentBank.blueprints || []) {
    blueprintMap.set(bp.id, { ...bp });
  }
  for (const impBp of importedBank.blueprints || []) {
    const remappedBp: Blueprint = {
      ...impBp,
      blocks: (impBp.blocks || []).map((block) => ({
        ...block,
        quotas: (block.quotas || []).map((q) => ({
          ...q,
          filter: {
            ...q.filter,
            tagIds: (q.filter.tagIds || []).map((t) => tagIdMap.get(t) || t),
            notTagIds: (q.filter.notTagIds || []).map((t) => tagIdMap.get(t) || t),
          },
        })),
      })),
    };
    const existing = blueprintMap.get(remappedBp.id);
    if (!existing) {
      blueprintMap.set(remappedBp.id, remappedBp);
    } else {
      const curDate = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      const impDate = remappedBp.updatedAt ? Date.parse(remappedBp.updatedAt) : 0;
      if (impDate > curDate) {
        blueprintMap.set(remappedBp.id, remappedBp);
      }
    }
  }

  return {
    groups: Array.from(groupMap.values()),
    tags: mergedTags,
    questions: Array.from(questionMap.values()),
    blueprints: Array.from(blueprintMap.values()),
  };
}

/**
 * Mescla dois perfis (modo padrão "Mesclar"):
 * - Provas e turmas por ID, mantendo a de updatedAt mais recente.
 * - Notas por ID, sem duplicar registros existentes.
 * - Banco de questões com regras de merge por id e etiquetas por nome.
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

  const mergedBank = mergeBankData(currentData.bank, importedData.bank);

  const mergedSettings: ProfileSettings = {
    activeExamId: currentSettings.activeExamId || importedSettings.activeExamId,
    activeClassId: currentSettings.activeClassId || importedSettings.activeClassId,
  };

  return {
    mergedData: {
      exams: Array.from(examMap.values()),
      classes: Array.from(classMap.values()),
      records: Array.from(recordMap.values()),
      ...(mergedBank ? { bank: mergedBank } : {}),
    },
    mergedSettings,
  };
}
