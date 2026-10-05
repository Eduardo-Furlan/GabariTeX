import { describe, it, expect } from 'vitest';
import { encryptAnswerKey, decryptAnswerKey } from '../src/utils/crypto';
import { DecryptedQrPayload } from '../src/types/omr';

describe('Web Crypto AES-256-GCM Gabarito Security', () => {
  const samplePayload: DecryptedQrPayload = {
    examId: 'prova-calculo-1',
    version: 'B',
    key: {
      1: 'C',
      2: 'A',
      3: 'D',
      4: 'B',
      5: 'E',
    },
    points: {
      1: 2.0,
      2: 2.0,
      3: 2.0,
      4: 2.0,
      5: 2.0,
    },
  };

  const password = 'MinhaSenhaForte2026';

  it('deve criptografar e descriptografar com a senha correta preservando os dados', async () => {
    const encryptedStr = await encryptAnswerKey(samplePayload, password);

    expect(encryptedStr.startsWith('MCORR:v1:')).toBe(true);
    // Garante que o texto puro não aparece de forma legível na string criptografada
    expect(encryptedStr.includes('prova-calculo-1')).toBe(false);
    expect(encryptedStr.includes('version')).toBe(false);

    const decrypted = await decryptAnswerKey(encryptedStr, password);

    expect(decrypted.examId).toBe(samplePayload.examId);
    expect(decrypted.version).toBe(samplePayload.version);
    expect(decrypted.key).toEqual(samplePayload.key);
    expect(decrypted.points).toEqual(samplePayload.points);
  });

  it('deve rejeitar e falhar na descriptografia se a senha estiver incorreta', async () => {
    const encryptedStr = await encryptAnswerKey(samplePayload, password);

    await expect(decryptAnswerKey(encryptedStr, 'senhaIncorreta')).rejects.toThrow(
      'Senha incorreta ou gabarito inválido.'
    );
  });

  it('deve rejeitar strings que não possuem o prefixo de gabarito protegido', async () => {
    await expect(decryptAnswerKey('STRING_QUALQUER_123', password)).rejects.toThrow(
      'QR Code não reconhecido como gabarito protegido.'
    );
  });

  it('deve rejeitar payload corrompido ou adulterado', async () => {
    const encryptedStr = await encryptAnswerKey(samplePayload, password);
    const corrupted = encryptedStr.slice(0, -4) + 'abcd';

    await expect(decryptAnswerKey(corrupted, password)).rejects.toThrow();
  });
});
