import { describe, it, expect } from 'vitest';
import {
  BankGroupNode,
  buildGroupTree,
  descendantIds,
  depthOf,
  pathOf,
  resolvePath,
  createGroup,
  renameGroup,
  moveGroup,
  deleteGroup,
  countQuestionsByGroup,
  MAX_GROUP_DEPTH,
} from '../src/utils/bank/tree';
import { BankGroup } from '../src/types/bank';

describe('Bank Group Tree (src/utils/bank/tree.ts)', () => {
  const gMath: BankGroup = {
    id: 'grp-math',
    parentId: null,
    name: 'Matemática',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const gPhysics: BankGroup = {
    id: 'grp-phys',
    parentId: null,
    name: 'Física',
    order: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const gGeom: BankGroup = {
    id: 'grp-geom',
    parentId: 'grp-math',
    name: 'Geometria',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const gEuclid: BankGroup = {
    id: 'grp-euclid',
    parentId: 'grp-geom',
    name: 'Euclidiana',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const gHyperb: BankGroup = {
    id: 'grp-hyperb',
    parentId: 'grp-geom',
    name: 'Hiperbólica',
    order: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const initialGroups: BankGroup[] = [gMath, gPhysics, gGeom, gEuclid, gHyperb];

  describe('buildGroupTree', () => {
    it('constructs a nested tree with accurate depth and ordering', () => {
      const tree = buildGroupTree(initialGroups);
      expect(tree).toHaveLength(2);
      expect(tree[0].name).toBe('Matemática');
      expect(tree[0].depth).toBe(0);
      expect(tree[1].name).toBe('Física');

      const geomNode = tree[0].children[0];
      expect(geomNode.name).toBe('Geometria');
      expect(geomNode.depth).toBe(1);
      expect(geomNode.children).toHaveLength(2);
      expect(geomNode.children[0].name).toBe('Euclidiana');
      expect(geomNode.children[0].depth).toBe(2);
      expect(geomNode.children[1].name).toBe('Hiperbólica');
      expect(geomNode.children[1].depth).toBe(2);
    });
  });

  describe('descendantIds and depthOf', () => {
    it('calculates descendantIds correctly', () => {
      const mathDesc = descendantIds(initialGroups, 'grp-math');
      expect(mathDesc).toEqual(new Set(['grp-geom', 'grp-euclid', 'grp-hyperb']));

      const geomDesc = descendantIds(initialGroups, 'grp-geom');
      expect(geomDesc).toEqual(new Set(['grp-euclid', 'grp-hyperb']));

      const euclidDesc = descendantIds(initialGroups, 'grp-euclid');
      expect(euclidDesc.size).toBe(0);
    });

    it('calculates depth accurately', () => {
      expect(depthOf(initialGroups, 'grp-math')).toBe(0);
      expect(depthOf(initialGroups, 'grp-geom')).toBe(1);
      expect(depthOf(initialGroups, 'grp-euclid')).toBe(2);
    });
  });

  describe('pathOf and resolvePath', () => {
    it('formats paths with slashes', () => {
      expect(pathOf(initialGroups, 'grp-euclid')).toBe('Matemática/Geometria/Euclidiana');
      expect(pathOf(initialGroups, 'grp-math')).toBe('Matemática');
    });

    it('resolves paths case-insensitively', () => {
      const resolved = resolvePath(initialGroups, 'matemática/geometria/euclidiana');
      expect(resolved?.id).toBe('grp-euclid');

      const nonExistent = resolvePath(initialGroups, 'Matemática/Álgebra');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('createGroup', () => {
    it('appends with dense order and validates uniqueness', () => {
      const { groups, newGroup } = createGroup(initialGroups, {
        name: 'Álgebra',
        parentId: 'grp-math',
      });
      expect(newGroup.order).toBe(1); // Geometria is 0, Álgebra becomes 1
      expect(newGroup.parentId).toBe('grp-math');
      expect(groups).toHaveLength(6);

      // Duplicate case-insensitive
      expect(() =>
        createGroup(groups, {
          name: 'álgebra',
          parentId: 'grp-math',
        })
      ).toThrow(/já existe/i);
    });

    it('enforces maximum depth', () => {
      let currentGroups = [...initialGroups];
      let parentId = 'grp-euclid'; // depth 2
      for (let i = 3; i <= MAX_GROUP_DEPTH; i++) {
        const res = createGroup(currentGroups, { name: `Sub-${i}`, parentId });
        currentGroups = res.groups;
        parentId = res.newGroup.id;
      }

      // Next level exceeds MAX_GROUP_DEPTH
      expect(() =>
        createGroup(currentGroups, { name: 'TooDeep', parentId })
      ).toThrow(/profundidade máxima/i);
    });
  });

  describe('renameGroup', () => {
    it('renames group and guards sibling uniqueness', () => {
      const { groups, updatedGroup } = renameGroup(initialGroups, 'grp-euclid', 'Plana');
      expect(updatedGroup.name).toBe('Plana');
      expect(pathOf(groups, 'grp-euclid')).toBe('Matemática/Geometria/Plana');

      // Conflict with sibling Hiperbólica
      expect(() => renameGroup(initialGroups, 'grp-euclid', 'hiperbólica')).toThrow(/já existe/i);
    });
  });

  describe('moveGroup', () => {
    it('prevents cycle (moving into self or descendant)', () => {
      expect(() => moveGroup(initialGroups, 'grp-math', 'grp-math')).toThrow(/si mesmo/i);
      expect(() => moveGroup(initialGroups, 'grp-math', 'grp-euclid')).toThrow(/subgrupos/i);
    });

    it('moves group to another parent with dense re-indexing', () => {
      const { groups, updatedGroup } = moveGroup(initialGroups, 'grp-hyperb', 'grp-phys');
      expect(updatedGroup.parentId).toBe('grp-phys');
      expect(updatedGroup.order).toBe(0); // first child of Física

      // Euclidiana should still be order 0 in Geometria
      const euclid = groups.find((g) => g.id === 'grp-euclid')!;
      expect(euclid.order).toBe(0);
      expect(pathOf(groups, 'grp-hyperb')).toBe('Física/Hiperbólica');
    });
  });

  describe('deleteGroup', () => {
    const sampleQuestions = [
      { id: 'q1', groupId: 'grp-euclid' },
      { id: 'q2', groupId: 'grp-hyperb' },
      { id: 'q3', groupId: 'grp-geom' },
      { id: 'q4', groupId: 'grp-phys' },
      { id: 'q5', groupId: null },
    ];

    it('strategy "delete" deletes group, descendants, and questions within them', () => {
      const result = deleteGroup(initialGroups, sampleQuestions, 'grp-geom', { kind: 'delete' });

      expect(result.deletedGroupIds).toContain('grp-geom');
      expect(result.deletedGroupIds).toContain('grp-euclid');
      expect(result.deletedGroupIds).toContain('grp-hyperb');
      expect(result.deletedQuestionIds).toEqual(['q1', 'q2', 'q3']);
      expect(result.groups.some((g) => g.id === 'grp-geom')).toBe(false);
    });

    it('strategy "move" moves questions and reparents child groups to target', () => {
      const result = deleteGroup(initialGroups, sampleQuestions, 'grp-geom', {
        kind: 'move',
        targetGroupId: 'grp-math',
      });

      expect(result.deletedGroupIds).toEqual(['grp-geom']);
      expect(result.deletedQuestionIds).toHaveLength(0);
      expect(result.remappedQuestions).toEqual([
        { id: 'q1', newGroupId: 'grp-math' },
        { id: 'q2', newGroupId: 'grp-math' },
        { id: 'q3', newGroupId: 'grp-math' },
      ]);

      const reparentedEuclid = result.groups.find((g) => g.id === 'grp-euclid')!;
      expect(reparentedEuclid.parentId).toBe('grp-math');
    });

    it('strategy "move" allows moving to null (Sem Grupo)', () => {
      const result = deleteGroup(initialGroups, sampleQuestions, 'grp-euclid', {
        kind: 'move',
        targetGroupId: null,
      });

      expect(result.deletedGroupIds).toEqual(['grp-euclid']);
      expect(result.remappedQuestions).toEqual([{ id: 'q1', newGroupId: null }]);
    });
  });

  describe('countQuestionsByGroup', () => {
    it('aggregates direct and descendant questions', () => {
      const questions = [
        { groupId: 'grp-euclid' },
        { groupId: 'grp-euclid' },
        { groupId: 'grp-hyperb' },
        { groupId: 'grp-math' },
        { groupId: null },
        { groupId: 'grp-euclid', archived: true },
      ];

      const counts = countQuestionsByGroup(questions, initialGroups, false);

      expect(counts.get('grp-euclid')?.own).toBe(2);
      expect(counts.get('grp-euclid')?.total).toBe(2);

      // Geometria has 0 direct, but Euclid (2) + Hyperb (1) = 3 total
      expect(counts.get('grp-geom')?.own).toBe(0);
      expect(counts.get('grp-geom')?.total).toBe(3);

      // Math has 1 direct + Geometria total (3) = 4 total
      expect(counts.get('grp-math')?.own).toBe(1);
      expect(counts.get('grp-math')?.total).toBe(4);

      // Sem Grupo
      expect(counts.get(null)?.own).toBe(1);
      expect(counts.get(null)?.total).toBe(1);
    });
  });
});
