import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidStoreId, isValidStoreKey } from '../src/storage/keyValidation';
import { shouldSnapshot, formatSnapshotFilename, SNAPSHOT_INTERVAL_MS } from '../src/storage/snapshots';

describe('keyValidation (Plan 12 §4.2 & §8)', () => {
  it('accepts valid store keys and IDs', () => {
    expect(isValidStoreKey('meta')).toBe(true);
    expect(isValidStoreKey('settings')).toBe(true);
    expect(isValidStoreKey('classes')).toBe(true);
    expect(isValidStoreKey('exams/prova-nova')).toBe(true);
    expect(isValidStoreKey('exams/550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidStoreKey('records/prova-mat-2026-1')).toBe(true);
    expect(isValidStoreKey('assets/a1b2c3d4.png')).toBe(true);
    expect(isValidStoreKey('assets/9f8e7d.jpeg')).toBe(true);
  });

  it('rejects path traversal, separators, Windows reserved names, uppercase, and invalid lengths', () => {
    expect(isValidStoreKey('../meta')).toBe(false);
    expect(isValidStoreKey('exams/../meta')).toBe(false);
    expect(isValidStoreKey('/etc/passwd')).toBe(false);
    expect(isValidStoreKey('C:\\Users\\test')).toBe(false);
    expect(isValidStoreKey('exams/CON')).toBe(false);
    expect(isValidStoreKey('exams/con')).toBe(false);
    expect(isValidStoreKey('exams/nul')).toBe(false);
    expect(isValidStoreKey('exams/com1')).toBe(false);
    expect(isValidStoreKey('exams/lpt9')).toBe(false);
    expect(isValidStoreKey('exams/ProvaMaiuscula')).toBe(false);
    expect(isValidStoreKey('exams/-comeca-com-hifen')).toBe(false);
    expect(isValidStoreId('a'.repeat(81))).toBe(false);
    expect(isValidStoreKey('assets/abc.toolong')).toBe(false);
    expect(isValidStoreKey('assets/abc.')).toBe(false);
  });
});

describe('snapshots (Plan 12 §6 & §8)', () => {
  it('never triggers snapshot when profile is empty', () => {
    expect(shouldSnapshot(null, Date.now(), true)).toBe(false);
  });

  it('triggers snapshot when lastAt is null and profile is not empty', () => {
    expect(shouldSnapshot(null, Date.now(), false)).toBe(true);
  });

  it('triggers snapshot only after 24 hours', () => {
    const base = Date.parse('2026-10-16T09:00:00.000Z');
    const lastIso = new Date(base).toISOString();
    expect(shouldSnapshot(lastIso, base + SNAPSHOT_INTERVAL_MS - 1000, false)).toBe(false);
    expect(shouldSnapshot(lastIso, base + SNAPSHOT_INTERVAL_MS, false)).toBe(true);
  });

  it('does not loop when system clock moves backwards', () => {
    const base = Date.parse('2026-10-16T09:00:00.000Z');
    const lastIso = new Date(base).toISOString();
    expect(shouldSnapshot(lastIso, base - 60_000, false)).toBe(false);
  });

  it('formats snapshot filename matching Rust regex', () => {
    const d = new Date(2026, 9, 16, 9, 30);
    expect(formatSnapshotFilename(d)).toBe('gabaritex-2026-10-16-0930.zip');
    expect(formatSnapshotFilename(d, 'auto')).toBe('gabaritex-2026-10-16-0930-auto.zip');
  });
});

describe('saveFile (Plan 12 §5.1 & §8)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses anchor download on web (!__DESKTOP__)', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const appendChild = vi.fn();
    const removeChild = vi.fn();

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ href: '', download: '', click })),
      body: { appendChild, removeChild },
    });

    const { saveFile } = await import('../src/platform/files');
    const res = await saveFile({
      suggestedName: 'notas.csv',
      mime: 'text/csv',
      data: 'col1,col2',
    });

    expect(res).toEqual({ status: 'saved' });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

