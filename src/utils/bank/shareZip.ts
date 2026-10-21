import { zipSync, strToU8, strFromU8, Zippable } from 'fflate';
import {
  BankData,
  BankGroup,
  BankTag,
  BankQuestion,
  BankShareManifest,
} from '../../types/bank';
import { descendantIds } from './tree';
import { importMergeTags } from './tags';
import { caseInsensitiveKey } from './names';
import { sha256Hex } from '../crypto';
import {
  ZipLimits,
  DEFAULT_ZIP_LIMITS,
  safeUnzip,
  verifyManifestFiles,
  externalizeQuestionImages,
  restoreQuestionImages,
} from '../zipAssets';

export interface BankSharePayload {
  manifest: BankShareManifest;
  groups: BankGroup[];
  tags: BankTag[];
  questions: BankQuestion[];
}

export interface MergeSubtreeResult {
  updatedBank: BankData;
  summary: {
    rootGroupName: string;
    groupsAdded: number;
    groupsUpdated: number;
    questionsAdded: number;
    questionsUpdated: number;
    tagsMerged: number;
  };
}

/**
 * Packages a group subtree into a .gabaritex-bank.zip container.
 * Ancestors are collapsed so the chosen group becomes root (parentId: null).
 */
export async function buildBankShareZip(
  bank: BankData,
  rootGroupId: string
): Promise<Uint8Array> {
  const rootGroup = bank.groups.find((g) => g.id === rootGroupId);
  if (!rootGroup) {
    throw new Error(`Grupo com id "${rootGroupId}" não encontrado no banco.`);
  }

  const subgroupIds = descendantIds(bank.groups, rootGroupId);
  const allSubtreeGroupIds = new Set<string>([rootGroupId, ...subgroupIds]);

  // Clone groups; root group gets parentId = null
  const exportedGroups: BankGroup[] = bank.groups
    .filter((g) => allSubtreeGroupIds.has(g.id))
    .map((g) => {
      const copy = { ...g };
      if (copy.id === rootGroupId) {
        copy.parentId = null;
      }
      return copy;
    });

  // Export questions belonging to this subtree
  const exportedQuestions: BankQuestion[] = bank.questions
    .filter((q) => q.groupId !== null && allSubtreeGroupIds.has(q.groupId))
    .map((q) => JSON.parse(JSON.stringify(q)));

  // Collect tags used by these questions
  const usedTagIdSet = new Set<string>();
  for (const q of exportedQuestions) {
    for (const t of q.tagIds || []) {
      usedTagIdSet.add(t);
    }
  }
  const exportedTags: BankTag[] = bank.tags.filter((t) => usedTagIdSet.has(t.id));

  // Externalize question images into assets/
  const assetsMap = new Map<string, Uint8Array>();
  await externalizeQuestionImages(exportedQuestions, assetsMap);

  const bankJsonPayload = {
    groups: exportedGroups,
    tags: exportedTags,
    questions: exportedQuestions,
  };
  const bankJsonStr = JSON.stringify(bankJsonPayload, null, 2);
  const bankJsonBytes = strToU8(bankJsonStr);
  const bankJsonHash = await sha256Hex(bankJsonBytes);

  const fileHashes: Record<string, string> = {
    'bank.json': bankJsonHash,
  };

  const zipEntries: Zippable = {
    'bank.json': bankJsonBytes,
  };

  for (const [relPath, bytes] of assetsMap.entries()) {
    fileHashes[relPath] = await sha256Hex(bytes);
    zipEntries[relPath] = [bytes, { level: 0 }];
  }

  const manifest: BankShareManifest = {
    app: 'gabaritex',
    kind: 'question-bank',
    schema: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      groups: exportedGroups.length,
      tags: exportedTags.length,
      questions: exportedQuestions.length,
      assets: assetsMap.size,
    },
    files: fileHashes,
  };

  zipEntries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  return zipSync(zipEntries);
}

/**
 * Parses and validates a .gabaritex-bank.zip container.
 */
export async function parseBankShareZip(
  zipBytes: Uint8Array,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS
): Promise<BankSharePayload> {
  const unzipped = safeUnzip(zipBytes, limits);

  const manifestBytes = unzipped['manifest.json'];
  if (!manifestBytes) {
    throw new Error('Arquivo não reconhecido como pacote do GabariTeX: manifest.json ausente.');
  }

  let manifest: BankShareManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new Error('manifest.json corrompido ou inválido.');
  }

  if (manifest.app !== 'gabaritex') {
    throw new Error('Arquivo não reconhecido como pacote do GabariTeX.');
  }
  if (manifest.kind !== 'question-bank') {
    throw new Error(
      `Tipo de contêiner inválido: esperado 'question-bank', recebido '${(manifest as any).kind}'.`
    );
  }
  if (manifest.schema !== 1) {
    throw new Error(
      `Versão de esquema ${manifest.schema} incompatível com esta versão do GabariTeX (suportado: 1).`
    );
  }

  await verifyManifestFiles(manifest.files, unzipped);

  const bankBytes = unzipped['bank.json'];
  if (!bankBytes) {
    throw new Error('Arquivo bank.json ausente no contêiner ZIP.');
  }

  let bankData: {
    groups?: BankGroup[];
    tags?: BankTag[];
    questions?: BankQuestion[];
  };
  try {
    bankData = JSON.parse(strFromU8(bankBytes));
  } catch {
    throw new Error('bank.json corrompido.');
  }

  const groups: BankGroup[] = bankData.groups || [];
  const tags: BankTag[] = bankData.tags || [];
  const questions: BankQuestion[] = bankData.questions || [];

  restoreQuestionImages(questions, unzipped);

  return {
    manifest,
    groups,
    tags,
    questions,
  };
}

