import { describe, it, expect } from 'vitest';
import {
  analyzeBlueprint,
  buildGroupDescendantLookup,
  matchesSourceExpr,
  matchesQuotaFilter,
  GenerateInput,
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
    const q1 = questions[0]; // g-euclid
    const q3 = questions[2]; // g-geo
    const q5 = questions[4]; // null

    // Direct vs descendant
    expect(matchesSourceExpr(q1, { kind: 'group', groupId: 'g-geo', descendants: true }, lookup)).toBe(true);
    expect(matchesSourceExpr(q1, { kind: 'group', groupId: 'g-geo', descendants: false }, lookup)).toBe(false);
    expect(matchesSourceExpr(q3, { kind: 'group', groupId: 'g-geo', descendants: false }, lookup)).toBe(true);

    // All includes ungrouped
    expect(matchesSourceExpr(q5, { kind: 'all' }, lookup)).toBe(true);

    // Except
    const exceptExpr = {
      kind: 'except' as const,
      base: { kind: 'group' as const, groupId: 'g-root', descendants: true },
      excluded: { kind: 'group' as const, groupId: 'g-alg', descendants: true },
    };
    expect(matchesSourceExpr(q1, exceptExpr, lookup)).toBe(true);
    expect(matchesSourceExpr(questions[3], exceptExpr, lookup)).toBe(false); // Álgebra excluded
  });

  it('matchesQuotaFilter matches tagIds, notTagIds, and type', () => {
    const q1 = questions[0]; // objective, ['t-easy']
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
            // Euclidiana has 2 non-archived questions (q-1 and q-2). Needing 3 should trigger shortfall.
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

    // With excludeQuestionIds excluding q-1
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
              // Álgebra only has 1 question (q-4) which is objective
              { kind: 'group', groupId: 'g-alg', descendants: true },
            ],
          },
          quotas: [
            // Quota demands subjective questions only -> Álgebra has NO subjective questions!
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
