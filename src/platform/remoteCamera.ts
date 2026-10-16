import { PhotoResult } from '../utils/photoPipeline';
import { classifyPhotoResult } from '../utils/batchQueue';

export interface NetworkInterfaceInfo {
  name: string;
  ip: string;
}

export interface RemoteSessionInfo {
  url: string;
  ip: string;
  port: number;
  token: string;
  interfaces: NetworkInterfaceInfo[];
}

export interface RemotePhotoEvent {
  id: string;
  size: number;
  mime: string;
  target?: 'qr' | 'sheet';
}

export interface RemoteStoppedEvent {
  reason: string;
}

export interface PhotoReportPayload {
  status: 'ok' | 'review' | 'error' | 'processing';
  label?: string;
  message?: string;
}

export function mapPhotoResultToReport(result: PhotoResult): PhotoReportPayload {
  if (result.status === 'qr_only') {
    const v = result.payload?.version;
    return {
      status: 'ok',
      label: v ? `QR Versão ${v}` : 'QR Code lido',
      message: 'Agora envie a foto do gabarito',
    };
  }
  const classified = classifyPhotoResult(result);
  if (classified.status === 'ok') {
    const v = result.record?.versionLetter;
    return {
      status: 'ok',
      label: v ? `Lida (versão ${v})` : 'Lida',
    };
  }
  if (classified.status === 'review') {
    return {
      status: 'review',
      label: 'Lida, com dúvidas',
      message: 'Revise no computador',
    };
  }
  return {
    status: 'error',
    label: 'Não foi possível ler',
    message: `${classified.reason || 'Foto ilegível'} — tire outra`,
  };
}

export async function getNetworkInterfaces(): Promise<NetworkInterfaceInfo[]> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return [];
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<NetworkInterfaceInfo[]>('remote_list_interfaces');
  } catch (err) {
    console.warn('[RemoteCamera] Falha ao listar interfaces de rede:', err);
    return [];
  }
}

export async function getRemoteCameraStatus(): Promise<RemoteSessionInfo | null> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<RemoteSessionInfo | null>('remote_status');
  } catch (err) {
    console.warn('[RemoteCamera] Falha ao verificar status da sessão remota:', err);
    return null;
  }
}

export async function startRemoteCamera(ip?: string): Promise<RemoteSessionInfo | null> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<RemoteSessionInfo>('remote_start', { ip });
  } catch (err) {
    console.warn('[RemoteCamera] Falha ao iniciar câmera remota:', err);
    throw err;
  }
}

export async function stopRemoteCamera(): Promise<void> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('remote_stop');
  } catch (err) {
    console.warn('[RemoteCamera] Falha ao parar câmera remota:', err);
  }
}

export async function takeRemotePhoto(id: string): Promise<Uint8Array | null> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const buffer = await invoke<ArrayBuffer>('remote_take', { id });
    return new Uint8Array(buffer);
  } catch (err) {
    console.warn(`[RemoteCamera] Falha ao obter bytes da foto ${id}:`, err);
    return null;
  }
}

export async function reportRemotePhoto(
  id: string,
  status: string,
  label?: string,
  message?: string
): Promise<void> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('remote_report', { id, status, label, message });
  } catch (err) {
    console.warn(`[RemoteCamera] Falha ao reportar feedback da foto ${id}:`, err);
  }
}

export interface PendingPhotoInfo {
  id: string;
  mime: string;
  size: number;
  target?: 'qr' | 'sheet';
}

export async function getRemotePendingPhotos(): Promise<PendingPhotoInfo[]> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return [];
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<PendingPhotoInfo[]>('remote_list_pending');
  } catch (err) {
    console.warn('[RemoteCamera] Falha ao listar fotos pendentes:', err);
    return [];
  }
}

export async function listenRemotePhotos(
  onPhoto: (file: File, id: string, target?: 'qr' | 'sheet') => void
): Promise<() => void> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return () => {};
  }
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<RemotePhotoEvent>('remote:photo', async (event) => {
      const { id, mime, target } = event.payload;
      const bytes = await takeRemotePhoto(id);
      if (!bytes || bytes.length === 0) return;

      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const file = new File(
        [bytes as BlobPart],
        `celular-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`,
        { type: mime || 'image/jpeg', lastModified: Date.now() }
      );

      onPhoto(file, id, target === 'sheet' ? 'sheet' : 'qr');
    });
    return unlisten;
  } catch (err) {
    console.warn('[RemoteCamera] Falha ao registrar listener de fotos remotas:', err);
    return () => {};
  }
}

export async function listenRemoteStopped(
  onStopped: (reason: string) => void
): Promise<() => void> {
  if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
    return () => {};
  }
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<RemoteStoppedEvent>('remote:stopped', (event) => {
      onStopped(event.payload.reason);
    });
    return unlisten;
  } catch (err) {
    console.warn('[RemoteCamera] Falha ao registrar listener de parada remota:', err);
    return () => {};
  }
}