/**
 * Merges an imported group subtree into existing bank data:
 * - root group mounted under targetParentGroupId (or keeps existing parent if already present).
 * - tags merged by case-insensitive name with question tag IDs remapped.
 * - questions merged by id, newer updatedAt wins.
 * - blueprints preserved.
 */
export function mergeSubtreeIntoBank(
  existingBank: BankData,
  imported: { groups: BankGroup[]; tags: BankTag[]; questions: BankQuestion[] },
  targetParentGroupId: string | null = null
): MergeSubtreeResult {
  if (!imported.groups || imported.groups.length === 0) {
    throw new Error('O arquivo importado não contém grupos.');
  }

  const importedRoot = imported.groups.find((g) => g.parentId === null) || imported.groups[0];

  // 1. Tags: merge by case-insensitive name
  const { tags: mergedTags, idMap: tagIdMap } = importMergeTags(
    existingBank.tags || [],
    imported.tags || []
  );

  let tagsMergedCount = 0;
  for (const incTag of imported.tags || []) {
    if (tagIdMap.get(incTag.id) !== incTag.id) {
      tagsMergedCount++;
    }
  }

  // 2. Groups
  const groupMap = new Map<string, BankGroup>();
  for (const g of existingBank.groups || []) {
    groupMap.set(g.id, { ...g });
  }

  let groupsAdded = 0;
  let groupsUpdated = 0;

  const existingRoot = groupMap.get(importedRoot.id);
  if (existingRoot) {
    // Already present root: do not move!
    const curDate = existingRoot.updatedAt ? Date.parse(existingRoot.updatedAt) : 0;
    const impDate = importedRoot.updatedAt ? Date.parse(importedRoot.updatedAt) : 0;
    if (impDate > curDate) {
      existingRoot.name = importedRoot.name;
      existingRoot.updatedAt = importedRoot.updatedAt;
      groupsUpdated++;
    }
  } else {
    // New root group: place under targetParentGroupId
    const siblings = Array.from(groupMap.values()).filter(
      (g) => g.parentId === targetParentGroupId
    );
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1;

    let rootName = importedRoot.name;
    const nameCollision = siblings.some(
      (s) => caseInsensitiveKey(s.name) === caseInsensitiveKey(rootName)
    );
    if (nameCollision) {
      rootName = `${rootName} (importado)`;
    }

    groupMap.set(importedRoot.id, {
      ...importedRoot,
      name: rootName,
      parentId: targetParentGroupId,
      order: maxOrder + 1,
    });
    groupsAdded++;
  }

  // Process descendant groups
  for (const g of imported.groups) {
    if (g.id === importedRoot.id) continue;
    const existing = groupMap.get(g.id);
    if (existing) {
      const curDate = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      const impDate = g.updatedAt ? Date.parse(g.updatedAt) : 0;
      if (impDate > curDate) {
        existing.name = g.name;
        existing.updatedAt = g.updatedAt;
        groupsUpdated++;
      }
    } else {
      groupMap.set(g.id, { ...g });
      groupsAdded++;
    }
  }

  // 3. Questions: remap tagIds, merge by id
  const questionMap = new Map<string, BankQuestion>();
  for (const q of existingBank.questions || []) {
    questionMap.set(q.id, { ...q });
  }

  let questionsAdded = 0;
  let questionsUpdated = 0;

  for (const impQ of imported.questions || []) {
    const remappedTagIds = (impQ.tagIds || []).map((tid) => tagIdMap.get(tid) || tid);
    const remappedQ: BankQuestion = {
      ...impQ,
      tagIds: Array.from(new Set(remappedTagIds)),
    };

    const existing = questionMap.get(remappedQ.id);
    if (!existing) {
      questionMap.set(remappedQ.id, remappedQ);
      questionsAdded++;
    } else {
      const curDate = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      const impDate = remappedQ.updatedAt ? Date.parse(remappedQ.updatedAt) : 0;
      if (impDate > curDate) {
        questionMap.set(remappedQ.id, remappedQ);
        questionsUpdated++;
      }
    }
  }

  const updatedBank: BankData = {
    groups: Array.from(groupMap.values()),
    tags: mergedTags,
    questions: Array.from(questionMap.values()),
    blueprints: existingBank.blueprints || [],
  };

  return {
    updatedBank,
    summary: {
      rootGroupName: importedRoot.name,
      groupsAdded,
      groupsUpdated,
      questionsAdded,
      questionsUpdated,
      tagsMerged: tagsMergedCount,
    },
  };
}
