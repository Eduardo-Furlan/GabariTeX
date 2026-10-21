import { BankTag, TagColor } from '../../types/bank';
import { generateBankId } from './ids';
import { validateTagName, caseInsensitiveKey } from './names';

export const TAG_COLORS: TagColor[] = [
  'slate',
  'red',
  'amber',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
];

/**
 * Finds an existing tag by case-insensitive name, or creates a new one.
 */
export function findOrCreateTag(
  tags: readonly BankTag[],
  rawName: string,
  color: TagColor = 'blue'
): { tags: BankTag[]; tag: BankTag; created: boolean } {
  const val = validateTagName(rawName);
  if (!val.valid) {
    throw new Error(val.error);
  }

  const key = caseInsensitiveKey(val.normalized);
  const existing = tags.find((t) => caseInsensitiveKey(t.name) === key);
  if (existing) {
    return { tags: [...tags], tag: existing, created: false };
  }

  const now = new Date().toISOString();
  const newTag: BankTag = {
    id: generateBankId(),
    name: val.normalized,
    color,
    createdAt: now,
    updatedAt: now,
  };

  return {
    tags: [...tags, newTag],
    tag: newTag,
    created: true,
  };
}

/**
 * Renames a tag, ensuring case-insensitive uniqueness among all other tags.
 */
export function renameTag(
  tags: readonly BankTag[],
  tagId: string,
  newName: string
): { tags: BankTag[]; updatedTag: BankTag } {
  const val = validateTagName(newName);
  if (!val.valid) {
    throw new Error(val.error);
  }

  const target = tags.find((t) => t.id === tagId);
  if (!target) {
    throw new Error(`Etiqueta com id "${tagId}" não encontrada.`);
  }

  const key = caseInsensitiveKey(val.normalized);
  const duplicate = tags.some((t) => t.id !== tagId && caseInsensitiveKey(t.name) === key);
  if (duplicate) {
    throw new Error(`Já existe uma etiqueta com o nome "${val.normalized}".`);
  }

  const updatedTag: BankTag = {
    ...target,
    name: val.normalized,
    updatedAt: new Date().toISOString(),
  };

  return {
    tags: tags.map((t) => (t.id === tagId ? updatedTag : t)),
    updatedTag,
  };
}

/**
 * Updates a tag's color.
 */
export function updateTagColor(
  tags: readonly BankTag[],
  tagId: string,
  color: TagColor
): { tags: BankTag[]; updatedTag: BankTag } {
  const target = tags.find((t) => t.id === tagId);
  if (!target) {
    throw new Error(`Etiqueta com id "${tagId}" não encontrada.`);
  }

  const updatedTag: BankTag = {
    ...target,
    color,
    updatedAt: new Date().toISOString(),
  };

  return {
    tags: tags.map((t) => (t.id === tagId ? updatedTag : t)),
    updatedTag,
  };
}

/**
 * Deletes a tag from the tags list and strips its ID from all questions.
 */
export function deleteTag<Q extends { id: string; tagIds: string[] }>(
  tags: readonly BankTag[],
  questions: readonly Q[],
  tagId: string
): { tags: BankTag[]; updatedQuestions: Q[] } {
  const nextTags = tags.filter((t) => t.id !== tagId);

  const updatedQuestions: Q[] = [];
  for (const q of questions) {
    if (q.tagIds && q.tagIds.includes(tagId)) {
      updatedQuestions.push({
        ...q,
        tagIds: q.tagIds.filter((id) => id !== tagId),
      });
    }
  }

  return {
    tags: nextTags,
    updatedQuestions,
  };
}

/**
 * Merges sourceTagId into targetTagId:
 * - Questions with sourceTagId are given targetTagId (deduplicated).
 * - sourceTagId is removed from tags.
 */
export function mergeTags<Q extends { id: string; tagIds: string[] }>(
  tags: readonly BankTag[],
  questions: readonly Q[],
  sourceTagId: string,
  targetTagId: string
): { tags: BankTag[]; updatedQuestions: Q[] } {
  if (sourceTagId === targetTagId) {
    return { tags: [...tags], updatedQuestions: [] };
  }

  const source = tags.find((t) => t.id === sourceTagId);
  const target = tags.find((t) => t.id === targetTagId);
  if (!source) throw new Error(`Etiqueta de origem "${sourceTagId}" não encontrada.`);
  if (!target) throw new Error(`Etiqueta de destino "${targetTagId}" não encontrada.`);

  const nextTags = tags.filter((t) => t.id !== sourceTagId);

  const updatedQuestions: Q[] = [];
  for (const q of questions) {
    if (q.tagIds && q.tagIds.includes(sourceTagId)) {
      const remaining = q.tagIds.filter((id) => id !== sourceTagId);
      if (!remaining.includes(targetTagId)) {
        remaining.push(targetTagId);
      }
      updatedQuestions.push({
        ...q,
        tagIds: remaining,
      });
    }
  }

  return {
    tags: nextTags,
    updatedQuestions,
  };
}

/**
 * Merges an incoming set of tags into existing tags by normalized name (case-insensitive).
 * Returns merged tags and a mapping from incoming tag ID to the canonical tag ID.
 */
export function importMergeTags(
  existingTags: readonly BankTag[],
  incomingTags: readonly BankTag[]
): { tags: BankTag[]; idMap: Map<string, string> } {
  const resultTags = [...existingTags];
  const nameIndex = new Map<string, BankTag>();
  for (const t of existingTags) {
    nameIndex.set(caseInsensitiveKey(t.name), t);
  }

  const idMap = new Map<string, string>();

  for (const inc of incomingTags) {
    const key = caseInsensitiveKey(inc.name);
    const existing = nameIndex.get(key);
    if (existing) {
      idMap.set(inc.id, existing.id);
      // If incoming tag is newer, optionally update color if desired
      if (inc.updatedAt && existing.updatedAt && inc.updatedAt > existing.updatedAt) {
        const idx = resultTags.findIndex((t) => t.id === existing.id);
        if (idx !== -1) {
          resultTags[idx] = { ...existing, color: inc.color, updatedAt: inc.updatedAt };
          nameIndex.set(key, resultTags[idx]);
        }
      }
    } else {
      idMap.set(inc.id, inc.id);
      resultTags.push(inc);
      nameIndex.set(key, inc);
    }
  }

  return { tags: resultTags, idMap };
}
