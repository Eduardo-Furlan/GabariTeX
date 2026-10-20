import {
  BankGroup,
  BankTag,
  BankQuestion,
  Blueprint,
  SourceExpr,
  RuleBlock,
  QuotaLine,
} from '../../types/bank';
import { MAX_QUESTIONS } from '../examLimits';
import { descendantIds } from './tree';
import { collectReferences } from './blueprint';

export interface GenerateInput {
  groups: BankGroup[];
  tags: BankTag[];
  questions: BankQuestion[];
  blueprint: Blueprint;
  seed: number;
  excludeQuestionIds?: ReadonlySet<string>;
  locked?: ReadonlyArray<{ questionId: string; lineId: string }>;
}

export interface Pick {
  questionId: string;
  blockId: string;
  lineId: string;
  points: number;
}

export type GenerateFailure =
  | { code: 'empty_blueprint' }
  | { code: 'broken_reference'; kind: 'group' | 'tag'; id: string }
  | { code: 'over_limit'; total: number; max: number }
  | { code: 'line_shortfall'; blockId: string; lineId: string; needed: number; available: number }
  | { code: 'joint_shortfall'; lineIds: string[]; needed: number; available: number }
  | { code: 'coverage_unsatisfiable'; blockId: string; operandIndex: number }
  | { code: 'xor_no_feasible_branch'; blockId: string };

export type GenerateResult =
  | { ok: true; seed: number; picks: Pick[]; xorChoices: Record<string, number> }
  | { ok: false; failures: GenerateFailure[] };

export interface BlueprintAnalysis {
  lineAvailability: Map<string, number>;
  lineCandidates: Map<string, string[]>;
  totalNeeded: number;
  failures: GenerateFailure[];
}

/**
 * Helper to precompute a lookup of groupId -> Set containing groupId and all its descendant group IDs.
 */
export function buildGroupDescendantLookup(
  groups: readonly BankGroup[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const g of groups) {
    const desc = descendantIds(groups, g.id);
    desc.add(g.id);
    map.set(g.id, desc);
  }
  return map;
}

/**
 * Tests whether a question matches a SourceExpr.
 */
export function matchesSourceExpr(
  q: BankQuestion,
  expr: SourceExpr,
  groupDescendants: Map<string, Set<string>>
): boolean {
  switch (expr.kind) {
    case 'group': {
      if (!q.groupId) return false;
      if (expr.descendants) {
        const set = groupDescendants.get(expr.groupId);
        return set ? set.has(q.groupId) : q.groupId === expr.groupId;
      }
      return q.groupId === expr.groupId;
    }

    case 'all':
      return true;

    case 'or':
    case 'and':
    case 'xor': {
      // In set membership, or, and, xor all represent the union of candidate pools.
      // (The AND coverage constraint and XOR single-branch selection are handled during solving.)
      return expr.operands.some((op) => matchesSourceExpr(q, op, groupDescendants));
    }

    case 'except': {
      return (
        matchesSourceExpr(q, expr.base, groupDescendants) &&
        !matchesSourceExpr(q, expr.excluded, groupDescendants)
      );
    }
  }
}

/**
 * Tests whether a question matches a quota line filter.
 */
export function matchesQuotaFilter(
  q: BankQuestion,
  line: QuotaLine
): boolean {
  if (line.filter.type && q.type !== line.filter.type) {
    return false;
  }

  // Tag intersection: question must have ALL tagIds
  if (line.filter.tagIds.length > 0) {
    const qTags = new Set(q.tagIds);
    for (const tid of line.filter.tagIds) {
      if (!qTags.has(tid)) return false;
    }
  }

  // Tag exclusion: question must have NONE of notTagIds
  if (line.filter.notTagIds.length > 0) {
    const qTags = new Set(q.tagIds);
    for (const tid of line.filter.notTagIds) {
      if (qTags.has(tid)) return false;
    }
  }

  return true;
}

/**
 * Returns the pool of eligible questions for a block.
 */
