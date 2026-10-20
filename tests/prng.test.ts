import { describe, it, expect } from 'vitest';
import { mulberry32, shuffle, shuffleArray } from '../src/utils/prng';

describe('prng (mulberry32 and shuffle)', () => {
  it('mulberry32 is deterministic given the same seed', () => {
    const prng1 = mulberry32(12345);
    const prng2 = mulberry32(12345);

    const values1 = Array.from({ length: 10 }, () => prng1());
    const values2 = Array.from({ length: 10 }, () => prng2());

    expect(values1).toEqual(values2);
    expect(values1.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('different seeds yield different sequences', () => {
    const prng1 = mulberry32(12345);
    const prng2 = mulberry32(54321);

    const values1 = Array.from({ length: 5 }, () => prng1());
    const values2 = Array.from({ length: 5 }, () => prng2());

    expect(values1).not.toEqual(values2);
  });

  it('shuffle is deterministic given the same prng state and does not mutate input', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const prng1 = mulberry32(42);
    const prng2 = mulberry32(42);

    const shuffled1 = shuffle(original, prng1);
    const shuffled2 = shuffle(original, prng2);

    expect(shuffled1).toEqual(shuffled2);
    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(shuffled1).not.toEqual(original);
    expect([...shuffled1].sort((a, b) => a - b)).toEqual(original);
  });

  it('shuffleArray is an alias of shuffle', () => {
    expect(shuffleArray).toBe(shuffle);
  });
});
