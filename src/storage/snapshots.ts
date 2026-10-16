export const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function shouldSnapshot(
  lastAtIso: string | null | undefined,
  nowMs: number,
  profileIsEmpty: boolean,
): boolean {
  if (profileIsEmpty) {
    return false;
  }
  if (!lastAtIso) {
    return true;
  }
  const lastMs = Date.parse(lastAtIso);
  if (Number.isNaN(lastMs)) {
    return true;
  }
  // If the system clock moved backwards, do not trigger a snapshot loop
  if (nowMs < lastMs) {
    return false;
  }
  return nowMs - lastMs >= SNAPSHOT_INTERVAL_MS;
}

export function formatSnapshotFilename(now: Date, reason?: string): string {
  const yyyy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const cleanReason = reason
    ? reason
        .toLowerCase()
        .replace(/[^a-z-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : '';
  const suffix = cleanReason ? `-${cleanReason}` : '';
  return `gabaritex-${yyyy}-${mm}-${dd}-${hh}${min}${suffix}.zip`;
}

