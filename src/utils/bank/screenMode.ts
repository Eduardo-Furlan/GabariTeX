import { BankGroup, BankQuestion } from '../../types/bank';

export type BankScreenMode = 'empty' | 'normal';

/**
 * Determines whether the bank screen should render the global empty state
 * or the standard layout with the group tree and question list.
 *
 * - An empty bank (0 groups and 0 questions) displays the global empty state.
 * - If there are groups (even with 0 questions) or questions, the normal layout is rendered.
 */
export function getBankScreenMode(
  groups: readonly BankGroup[],
  questions: readonly BankQuestion[]
): BankScreenMode {
  if (groups.length === 0 && questions.length === 0) {
    return 'empty';
  }
  return 'normal';
}
