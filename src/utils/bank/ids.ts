/**
 * Store-safe ID validation and generation for the question bank.
 * IDs must satisfy: ^[a-z0-9][a-z0-9_-]{0,79}$
 */
const STORE_ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export function isValidBankId(id: string): boolean {
  return STORE_ID_REGEX.test(id);
}

export function generateBankId(): string {
  return crypto.randomUUID().toLowerCase();
}
