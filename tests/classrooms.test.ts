import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  normalizeRegistration,
  createClassroom,
  addStudent,
  updateStudent,
  removeStudent,
  searchStudents,
  parseStudentList,
  mergeIntoClassroom,
  findDuplicateRecord,
  missingStudents,
  readTextFile,
} from '../src/utils/classrooms';
import { Classroom, GradingRecord } from '../src/types/exam';

describe('Plano 06 — Turmas e Alunos (Funções Puras)', () => {
  describe('normalizeText', () => {
    it('deve converter para minúsculas, remover acentos e colapsar espaços', () => {
      expect(normalizeText('JOÃO  da Silva')).toBe('joao da silva');
      expect(normalizeText('  Érica    CONCEIÇÃO ')).toBe('erica conceicao');
      expect(normalizeText('')).toBe('');
    });
  });

  describe('normalizeRegistration', () => {
    it('deve aplicar trim, remover espaços internos, minúsculas e PRESERVAR zeros à esquerda', () => {
      expect(normalizeRegistration(' 00123 ')).toBe('00123');
      expect(normalizeRegistration(' 00123 ') === '123').toBe(false);
      expect(normalizeRegistration('RA 2026-009 ')).toBe('ra2026-009');
      expect(normalizeRegistration('000456')).toBe('000456');
    });
  });

  describe('Gerenciamento de Turma (create, add, update, remove, search)', () => {
    it('deve criar uma turma com timestamps ISO', () => {
      const c = createClassroom('3º Ano A');
      expect(c.name).toBe('3º Ano A');
      expect(c.students.length).toBe(0);
      expect(c.id).toBeDefined();
      expect(c.createdAt).toBeDefined();
      expect(c.updatedAt).toBeDefined();
    });

    it('deve adicionar alunos e rejeitar nome vazio', () => {
      let c = createClassroom('Turma 1');
      c = addStudent(c, { name: 'Lucas Silva', registration: '001' });
      expect(c.students.length).toBe(1);
      expect(c.students[0].name).toBe('Lucas Silva');
      expect(c.students[0].registration).toBe('001');

      expect(() => addStudent(c, { name: '   ' })).toThrow('Nome do aluno não pode ser vazio.');
    });

    it('deve atualizar aluno e preservar dados imutáveis', () => {
      let c = createClassroom('Turma 1');
      c = addStudent(c, { name: 'Ana', registration: '10' });
      const studentId = c.students[0].id;

      c = updateStudent(c, studentId, { name: 'Ana Paula', registration: '10-A' });
      expect(c.students[0].name).toBe('Ana Paula');
      expect(c.students[0].registration).toBe('10-A');
      expect(c.students[0].id).toBe(studentId);

      expect(() => updateStudent(c, studentId, { name: '' })).toThrow();
    });

    it('deve remover aluno por id', () => {
      let c = createClassroom('Turma 1');
      c = addStudent(c, { name: 'Ana', registration: '1' });
      c = addStudent(c, { name: 'Beto', registration: '2' });
      expect(c.students.length).toBe(2);

      const anaId = c.students[0].id;
      c = removeStudent(c, anaId);
      expect(c.students.length).toBe(1);
      expect(c.students[0].name).toBe('Beto');
    });

    it('deve buscar alunos por nome insensível a acentos ou por matrícula', () => {
      let c = createClassroom('Turma 1');
      c = addStudent(c, { name: 'Joãozinho Silva', registration: '2026-001' });
      c = addStudent(c, { name: 'Maria Conceição', registration: '2026-002' });
      c = addStudent(c, { name: 'Pedro Paulo', registration: '9999' });

      expect(searchStudents(c, 'joao').length).toBe(1);
      expect(searchStudents(c, 'JOAO')[0].name).toBe('Joãozinho Silva');
      expect(searchStudents(c, 'conceicao').length).toBe(1);
      expect(searchStudents(c, '2026').length).toBe(2);
      expect(searchStudents(c, '9999').length).toBe(1);
      expect(searchStudents(c, 'inexistente').length).toBe(0);
      expect(searchStudents(c, '').length).toBe(3);
    });
  });

  describe('parseStudentList', () => {
    it('deve detectar separador ponto-e-vírgula com cabeçalho', () => {
      const csv = `Nome;Matrícula
João Silva;00123
Maria Santos;00124`;
      const res = parseStudentList(csv);
      expect(res.students.length).toBe(2);
      expect(res.students[0].name).toBe('João Silva');
      expect(res.students[0].registration).toBe('00123');
      expect(res.duplicates).toBe(0);
      expect(res.ignoredLines).toBe(0);
    });

    it('deve detectar separador tabulação (copiado do Excel/Planilhas)', () => {
      const tsv = `Matrícula\tAluno
00991\tCarlos Drummond
00992\tClarice Lispector`;
      const res = parseStudentList(tsv);
      expect(res.students.length).toBe(2);
      expect(res.students[0].name).toBe('Carlos Drummond');
      expect(res.students[0].registration).toBe('00991');
    });

    it('deve suportar uma única coluna (apenas nomes)', () => {
      const text = `Fulano de Tal
Ciclano de Sousa
Beltrano Júnior`;
      const res = parseStudentList(text);
      expect(res.students.length).toBe(3);
      expect(res.students[0].name).toBe('Fulano de Tal');
      expect(res.students[0].registration).toBeUndefined();
    });

    it('deve suportar duas colunas sem cabeçalho identificando a numérica como matrícula', () => {
      const csv = `0012;Mariana Rios
0013;Roberto Carlos`;
      const res = parseStudentList(csv);
      expect(res.students.length).toBe(2);
      expect(res.students[0].name).toBe('Mariana Rios');
      expect(res.students[0].registration).toBe('0012');
    });

    it('deve respeitar campos entre aspas com vírgula interna e ignorar BOM', () => {
      const csv = `\uFEFF"Silva, João";001
"Santos, Maria";002`;
      const res = parseStudentList(csv);
      expect(res.students.length).toBe(2);
      expect(res.students[0].name).toBe('Silva, João');
      expect(res.students[0].registration).toBe('001');
    });

    it('deve identificar duplicados dentro do próprio arquivo e ignorar linhas vazias', () => {
      const text = `
João Silva;001

Maria Santos;002
João Outro;001
João Silva;009
`;
      const res = parseStudentList(text);
      expect(res.students.length).toBe(2); // João Silva (001) e Maria Santos (002)
      expect(res.duplicates).toBe(2); // 001 repetido e João Silva repetido
      expect(res.ignoredLines).toBeGreaterThan(0);
    });

    it('deve detectar separador traço/hífen digitado manualmente', () => {
      const text = `João da Silva - 00123
Maria Santos - 00124`;
      const res = parseStudentList(text);
      expect(res.students.length).toBe(2);
      expect(res.students[0].name).toBe('João da Silva');
      expect(res.students[0].registration).toBe('00123');
      expect(res.students[1].name).toBe('Maria Santos');
      expect(res.students[1].registration).toBe('00124');
    });

    it('deve detectar separador barra vertical (pipe) digitado manualmente', () => {
      const text = `João da Silva | 00123
Maria Santos | 00124`;
      const res = parseStudentList(text);
      expect(res.students.length).toBe(2);
      expect(res.students[0].name).toBe('João da Silva');
      expect(res.students[0].registration).toBe('00123');
    });

    it('deve preservar hífens internos em nomes e matrículas ao usar traço como separador', () => {
      const text = `Jean-Claude Van Damme - 2026-001
Maria-Eduarda Ferreira - 2026-002`;
      const res = parseStudentList(text);
      expect(res.students.length).toBe(2);
      expect(res.students[0].name).toBe('Jean-Claude Van Damme');
      expect(res.students[0].registration).toBe('2026-001');
      expect(res.students[1].name).toBe('Maria-Eduarda Ferreira');
      expect(res.students[1].registration).toBe('2026-002');
    });

    it('deve suportar matrícula antes do nome com traço', () => {
      const text = `00123 - João da Silva
00124 - Maria Santos`;
      const res = parseStudentList(text);
      expect(res.students.length).toBe(2);
      expect(res.students[0].name).toBe('João da Silva');
      expect(res.students[0].registration).toBe('00123');
    });
  });

  describe('mergeIntoClassroom', () => {
    it('deve mesclar novos alunos sem repetir por matrícula nem por nome normalizado', () => {
      let c = createClassroom('Turma A');
      c = addStudent(c, { name: 'João Silva', registration: '001' });

      const incoming = [
        { name: 'joao silva', registration: '999' }, // mesmo nome
        { name: 'Carlos', registration: '001' },     // mesma matrícula
        { name: 'Nova Aluna', registration: '002' }, // novo
      ];

      const res = mergeIntoClassroom(c, incoming);
      expect(res.added).toBe(1);
      expect(res.skipped).toBe(2);
      expect(res.classroom.students.length).toBe(2);
      expect(res.classroom.students[1].name).toBe('Nova Aluna');
    });
  });

  describe('findDuplicateRecord', () => {
    const existingRecords: GradingRecord[] = [
      {
        id: 'rec-1',
        timestamp: Date.now(),
        studentName: 'João Silva',
        studentId: '00123',
        classId: 'class-A',
        studentRef: 'student-uuid-1',
        versionLetter: 'A',
        totalScore: 8,
        maxScore: 10,
        percentage: 80,
        answers: [],
      },
    ];

    it('deve identificar duplicata por studentRef', () => {
      const dup = findDuplicateRecord(existingRecords, {
        studentRef: 'student-uuid-1',
        classId: 'class-A',
      });
      expect(dup).toBeDefined();
      expect(dup?.id).toBe('rec-1');
    });

    it('deve identificar duplicata por matrícula normalizada na mesma turma', () => {
      const dup = findDuplicateRecord(existingRecords, {
        registration: ' 00123 ',
        classId: 'class-A',
      });
      expect(dup).toBeDefined();
      expect(dup?.id).toBe('rec-1');
    });

    it('não deve considerar duplicata se a matrícula for igual mas em outra turma', () => {
      const dup = findDuplicateRecord(existingRecords, {
        registration: '00123',
        classId: 'class-B',
      });
      expect(dup).toBeUndefined();
    });

    it('sem studentRef e sem matrícula nunca considera duplicado', () => {
      const dup = findDuplicateRecord(existingRecords, {
        classId: 'class-A',
      });
      expect(dup).toBeUndefined();
    });
  });

  describe('missingStudents', () => {
    it('deve listar alunos sem nota na turma', () => {
      let c = createClassroom('Turma A');
      c.id = 'class-A';
      c = addStudent(c, { name: 'Aluno Com Nota 1', registration: '101' });
      c = addStudent(c, { name: 'Aluno Com Nota 2', registration: '102' });
      c = addStudent(c, { name: 'Aluno Faltante', registration: '103' });

      const records: GradingRecord[] = [
        {
          id: 'r1',
          timestamp: Date.now(),
          studentName: 'Aluno 1',
          studentId: '101',
          classId: 'class-A',
          studentRef: c.students[0].id,
          versionLetter: 'A',
          totalScore: 10,
          maxScore: 10,
          percentage: 100,
          answers: [],
        },
        {
          id: 'r2',
          timestamp: Date.now(),
          studentName: 'Aluno 2',
          studentId: '102',
          classId: 'class-A',
          versionLetter: 'A',
          totalScore: 5,
          maxScore: 10,
          percentage: 50,
          answers: [],
        },
      ];

      const missing = missingStudents(c, records);
      expect(missing.length).toBe(1);
      expect(missing[0].name).toBe('Aluno Faltante');
    });
  });

  describe('readTextFile com fallback para Windows-1252', () => {
    it('deve ler utf-8 normalmente', async () => {
      const blob = new Blob(['João Conceição'], { type: 'text/plain' });
      const text = await readTextFile(blob);
      expect(text).toBe('João Conceição');
    });

    it('deve ler Windows-1252 quando UTF-8 falhar', async () => {
      // Byte 0xE3 = 'ã' em Windows-1252, mas é sequência UTF-8 inválida quando isolado
      const winBytes = new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f]); // "João" em Windows-1252
      const blob = new Blob([winBytes]);
      const text = await readTextFile(blob);
      expect(text).toBe('João');
    });
  });

  describe('Resiliência a dados legados/malformados (students undefined)', () => {
    it('searchStudents e missingStudents não devem lançar erro quando students for undefined', () => {
      const malformedClass = {
        id: 'c-legacy',
        name: 'Turma Legada',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as unknown as Classroom;

      expect(() => searchStudents(malformedClass, 'teste')).not.toThrow();
      expect(searchStudents(malformedClass, 'teste')).toEqual([]);

      expect(() => missingStudents(malformedClass, [])).not.toThrow();
      expect(missingStudents(malformedClass, [])).toEqual([]);
    });

    it('addStudent, updateStudent e removeStudent tratam students undefined graciosamente', () => {
      const malformedClass = {
        id: 'c-legacy',
        name: 'Turma Legada',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as unknown as Classroom;

      const added = addStudent(malformedClass, { name: 'Novo Aluno' });
      expect(added.students.length).toBe(1);
      expect(added.students[0].name).toBe('Novo Aluno');

      const removed = removeStudent(malformedClass, 'non-existent');
      expect(removed.students).toEqual([]);
    });
  });
});

