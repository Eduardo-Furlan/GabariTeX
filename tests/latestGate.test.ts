import { describe, it, expect } from 'vitest';
import { createLatestGate } from '../src/utils/latestGate';

describe('createLatestGate', () => {
  it('gera tokens incrementais e só considera o último como current', () => {
    const gate = createLatestGate();

    const t1 = gate.begin();
    expect(gate.isCurrent(t1)).toBe(true);

    const t2 = gate.begin();
    expect(gate.isCurrent(t1)).toBe(false);
    expect(gate.isCurrent(t2)).toBe(true);

    const t3 = gate.begin();
    expect(gate.isCurrent(t1)).toBe(false);
    expect(gate.isCurrent(t2)).toBe(false);
    expect(gate.isCurrent(t3)).toBe(true);
  });
});
