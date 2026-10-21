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
import { mulberry32, shuffle } from '../prng';

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
 * Precomputes lookup of groupId -> Set containing groupId and all its descendant group IDs.
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

  if (line.filter.tagIds.length > 0) {
    const qTags = new Set(q.tagIds);
    for (const tid of line.filter.tagIds) {
      if (!qTags.has(tid)) return false;
    }
  }

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
 * Performs static availability analysis of a blueprint.
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

export interface FlowLine {
  id: string;
  blockId: string;
  demand: number;
  candidates: string[];
}

export interface MatchingResult {
  matchedCount: number;
  totalDemand: number;
  assignment: Map<string, string[]>;
  questionAssignment: Map<string, string>;
  hallViolatedLineIds?: string[];
}

/**
 * Solves maximum bipartite matching with line capacities using augmenting paths.
 * Explores candidate edges in randomized order driven by prng.
 */
export function solveBipartiteMatching(
  lines: FlowLine[],
  preAssignments?: ReadonlyArray<{ questionId: string; lineId: string }>,
  prng?: () => number
): MatchingResult {
  const assignment = new Map<string, string[]>();
  const questionToLine = new Map<string, string>();
  const lockedQuestions = new Set<string>();

  for (const line of lines) {
    assignment.set(line.id, []);
  }

  // Pre-assign locked/witness questions
  if (preAssignments) {
    for (const lock of preAssignments) {
      const line = lines.find((l) => l.id === lock.lineId);
      if (line) {
        assignment.get(line.id)!.push(lock.questionId);
        questionToLine.set(lock.questionId, line.id);
        lockedQuestions.add(lock.questionId);
      }
    }
  }

  // Shuffle candidates for each line if prng is provided
  const candidateLists = new Map<string, string[]>();
  for (const line of lines) {
    const list = prng ? shuffle(line.candidates, prng) : [...line.candidates];
    candidateLists.set(line.id, list);
  }

  // Augmenting path search
  function findAugmentingPath(
    startLineId: string
  ): Array<{ lineId: string; questionId: string }> | null {
    const visitedLines = new Set<string>([startLineId]);
    const visitedQuestions = new Set<string>();
    const prevLine = new Map<string, string>();
    const prevQuestion = new Map<string, string>();

    const queue: string[] = [startLineId];

    while (queue.length > 0) {
      const currLineId = queue.shift()!;
      const cands = candidateLists.get(currLineId) || [];

      for (const qId of cands) {
        if (visitedQuestions.has(qId)) continue;
        if (lockedQuestions.has(qId)) continue;

        visitedQuestions.add(qId);
        prevLine.set(qId, currLineId);

        const assignedLineId = questionToLine.get(qId);
        if (!assignedLineId) {
          // Found augmenting path to unassigned question!
          const path: Array<{ lineId: string; questionId: string }> = [];
          let traceQ: string | undefined = qId;
          while (traceQ) {
            const lId = prevLine.get(traceQ)!;
            path.push({ lineId: lId, questionId: traceQ });
            traceQ = prevQuestion.get(lId);
          }
          return path.reverse();
        } else if (!visitedLines.has(assignedLineId)) {
          visitedLines.add(assignedLineId);
          prevQuestion.set(assignedLineId, qId);
          queue.push(assignedLineId);
        }
      }
    }

    return null;
  }

  // Augment until each line's demand is satisfied
  for (const line of lines) {
    while ((assignment.get(line.id)?.length || 0) < line.demand) {
      const path = findAugmentingPath(line.id);
      if (!path) break;

      for (const step of path) {
        const oldLineId = questionToLine.get(step.questionId);
        if (oldLineId) {
          const oldList = assignment.get(oldLineId)!;
          const idx = oldList.indexOf(step.questionId);
          if (idx !== -1) oldList.splice(idx, 1);
        }
        assignment.get(step.lineId)!.push(step.questionId);
        questionToLine.set(step.questionId, step.lineId);
      }
    }
  }

  let matchedCount = 0;
  let totalDemand = 0;
  for (const line of lines) {
    matchedCount += assignment.get(line.id)?.length || 0;
    totalDemand += line.demand;
  }

  if (matchedCount === totalDemand) {
    return { matchedCount, totalDemand, assignment, questionAssignment: questionToLine };
  }

  // Find minimal Hall violation subset
  const underSatisfied = lines.filter(
    (l) => (assignment.get(l.id)?.length || 0) < l.demand
  );

  const reachableLines = new Set<string>();
  const visitedQ = new Set<string>();
  const qQueue: string[] = [];

  for (const l of underSatisfied) {
    reachableLines.add(l.id);
    qQueue.push(l.id);
  }

  while (qQueue.length > 0) {
    const lId = qQueue.shift()!;
    const cands = candidateLists.get(lId) || [];
    for (const qId of cands) {
      if (visitedQ.has(qId)) continue;
      visitedQ.add(qId);
      const assignedL = questionToLine.get(qId);
      if (assignedL && !reachableLines.has(assignedL)) {
        reachableLines.add(assignedL);
        qQueue.push(assignedL);
      }
    }
  }

  let hallLines = Array.from(reachableLines);
  hallLines.sort();
  // Greedy minimization: drop lines as long as Hall violation condition holds
  for (let i = hallLines.length - 1; i >= 0; i--) {
    const testSet = hallLines.filter((_, idx) => idx !== i);
    if (testSet.length === 0) continue;
    const testDemand = lines
      .filter((l) => testSet.includes(l.id))
      .reduce((sum, l) => sum + l.demand, 0);
    const testCandidates = new Set<string>();
    for (const l of lines) {
      if (testSet.includes(l.id)) {
        for (const cid of l.candidates) {
          if (!lockedQuestions.has(cid)) testCandidates.add(cid);
        }
      }
    }
    if (testCandidates.size < testDemand) {
      hallLines = testSet;
    }
  }
  hallLines.sort();

  return {
    matchedCount,
    totalDemand,
    assignment,
    questionAssignment: questionToLine,
    hallViolatedLineIds: hallLines,
  };
}

