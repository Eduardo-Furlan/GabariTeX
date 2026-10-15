import { describe, it, expect } from 'vitest';
import {
  buildBackup,
  parseBackup,
  buildGradebookExport,
  parseGradebookExport,
  mergeGradebooks,
  BackupFile,
} from '../src/utils/backup';
import { emptyExam, initialSampleExam } from '../src/utils/sampleExam';
import { GradingRecord } from '../src/types/exam';

describe('Backup e Sincronização de Dados (backup.ts)', () => {
  const sampleRecords: GradingRecord[] = [
    {
      id: 'rec-1',
      timestamp: 1000,
      studentName: 'Lucas Lima',
      studentId: 'RA01',
      versionLetter: 'A',
      totalScore: 7,
      maxScore: 10,
      percentage: 70,
      answers: [],
    },
    {
      id: 'rec-2',
      timestamp: 2000,
      studentName: 'Mariana Souza',
      studentId: 'RA02',
      versionLetter: 'B',
      totalScore: 9,
      maxScore: 10,
      percentage: 90,
      answers: [],
    },
  ];

  it('deve realizar round-trip de backup completo com sucesso', () => {
    const backup = buildBackup(initialSampleExam, sampleRecords, 'senha-mestra-123');
    expect(backup.app).toBe('gabaritex');
    expect(backup.schema).toBe(1);
    expect(backup.teacherPassword).toBe('senha-mestra-123');
    expect(backup.exam.questions.length).toBe(initialSampleExam.questions.length);
    expect(backup.gradebook.length).toBe(2);

    const serialized = JSON.stringify(backup);
    const parsed = parseBackup(serialized);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.app).toBe('gabaritex');
      expect(parsed.data.schema).toBe(1);
      expect(parsed.data.exam.header.examTitle).toBe(initialSampleExam.header.examTitle);
      expect(parsed.data.gradebook.length).toBe(2);
      expect(parsed.data.teacherPassword).toBe('senha-mestra-123');
    }
  });

  describe('Validação de integridade em parseBackup', () => {
    it('deve rejeitar JSON malformado sem lançar exceção', () => {
      const res = parseBackup('{"app": "gabaritex", broken json');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('JSON inválido');
      }
    });

    it('deve rejeitar arquivos que não sejam objetos JSON', () => {
      expect(parseBackup('"string"').ok).toBe(false);
      expect(parseBackup('12345').ok).toBe(false);
      expect(parseBackup('[]').ok).toBe(false);
    });

    it('deve rejeitar backups de outras aplicações', () => {
      const other = JSON.stringify({ app: 'outro-app', schema: 1 });
      const res = parseBackup(other);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('não é um backup oficial do GabariTeX');
      }
    });

    it('deve rejeitar esquemas incompatíveis', () => {
      const wrongSchema = JSON.stringify({ app: 'gabaritex', schema: 99 });
      const res = parseBackup(wrongSchema);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('Versão de esquema não suportada');
      }
    });

    it('deve rejeitar backups com dados de prova ausentes ou corrompidos', () => {
      const noExam = JSON.stringify({
        app: 'gabaritex',
        schema: 1,
        exportedAt: new Date().toISOString(),
        gradebook: [],
      });
      const res = parseBackup(noExam);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('Dados da prova ausentes');
      }

      const corruptedExam = JSON.stringify({
        app: 'gabaritex',
        schema: 1,
        exportedAt: new Date().toISOString(),
        exam: { header: 'invalido' },
        gradebook: [],
      });
      expect(parseBackup(corruptedExam).ok).toBe(false);
    });

    it('deve rejeitar backups sem lista de notas', () => {
      const noGradebook = JSON.stringify({
        app: 'gabaritex',
        schema: 1,
        exportedAt: new Date().toISOString(),
        exam: emptyExam,
      });
      const res = parseBackup(noGradebook);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain('Lista de notas de correção ausente');
      }
    });
  });

  describe('Exportação e importação dedicada de notas', () => {
    it('deve exportar e reimportar livro de notas', () => {
      const exportData = buildGradebookExport(sampleRecords);
      expect(exportData.app).toBe('gabaritex-gradebook');
      expect(exportData.schema).toBe(1);

      const parsed = parseGradebookExport(JSON.stringify(exportData));
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.length).toBe(2);
        expect(parsed.data[0].id).toBe('rec-1');
      }
    });

    it('deve extrair notas a partir de um backup completo do GabariTeX', () => {
      const fullBackup = buildBackup(emptyExam, sampleRecords);
      const parsed = parseGradebookExport(JSON.stringify(fullBackup));
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.length).toBe(2);
      }
    });

    it('deve aceitar array puro de GradingRecord', () => {
      const parsed = parseGradebookExport(JSON.stringify(sampleRecords));
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.data.length).toBe(2);
      }
    });
  });

  describe('Mesclagem de notas (mergeGradebooks)', () => {
    it('deve adicionar novos registros sem duplicar existentes', () => {
      const current: GradingRecord[] = [sampleRecords[0]]; // rec-1
      const incoming: GradingRecord[] = [sampleRecords[1]]; // rec-2

      const { merged, summary } = mergeGradebooks(current, incoming);
      expect(summary.added).toBe(1);
      expect(summary.updated).toBe(0);
      expect(summary.unchanged).toBe(0);
      expect(merged.length).toBe(2);
      expect(merged.map((r) => r.id).sort()).toEqual(['rec-1', 'rec-2']);
    });

    it('deve atualizar registro existente se a versão importada for mais recente', () => {
      const current: GradingRecord[] = [
        { ...sampleRecords[0], timestamp: 1000, totalScore: 7 },
      ];
      const incoming: GradingRecord[] = [
        { ...sampleRecords[0], timestamp: 2000, totalScore: 8.5 }, // mais recente
      ];

      const { merged, summary } = mergeGradebooks(current, incoming);
      expect(summary.added).toBe(0);
      expect(summary.updated).toBe(1);
      expect(summary.unchanged).toBe(0);
      expect(merged.length).toBe(1);
      expect(merged[0].totalScore).toBe(8.5);
    });

    it('deve manter registro existente se o importado for mais antigo ou idêntico', () => {
      const current: GradingRecord[] = [
        { ...sampleRecords[0], timestamp: 2000, totalScore: 9 },
      ];
      const incoming: GradingRecord[] = [
        { ...sampleRecords[0], timestamp: 1000, totalScore: 5 }, // mais antigo
      ];

      const { merged, summary } = mergeGradebooks(current, incoming);
      expect(summary.added).toBe(0);
      expect(summary.updated).toBe(0);
      expect(summary.unchanged).toBe(1);
      expect(merged.length).toBe(1);
      expect(merged[0].totalScore).toBe(9);
    });

    it('deve ordenar registros resultantes por timestamp decrescente', () => {
      const current: GradingRecord[] = [
        { ...sampleRecords[0], id: 'old', timestamp: 100 },
      ];
      const incoming: GradingRecord[] = [
        { ...sampleRecords[1], id: 'newest', timestamp: 900 },
        { ...sampleRecords[1], id: 'mid', timestamp: 500 },
      ];

      const { merged } = mergeGradebooks(current, incoming);
      expect(merged.map((r) => r.id)).toEqual(['newest', 'mid', 'old']);
    });
  });
});

