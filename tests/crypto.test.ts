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

  it('deve realizar round-trip de subjectivePoints preservando as notas máximas', async () => {
    const payloadWithSubj: DecryptedQrPayload = {
      ...samplePayload,
      subjectiveQuestions: [6, 7],
      subjectivePoints: { 6: 2.5, 7: 3.0 },
    };

    const encrypted = await encryptAnswerKey(payloadWithSubj, password);
    const decrypted = await decryptAnswerKey(encrypted, password);

    expect(decrypted.subjectiveQuestions).toEqual([6, 7]);
    expect(decrypted.subjectivePoints).toEqual({ 6: 2.5, 7: 3.0 });
  });

  it('deve retornar subjectivePoints como undefined se o QR não contiver a chave sp', async () => {
    // samplePayload não possui subjectivePoints
    const encrypted = await encryptAnswerKey(samplePayload, password);
    const decrypted = await decryptAnswerKey(encrypted, password);

    expect(decrypted.subjectivePoints).toBeUndefined();
  });

  it('prova com 50 questões (sendo 10 dissertativas) deve gerar string criptografada < 2000 caracteres', async () => {
    const objKey: Record<number, string> = {};
    const objPoints: Record<number, number> = {};
    const subjQuestions: number[] = [];
    const subjPoints: Record<number, number> = {};

    for (let q = 1; q <= 40; q++) {
      objKey[q] = ['A', 'B', 'C', 'D', 'E'][q % 5];
      objPoints[q] = 1.5;
    }
    for (let q = 41; q <= 50; q++) {
      subjQuestions.push(q);
      subjPoints[q] = 2.0;
    }

    const largePayload: DecryptedQrPayload = {
      examId: 'prova-semestral-final-2026',
      version: 'A',
      key: objKey,
      points: objPoints,
      totalQuestions: 50,
      subjectiveQuestions: subjQuestions,
      subjectivePoints: subjPoints,
    };

    const encrypted = await encryptAnswerKey(largePayload, password);
    // Deve caber com folga em um QR Code versão 40-L (capacidade máx ~2953 bytes)
    expect(encrypted.length).toBeLessThan(2000);
  });
});
