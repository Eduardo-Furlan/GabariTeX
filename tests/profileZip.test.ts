import { describe, it, expect } from 'vitest';
import {
  buildProfileZip,
  parseProfileZip,
  summarizeProfileImport,
  mergeProfiles,
} from '../src/utils/profileZip';
import {
  generateExamPassword,
  UNAMBIGUOUS_PASSWORD_ALPHABET,
  decryptWithCandidatePasswords,
  encryptAnswerKey,
} from '../src/utils/crypto';
import { ProfileData } from '../src/types/profile';
import { Exam } from '../src/types/exam';
import { initialSampleExam } from '../src/utils/sampleExam';
import { strToU8, unzipSync, zipSync } from 'fflate';

describe('Profile ZIP Container e Senhas (Plano 08 §5 e §6)', () => {
  const sampleImage1 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const sampleImage2 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QzwAEjAwgAAAgfAD9hZ17PAAAAABJRU5ErkJggg==';

  const examWithImages: Exam = {
    ...initialSampleExam,
    id: 'exam-with-images',
    password: 'senhaSegura1',
    updatedAt: '2026-10-15T10:00:00.000Z',
    questions: [
      {
        id: 'q1',
        type: 'objective',
        prompt: 'Questão 1',
        points: 2,
        imageUrl: sampleImage1,
        options: [{ id: 'opt1', label: 'A', text: 'A', isCorrect: true }],
      },
      {
        id: 'q2',
        type: 'objective',
        prompt: 'Questão 2 com a mesma imagem de q1',
        points: 2,
        imageUrl: sampleImage1, // Imagem duplicada!
        options: [{ id: 'opt2', label: 'B', text: 'B', isCorrect: true }],
      },
      {
        id: 'q3',
        type: 'objective',
        prompt: 'Questão 3 com outra imagem',
        points: 2,
        imageUrl: sampleImage2,
        options: [{ id: 'opt3', label: 'C', text: 'C', isCorrect: true }],
      },
    ],
  };

  const sampleProfile: ProfileData = {
    exams: [examWithImages],
    classes: [
      {
        id: 'class-1',
        name: 'Turma A',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        students: [{ id: 's1', name: 'Aluno 1' }],
      },
    ],
    records: [
      {
        id: 'rec-1',
        examId: 'exam-with-images',
        studentName: 'Aluno 1',
        studentId: 'A01',
        timestamp: 1000,
        versionLetter: 'A',
        totalScore: 4,
        maxScore: 6,
        percentage: 66.6,
        answers: [],
      },
    ],
  };

  it('deve gerar senha de 8 caracteres sem caracteres ambíguos', () => {
    const pwd1 = generateExamPassword();
    const pwd2 = generateExamPassword();

    expect(pwd1.length).toBe(8);
    expect(pwd2.length).toBe(8);
    expect(pwd1).not.toBe(pwd2);

    for (const char of pwd1) {
      expect(UNAMBIGUOUS_PASSWORD_ALPHABET.includes(char)).toBe(true);
      // Nenhum caractere ambíguo
      expect(['0', 'O', 'o', '1', 'I', 'l'].includes(char)).toBe(false);
    }
  });

  it('deve extrair, deduplicar e reinserir imagens de forma idêntica', async () => {
    const zipBytes = await buildProfileZip(sampleProfile);
    expect(zipBytes.byteLength).toBeGreaterThan(0);

    const unzipped = unzipSync(zipBytes);
    // Deve haver manifest.json, profile.json e apenas 2 imagens em assets/ (sampleImage1 e sampleImage2)
    const assetFiles = Object.keys(unzipped).filter((k) => k.startsWith('assets/'));
    expect(assetFiles.length).toBe(2);

    const parsed = await parseProfileZip(zipBytes);
    expect(parsed.manifest.counts.assets).toBe(2);
    expect(parsed.profile.exams.length).toBe(1);

    const restoredExam = parsed.profile.exams[0];
    expect(restoredExam.questions[0].imageUrl).toBe(sampleImage1);
    expect(restoredExam.questions[1].imageUrl).toBe(sampleImage1);
    expect(restoredExam.questions[2].imageUrl).toBe(sampleImage2);
  });

  it('deve exportar e restaurar senhas quando includePasswords é true', async () => {
    const zipBytes = await buildProfileZip(sampleProfile, {}, { includePasswords: true });
    const parsed = await parseProfileZip(zipBytes);

    expect(parsed.manifest.includes.passwords).toBe(true);
    expect(parsed.profile.exams[0].password).toBe('senhaSegura1');
    expect(parsed.passwordsGenerated.length).toBe(0);
  });

  it('deve omitir senhas quando includePasswords é false e gerar senha nova ao importar', async () => {
    const zipBytes = await buildProfileZip(sampleProfile, {}, { includePasswords: false });
    const parsed = await parseProfileZip(zipBytes);

    expect(parsed.manifest.includes.passwords).toBe(false);
    // O exame restaurado recebe uma senha nova
    expect(parsed.profile.exams[0].password).toBeTruthy();
    expect(parsed.profile.exams[0].password.length).toBe(8);
    expect(parsed.profile.exams[0].password).not.toBe('senhaSegura1');
    expect(parsed.passwordsGenerated.length).toBe(1);
  });

  it('deve omitir dados de alunos quando includeRecords e includeClasses são false (Compartilhar prova)', async () => {
    const zipBytes = await buildProfileZip(
      sampleProfile,
      {},
      { includeRecords: false, includeClasses: false, includePasswords: false }
    );
    const parsed = await parseProfileZip(zipBytes);

    expect(parsed.manifest.includes.records).toBe(false);
    expect(parsed.manifest.includes.classes).toBe(false);
    expect(parsed.profile.records.length).toBe(0);
    expect(parsed.profile.classes.length).toBe(0);
  });

  describe('Validação de integridade do manifest e hashes', () => {
    it('deve rejeitar ZIP quando o manifest tiver app diferente de gabaritex', async () => {
      const zipBytes = await buildProfileZip(sampleProfile);
      const unzipped = unzipSync(zipBytes);
      const manifest = JSON.parse(new TextDecoder().decode(unzipped['manifest.json']));
      manifest.app = 'outro-app';
      unzipped['manifest.json'] = strToU8(JSON.stringify(manifest));
      const corruptedZip = zipSync(unzipped);

      await expect(parseProfileZip(corruptedZip)).rejects.toThrow(
        'Arquivo não reconhecido como perfil do GabariTeX'
      );
    });

    it('deve rejeitar ZIP quando schema for diferente de 1', async () => {
      const zipBytes = await buildProfileZip(sampleProfile);
      const unzipped = unzipSync(zipBytes);
      const manifest = JSON.parse(new TextDecoder().decode(unzipped['manifest.json']));
      manifest.schema = 2;
      unzipped['manifest.json'] = strToU8(JSON.stringify(manifest));
      const corruptedZip = zipSync(unzipped);

      await expect(parseProfileZip(corruptedZip)).rejects.toThrow('incompatível com esta versão');
    });

    it('deve rejeitar ZIP quando um arquivo listado tiver hash adulterado', async () => {
      const zipBytes = await buildProfileZip(sampleProfile);
      const unzipped = unzipSync(zipBytes);
      // Adultera profile.json
      unzipped['profile.json'] = strToU8('{"exams": [], "adulterado": true}');
      const corruptedZip = zipSync(unzipped);

      await expect(parseProfileZip(corruptedZip)).rejects.toThrow(
        'Arquivo corrompido ou incompleto: divergência no hash de profile.json'
      );
    });

    it('deve rejeitar ZIP quando um arquivo do manifest estiver faltando', async () => {
      const zipBytes = await buildProfileZip(sampleProfile);
      const unzipped = unzipSync(zipBytes);
      delete unzipped['profile.json'];
      const corruptedZip = zipSync(unzipped);

      await expect(parseProfileZip(corruptedZip)).rejects.toThrow(
        'arquivo ausente no ZIP: profile.json'
      );
    });
  });

  describe('Mesclagem de perfis (mergeProfiles)', () => {
    it('deve mesclar exames por ID mantendo o mais recente e unificar turmas e notas', () => {
      const current: ProfileData = {
        exams: [
          {
            ...examWithImages,
            id: 'e1',
            updatedAt: '2026-10-10T12:00:00.000Z',
            header: { ...examWithImages.header, examTitle: 'Versão Antiga' },
          },
        ],
        classes: [
          {
            id: 'c1',
            name: 'Turma Antiga',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
            students: [],
          },
        ],
        records: [
          {
            id: 'r1',
            examId: 'e1',
            studentName: 'A1',
            studentId: '1',
            timestamp: 1,
            versionLetter: 'A',
            totalScore: 5,
            maxScore: 10,
            percentage: 50,
            answers: [],
          },
        ],
      };

      const imported: ProfileData = {
        exams: [
          // e1 mais recente
          {
            ...examWithImages,
            id: 'e1',
            updatedAt: '2026-10-15T12:00:00.000Z',
            header: { ...examWithImages.header, examTitle: 'Versão Mais Recente' },
          },
          // e2 novo
          {
            ...examWithImages,
            id: 'e2',
            updatedAt: '2026-10-12T12:00:00.000Z',
            header: { ...examWithImages.header, examTitle: 'Prova Nova' },
          },
        ],
        classes: [
          // c1 mais recente
          {
            id: 'c1',
            name: 'Turma Atualizada',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-14T00:00:00.000Z',
            students: [{ id: 's1', name: 'Aluno X' }],
          },
        ],
        records: [
          // r1 já existe no current, não duplica
          {
            id: 'r1',
            examId: 'e1',
            studentName: 'A1',
            studentId: '1',
            timestamp: 1,
            versionLetter: 'A',
            totalScore: 5,
            maxScore: 10,
            percentage: 50,
            answers: [],
          },
          // r2 novo
          {
            id: 'r2',
            examId: 'e2',
            studentName: 'A2',
            studentId: '2',
            timestamp: 2,
            versionLetter: 'B',
            totalScore: 8,
            maxScore: 10,
            percentage: 80,
            answers: [],
          },
        ],
      };

      const summary = summarizeProfileImport(current, imported);
      expect(summary.examsCount).toBe(2);
      expect(summary.newExams).toBe(1);
      expect(summary.existingExams).toBe(1);
      expect(summary.newerExams).toBe(1);
      expect(summary.newRecords).toBe(1);

      const { mergedData } = mergeProfiles(current, imported);
      expect(mergedData.exams.length).toBe(2);
      const e1Merged = mergedData.exams.find((e) => e.id === 'e1');
      expect(e1Merged?.header.examTitle).toBe('Versão Mais Recente');

      const c1Merged = mergedData.classes.find((c) => c.id === 'c1');
      expect(c1Merged?.name).toBe('Turma Atualizada');

      expect(mergedData.records.length).toBe(2);
      expect(mergedData.records.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    });
  });

  describe('Estratégia de senhas do corretor (§3.3)', () => {
    it('deve priorizar a senha da prova ativa e tentar as demais senhas até o limite', async () => {
      const payload = {
        examId: 'prova-alvo',
        version: 'A',
        key: { 1: 'B' },
      };
      const correctPassword = 'senhaDaProvaAlvo';
      const encryptedQr = await encryptAnswerKey(payload, correctPassword);

      // Cenário 1: Prova ativa tem a senha correta (índice 0)
      const res1 = await decryptWithCandidatePasswords(encryptedQr, [
        correctPassword,
        'outra1',
        'outra2',
      ]);
      expect(res1.attemptIndex).toBe(0);
      expect(res1.passwordUsed).toBe(correctPassword);
      expect(res1.payload.examId).toBe('prova-alvo');

      // Cenário 2: Prova ativa tem senha incorreta, mas uma das provas da biblioteca tem a correta
      const res2 = await decryptWithCandidatePasswords(encryptedQr, [
        'senhaAtivaErrada',
        'outraSenha1',
        correctPassword,
        'outraSenha2',
      ]);
      expect(res2.attemptIndex).toBe(2);
      expect(res2.passwordUsed).toBe(correctPassword);

      // Cenário 3: Nenhuma senha confere
      await expect(
        decryptWithCandidatePasswords(encryptedQr, ['errada1', 'errada2', 'errada3'])
      ).rejects.toThrow('Não consegui abrir este QR com as senhas das provas deste perfil');
    });
  });
});