/**
 * Represents an XOR node in a blueprint with its block ID, path, and operands.
 */
interface XorNode {
  blockId: string;
  path: number[];
  operands: SourceExpr[];
}

function findXorNodesInExpr(
  expr: SourceExpr,
  blockId: string,
  path: number[],
  out: XorNode[]
): void {
  if (expr.kind === 'xor') {
    out.push({ blockId, path, operands: expr.operands });
  } else if (expr.kind === 'or' || expr.kind === 'and') {
    expr.operands.forEach((op, idx) => {
      findXorNodesInExpr(op, blockId, [...path, idx], out);
    });
  } else if (expr.kind === 'except') {
    findXorNodesInExpr(expr.base, blockId, [...path, 0], out);
    findXorNodesInExpr(expr.excluded, blockId, [...path, 1], out);
  }
}

function replaceXorNodeInExpr(
  expr: SourceExpr,
  path: number[],
  chosenOperand: SourceExpr
): SourceExpr {
  if (path.length === 0) {
    return chosenOperand;
  }
  const [head, ...tail] = path;
  if (expr.kind === 'xor' || expr.kind === 'or' || expr.kind === 'and') {
    const nextOps = expr.operands.map((op, idx) =>
      idx === head ? replaceXorNodeInExpr(op, tail, chosenOperand) : op
    );
    return { ...expr, operands: nextOps };
  }
  if (expr.kind === 'except') {
    if (head === 0) {
      return { ...expr, base: replaceXorNodeInExpr(expr.base, tail, chosenOperand) };
    }
    return { ...expr, excluded: replaceXorNodeInExpr(expr.excluded, tail, chosenOperand) };
  }
  return expr;
}

/**
 * Solves a blueprint that has had any XOR expressions specialized to concrete branches.
 */
