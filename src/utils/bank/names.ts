/**
 * Normalization and validation for group and tag names.
 */

export function normalizeTagName(name: string): string {
  if (!name) return '';
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export interface NameValidationResult {
  valid: boolean;
  error?: string;
  normalized: string;
}

export function validateTagName(name: string): NameValidationResult {
  const normalized = normalizeTagName(name);
  if (!normalized) {
    return { valid: false, error: 'O nome da etiqueta não pode ser vazio.', normalized };
  }
  if (normalized.length > 40) {
    return { valid: false, error: 'O nome da etiqueta deve ter no máximo 40 caracteres.', normalized };
  }
  return { valid: true, normalized };
}

export function normalizeGroupName(name: string): string {
  if (!name) return '';
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function validateGroupName(name: string): NameValidationResult {
  const normalized = normalizeGroupName(name);
  if (!normalized) {
    return { valid: false, error: 'O nome do grupo não pode ser vazio.', normalized };
  }
  if (normalized.length > 60) {
    return { valid: false, error: 'O nome do grupo deve ter no máximo 60 caracteres.', normalized };
  }
  if (normalized.includes('/')) {
    return { valid: false, error: 'O nome do grupo não pode conter a barra ("/").', normalized };
  }
  return { valid: true, normalized };
}

/**
 * Case-insensitive comparison key for uniqueness checks.
 */
export function caseInsensitiveKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}
