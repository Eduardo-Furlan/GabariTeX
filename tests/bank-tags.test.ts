import { describe, it, expect } from 'vitest';
import {
  findOrCreateTag,
  renameTag,
  updateTagColor,
  deleteTag,
  mergeTags,
  importMergeTags,
} from '../src/utils/bank/tags';
import { BankTag } from '../src/types/bank';

describe('Bank Tags (src/utils/bank/tags.ts)', () => {
  const tagFacil: BankTag = {
    id: 'tag-1',
    name: 'fácil',
    color: 'green',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const tagMedia: BankTag = {
    id: 'tag-2',
    name: 'média',
    color: 'amber',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const initialTags = [tagFacil, tagMedia];

  describe('findOrCreateTag', () => {
    it('returns existing tag if found case-insensitively', () => {
      const res = findOrCreateTag(initialTags, 'FÁCIL');
      expect(res.created).toBe(false);
      expect(res.tag.id).toBe('tag-1');
      expect(res.tags).toHaveLength(2);
    });

    it('creates a new tag if not found', () => {
      const res = findOrCreateTag(initialTags, 'difícil', 'red');
      expect(res.created).toBe(true);
      expect(res.tag.name).toBe('difícil');
      expect(res.tag.color).toBe('red');
      expect(res.tags).toHaveLength(3);
    });

    it('rejects invalid names', () => {
      expect(() => findOrCreateTag(initialTags, '')).toThrow();
    });
  });

  describe('renameTag', () => {
    it('renames tag and updates timestamp', () => {
      const res = renameTag(initialTags, 'tag-1', 'muito fácil');
      expect(res.updatedTag.name).toBe('muito fácil');
      expect(res.tags.find((t) => t.id === 'tag-1')?.name).toBe('muito fácil');
    });

    it('prevents renaming to an existing tag name', () => {
      expect(() => renameTag(initialTags, 'tag-1', 'MÉDIA')).toThrow(/já existe/i);
    });
  });

  describe('updateTagColor', () => {
    it('updates tag color', () => {
      const res = updateTagColor(initialTags, 'tag-1', 'teal');
      expect(res.updatedTag.color).toBe('teal');
    });
  });

  describe('deleteTag', () => {
    it('removes tag and strips tagId from questions', () => {
      const questions = [
        { id: 'q1', tagIds: ['tag-1', 'tag-2'] },
        { id: 'q2', tagIds: ['tag-2'] },
        { id: 'q3', tagIds: ['tag-1'] },
      ];

      const res = deleteTag(initialTags, questions, 'tag-1');
      expect(res.tags.some((t) => t.id === 'tag-1')).toBe(false);
      expect(res.updatedQuestions).toEqual([
        { id: 'q1', tagIds: ['tag-2'] },
        { id: 'q3', tagIds: [] },
      ]);
    });
  });

  describe('mergeTags', () => {
    it('merges source into target and reassigns questions deduplicating', () => {
      const questions = [
        { id: 'q1', tagIds: ['tag-1', 'tag-2'] },
        { id: 'q2', tagIds: ['tag-1'] },
        { id: 'q3', tagIds: ['tag-2'] },
      ];

      const res = mergeTags(initialTags, questions, 'tag-1', 'tag-2');
      expect(res.tags.find((t) => t.id === 'tag-1')).toBeUndefined();
      expect(res.tags.find((t) => t.id === 'tag-2')).toBeDefined();

      expect(res.updatedQuestions).toEqual([
        { id: 'q1', tagIds: ['tag-2'] },
        { id: 'q2', tagIds: ['tag-2'] },
      ]);
    });
  });

  describe('importMergeTags', () => {
    it('merges tags by case-insensitive name and provides remapping idMap', () => {
      const incoming: BankTag[] = [
        {
          id: 'inc-1',
          name: 'FÁCIL',
          color: 'blue',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
        },
        {
          id: 'inc-2',
          name: 'vestibular',
          color: 'violet',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
        },
      ];

      const res = importMergeTags(initialTags, incoming);
      expect(res.tags).toHaveLength(3); // fácil (merged), média (kept), vestibular (new)
      expect(res.idMap.get('inc-1')).toBe('tag-1');
      expect(res.idMap.get('inc-2')).toBe('inc-2');
    });
  });
});