function solveSpecializedBlueprint(
  input: GenerateInput,
  specializedBlueprint: Blueprint,
  prng: () => number
): GenerateResult {
  const { groups, tags, questions, seed, excludeQuestionIds, locked = [] } = input;

  // 1. Static availability analysis
  const analysis = analyzeBlueprint({
    groups,
    tags,
    questions,
    blueprint: specializedBlueprint,
    excludeQuestionIds,
  });

  if (analysis.failures.length > 0) {
    return { ok: false, failures: analysis.failures };
  }

  // 2. Validate locked questions
  const lockedPreAssign: Array<{ questionId: string; lineId: string }> = [];
  const lockedQIds = new Set<string>();

  for (const lock of locked) {
    if (lockedQIds.has(lock.questionId)) {
      // Duplicate question lock
      return {
        ok: false,
        failures: [
          {
            code: 'line_shortfall',
            blockId: '',
            lineId: lock.lineId,
            needed: 1,
            available: 0,
          },
        ],
      };
    }
    const cands = analysis.lineCandidates.get(lock.lineId);
    if (!cands || !cands.includes(lock.questionId)) {
      // Question not eligible for locked line
      return {
        ok: false,
        failures: [
          {
            code: 'line_shortfall',
            blockId: '',
            lineId: lock.lineId,
            needed: 1,
            available: 0,
          },
        ],
      };
    }
    lockedQIds.add(lock.questionId);
    lockedPreAssign.push(lock);
  }

  // 3. Prepare FlowLines
  const lines: FlowLine[] = [];
  for (const block of specializedBlueprint.blocks) {
    for (const line of block.quotas) {
      lines.push({
        id: line.id,
        blockId: block.id,
        demand: line.count,
        candidates: analysis.lineCandidates.get(line.id) || [],
      });
    }
  }

  // 4. Handle AND Coverage via Witness Selection
  const groupDescendants = buildGroupDescendantLookup(groups);
  const questionsById = new Map<string, BankQuestion>();
  for (const q of questions) questionsById.set(q.id, q);

  interface CoverageRequirement {
    blockId: string;
    operandIndex: number;
    operandExpr: SourceExpr;
    satisfied: boolean;
  }

  const coverageRequirements: CoverageRequirement[] = [];
  for (const block of specializedBlueprint.blocks) {
    if (block.source.kind === 'and') {
      block.source.operands.forEach((op, opIdx) => {
        const satisfied = lockedPreAssign.some((lock) => {
          const lObj = lines.find((l) => l.id === lock.lineId);
          if (lObj?.blockId !== block.id) return false;
          const q = questionsById.get(lock.questionId);
          return q ? matchesSourceExpr(q, op, groupDescendants) : false;
        });
        coverageRequirements.push({
          blockId: block.id,
          operandIndex: opIdx,
          operandExpr: op,
          satisfied,
        });
      });
    }
  }

  // Backtracking witness selection for remaining coverage requirements
  function selectWitnesses(
    reqIndex: number,
    currentPreAssign: Array<{ questionId: string; lineId: string }>,
    usedQIds: Set<string>
  ): Array<{ questionId: string; lineId: string }> | null {
    if (reqIndex >= coverageRequirements.length) {
      return currentPreAssign;
    }

    const req = coverageRequirements[reqIndex];
    if (req.satisfied) {
      return selectWitnesses(reqIndex + 1, currentPreAssign, usedQIds);
    }

    const blockLines = lines.filter((l) => l.blockId === req.blockId);
    const candidateWitnesses: Array<{ qId: string; lineId: string }> = [];

    for (const l of blockLines) {
      const alreadyAssigned = currentPreAssign.filter((p) => p.lineId === l.id).length;
      if (alreadyAssigned >= l.demand) continue;

      for (const qId of l.candidates) {
        if (usedQIds.has(qId)) continue;
        const q = questionsById.get(qId);
        if (q && matchesSourceExpr(q, req.operandExpr, groupDescendants)) {
          candidateWitnesses.push({ qId, lineId: l.id });
        }
      }
    }

    if (candidateWitnesses.length === 0) {
      return null;
    }

    const shuffledWitnesses = shuffle(candidateWitnesses, prng);

    for (const w of shuffledWitnesses) {
      const nextPreAssign = [...currentPreAssign, { questionId: w.qId, lineId: w.lineId }];
      const nextUsed = new Set(usedQIds);
      nextUsed.add(w.qId);

      const quickCheck = solveBipartiteMatching(lines, nextPreAssign);
      if (quickCheck.matchedCount < quickCheck.totalDemand) {
        continue;
      }

      const qObj = questionsById.get(w.qId)!;
      for (let j = reqIndex + 1; j < coverageRequirements.length; j++) {
        const nextReq = coverageRequirements[j];
        if (
          nextReq.blockId === req.blockId &&
          !nextReq.satisfied &&
          matchesSourceExpr(qObj, nextReq.operandExpr, groupDescendants)
        ) {
          nextReq.satisfied = true;
        }
      }

      const res = selectWitnesses(reqIndex + 1, nextPreAssign, nextUsed);
      if (res) return res;
    }

    return null;
  }

  const witnessPreAssignments = selectWitnesses(
    0,
    [...lockedPreAssign],
    new Set(lockedQIds)
  );

  if (coverageRequirements.length > 0 && !witnessPreAssignments) {
    const firstUnsat = coverageRequirements.find((r) => !r.satisfied);
    return {
      ok: false,
      failures: [
        {
          code: 'coverage_unsatisfiable',
          blockId: firstUnsat?.blockId || specializedBlueprint.blocks[0].id,
          operandIndex: firstUnsat?.operandIndex || 0,
        },
      ],
    };
  }

  // 5. Run full bipartite matching
  const finalMatching = solveBipartiteMatching(
    lines,
    witnessPreAssignments || lockedPreAssign,
    prng
  );

  if (finalMatching.matchedCount < finalMatching.totalDemand) {
    const hallLines = finalMatching.hallViolatedLineIds || [];
    if (hallLines.length === 1) {
      const l = lines.find((x) => x.id === hallLines[0])!;
      return {
        ok: false,
        failures: [
          {
            code: 'line_shortfall',
            blockId: l.blockId,
            lineId: l.id,
            needed: l.demand,
            available: l.candidates.length,
          },
        ],
      };
    }
    const needed = lines
      .filter((l) => hallLines.includes(l.id))
      .reduce((sum, l) => sum + l.demand, 0);
    const availSet = new Set<string>();
    for (const l of lines) {
      if (hallLines.includes(l.id)) {
        for (const cid of l.candidates) availSet.add(cid);
      }
    }
    return {
      ok: false,
      failures: [
        {
          code: 'joint_shortfall',
          lineIds: hallLines,
          needed,
          available: availSet.size,
        },
      ],
    };
  }

  // 6. Build picks
  const picks: Pick[] = [];
  for (const block of specializedBlueprint.blocks) {
    for (const line of block.quotas) {
      const qIds = finalMatching.assignment.get(line.id) || [];
      for (const qId of qIds) {
        const qObj = questionsById.get(qId)!;
        const points =
          line.points !== undefined
            ? line.points
            : block.points !== undefined
            ? block.points
            : qObj.points;
        picks.push({
          questionId: qId,
          blockId: block.id,
          lineId: line.id,
          points,
        });
      }
    }
  }

  return {
    ok: true,
    seed,
    picks,
    xorChoices: {},
  };
}

