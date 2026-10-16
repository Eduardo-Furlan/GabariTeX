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
});

