import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapPhotoResultToReport,
  getNetworkInterfaces,
  getRemoteCameraStatus,
  startRemoteCamera,
  stopRemoteCamera,
  takeRemotePhoto,
  reportRemotePhoto,
  getRemotePendingPhotos,
  listenRemotePhotos,
  listenRemoteStopped,
} from '../src/platform/remoteCamera';
import { PhotoResult } from '../src/utils/photoPipeline';

describe('mapPhotoResultToReport (Plan 13 §4 & §7)', () => {
  it('maps successful grading to "ok" with version letter without leaking student data', () => {
    const mockResult: PhotoResult = {
      status: 'graded',
      payloadSource: 'locked',
      record: {
        id: 'rec-1',
        examId: 'exam-1',
        studentName: 'Aluno Confidencial',
        studentId: '12345',
        versionLetter: 'B',
        answers: [{ questionIndex: 0, rawChoice: 'A', status: 'correct', points: 1 }],
        score: 10,
        percentage: 100,
        gradedAt: new Date().toISOString(),
      },
    };

    const report = mapPhotoResultToReport(mockResult);
    expect(report.status).toBe('ok');
    expect(report.label).toBe('Lida (versão B)');
    expect(JSON.stringify(report)).not.toContain('Aluno Confidencial');
    expect(JSON.stringify(report)).not.toContain('12345');
    expect(JSON.stringify(report)).not.toContain('10');
  });

  it('maps version mismatch to "review" without leaking student data', () => {
    const mockResult: PhotoResult = {
      status: 'graded',
      payloadSource: 'qr',
      versionMismatch: true,
      record: {
        id: 'rec-2',
        examId: 'exam-1',
        studentName: 'Estudante Secreto',
        versionLetter: 'C',
        answers: [],
        score: 0,
        percentage: 0,
        gradedAt: new Date().toISOString(),
      },
    };

    const report = mapPhotoResultToReport(mockResult);
    expect(report.status).toBe('review');
    expect(report.label).toBe('Lida, com dúvidas');
    expect(report.message).toBe('Revise no computador');
    expect(JSON.stringify(report)).not.toContain('Estudante Secreto');
  });

  it('maps question with doubt/rasura to "review"', () => {
    const mockResult: PhotoResult = {
      status: 'graded',
      payloadSource: 'locked',
      record: {
        id: 'rec-3',
        examId: 'exam-1',
        versionLetter: 'A',
        answers: [
          { questionIndex: 0, rawChoice: 'A', status: 'correct', points: 1 },
          { questionIndex: 1, rawChoice: 'B', status: 'incorrect', points: 0, needsReview: true, reviewReason: 'rasura' },
        ],
        score: 5,
        percentage: 50,
        gradedAt: new Date().toISOString(),
      },
    };

    const report = mapPhotoResultToReport(mockResult);
    expect(report.status).toBe('review');
    expect(report.label).toBe('Lida, com dúvidas');
    expect(report.message).toBe('Revise no computador');
  });

  it('maps unreadable/error to "error" with guidance to retake photo', () => {
    const mockResult: PhotoResult = {
      status: 'error',
      payloadSource: 'none',
      error: 'Não foi possível detectar o QR Code',
    };

    const report = mapPhotoResultToReport(mockResult);
    expect(report.status).toBe('error');
    expect(report.label).toBe('Não foi possível ler');
    expect(report.message).toContain('tire outra');
  });

  it('maps qr_only status to "ok" with instruction to send answer sheet photo next', () => {
    const mockResult: PhotoResult = {
      status: 'qr_only',
      payloadSource: 'qr',
      payload: {
        version: 'B',
        examId: 'exam-1',
        key: { 1: 'A' },
      },
    };

    const report = mapPhotoResultToReport(mockResult);
    expect(report.status).toBe('ok');
    expect(report.label).toBe('QR Versão B');
    expect(report.message).toContain('gabarito');
  });
});

describe('remoteCamera platform adapter (!__DESKTOP__)', () => {
  beforeEach(() => {
    vi.stubGlobal('__DESKTOP__', false);
  });

  it('gracefully returns safe defaults when running on web', async () => {
    expect(await getNetworkInterfaces()).toEqual([]);
    expect(await getRemoteCameraStatus()).toBeNull();
    expect(await startRemoteCamera()).toBeNull();
    expect(await takeRemotePhoto('p-1')).toBeNull();
    expect(await getRemotePendingPhotos()).toEqual([]);

    await expect(stopRemoteCamera()).resolves.toBeUndefined();
    await expect(reportRemotePhoto('p-1', 'ok')).resolves.toBeUndefined();

    const unlisten1 = await listenRemotePhotos(() => {});
    expect(typeof unlisten1).toBe('function');

    const unlisten2 = await listenRemoteStopped(() => {});
    expect(typeof unlisten2).toBe('function');
  });
});

describe('remoteCamera platform adapter (__DESKTOP__)', () => {
  beforeEach(() => {
    vi.stubGlobal('__DESKTOP__', true);
  });

  it('invokes Tauri IPC commands when in desktop mode', async () => {
    const mockInvoke = vi.fn(async (cmd: string, args?: any) => {
      if (cmd === 'remote_list_interfaces') {
        return [{ name: 'wlan0', ip: '192.168.1.100' }];
      }
      if (cmd === 'remote_status') {
        return {
          url: 'http://192.168.1.100:47831/#t=tok123',
          ip: '192.168.1.100',
          port: 47831,
          token: 'tok123',
          interfaces: [{ name: 'wlan0', ip: '192.168.1.100' }],
        };
      }
      if (cmd === 'remote_start') {
        return {
          url: `http://${args?.ip || '192.168.1.100'}:47831/#t=tok123`,
          ip: args?.ip || '192.168.1.100',
          port: 47831,
          token: 'tok123',
          interfaces: [{ name: 'wlan0', ip: '192.168.1.100' }],
        };
      }
      if (cmd === 'remote_take') {
        return new Uint8Array([0xff, 0xd8, 0xff]).buffer;
      }
      if (cmd === 'remote_list_pending') {
        return [{ id: 'p-99', mime: 'image/jpeg', size: 1024 }];
      }
      return null;
    });

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: mockInvoke,
    }));

    const ifaces = await getNetworkInterfaces();
    expect(ifaces).toEqual([{ name: 'wlan0', ip: '192.168.1.100' }]);
    expect(mockInvoke).toHaveBeenCalledWith('remote_list_interfaces');

    const status = await getRemoteCameraStatus();
    expect(status?.port).toBe(47831);
    expect(mockInvoke).toHaveBeenCalledWith('remote_status');

    const session = await startRemoteCamera('192.168.1.105');
    expect(session?.ip).toBe('192.168.1.105');
    expect(mockInvoke).toHaveBeenCalledWith('remote_start', { ip: '192.168.1.105' });

    await stopRemoteCamera();
    expect(mockInvoke).toHaveBeenCalledWith('remote_stop');

    const bytes = await takeRemotePhoto('p-123');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes?.length).toBe(3);
    expect(mockInvoke).toHaveBeenCalledWith('remote_take', { id: 'p-123' });

    const pending = await getRemotePendingPhotos();
    expect(pending).toEqual([{ id: 'p-99', mime: 'image/jpeg', size: 1024 }]);
    expect(mockInvoke).toHaveBeenCalledWith('remote_list_pending');

    await reportRemotePhoto('p-123', 'ok', 'Lida ✓');
    expect(mockInvoke).toHaveBeenCalledWith('remote_report', {
      id: 'p-123',
      status: 'ok',
      label: 'Lida ✓',
      message: undefined,
    });
  });
});