export function getBlockPool(
  questions: readonly BankQuestion[],
  block: RuleBlock,
  groupDescendants: Map<string, Set<string>>,
  excludeQuestionIds?: ReadonlySet<string>
): BankQuestion[] {
  return questions.filter((q) => {
    if (q.archived) return false;
    if (excludeQuestionIds && excludeQuestionIds.has(q.id)) return false;
    return matchesSourceExpr(q, block.source, groupDescendants);
  });
}

/**
 * Performs static availability analysis of a blueprint:
 * - Checks structural and reference failures (empty, broken reference, over limit)
 * - Computes candidate questions for each line
 * - Checks line shortfalls
 * - Checks coverage unsatisfiability for AND sources
 */
export function analyzeBlueprint(
  input: Omit<GenerateInput, 'seed' | 'locked'>
): BlueprintAnalysis {
  const { groups, tags, questions, blueprint, excludeQuestionIds } = input;
  const failures: GenerateFailure[] = [];

  // Deterministically sort questions by ID
  const sortedQuestions = [...questions].sort((a, b) => a.id.localeCompare(b.id));

  // 1. Check for empty blueprint
  if (!blueprint.blocks || blueprint.blocks.length === 0) {
    failures.push({ code: 'empty_blueprint' });
    return {
      lineAvailability: new Map(),
      lineCandidates: new Map(),
      totalNeeded: 0,
      failures,
    };
  }

  let totalNeeded = 0;
  for (const b of blueprint.blocks) {
    for (const q of b.quotas) {
      totalNeeded += q.count;
    }
  }

  if (totalNeeded === 0) {
    failures.push({ code: 'empty_blueprint' });
  }

  // 2. Check for broken references
  const validGroupIds = new Set(groups.map((g) => g.id));
  const validTagIds = new Set(tags.map((t) => t.id));
  const { groupIds: refGroupIds, tagIds: refTagIds } = collectReferences(blueprint);

  for (const gid of refGroupIds) {
    if (!validGroupIds.has(gid)) {
      failures.push({ code: 'broken_reference', kind: 'group', id: gid });
    }
  }

  for (const tid of refTagIds) {
    if (!validTagIds.has(tid)) {
      failures.push({ code: 'broken_reference', kind: 'tag', id: tid });
    }
  }

  // 3. Check for over limit
  if (totalNeeded > MAX_QUESTIONS) {
    failures.push({ code: 'over_limit', total: totalNeeded, max: MAX_QUESTIONS });
  }

  // 4. Calculate line availability and candidates
  const lineAvailability = new Map<string, number>();
  const lineCandidates = new Map<string, string[]>();
  const groupDescendants = buildGroupDescendantLookup(groups);

  for (const block of blueprint.blocks) {
    const blockPool = getBlockPool(
      sortedQuestions,
      block,
      groupDescendants,
      excludeQuestionIds
    );

    // Check AND coverage unsatisfiability:
    // If the block source is AND, every operand must have at least one question in blockPool
    // that satisfies at least one quota line in this block.
    if (block.source.kind === 'and') {
      block.source.operands.forEach((op, opIdx) => {
        const hasCoveringCandidate = blockPool.some(
          (q) =>
            matchesSourceExpr(q, op, groupDescendants) &&
            block.quotas.some((line) => matchesQuotaFilter(q, line))
        );
        if (!hasCoveringCandidate) {
          failures.push({
            code: 'coverage_unsatisfiable',
            blockId: block.id,
            operandIndex: opIdx,
          });
        }
      });
    }

    for (const line of block.quotas) {
      const candidates = blockPool
        .filter((q) => matchesQuotaFilter(q, line))
        .map((q) => q.id);

      lineAvailability.set(line.id, candidates.length);
      lineCandidates.set(line.id, candidates);

      if (candidates.length < line.count) {
        failures.push({
          code: 'line_shortfall',
          blockId: block.id,
          lineId: line.id,
          needed: line.count,
          available: candidates.length,
        });
      }
    }
  }

  return {
    lineAvailability,
    lineCandidates,
    totalNeeded,
    failures,
  };
}
