import {
  Blueprint,
  RuleBlock,
  SourceExpr,
  QuotaLine,
  QuotaFilter,
} from '../../types/bank';
import { MAX_QUESTIONS } from '../examLimits';

/**
 * Traverses a source expression and collects all referenced group IDs.
 */
function collectSourceGroupIds(expr: SourceExpr, out: Set<string>): void {
  switch (expr.kind) {
    case 'group':
      out.add(expr.groupId);
      break;
    case 'all':
      break;
    case 'or':
    case 'and':
    case 'xor':
      for (const op of expr.operands) {
        collectSourceGroupIds(op, out);
      }
      break;
    case 'except':
      collectSourceGroupIds(expr.base, out);
      collectSourceGroupIds(expr.excluded, out);
      break;
  }
}

/**
 * Collects all group IDs and tag IDs referenced by a blueprint or rule block.
 */
export function collectReferences(
  target: Blueprint | RuleBlock | SourceExpr
): { groupIds: Set<string>; tagIds: Set<string> } {
  const groupIds = new Set<string>();
  const tagIds = new Set<string>();

  if ('blocks' in target) {
    // Blueprint
    for (const b of target.blocks) {
      collectSourceGroupIds(b.source, groupIds);
      for (const q of b.quotas) {
        for (const tid of q.filter.tagIds) tagIds.add(tid);
        for (const tid of q.filter.notTagIds) tagIds.add(tid);
      }
    }
  } else if ('quotas' in target) {
    // RuleBlock
    collectSourceGroupIds(target.source, groupIds);
    for (const q of target.quotas) {
      for (const tid of q.filter.tagIds) tagIds.add(tid);
      for (const tid of q.filter.notTagIds) tagIds.add(tid);
    }
  } else {
    // SourceExpr
    collectSourceGroupIds(target, groupIds);
  }

  return { groupIds, tagIds };
}

export interface BrokenReferences {
  broken: boolean;
  missingGroups: string[];
  missingTags: string[];
}

/**
 * Detects whether any group or tag referenced in a blueprint has been deleted.
 */
export function detectBrokenReferences(
  bp: Blueprint,
  validGroupIds: ReadonlySet<string>,
  validTagIds: ReadonlySet<string>
): BrokenReferences {
  const { groupIds, tagIds } = collectReferences(bp);
  const missingGroups: string[] = [];
  const missingTags: string[] = [];

  for (const gid of groupIds) {
    if (!validGroupIds.has(gid)) {
      missingGroups.push(gid);
    }
  }

  for (const tid of tagIds) {
    if (!validTagIds.has(tid)) {
      missingTags.push(tid);
    }
  }

  return {
    broken: missingGroups.length > 0 || missingTags.length > 0,
    missingGroups,
    missingTags,
  };
}

/**
 * Recursively normalizes a SourceExpr:
 * - Flattens associative operators of the same kind (e.g. (A or B) or C -> A or B or C)
 * - Collapses 1-ary operators to the single operand
 * - Handles empty operands by defaulting to 'all'
 */
export function normalizeSourceExpr(expr: SourceExpr): SourceExpr {
  switch (expr.kind) {
    case 'group':
    case 'all':
      return { ...expr };

    case 'or':
    case 'and':
    case 'xor': {
      const flattened: SourceExpr[] = [];
      for (const rawOp of expr.operands) {
        const op = normalizeSourceExpr(rawOp);
        if (op.kind === expr.kind) {
          flattened.push(...op.operands);
        } else {
          flattened.push(op);
        }
      }

      if (flattened.length === 0) {
        return { kind: 'all' };
      }
      if (flattened.length === 1) {
        return flattened[0];
      }
      return { kind: expr.kind, operands: flattened };
    }

    case 'except': {
      const base = normalizeSourceExpr(expr.base);
      const excluded = normalizeSourceExpr(expr.excluded);
      return { kind: 'except', base, excluded };
    }
  }
}

/**
 * Normalizes a quota line (sorts tag sets, trims properties).
 */
export function normalizeQuotaLine(line: QuotaLine): QuotaLine {
  return {
    ...line,
    filter: {
      tagIds: Array.from(new Set(line.filter.tagIds)).sort(),
      notTagIds: Array.from(new Set(line.filter.notTagIds)).sort(),
      type: line.filter.type,
    },
  };
}

/**
 * Normalizes an entire blueprint.
 */
