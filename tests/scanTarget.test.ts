import { describe, it, expect } from 'vitest';
import { gradePhotoFile } from '../src/utils/photoPipeline';

describe('scanTarget: separação de etapas de leitura', () => {
  it('rejeita leitura de gabarito (scanTarget: sheet) se nenhuma versão estiver travada', async () => {
    const dummyFile = new File([new Uint8Array([1, 2, 3])], 'dummy.png', { type: 'image/png' });

    const result = await gradePhotoFile(dummyFile, {
      teacherPassword: 'senha',
      lockedPayload: null,
      scanTarget: 'sheet',
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('Nenhuma versão de prova está travada');
  });

  it('rejeita leitura de QR Code (scanTarget: qr) se a senha do professor não for informada', async () => {
    const dummyFile = new File([new Uint8Array([1, 2, 3])], 'dummy.png', { type: 'image/png' });

    const result = await gradePhotoFile(dummyFile, {
      teacherPassword: '',
      lockedPayload: null,
      scanTarget: 'qr',
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('informe a senha da prova');
  });

  it('no modo desktop, scanTarget: qr invoca processExamPhotoNative exclusivamente com readQr: true e readOmr: false', async () => {
    const { vi } = await import('vitest');
    vi.stubGlobal('__DESKTOP__', true);
    const omrBackend = await import('../src/platform/omrBackend');
    const spy = vi.spyOn(omrBackend, 'processExamPhotoNative').mockResolvedValueOnce({
      qrRawText: undefined,
      detections: [],
      debugInfo: {} as any,
      omrError: { code: 'QR_NOT_FOUND', message: 'QR não encontrado' },
    });

    const dummyFile = new File([new Uint8Array([1, 2, 3])], 'qr.jpg', { type: 'image/jpeg' });
    const res = await gradePhotoFile(dummyFile, {
      teacherPassword: 'senha',
      lockedPayload: null,
      scanTarget: 'qr',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({
        readQr: true,
        readOmr: false,
      })
    );
    expect(res.status).toBe('error');
    spy.mockRestore();
  });

  it('no modo desktop, scanTarget: sheet invoca processExamPhotoNative exclusivamente com readQr: false e readOmr: true', async () => {
    const { vi } = await import('vitest');
    vi.stubGlobal('__DESKTOP__', true);
    const omrBackend = await import('../src/platform/omrBackend');
    const spy = vi.spyOn(omrBackend, 'processExamPhotoNative').mockResolvedValueOnce({
      qrRawText: undefined,
      detections: [],
      debugInfo: {
        markersFound: 4,
        perspectiveSuccess: true,
        alignmentMethod: '4-corners',
        qrDetected: false,
        processingTimeMs: 12,
        imageDimensions: { width: 800, height: 1000 },
        logs: [],
      },
    });

    const dummyFile = new File([new Uint8Array([1, 2, 3])], 'sheet.jpg', { type: 'image/jpeg' });
    const res = await gradePhotoFile(dummyFile, {
      teacherPassword: 'senha',
      lockedPayload: {
        version: 'A',
        examId: 'exam-123',
        totalQuestions: 5,
        key: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' },
      },
      scanTarget: 'sheet',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({
        readQr: false,
        readOmr: true,
        totalQuestions: 5,
      })
    );
    expect(res.status).toBe('graded');
    expect(res.payloadSource).toBe('locked');
    spy.mockRestore();
  });
});

