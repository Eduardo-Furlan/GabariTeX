const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const EXT_REGEX = /^[a-z0-9]{1,5}$/;

export function isValidStoreId(id: string): boolean {
  if (!ID_REGEX.test(id)) return false;
  if (WINDOWS_RESERVED_NAMES.has(id)) return false;
  return true;
}

export function isValidStoreKey(key: string): boolean {
  if (key.includes('..') || key.includes('\\') || key.startsWith('/')) {
    return false;
  }
  if (key === 'meta' || key === 'settings' || key === 'classes') {
    return true;
  }
  if (key.startsWith('exams/')) {
    return isValidStoreId(key.slice('exams/'.length));
  }
  if (key.startsWith('records/')) {
    return isValidStoreId(key.slice('records/'.length));
  }
  if (key.startsWith('assets/')) {
    const rest = key.slice('assets/'.length);
    const dotIndex = rest.indexOf('.');
    if (dotIndex <= 0 || dotIndex !== rest.lastIndexOf('.')) {
      return false;
    }
    const id = rest.slice(0, dotIndex);
    const ext = rest.slice(dotIndex + 1);
    return isValidStoreId(id) && EXT_REGEX.test(ext);
  }
  return false;
}

