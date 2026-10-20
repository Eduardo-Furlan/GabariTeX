import { describe, it, expect } from 'vitest';
import { isValidBankId, generateBankId } from '../src/utils/bank/ids';
import {
  normalizeTagName,
  validateTagName,
  normalizeGroupName,
  validateGroupName,
  caseInsensitiveKey,
} from '../src/utils/bank/names';

describe('Bank IDs and Names (src/utils/bank/ids.ts & names.ts)', () => {
  describe('ids', () => {
    it('generates valid lowercase UUIDs meeting store ID requirements', () => {
      const id = generateBankId();
      expect(isValidBankId(id)).toBe(true);
      expect(id).toMatch(/^[a-z0-9][a-z0-9_-]{0,79}$/);
    });

    it('rejects invalid store IDs', () => {
      expect(isValidBankId('')).toBe(false);
      expect(isValidBankId('-starts-with-hyphen')).toBe(false);
      expect(isValidBankId('has spaces')).toBe(false);
      expect(isValidBankId('UPPERCASE')).toBe(false);
      expect(isValidBankId('a'.repeat(81))).toBe(false);
    });
  });

  describe('tag names', () => {
    it('normalizes whitespace and NFC form', () => {
      expect(normalizeTagName('  fácil   vestibular  ')).toBe('fácil vestibular');
      expect(normalizeTagName('e\u0301')).toBe('é'); // NFD to NFC
    });

    it('validates 1..40 char length and non-empty', () => {
      expect(validateTagName('').valid).toBe(false);
      expect(validateTagName('   ').valid).toBe(false);
      expect(validateTagName('fácil').valid).toBe(true);
      expect(validateTagName('a'.repeat(40)).valid).toBe(true);
      expect(validateTagName('a'.repeat(41)).valid).toBe(false);
    });
  });

  describe('group names', () => {
    it('normalizes group names', () => {
      expect(normalizeGroupName('  Geometria   Plana  ')).toBe('Geometria Plana');
    });

    it('rejects slash "/" in group names', () => {
      const res = validateGroupName('Geometria/Plana');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('barra');
    });

    it('validates 1..60 char length and non-empty', () => {
      expect(validateGroupName('').valid).toBe(false);
      expect(validateGroupName('Matemática').valid).toBe(true);
      expect(validateGroupName('a'.repeat(60)).valid).toBe(true);
      expect(validateGroupName('a'.repeat(61)).valid).toBe(false);
    });

    it('computes case-insensitive comparison keys', () => {
      expect(caseInsensitiveKey('Matemática')).toBe('matemática');
      expect(caseInsensitiveKey('FÁCIL')).toBe('fácil');
    });
  });
});