export function normalizeBlueprint(bp: Blueprint): Blueprint {
  return {
    ...bp,
    name: bp.name.trim(),
    description: bp.description?.trim(),
    blocks: bp.blocks.map((b) => ({
      ...b,
      source: normalizeSourceExpr(b.source),
      quotas: b.quotas.map(normalizeQuotaLine),
    })),
  };
}

/**
 * Checks whether a rule block can be represented in the visual rule builder.
 * Flat form:
 * - source is leaf (group/all), or
 * - source is a single operator (or/and/xor) over leaves,
 * - optionally followed by except with a single group leaf or an or of group leaves.
 */
export function isVisuallyRepresentable(block: RuleBlock): boolean {
  function isLeaf(s: SourceExpr): boolean {
    return s.kind === 'group' || s.kind === 'all';
  }

  function isGroupLeaf(s: SourceExpr): boolean {
    return s.kind === 'group';
  }

  function isFlatBase(s: SourceExpr): boolean {
    if (isLeaf(s)) return true;
    if (s.kind === 'or' || s.kind === 'and' || s.kind === 'xor') {
      return s.operands.every(isLeaf);
    }
    return false;
  }

  function isFlatExcluded(s: SourceExpr): boolean {
    if (isGroupLeaf(s)) return true;
    if (s.kind === 'or') {
      return s.operands.every(isGroupLeaf);
    }
    return false;
  }

  const s = normalizeSourceExpr(block.source);

  if (s.kind === 'except') {
    return isFlatBase(s.base) && isFlatExcluded(s.excluded);
  }

  return isFlatBase(s);
}

export interface BlueprintValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a blueprint structure, references, limits, and points.
 */
export function validateBlueprint(
  bp: Blueprint,
  options?: {
    maxQuestions?: number;
    validGroupIds?: ReadonlySet<string>;
    validTagIds?: ReadonlySet<string>;
  }
): BlueprintValidationResult {
  const errors: string[] = [];
  const maxQ = options?.maxQuestions ?? MAX_QUESTIONS;

  if (!bp.name || !bp.name.trim()) {
    errors.push('O nome do modelo de prova não pode ser vazio.');
  }

  if (!bp.blocks || bp.blocks.length === 0) {
    errors.push('O modelo de prova deve conter pelo menos um bloco de regras.');
    return { valid: false, errors };
  }

  let totalQuestions = 0;

  bp.blocks.forEach((block, bIdx) => {
    const blockLabel = `Bloco ${bIdx + 1}`;

    if (block.points !== undefined) {
      if (typeof block.points !== 'number' || block.points <= 0) {
        errors.push(`${blockLabel}: Os pontos do bloco devem ser um número positivo.`);
      }
    }

    if (!block.quotas || block.quotas.length === 0) {
      errors.push(`${blockLabel}: O bloco deve conter pelo menos uma linha de cota.`);
      return;
    }

    block.quotas.forEach((line, lIdx) => {
      const lineLabel = `${blockLabel}, Linha ${lIdx + 1}`;

      if (!Number.isInteger(line.count) || line.count < 1 || line.count > maxQ) {
        errors.push(`${lineLabel}: A quantidade de questões deve ser um número inteiro entre 1 e ${maxQ}.`);
      } else {
        totalQuestions += line.count;
      }

      if (line.points !== undefined) {
        if (typeof line.points !== 'number' || line.points <= 0) {
          errors.push(`${lineLabel}: A pontuação da linha deve ser um número positivo.`);
        }
      }

      // Check overlap between tagIds and notTagIds
      const tagSet = new Set(line.filter.tagIds);
      for (const notTag of line.filter.notTagIds) {
        if (tagSet.has(notTag)) {
          errors.push(`${lineLabel}: A etiqueta não pode estar incluída e excluída ao mesmo tempo.`);
          break;
        }
      }
    });
  });

  if (totalQuestions > maxQ) {
    errors.push(`A soma total de questões (${totalQuestions}) excede o limite máximo de ${maxQ} questões por prova.`);
  }

  if (options?.validGroupIds || options?.validTagIds) {
    const broken = detectBrokenReferences(
      bp,
      options.validGroupIds || new Set(),
      options.validTagIds || new Set()
    );
    if (broken.missingGroups.length > 0) {
      errors.push(`O modelo referencia ${broken.missingGroups.length} grupo(s) excluído(s).`);
    }
    if (broken.missingTags.length > 0) {
      errors.push(`O modelo referencia ${broken.missingTags.length} etiqueta(s) excluída(s).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