/**
 * Main generator entry point:
 * - Deterministic seeded PRNG (mulberry32)
 * - Resolves XOR nodes (up to 256 combinations)
 * - Checks coverage (AND) and line quotas with max flow
 * - Returns picks or detailed failure reasons
 */
export function generateFromBlueprint(input: GenerateInput): GenerateResult {
  const prng = mulberry32(input.seed);

  // Find all XOR nodes in the blueprint
  const xorNodes: XorNode[] = [];
  input.blueprint.blocks.forEach((b) => {
    findXorNodesInExpr(b.source, b.id, [], xorNodes);
  });

  if (xorNodes.length === 0) {
    return solveSpecializedBlueprint(input, input.blueprint, prng);
  }

  // Build cartesian product of XOR choices
  let combinations: number[][] = [[]];
  for (const node of xorNodes) {
    const nextCombos: number[][] = [];
    for (const prev of combinations) {
      for (let i = 0; i < node.operands.length; i++) {
        nextCombos.push([...prev, i]);
      }
    }
    combinations = nextCombos;
    if (combinations.length > 256) {
      break;
    }
  }

  // Shuffle combinations using prng
  const shuffledCombinations = shuffle(combinations.slice(0, 256), prng);

  for (const combo of shuffledCombinations) {
    let specializedBlocks = [...input.blueprint.blocks];
    const xorChoices: Record<string, number> = {};

    xorNodes.forEach((node, nodeIdx) => {
      const choiceIdx = combo[nodeIdx];
      xorChoices[`${node.blockId}:${node.path.join('.')}`] = choiceIdx;
      const chosenOp = node.operands[choiceIdx];
      specializedBlocks = specializedBlocks.map((b) => {
        if (b.id !== node.blockId) return b;
        return {
          ...b,
          source: replaceXorNodeInExpr(b.source, node.path, chosenOp),
        };
      });
    });

    const specializedBp: Blueprint = {
      ...input.blueprint,
      blocks: specializedBlocks,
    };

    const result = solveSpecializedBlueprint(input, specializedBp, prng);
    if (result.ok) {
      return {
        ...result,
        xorChoices,
      };
    }
  }

  return {
    ok: false,
    failures: [
      {
        code: 'xor_no_feasible_branch',
        blockId: xorNodes[0]?.blockId || input.blueprint.blocks[0]?.id || '',
      },
    ],
  };
}

