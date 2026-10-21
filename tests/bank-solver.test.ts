import { describe, it, expect } from 'vitest';
import {
  analyzeBlueprint,
  buildGroupDescendantLookup,
  matchesSourceExpr,
  matchesQuotaFilter,
  solveBipartiteMatching,
  generateFromBlueprint,
  describeFailure,
  GenerateInput,
  Pick,
} from '../src/utils/bank/solver';
import {
  BankGroup,
  BankTag,
  BankQuestion,
  Blueprint,
} from '../src/types/bank';

describe('Bank Solver - Availability Analysis (Phase 6 Step 1)', () => {
  const groups: BankGroup[] = [
    { id: 'g-root', name: 'Matemática', parentId: null, sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-geo', name: 'Geometria', parentId: 'g-root', sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-euclid', name: 'Euclidiana', parentId: 'g-geo', sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-alg', name: 'Álgebra', parentId: 'g-root', sortOrder: 1, createdAt: '', updatedAt: '' },
  ];

  const tags: BankTag[] = [
    { id: 't-easy', name: 'Fácil', color: 'emerald', createdAt: '', updatedAt: '' },
    { id: 't-hard', name: 'Difícil', color: 'rose', createdAt: '', updatedAt: '' },
    { id: 't-review', name: 'Revisar', color: 'amber', createdAt: '', updatedAt: '' },
  ];

  const questions: BankQuestion[] = [
    {
      id: 'q-1',
      groupId: 'g-euclid',
      type: 'objective',
      prompt: 'Q1 Euclidiana Fácil',
      points: 1,
      tagIds: ['t-easy'],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'q-2',
      groupId: 'g-euclid',
      type: 'objective',
      prompt: 'Q2 Euclidiana Difícil',
      points: 2,
      tagIds: ['t-hard'],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'q-3',
      groupId: 'g-geo',
      type: 'subjective',
      prompt: 'Q3 Geometria Geral Fácil',
      points: 3,
      tagIds: ['t-easy'],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'q-4',
      groupId: 'g-alg',
      type: 'objective',
      prompt: 'Q4 Álgebra Fácil',
      points: 1.5,
      tagIds: ['t-easy'],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'q-5',
      groupId: null,
      type: 'objective',
      prompt: 'Q5 Sem Grupo',
      points: 1,
      tagIds: ['t-review'],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'q-archived',
      groupId: 'g-euclid',
      type: 'objective',
      prompt: 'Q Arquivada',
      points: 1,
      tagIds: ['t-easy'],
      archived: true,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('correctly builds group descendant lookup with self included', () => {
    const lookup = buildGroupDescendantLookup(groups);
    expect(lookup.get('g-euclid')).toEqual(new Set(['g-euclid']));
    expect(lookup.get('g-geo')).toEqual(new Set(['g-geo', 'g-euclid']));
    expect(lookup.get('g-root')).toEqual(new Set(['g-root', 'g-geo', 'g-euclid', 'g-alg']));
  });

  it('matchesSourceExpr correctly resolves groups, descendants, all, and except', () => {
    const lookup = buildGroupDescendantLookup(groups);
    const q1 = questions[0];
    const q3 = questions[2];
    const q5 = questions[4];

    expect(matchesSourceExpr(q1, { kind: 'group', groupId: 'g-geo', descendants: true }, lookup)).toBe(true);
    expect(matchesSourceExpr(q1, { kind: 'group', groupId: 'g-geo', descendants: false }, lookup)).toBe(false);
    expect(matchesSourceExpr(q3, { kind: 'group', groupId: 'g-geo', descendants: false }, lookup)).toBe(true);
    expect(matchesSourceExpr(q5, { kind: 'all' }, lookup)).toBe(true);

    const exceptExpr = {
      kind: 'except' as const,
      base: { kind: 'group' as const, groupId: 'g-root', descendants: true },
      excluded: { kind: 'group' as const, groupId: 'g-alg', descendants: true },
    };
    expect(matchesSourceExpr(q1, exceptExpr, lookup)).toBe(true);
    expect(matchesSourceExpr(questions[3], exceptExpr, lookup)).toBe(false);
  });

  it('matchesQuotaFilter matches tagIds, notTagIds, and type', () => {
    const q1 = questions[0];
    expect(matchesQuotaFilter(q1, { id: 'l1', count: 1, filter: { tagIds: ['t-easy'], notTagIds: [] } })).toBe(true);
    expect(matchesQuotaFilter(q1, { id: 'l1', count: 1, filter: { tagIds: ['t-hard'], notTagIds: [] } })).toBe(false);
    expect(matchesQuotaFilter(q1, { id: 'l1', count: 1, filter: { tagIds: [], notTagIds: ['t-easy'] } })).toBe(false);
    expect(matchesQuotaFilter(q1, { id: 'l1', count: 1, filter: { tagIds: [], notTagIds: [], type: 'subjective' } })).toBe(false);
    expect(matchesQuotaFilter(q1, { id: 'l1', count: 1, filter: { tagIds: [], notTagIds: [], type: 'objective' } })).toBe(true);
  });

  it('detects empty blueprint failure', () => {
    const bpEmpty: Blueprint = {
      id: 'bp-1',
      name: 'Vazio',
      blocks: [],
      createdAt: '',
      updatedAt: '',
    };
    const res = analyzeBlueprint({ groups, tags, questions, blueprint: bpEmpty });
    expect(res.failures).toContainEqual({ code: 'empty_blueprint' });
  });

  it('detects broken reference failures for missing groups and tags', () => {
    const bpBroken: Blueprint = {
      id: 'bp-broken',
      name: 'Quebrado',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'group', groupId: 'non-existent-group', descendants: true },
          quotas: [
            {
              id: 'l1',
              count: 1,
              filter: { tagIds: ['non-existent-tag'], notTagIds: [] },
            },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const res = analyzeBlueprint({ groups, tags, questions, blueprint: bpBroken });
    expect(res.failures).toContainEqual({
      code: 'broken_reference',
      kind: 'group',
      id: 'non-existent-group',
    });
    expect(res.failures).toContainEqual({
      code: 'broken_reference',
      kind: 'tag',
      id: 'non-existent-tag',
    });
  });

  it('detects over limit failure when total needed questions exceeds 40', () => {
    const bpOver: Blueprint = {
      id: 'bp-over',
      name: 'Mais de 40',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'all' },
          quotas: [{ id: 'l1', count: 41, filter: { tagIds: [], notTagIds: [] } }],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const res = analyzeBlueprint({ groups, tags, questions, blueprint: bpOver });
    expect(res.failures).toContainEqual({ code: 'over_limit', total: 41, max: 40 });
  });

  it('detects line shortfall and excludes archived and excluded questions', () => {
    const bp: Blueprint = {
      id: 'bp-valid',
      name: 'Teste de Cota',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'group', groupId: 'g-euclid', descendants: true },
          quotas: [
            { id: 'l1', count: 3, filter: { tagIds: [], notTagIds: [] } },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const res = analyzeBlueprint({ groups, tags, questions, blueprint: bp });
    expect(res.failures).toContainEqual({
      code: 'line_shortfall',
      blockId: 'b1',
      lineId: 'l1',
      needed: 3,
      available: 2,
    });
    expect(res.lineAvailability.get('l1')).toBe(2);
    expect(res.lineCandidates.get('l1')).toEqual(['q-1', 'q-2']);

    const resWithExcluded = analyzeBlueprint({
      groups,
      tags,
      questions,
      blueprint: bp,
      excludeQuestionIds: new Set(['q-1']),
    });
    expect(resWithExcluded.lineAvailability.get('l1')).toBe(1);
    expect(resWithExcluded.lineCandidates.get('l1')).toEqual(['q-2']);
  });

  it('detects coverage unsatisfiability in AND source expressions', () => {
    const bpAnd: Blueprint = {
      id: 'bp-and',
      name: 'Cobertura Impossível',
      blocks: [
        {
          id: 'b1',
          source: {
            kind: 'and',
            operands: [
              { kind: 'group', groupId: 'g-euclid', descendants: true },
              { kind: 'group', groupId: 'g-alg', descendants: true },
            ],
          },
          quotas: [
            { id: 'l1', count: 1, filter: { tagIds: [], notTagIds: [], type: 'subjective' } },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const res = analyzeBlueprint({ groups, tags, questions, blueprint: bpAnd });
    expect(res.failures).toContainEqual({
      code: 'coverage_unsatisfiable',
      blockId: 'b1',
      operandIndex: 1,
    });
  });
});

describe('Bank Solver - Seeded Generation & Operators (Phase 6 Steps 2 & 3)', () => {
  const groups: BankGroup[] = [
    { id: 'g-geo', name: 'Geometria', parentId: null, sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-euclid', name: 'Euclidiana', parentId: 'g-geo', sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-hip', name: 'Hiperbólica', parentId: 'g-geo', sortOrder: 1, createdAt: '', updatedAt: '' },
  ];

  const tags: BankTag[] = [
    { id: 't-facil', name: 'Fácil', color: 'emerald', createdAt: '', updatedAt: '' },
    { id: 't-media', name: 'Média', color: 'blue', createdAt: '', updatedAt: '' },
    { id: 't-dificil', name: 'Difícil', color: 'rose', createdAt: '', updatedAt: '' },
  ];

  // 10 synthetic questions
  const questions: BankQuestion[] = [
    { id: 'q-e1', groupId: 'g-euclid', type: 'objective', prompt: 'E1', points: 1, tagIds: ['t-facil'], createdAt: '', updatedAt: '' },
    { id: 'q-e2', groupId: 'g-euclid', type: 'objective', prompt: 'E2', points: 1, tagIds: ['t-facil'], createdAt: '', updatedAt: '' },
    { id: 'q-e3', groupId: 'g-euclid', type: 'objective', prompt: 'E3', points: 2, tagIds: ['t-media'], createdAt: '', updatedAt: '' },
    { id: 'q-e4', groupId: 'g-euclid', type: 'objective', prompt: 'E4', points: 2, tagIds: ['t-media'], createdAt: '', updatedAt: '' },
    { id: 'q-e5', groupId: 'g-euclid', type: 'objective', prompt: 'E5', points: 3, tagIds: ['t-dificil'], createdAt: '', updatedAt: '' },
    { id: 'q-h1', groupId: 'g-hip', type: 'objective', prompt: 'H1', points: 1, tagIds: ['t-facil'], createdAt: '', updatedAt: '' },
    { id: 'q-h2', groupId: 'g-hip', type: 'objective', prompt: 'H2', points: 2, tagIds: ['t-media'], createdAt: '', updatedAt: '' },
    { id: 'q-h3', groupId: 'g-hip', type: 'objective', prompt: 'H3', points: 2, tagIds: ['t-media'], createdAt: '', updatedAt: '' },
    { id: 'q-h4', groupId: 'g-hip', type: 'objective', prompt: 'H4', points: 3, tagIds: ['t-dificil'], createdAt: '', updatedAt: '' },
    { id: 'q-h5', groupId: 'g-hip', type: 'objective', prompt: 'H5', points: 3, tagIds: ['t-dificil'], createdAt: '', updatedAt: '' },
  ];

  it('generates reproducible results given the same seed', () => {
    const bp: Blueprint = {
      id: 'bp-test',
      name: 'Teste Reprodutibilidade',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'group', groupId: 'g-geo', descendants: true },
          quotas: [
            { id: 'l1', count: 2, filter: { tagIds: ['t-facil'], notTagIds: [] } },
            { id: 'l2', count: 2, filter: { tagIds: ['t-media'], notTagIds: [] } },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const res1 = generateFromBlueprint({ groups, tags, questions, blueprint: bp, seed: 42 });
    const res2 = generateFromBlueprint({ groups, tags, questions, blueprint: bp, seed: 42 });
    const res3 = generateFromBlueprint({ groups, tags, questions, blueprint: bp, seed: 999 });

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (res1.ok && res2.ok && res3.ok) {
      expect(res1.picks).toEqual(res2.picks);
      // Different seed produces valid but different draw
      expect(res1.picks.map((p) => p.questionId)).not.toEqual(res3.picks.map((p) => p.questionId));
    }
  });

  it('resolves points precedence correctly: line > block > question', () => {
    const bp: Blueprint = {
      id: 'bp-points',
      name: 'Precedência de Pontos',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'group', groupId: 'g-euclid', descendants: true },
          points: 10, // block override
          quotas: [
            { id: 'l1', count: 1, filter: { tagIds: ['t-facil'], notTagIds: [] }, points: 25 }, // line override
            { id: 'l2', count: 1, filter: { tagIds: ['t-media'], notTagIds: [] } }, // falls back to block (10)
          ],
        },
        {
          id: 'b2',
          source: { kind: 'group', groupId: 'g-hip', descendants: true },
          // no block override
          quotas: [
            { id: 'l3', count: 1, filter: { tagIds: ['t-dificil'], notTagIds: [] } }, // falls back to question (3)
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const res = generateFromBlueprint({ groups, tags, questions, blueprint: bp, seed: 123 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const p1 = res.picks.find((p) => p.lineId === 'l1');
      const p2 = res.picks.find((p) => p.lineId === 'l2');
      const p3 = res.picks.find((p) => p.lineId === 'l3');

      expect(p1?.points).toBe(25); // line override wins
      expect(p2?.points).toBe(10); // block override wins
      expect(p3?.points).toBe(3);  // question default wins
    }
  });

  it('respects locked questions assignments', () => {
    const bp: Blueprint = {
      id: 'bp-lock',
      name: 'Teste Travamento',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'group', groupId: 'g-geo', descendants: true },
          quotas: [
            { id: 'l1', count: 2, filter: { tagIds: ['t-facil'], notTagIds: [] } },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Lock q-h1 to l1
    const res = generateFromBlueprint({
      groups,
      tags,
      questions,
      blueprint: bp,
      seed: 777,
      locked: [{ questionId: 'q-h1', lineId: 'l1' }],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.picks).toHaveLength(2);
      expect(res.picks.some((p) => p.questionId === 'q-h1' && p.lineId === 'l1')).toBe(true);
    }
  });

  it('handles AND coverage constraint by ensuring at least one question from each operand', () => {
    const bpAnd: Blueprint = {
      id: 'bp-and',
      name: 'Cobertura E',
      blocks: [
        {
          id: 'b1',
          source: {
            kind: 'and',
            operands: [
              { kind: 'group', groupId: 'g-euclid', descendants: true },
              { kind: 'group', groupId: 'g-hip', descendants: true },
            ],
          },
          quotas: [
            // Total 2 questions from the union of Euclidiana and Hiperbólica
            { id: 'l1', count: 2, filter: { tagIds: ['t-facil'], notTagIds: [] } },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Both Euclidiana and Hiperbólica must be represented in the 2 questions!
    const res = generateFromBlueprint({ groups, tags, questions, blueprint: bpAnd, seed: 101 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.picks).toHaveLength(2);
      const qIds = res.picks.map((p) => p.questionId);
      const hasEuclid = qIds.some((id) => id.startsWith('q-e'));
      const hasHip = qIds.some((id) => id.startsWith('q-h'));
      expect(hasEuclid).toBe(true);
      expect(hasHip).toBe(true);
    }
  });

  it('resolves XOR by selecting a feasible branch among alternatives', () => {
    const bpXor: Blueprint = {
      id: 'bp-xor',
      name: 'Escolha XOU',
      blocks: [
        {
          id: 'b1',
          source: {
            kind: 'xor',
            operands: [
              // Branch 0: g-hip, but needs 3 facil -> g-hip only has 1 facil! (Infeasible)
              { kind: 'group', groupId: 'g-hip', descendants: true },
              // Branch 1: g-euclid, has 2 facil -> still needs 3 -> infeasible
              // Wait, let's make Branch 1 have g-geo (3 facil total) -> Feasible!
              { kind: 'group', groupId: 'g-geo', descendants: true },
            ],
          },
          quotas: [
            { id: 'l1', count: 3, filter: { tagIds: ['t-facil'], notTagIds: [] } },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const res = generateFromBlueprint({ groups, tags, questions, blueprint: bpXor, seed: 42 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.picks).toHaveLength(3);
      // Branch 1 was selected because Branch 0 is infeasible
      expect(res.xorChoices['b1:']).toBe(1);
    }
  });

  it('fails with xor_no_feasible_branch when all XOR branches are infeasible', () => {
    const bpXorFail: Blueprint = {
      id: 'bp-xor-fail',
      name: 'XOU Impossível',
      blocks: [
        {
          id: 'b1',
          source: {
            kind: 'xor',
            operands: [
              { kind: 'group', groupId: 'g-euclid', descendants: true }, // has 2 facil
              { kind: 'group', groupId: 'g-hip', descendants: true },    // has 1 facil
            ],
          },
          quotas: [
            { id: 'l1', count: 3, filter: { tagIds: ['t-facil'], notTagIds: [] } },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const res = generateFromBlueprint({ groups, tags, questions, blueprint: bpXorFail, seed: 42 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failures).toContainEqual({ code: 'xor_no_feasible_branch', blockId: 'b1' });
    }
  });
});

describe('Bank Solver - Joint Shortfall & pt-BR Diagnostics (Phase 6 Step 5)', () => {
  const groups: BankGroup[] = [
    { id: 'g-root', name: 'Geral', parentId: null, sortOrder: 0, createdAt: '', updatedAt: '' },
  ];
  const tags: BankTag[] = [
    { id: 't-a', name: 'A', color: 'blue', createdAt: '', updatedAt: '' },
    { id: 't-b', name: 'B', color: 'emerald', createdAt: '', updatedAt: '' },
  ];

  // 3 questions that match both tag A and tag B
  const questions: BankQuestion[] = [
    { id: 'q1', groupId: 'g-root', type: 'objective', prompt: 'Q1', points: 1, tagIds: ['t-a', 't-b'], createdAt: '', updatedAt: '' },
    { id: 'q2', groupId: 'g-root', type: 'objective', prompt: 'Q2', points: 1, tagIds: ['t-a', 't-b'], createdAt: '', updatedAt: '' },
    { id: 'q3', groupId: 'g-root', type: 'objective', prompt: 'Q3', points: 1, tagIds: ['t-a', 't-b'], createdAt: '', updatedAt: '' },
  ];

  it('detects joint shortfall via Hall condition violation when individual lines pass but joint set fails', () => {
    const bp: Blueprint = {
      id: 'bp-joint',
      name: 'Conflito Conjunto',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'all' },
          quotas: [
            // Line 1 needs 2 questions with tag A (has 3 available: q1, q2, q3) -> Passes individual check!
            { id: 'l1', count: 2, filter: { tagIds: ['t-a'], notTagIds: [] } },
            // Line 2 needs 2 questions with tag B (has 3 available: q1, q2, q3) -> Passes individual check!
            { id: 'l2', count: 2, filter: { tagIds: ['t-b'], notTagIds: [] } },
          ],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Total needed = 4, but union of candidates = 3!
    const res = generateFromBlueprint({ groups, tags, questions, blueprint: bp, seed: 123 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failures).toContainEqual({
        code: 'joint_shortfall',
        lineIds: ['l1', 'l2'],
        needed: 4,
        available: 3,
      });

      // Check describeFailure pt-BR copy
      const msg = describeFailure(res.failures[0], { blueprint: bp });
      expect(msg).toContain('Conflito entre as cotas');
      expect(msg).toContain('necessárias 4 questões no total');
      expect(msg).toContain('apenas 3 questões distintas disponíveis');
    }
  });

  it('formats clear pt-BR descriptions for all failure types', () => {
    const bp: Blueprint = {
      id: 'bp-diag',
      name: 'Diagnósticos',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'all' },
          quotas: [{ id: 'l1', count: 5, filter: { tagIds: [], notTagIds: [] } }],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    expect(describeFailure({ code: 'empty_blueprint' }, { blueprint: bp })).toBe(
      'O modelo de prova está vazio ou não possui questões a gerar.'
    );
    expect(describeFailure({ code: 'broken_reference', kind: 'group', id: 'g-99' }, { blueprint: bp })).toBe(
      'O grupo referenciado (ID: "g-99") foi excluído ou não existe.'
    );
    expect(describeFailure({ code: 'over_limit', total: 42, max: 40 }, { blueprint: bp })).toBe(
      'O total de 42 questões excede o limite máximo de 40 questões por prova.'
    );
    expect(
      describeFailure(
        { code: 'line_shortfall', blockId: 'b1', lineId: 'l1', needed: 5, available: 2 },
        { blueprint: bp }
      )
    ).toContain('Bloco 1, Linha 1: necessárias 5 questões, mas apenas 2 estão disponíveis no banco.');
    expect(
      describeFailure(
        { code: 'coverage_unsatisfiable', blockId: 'b1', operandIndex: 0 },
        { blueprint: bp }
      )
    ).toContain('Bloco 1: a condição de cobertura (E) para a origem 1 não pode ser satisfeita');
    expect(
      describeFailure({ code: 'xor_no_feasible_branch', blockId: 'b1' }, { blueprint: bp })
    ).toContain('Bloco 1: nenhuma das alternativas da regra exclusiva (XOU) possui questões suficientes');
  });
});

describe('Bank Solver - Oracle and Distribution Tests (Phase 6 Step 4)', () => {
  it('passes distribution test: unbiased sampling over 2,000 seeds', () => {
    const groups: BankGroup[] = [
      { id: 'g1', name: 'G1', parentId: null, sortOrder: 0, createdAt: '', updatedAt: '' },
    ];
    const tags: BankTag[] = [];

    // 5 equivalent candidate questions
    const questions: BankQuestion[] = [
      { id: 'q1', groupId: 'g1', type: 'objective', prompt: 'Q1', points: 1, tagIds: [], createdAt: '', updatedAt: '' },
      { id: 'q2', groupId: 'g1', type: 'objective', prompt: 'Q2', points: 1, tagIds: [], createdAt: '', updatedAt: '' },
      { id: 'q3', groupId: 'g1', type: 'objective', prompt: 'Q3', points: 1, tagIds: [], createdAt: '', updatedAt: '' },
      { id: 'q4', groupId: 'g1', type: 'objective', prompt: 'Q4', points: 1, tagIds: [], createdAt: '', updatedAt: '' },
      { id: 'q5', groupId: 'g1', type: 'objective', prompt: 'Q5', points: 1, tagIds: [], createdAt: '', updatedAt: '' },
    ];

    const bp: Blueprint = {
      id: 'bp-dist',
      name: 'Distribuição',
      blocks: [
        {
          id: 'b1',
          source: { kind: 'all' },
          // Draw 2 questions out of 5
          quotas: [{ id: 'l1', count: 2, filter: { tagIds: [], notTagIds: [] } }],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const counts: Record<string, number> = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
    const TOTAL_RUNS = 2000;

    for (let seed = 1; seed <= TOTAL_RUNS; seed++) {
      const res = generateFromBlueprint({ groups, tags, questions, blueprint: bp, seed });
      expect(res.ok).toBe(true);
      if (res.ok) {
        for (const pick of res.picks) {
          counts[pick.questionId]++;
        }
      }
    }

    // Expected per question: 2000 * (2/5) = 800.
    // Generous tolerance [650, 950] guarantees deterministic non-flaky pass.
    for (const qId of ['q1', 'q2', 'q3', 'q4', 'q5']) {
      expect(counts[qId]).toBeGreaterThanOrEqual(650);
      expect(counts[qId]).toBeLessThanOrEqual(950);
    }
  });

  it('matches brute-force oracle across randomized small problem instances', () => {
    // Brute force solver for small instances
    function bruteForceFeasible(
      candMap: Map<string, string[]>,
      demands: Map<string, number>,
      lineIds: string[]
    ): boolean {
      const totalK = lineIds.reduce((sum, l) => sum + (demands.get(l) || 0), 0);
      const allQ = Array.from(new Set(Array.from(candMap.values()).flat()));

      // Helper to generate combinations of size K
      function combinations<T>(arr: T[], k: number): T[][] {
        if (k === 0) return [[]];
        if (arr.length < k) return [];
        const [head, ...tail] = arr;
        const withHead = combinations(tail, k - 1).map((c) => [head, ...c]);
        const withoutHead = combinations(tail, k);
        return [...withHead, ...withoutHead];
      }

      // Helper to test if subset Q_sub can be partitioned into lines
      function canPartition(qRemaining: Set<string>, lineIdx: number): boolean {
        if (lineIdx >= lineIds.length) {
          return qRemaining.size === 0;
        }
        const lId = lineIds[lineIdx];
        const need = demands.get(lId) || 0;
        const eligible = (candMap.get(lId) || []).filter((q) => qRemaining.has(q));
        if (eligible.length < need) return false;

        const subCombos = combinations(eligible, need);
        for (const combo of subCombos) {
          const nextRemaining = new Set(qRemaining);
          for (const q of combo) nextRemaining.delete(q);
          if (canPartition(nextRemaining, lineIdx + 1)) return true;
        }
        return false;
      }

      const qCombos = combinations(allQ, totalK);
      for (const combo of qCombos) {
        if (canPartition(new Set(combo), 0)) return true;
      }
      return false;
    }

    // Test 30 randomized small instances
    for (let testCase = 1; testCase <= 30; testCase++) {
      const numQuestions = 4 + (testCase % 5); // 4 to 8 questions
      const questionIds = Array.from({ length: numQuestions }, (_, i) => `q${i + 1}`);
      const lineIds = ['l1', 'l2'];
      const demands = new Map<string, number>([
        ['l1', 1 + (testCase % 2)],
        ['l2', 1 + ((testCase + 1) % 2)],
      ]);

      const candMap = new Map<string, string[]>();
      // Deterministically build candidate lists based on testCase
      candMap.set(
        'l1',
        questionIds.filter((_, idx) => (idx + testCase) % 2 === 0)
      );
      candMap.set(
        'l2',
        questionIds.filter((_, idx) => (idx + testCase * 2) % 3 !== 0)
      );

      const flowLines = [
        { id: 'l1', blockId: 'b1', demand: demands.get('l1')!, candidates: candMap.get('l1')! },
        { id: 'l2', blockId: 'b1', demand: demands.get('l2')!, candidates: candMap.get('l2')! },
      ];

      const oracleResult = bruteForceFeasible(candMap, demands, lineIds);
      const matchingResult = solveBipartiteMatching(flowLines);
      const solverResult = matchingResult.matchedCount === matchingResult.totalDemand;

      expect(solverResult).toBe(oracleResult);
    }
  });
});
