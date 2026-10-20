import { describe, it, expect } from 'vitest';
import {
  collectReferences,
  detectBrokenReferences,
  normalizeSourceExpr,
  normalizeBlueprint,
  isVisuallyRepresentable,
  validateBlueprint,
} from '../src/utils/bank/blueprint';
import { Blueprint, RuleBlock, SourceExpr } from '../src/types/bank';

describe('Bank Blueprint Utilities (src/utils/bank/blueprint.ts)', () => {
  const sampleBlueprint: Blueprint = {
    id: 'bp-1',
    name: 'Prova 1 - Geometria',
    blocks: [
      {
        id: 'blk-1',
        source: {
          kind: 'or',
          operands: [
            { kind: 'group', groupId: 'grp-euclid', descendants: true },
            { kind: 'group', groupId: 'grp-hyperb', descendants: false },
          ],
        },
        quotas: [
          {
            id: 'line-1',
            count: 3,
            filter: { tagIds: ['tag-facil'], notTagIds: [] },
          },
          {
            id: 'line-2',
            count: 5,
            filter: { tagIds: ['tag-media'], notTagIds: ['tag-revisar'] },
          },
        ],
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  describe('collectReferences & detectBrokenReferences', () => {
    it('collects all group and tag IDs', () => {
      const { groupIds, tagIds } = collectReferences(sampleBlueprint);
      expect(groupIds).toEqual(new Set(['grp-euclid', 'grp-hyperb']));
      expect(tagIds).toEqual(new Set(['tag-facil', 'tag-media', 'tag-revisar']));
    });

    it('detects missing group or tag IDs', () => {
      const validGroups = new Set(['grp-euclid']); // grp-hyperb missing
      const validTags = new Set(['tag-facil', 'tag-media', 'tag-revisar']);

      const check = detectBrokenReferences(sampleBlueprint, validGroups, validTags);
      expect(check.broken).toBe(true);
      expect(check.missingGroups).toEqual(['grp-hyperb']);
      expect(check.missingTags).toHaveLength(0);
    });
  });

  describe('normalizeSourceExpr', () => {
    it('flattens nested operators of the same kind', () => {
      const nested: SourceExpr = {
        kind: 'or',
        operands: [
          { kind: 'group', groupId: 'g1', descendants: true },
          {
            kind: 'or',
            operands: [
              { kind: 'group', groupId: 'g2', descendants: true },
              { kind: 'group', groupId: 'g3', descendants: true },
            ],
          },
        ],
      };

      const normalized = normalizeSourceExpr(nested);
      expect(normalized.kind).toBe('or');
      if (normalized.kind === 'or') {
        expect(normalized.operands).toHaveLength(3);
      }
    });

    it('collapses single-operand operators to the operand itself', () => {
      const single: SourceExpr = {
        kind: 'and',
        operands: [{ kind: 'group', groupId: 'g1', descendants: true }],
      };
      const collapsed = normalizeSourceExpr(single);
      expect(collapsed).toEqual({ kind: 'group', groupId: 'g1', descendants: true });
    });
  });

  describe('isVisuallyRepresentable', () => {
    it('returns true for flat leaves and single-level operators', () => {
      const block1: RuleBlock = {
        id: 'b1',
        source: {
          kind: 'or',
          operands: [
            { kind: 'group', groupId: 'g1', descendants: true },
            { kind: 'group', groupId: 'g2', descendants: true },
          ],
        },
        quotas: [],
      };
      expect(isVisuallyRepresentable(block1)).toBe(true);
    });

    it('returns true for except with group leaves', () => {
      const blockWithExcept: RuleBlock = {
        id: 'b1',
        source: {
          kind: 'except',
          base: {
            kind: 'or',
            operands: [{ kind: 'group', groupId: 'g1', descendants: true }],
          },
          excluded: { kind: 'group', groupId: 'g2', descendants: false },
        },
        quotas: [],
      };
      expect(isVisuallyRepresentable(blockWithExcept)).toBe(true);
    });

    it('returns false for deeply nested or mixed non-flat expressions', () => {
      const complex: RuleBlock = {
        id: 'b1',
        source: {
          kind: 'or',
          operands: [
            {
              kind: 'and',
              operands: [
                { kind: 'group', groupId: 'g1', descendants: true },
                { kind: 'group', groupId: 'g2', descendants: true },
              ],
            },
            { kind: 'group', groupId: 'g3', descendants: true },
          ],
        },
        quotas: [],
      };
      expect(isVisuallyRepresentable(complex)).toBe(false);
    });
  });

  describe('validateBlueprint', () => {
    it('passes for valid blueprint', () => {
      const res = validateBlueprint(sampleBlueprint);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects blueprints exceeding max question count (40)', () => {
      const overLimit: Blueprint = {
        ...sampleBlueprint,
        blocks: [
          {
            ...sampleBlueprint.blocks[0],
            quotas: [
              { id: 'l1', count: 25, filter: { tagIds: [], notTagIds: [] } },
              { id: 'l2', count: 20, filter: { tagIds: [], notTagIds: [] } },
            ],
          },
        ],
      };
      const res = validateBlueprint(overLimit);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('excede o limite máximo de 40 questões');
    });

    it('rejects contradictory tag filter (included and excluded)', () => {
      const invalidFilter: Blueprint = {
        ...sampleBlueprint,
        blocks: [
          {
            ...sampleBlueprint.blocks[0],
            quotas: [
              {
                id: 'l1',
                count: 5,
                filter: { tagIds: ['tag-1'], notTagIds: ['tag-1'] },
              },
            ],
          },
        ],
      };
      const res = validateBlueprint(invalidFilter);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('não pode estar incluída e excluída ao mesmo tempo');
    });
  });
});
