import { describe, it, expect } from 'vitest';
import {
  buildQuestionUsageMap,
  buildUsageCounts,
  buildExclusionSet,
  formatQuestionUsage,
} from '../src/utils/bank/usage';

describe('Bank Usage Index (src/utils/bank/usage.ts)', () => {
  const sampleExams = [
    {
      id: 'exam-1',
      questions: [
        { sourceQuestionId: 'bq-1' },
        { sourceQuestionId: 'bq-2' },
        { sourceQuestionId: 'bq-1' }, // duplicate in same exam
      ],
    },
    {
      id: 'exam-2',
      questions: [
        { sourceQuestionId: 'bq-1' },
        { sourceQuestionId: 'bq-3' },
      ],
    },
    {
      id: 'exam-3',
      questions: [],
    },
  ];

  it('builds usage map deduplicating per exam', () => {
    const usage = buildQuestionUsageMap(sampleExams);

    expect(usage.get('bq-1')).toEqual(['exam-1', 'exam-2']);
    expect(usage.get('bq-2')).toEqual(['exam-1']);
    expect(usage.get('bq-3')).toEqual(['exam-2']);
    expect(usage.get('bq-unused')).toBeUndefined();
  });

  it('builds usage counts accurately', () => {
    const usage = buildQuestionUsageMap(sampleExams);
    const counts = buildUsageCounts(usage);

    expect(counts.get('bq-1')).toBe(2);
    expect(counts.get('bq-2')).toBe(1);
    expect(counts.get('bq-3')).toBe(1);
  });

  it('builds exclusion set from chosen exams', () => {
    const excluded = buildExclusionSet(sampleExams, ['exam-1']);
    expect(excluded).toEqual(new Set(['bq-1', 'bq-2']));

    const both = buildExclusionSet(sampleExams, ['exam-1', 'exam-2']);
    expect(both).toEqual(new Set(['bq-1', 'bq-2', 'bq-3']));

    const none = buildExclusionSet(sampleExams, []);
    expect(none.size).toBe(0);
  });

  it('formats question usage microcopy correctly', () => {
    expect(formatQuestionUsage(0)).toBe('Nunca usada');
    expect(formatQuestionUsage(1)).toBe('Usada em 1 prova');
    expect(formatQuestionUsage(4)).toBe('Usada em 4 provas');
  });
});