export interface FailureDescribeContext {
  blueprint: Blueprint;
  groupsById?: Map<string, BankGroup>;
  tagsById?: Map<string, BankTag>;
}

/**
 * Converts a GenerateFailure to clear, helpful user-facing pt-BR copy.
 */
export function describeFailure(
  failure: GenerateFailure,
  ctx: FailureDescribeContext
): string {
  const { blueprint } = ctx;

  function findBlock(blockId: string): { block: RuleBlock; index: number } | null {
    const idx = blueprint.blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return null;
    return { block: blueprint.blocks[idx], index: idx };
  }

  function findLine(
    blockId: string,
    lineId: string
  ): { line: QuotaLine; blockIndex: number; lineIndex: number } | null {
    const bInfo = findBlock(blockId);
    if (!bInfo) return null;
    const lIdx = bInfo.block.quotas.findIndex((q) => q.id === lineId);
    if (lIdx === -1) return null;
    return { line: bInfo.block.quotas[lIdx], blockIndex: bInfo.index, lineIndex: lIdx };
  }

  switch (failure.code) {
    case 'empty_blueprint':
      return 'O modelo de prova está vazio ou não possui questões a gerar.';

    case 'broken_reference':
      if (failure.kind === 'group') {
        return `O grupo referenciado (ID: "${failure.id}") foi excluído ou não existe.`;
      }
      return `A etiqueta referenciada (ID: "${failure.id}") foi excluída ou não existe.`;

    case 'over_limit':
      return `O total de ${failure.total} questões excede o limite máximo de ${failure.max} questões por prova.`;

    case 'line_shortfall': {
      const lInfo = findLine(failure.blockId, failure.lineId);
      const label = lInfo
        ? `Bloco ${lInfo.blockIndex + 1}, Linha ${lInfo.lineIndex + 1}`
        : 'Linha de cota';
      return `${label}: necessárias ${failure.needed} questões, mas apenas ${failure.available} estão disponíveis no banco.`;
    }

    case 'joint_shortfall': {
      const lineLabels = failure.lineIds.map((lId) => {
        for (let bIdx = 0; bIdx < blueprint.blocks.length; bIdx++) {
          const b = blueprint.blocks[bIdx];
          const lIdx = b.quotas.findIndex((q) => q.id === lId);
          if (lIdx !== -1) {
            return `Bloco ${bIdx + 1} Linha ${lIdx + 1}`;
          }
        }
        return lId;
      });
      return `Conflito entre as cotas (${lineLabels.join(', ')}): necessárias ${failure.needed} questões no total, mas há apenas ${failure.available} questões distintas disponíveis para atender a esse conjunto conjuntamente.`;
    }

    case 'coverage_unsatisfiable': {
      const bInfo = findBlock(failure.blockId);
      const blockLabel = bInfo ? `Bloco ${bInfo.index + 1}` : 'Bloco';
      return `${blockLabel}: a condição de cobertura (E) para a origem ${failure.operandIndex + 1} não pode ser satisfeita com as questões disponíveis.`;
    }

    case 'xor_no_feasible_branch': {
      const bInfo = findBlock(failure.blockId);
      const blockLabel = bInfo ? `Bloco ${bInfo.index + 1}` : 'Bloco';
      return `${blockLabel}: nenhuma das alternativas da regra exclusiva (XOU) possui questões suficientes para gerar a prova.`;
    }
  }
}
