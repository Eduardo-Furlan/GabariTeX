import { describe, it, expect } from 'vitest';
import { generateExamVersions } from '../src/utils/randomizer';
import { initialSampleExam } from '../src/utils/sampleExam';
import { decryptAnswerKey } from '../src/utils/crypto';

describe('Randomizador de Provas e Gabaritos', () => {
  it('deve gerar o número correto de versões configurado no exame', async () => {
    const versions = await generateExamVersions(initialSampleExam);
    expect(versions.length).toBe(initialSampleExam.versionCount);
    expect(versions[0].versionLetter).toBe('A');
    expect(versions[1].versionLetter).toBe('B');
    expect(versions[2].versionLetter).toBe('C');
    expect(versions[3].versionLetter).toBe('D');
  });

  it('deve manter a coerência das respostas corretas após o embaralhamento de alternativas', async () => {
    const versions = await generateExamVersions(initialSampleExam);

    for (const version of versions) {
      // Verifica cada questão objetiva
      let objIndex = 1;
      for (const q of version.questions) {
        if (q.type === 'objective' && q.options) {
          const correctKeyLetter = version.objectiveAnswerKey[objIndex];
          const markedOption = q.options.find((opt) => opt.label === correctKeyLetter);

          expect(markedOption).toBeDefined();
          expect(markedOption?.isCorrect).toBe(true);

          objIndex++;
        }
      }
    }
  });

  it('questões dissertativas não devem constar no gabarito objetivo de bolinhas', async () => {
    const versions = await generateExamVersions(initialSampleExam);
    const objCount = initialSampleExam.questions.filter((q) => q.type === 'objective').length;

    for (const version of versions) {
      const keysCount = Object.keys(version.objectiveAnswerKey).length;
      expect(keysCount).toBe(objCount);
    }
  });

  it('o QR code de cada versão deve ser descriptografável com a senha da prova e bater com o gabarito', async () => {
    const versions = await generateExamVersions(initialSampleExam);

    for (const version of versions) {
      const payload = await decryptAnswerKey(version.encryptedQrPayload, initialSampleExam.password);
      expect(payload.version).toBe(version.versionLetter);
      expect(payload.key).toEqual(version.objectiveAnswerKey);
    }
  });
});
