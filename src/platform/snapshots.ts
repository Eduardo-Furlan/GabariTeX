import { ProfileData } from '../types/profile';
import { buildProfileZip } from '../utils/profileZip';
import { formatSnapshotFilename, shouldSnapshot } from '../storage/snapshots';

export interface DesktopSnapshotInfo {
  dir: string;
  lastSnapshotAt?: string;
}

export async function getDesktopSnapshotInfo(): Promise<DesktopSnapshotInfo | null> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const info = await invoke<DesktopSnapshotInfo>('snapshot_dir_get');
    return info;
  } catch (err) {
    console.warn('[Desktop Snapshot] Não foi possível obter pasta de snapshots:', err);
    return null;
  }
}

export async function pickDesktopSnapshotDir(): Promise<string | null> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const picked = await invoke<string | null>('snapshot_dir_pick');
    return picked;
  } catch (err) {
    console.warn('[Desktop Snapshot] Erro ao selecionar pasta:', err);
    return null;
  }
}

export async function triggerDesktopSnapshot(
  profileData: ProfileData,
  reason?: string
): Promise<string | null> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const now = new Date();
    const fileName = formatSnapshotFilename(now, reason);
    const zipBytes = await buildProfileZip(profileData);

    const savedName = await invoke<string>('snapshot_write', zipBytes, {
      headers: {
        'x-snapshot-name': fileName,
        'x-snapshot-timestamp': now.toISOString(),
      },
    });
    return savedName;
  } catch (err) {
    console.warn('[Desktop Snapshot] Falha ao gravar snapshot automático:', err);
    return null;
  }
}

export async function checkAndRunDailySnapshot(
  profileData: ProfileData
): Promise<string | null> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return null;
  }
  const info = await getDesktopSnapshotInfo();
  if (!info) return null;

  const profileIsEmpty = profileData.exams.length === 0;
  if (shouldSnapshot(info.lastSnapshotAt, Date.now(), profileIsEmpty)) {
    return triggerDesktopSnapshot(profileData, 'diario');
  }
  return null;
}

