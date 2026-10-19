import { describe, it, expect } from 'vitest';
import { runAudit } from '../scripts/audit-dark-classes.mjs';

describe('UI Dark Mode and Element Audit', () => {
  it('has zero light-only colored classes, un-tokenized scrims, or raw native selects', () => {
    const offenders = runAudit();
    if (offenders.length > 0) {
      const summary = offenders
        .slice(0, 20)
        .map((o) => `[${o.type}] ${o.file}:${o.line} -> ${o.detail} ("${o.snippet.slice(0, 60)}")`)
        .join('\n');
      const extra = offenders.length > 20 ? `\n...and ${offenders.length - 20} more.` : '';
      expect.fail(
        `Found ${offenders.length} UI audit offender(s):\n${summary}${extra}\nRun 'node scripts/audit-dark-classes.mjs' for full breakdown.`
      );
    }
    expect(offenders).toHaveLength(0);
  });
});

