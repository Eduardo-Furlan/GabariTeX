import { BankGroup } from '../../types/bank';
import { generateBankId } from './ids';
import { validateGroupName, caseInsensitiveKey } from './names';

export const MAX_GROUP_DEPTH = 12;

export interface BankGroupNode extends BankGroup {
  children: BankGroupNode[];
  depth: number;
}

/**
 * Builds a hierarchical tree of groups sorted by `order`.
 */
export function buildGroupTree(groups: readonly BankGroup[]): BankGroupNode[] {
  const map = new Map<string, BankGroupNode>();
  const roots: BankGroupNode[] = [];

  // Sort input by order to establish stable baseline
  const sorted = [...groups].sort((a, b) => a.order - b.order);

  for (const g of sorted) {
    map.set(g.id, {
      ...g,
      children: [],
      depth: 0,
    });
  }

  for (const g of sorted) {
    const node = map.get(g.id)!;
    if (g.parentId && map.has(g.parentId)) {
      const parent = map.get(g.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Calculate depths recursively
  function assignDepth(node: BankGroupNode, depth: number) {
    node.depth = depth;
    node.children.sort((a, b) => a.order - b.order);
    for (const child of node.children) {
      assignDepth(child, depth + 1);
    }
  }

  roots.sort((a, b) => a.order - b.order);
  for (const root of roots) {
    assignDepth(root, 0);
  }

  return roots;
}

/**
 * Returns all descendant group IDs of `groupId` (not including `groupId`).
 */
export function descendantIds(groups: readonly BankGroup[], groupId: string): Set<string> {
  const childrenMap = new Map<string, string[]>();
  for (const g of groups) {
    if (g.parentId) {
      const list = childrenMap.get(g.parentId) || [];
      list.push(g.id);
      childrenMap.set(g.parentId, list);
    }
  }

  const result = new Set<string>();
  const stack = [...(childrenMap.get(groupId) || [])];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (!result.has(current)) {
      result.add(current);
      const nextChildren = childrenMap.get(current);
      if (nextChildren) {
        stack.push(...nextChildren);
      }
    }
  }

  return result;
}

/**
 * Returns the depth of a group (0 for root). Throws if cycle detected.
 */
export function depthOf(groups: readonly BankGroup[], groupId: string): number {
  const map = new Map<string, BankGroup>();
  for (const g of groups) {
    map.set(g.id, g);
  }

  let depth = 0;
  let curr = map.get(groupId);
  const visited = new Set<string>();

  while (curr && curr.parentId) {
    if (visited.has(curr.id)) {
      throw new Error(`Ciclo detectado no grupo ${curr.id}`);
    }
    visited.add(curr.id);
    depth++;
    curr = map.get(curr.parentId);
  }

  return depth;
}

/**
 * Returns the slash-separated path of a group (e.g. "Matemática/Geometria/Euclidiana").
 */
export function pathOf(groups: readonly BankGroup[], groupId: string): string {
  const map = new Map<string, BankGroup>();
  for (const g of groups) {
    map.set(g.id, g);
  }

  const parts: string[] = [];
  let curr = map.get(groupId);
  const visited = new Set<string>();

  while (curr) {
    if (visited.has(curr.id)) {
      throw new Error(`Ciclo detectado no grupo ${curr.id}`);
    }
    visited.add(curr.id);
    parts.unshift(curr.name);
    curr = curr.parentId ? map.get(curr.parentId) : undefined;
  }

  return parts.join('/');
}

/**
 * Resolves a slash-separated path (e.g. "Matemática/Geometria") case-insensitively.
 */
export function resolvePath(groups: readonly BankGroup[], path: string): BankGroup | undefined {
  if (!path || !path.trim()) return undefined;
  const segments = path
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return undefined;

  let currentParentId: string | null = null;
  let matchedGroup: BankGroup | undefined;

  for (const seg of segments) {
    const segKey = caseInsensitiveKey(seg);
    const found = groups.find(
      (g) => g.parentId === currentParentId && caseInsensitiveKey(g.name) === segKey
    );
    if (!found) return undefined;
    matchedGroup = found;
    currentParentId = found.id;
  }

  return matchedGroup;
}

/**
 * Helper to densely reindex siblings under a given parentId.
 */
function denseReindex(groups: BankGroup[], parentId: string | null): BankGroup[] {
  const siblings = groups.filter((g) => g.parentId === parentId).sort((a, b) => a.order - b.order);
  const orderMap = new Map<string, number>();
  siblings.forEach((g, idx) => {
    orderMap.set(g.id, idx);
  });

  return groups.map((g) => {
    if (orderMap.has(g.id)) {
      const newOrder = orderMap.get(g.id)!;
      return g.order !== newOrder ? { ...g, order: newOrder } : g;
    }
    return g;
  });
}

/**
 * Creates a new group, enforcing sibling name uniqueness, max depth, and dense ordering.
 */
export function createGroup(
  groups: readonly BankGroup[],
  input: { name: string; parentId: string | null; id?: string }
): { groups: BankGroup[]; newGroup: BankGroup } {
  const val = validateGroupName(input.name);
  if (!val.valid) {
    throw new Error(val.error);
  }

  if (input.parentId !== null) {
    const parent = groups.find((g) => g.id === input.parentId);
    if (!parent) {
      throw new Error(`Grupo pai com id "${input.parentId}" não foi encontrado.`);
    }
    const parentDepth = depthOf(groups, input.parentId);
    if (parentDepth + 1 > MAX_GROUP_DEPTH) {
      throw new Error(`Profundidade máxima de ${MAX_GROUP_DEPTH} níveis excedida.`);
    }
  }

  const nameKey = caseInsensitiveKey(val.normalized);
  const duplicate = groups.some(
    (g) => g.parentId === input.parentId && caseInsensitiveKey(g.name) === nameKey
  );
  if (duplicate) {
    throw new Error(`Já existe um subgrupo com o nome "${val.normalized}" neste nível.`);
  }

  const siblings = groups.filter((g) => g.parentId === input.parentId);
  const now = new Date().toISOString();
  const newGroup: BankGroup = {
    id: input.id || generateBankId(),
    parentId: input.parentId,
    name: val.normalized,
    order: siblings.length,
    createdAt: now,
    updatedAt: now,
  };

  const nextGroups = [...groups, newGroup];
  return { groups: nextGroups, newGroup };
}

/**
 * Renames a group, checking sibling name uniqueness.
 */
export function renameGroup(
  groups: readonly BankGroup[],
  groupId: string,
  newName: string
): { groups: BankGroup[]; updatedGroup: BankGroup } {
  const val = validateGroupName(newName);
  if (!val.valid) {
    throw new Error(val.error);
  }

  const target = groups.find((g) => g.id === groupId);
  if (!target) {
    throw new Error(`Grupo com id "${groupId}" não encontrado.`);
  }

  const nameKey = caseInsensitiveKey(val.normalized);
  const duplicate = groups.some(
    (g) => g.id !== groupId && g.parentId === target.parentId && caseInsensitiveKey(g.name) === nameKey
  );
  if (duplicate) {
    throw new Error(`Já existe um subgrupo com o nome "${val.normalized}" neste nível.`);
  }

  const now = new Date().toISOString();
  const updatedGroup: BankGroup = {
    ...target,
    name: val.normalized,
    updatedAt: now,
  };

  const nextGroups = groups.map((g) => (g.id === groupId ? updatedGroup : g));
  return { groups: nextGroups, updatedGroup };
}

/**
 * Moves a group to a new parent, checking cycle guards, depth limits, and sibling uniqueness.
 */
export function moveGroup(
  groups: readonly BankGroup[],
  groupId: string,
  newParentId: string | null,
  newOrder?: number
): { groups: BankGroup[]; updatedGroup: BankGroup } {
  const target = groups.find((g) => g.id === groupId);
  if (!target) {
    throw new Error(`Grupo com id "${groupId}" não encontrado.`);
  }

  if (target.parentId === newParentId && newOrder === undefined) {
    return { groups: [...groups], updatedGroup: target };
  }

  // Cycle check: cannot move into self or any descendant
  if (newParentId === groupId) {
    throw new Error('Não é possível mover um grupo para dentro de si mesmo.');
  }

  const descendants = descendantIds(groups, groupId);
  if (newParentId && descendants.has(newParentId)) {
    throw new Error('Não é possível mover um grupo para dentro de um de seus subgrupos.');
  }

  // Depth check: newParentDepth + 1 + subtreeHeight <= MAX_GROUP_DEPTH
  const newParentDepth = newParentId ? depthOf(groups, newParentId) + 1 : 0;
  let maxSubtreeRelativeDepth = 0;
  for (const descId of descendants) {
    const d = depthOf(groups, descId) - depthOf(groups, groupId);
    if (d > maxSubtreeRelativeDepth) maxSubtreeRelativeDepth = d;
  }
  if (newParentDepth + maxSubtreeRelativeDepth > MAX_GROUP_DEPTH) {
    throw new Error(`Mover este grupo excederia o limite máximo de ${MAX_GROUP_DEPTH} níveis.`);
  }

  // Sibling uniqueness check at destination
  const nameKey = caseInsensitiveKey(target.name);
  const duplicate = groups.some(
    (g) => g.id !== groupId && g.parentId === newParentId && caseInsensitiveKey(g.name) === nameKey
  );
  if (duplicate) {
    throw new Error(`Já existe um subgrupo com o nome "${target.name}" no destino.`);
  }

  const oldParentId = target.parentId;
  const now = new Date().toISOString();

  // Destination siblings
  const destSiblings = groups
    .filter((g) => g.parentId === newParentId && g.id !== groupId)
    .sort((a, b) => a.order - b.order);

  const targetOrder =
    newOrder !== undefined
      ? Math.max(0, Math.min(newOrder, destSiblings.length))
      : destSiblings.length;

  destSiblings.splice(targetOrder, 0, { ...target, parentId: newParentId, order: targetOrder, updatedAt: now });

  const destOrderMap = new Map<string, number>();
  destSiblings.forEach((g, idx) => {
    destOrderMap.set(g.id, idx);
  });

  let next = groups.map((g) => {
    if (g.id === groupId) {
      return { ...g, parentId: newParentId, order: targetOrder, updatedAt: now };
    }
    if (destOrderMap.has(g.id)) {
      return { ...g, order: destOrderMap.get(g.id)! };
    }
    return g;
  });

  // Re-index old parent siblings densely
  next = denseReindex(next, oldParentId);

  const updatedGroup = next.find((g) => g.id === groupId)!;
  return { groups: next, updatedGroup };
}

export type DeleteGroupStrategy =
  | { kind: 'move'; targetGroupId: string | null }
  | { kind: 'delete' };

export interface DeleteGroupResult {
  groups: BankGroup[];
  deletedGroupIds: string[];
  remappedQuestions: { id: string; newGroupId: string | null }[];
  deletedQuestionIds: string[];
}

/**
 * Deletes a group according to the chosen strategy:
 * - 'move': moves all direct questions and subgrupos to `targetGroupId` (or reparents them), deleting only `groupId`.
 * - 'delete': deletes `groupId` and all descendant groups and all questions inside them.
 */
export function deleteGroup(
  groups: readonly BankGroup[],
  questions: readonly { id: string; groupId: string | null }[],
  groupId: string,
  strategy: DeleteGroupStrategy
): DeleteGroupResult {
  const target = groups.find((g) => g.id === groupId);
  if (!target) {
    throw new Error(`Grupo com id "${groupId}" não encontrado.`);
  }

  const descendants = descendantIds(groups, groupId);

  if (strategy.kind === 'delete') {
    const allDeletedIds = new Set<string>([groupId, ...descendants]);
    const nextGroups = groups.filter((g) => !allDeletedIds.has(g.id));
    const reindexed = denseReindex(nextGroups, target.parentId);

    const deletedQuestionIds = questions
      .filter((q) => q.groupId && allDeletedIds.has(q.groupId))
      .map((q) => q.id);

    return {
      groups: reindexed,
      deletedGroupIds: Array.from(allDeletedIds),
      remappedQuestions: [],
      deletedQuestionIds,
    };
  }

  // strategy.kind === 'move'
  const targetGroupId = strategy.targetGroupId;
  if (targetGroupId === groupId || (targetGroupId && descendants.has(targetGroupId))) {
    throw new Error('Não é possível mover o conteúdo para o próprio grupo a ser excluído ou para um de seus subgrupos.');
  }

  // Questions in groupId and descendants are moved to targetGroupId
  const remappedQuestions: { id: string; newGroupId: string | null }[] = [];
  const affectedGroups = new Set<string>([groupId, ...descendants]);

  for (const q of questions) {
    if (q.groupId && affectedGroups.has(q.groupId)) {
      remappedQuestions.push({ id: q.id, newGroupId: targetGroupId });
    }
  }

  // Direct child groups of groupId are reparented to targetGroupId
  let nextGroups = groups
    .filter((g) => g.id !== groupId)
    .map((g) => {
      if (g.parentId === groupId) {
        return { ...g, parentId: targetGroupId, updatedAt: new Date().toISOString() };
      }
      return g;
    });

  nextGroups = denseReindex(nextGroups, target.parentId);
  if (targetGroupId !== target.parentId) {
    nextGroups = denseReindex(nextGroups, targetGroupId);
  }

  return {
    groups: nextGroups,
    deletedGroupIds: [groupId],
    remappedQuestions,
    deletedQuestionIds: [],
  };
}

/**
 * Computes direct and descendant question counts per group.
 * Group null represents "Sem Grupo".
 */
export function countQuestionsByGroup(
  questions: readonly { groupId: string | null; archived?: boolean }[],
  groups: readonly BankGroup[],
  includeArchived = false
): Map<string | null, { own: number; total: number }> {
  const result = new Map<string | null, { own: number; total: number }>();

  // Initialize
  result.set(null, { own: 0, total: 0 });
  for (const g of groups) {
    result.set(g.id, { own: 0, total: 0 });
  }

  // Count own
  for (const q of questions) {
    if (!includeArchived && q.archived) continue;
    const entry = result.get(q.groupId) || { own: 0, total: 0 };
    entry.own += 1;
    entry.total += 1;
    result.set(q.groupId, entry);
  }

  // Precompute descendants
  for (const g of groups) {
    const desc = descendantIds(groups, g.id);
    let total = result.get(g.id)?.own || 0;
    for (const descId of desc) {
      total += result.get(descId)?.own || 0;
    }
    const entry = result.get(g.id)!;
    entry.total = total;
  }

  return result;
}
