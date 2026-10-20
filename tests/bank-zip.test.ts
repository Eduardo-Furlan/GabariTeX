import { describe, it, expect } from 'vitest';
import {
  buildProfileZip,
  parseProfileZip,
  summarizeProfileImport,
  mergeProfiles,
  mergeBankData,
} from '../src/utils/profileZip';
import { ProfileData } from '../src/types/profile';
import { BankData, BankGroup, BankTag, BankQuestion, Blueprint } from '../src/types/bank';
import { Exam } from '../src/types/exam';
import { initialSampleExam } from '../src/utils/sampleExam';
import { strFromU8 } from 'fflate';

describe('Banco de Questões no Perfil ZIP (Plano 5.2)', () => {
  const sampleImage1 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const sampleImage2 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QzwAEjAwgAAAgfAD9hZ17PAAAAABJRU5ErkJggg==';

  const bankGroup1: BankGroup = {
    id: 'grp-1',
    parentId: null,
    name: 'Matemática',
    order: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const bankTag1: BankTag = {
    id: 'tag-1',
    name: 'Geometria',
    color: 'blue',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const bankQuestion1: BankQuestion = {
    id: 'bq-1',
    groupId: 'grp-1',
    tagIds: ['tag-1'],
    type: 'objective',
    prompt: 'Qual a área de um triângulo equilátero de lado 2?',
    points: 2,
    imageUrl: sampleImage1, // mesma imagem que a prova usará
    options: [
      { id: 'opt1', label: 'A', text: '√3', isCorrect: true },
      { id: 'opt2', label: 'B', text: '2√3', isCorrect: false },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const bankQuestion2: BankQuestion = {
    id: 'bq-2',
    groupId: 'grp-1',
    tagIds: ['tag-1'],
    type: 'objective',
    prompt: 'Qual o valor da diagonal de um quadrado de lado 1?',
    points: 1,
    imageUrl: sampleImage2,
    options: [
      { id: 'opt1', label: 'A', text: '√2', isCorrect: true },
      { id: 'opt2', label: 'B', text: '2', isCorrect: false },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const bankBlueprint1: Blueprint = {
    id: 'bp-1',
    name: 'Modelo Geometria',
    blocks: [
      {
        id: 'block-1',
        source: { kind: 'group', groupId: 'grp-1', descendants: true },
        quotas: [
          {
            id: 'quota-1',
            count: 2,
            filter: { tagIds: ['tag-1'], notTagIds: [] },
          },
        ],
      },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const sampleBank: BankData = {
    groups: [bankGroup1],
    tags: [bankTag1],
    questions: [bankQuestion1, bankQuestion2],
    blueprints: [bankBlueprint1],
  };

  const examWithImage: Exam = {
    ...initialSampleExam,
    id: 'exam-1',
    updatedAt: '2026-10-01T00:00:00.000Z',
    questions: [
      {
        id: 'eq-1',
        type: 'objective',
        prompt: 'Questão da prova com imagem igual à do banco',
        points: 2,
        imageUrl: sampleImage1,
        options: [{ id: 'opt-a', label: 'A', text: 'Correta', isCorrect: true }],
      },
    ],
  };

  const sampleProfileWithBank: ProfileData = {
    exams: [examWithImage],
    classes: [],
    records: [],
    bank: sampleBank,
  };

  it('exporta perfil com banco e deduplica imagem entre prova e banco de questões', async () => {
    const zipBytes = await buildProfileZip(sampleProfileWithBank);
    const parsed = await parseProfileZip(zipBytes);

    expect(parsed.manifest.includes.bank).toBe(true);
    expect(parsed.manifest.counts.bankQuestions).toBe(2);
    expect(parsed.manifest.counts.bankGroups).toBe(1);
    expect(parsed.manifest.counts.bankTags).toBe(1);
    expect(parsed.manifest.counts.bankBlueprints).toBe(1);

    // Deve haver exatamente 2 assets únicos (sampleImage1 usada no exame e na bq-1, sampleImage2 na bq-2)
    expect(parsed.manifest.counts.assets).toBe(2);

    // Banco de questões restaurado corretamente
    expect(parsed.profile.bank).toBeDefined();
    expect(parsed.profile.bank?.questions.length).toBe(2);
    expect(parsed.profile.bank?.questions[0].imageUrl).toBe(sampleImage1);
    expect(parsed.profile.bank?.questions[1].imageUrl).toBe(sampleImage2);

    // Questão da prova também restaurada
    expect(parsed.profile.exams[0].questions[0].imageUrl).toBe(sampleImage1);
  });

  it('permite omitir o banco com includeBank: false', async () => {
    const zipBytes = await buildProfileZip(sampleProfileWithBank, {}, { includeBank: false });
    const parsed = await parseProfileZip(zipBytes);

    expect(parsed.manifest.includes.bank).toBeUndefined();
    expect(parsed.manifest.counts.bankQuestions).toBeUndefined();
    expect(parsed.profile.bank).toBeUndefined();
  });

  it('não inclui banco quando bank for vazio ou ausente', async () => {
    const emptyBankProfile: ProfileData = {
      exams: [examWithImage],
      classes: [],
      records: [],
      bank: { groups: [], tags: [], questions: [], blueprints: [] },
    };
    const zipBytes = await buildProfileZip(emptyBankProfile);
    const parsed = await parseProfileZip(zipBytes);

    expect(parsed.manifest.includes.bank).toBeUndefined();
    expect(parsed.profile.bank).toBeUndefined();
  });

  it('leitor 1.1 ignora banco silenciosamente ao ler profile.json', async () => {
    const zipBytes = await buildProfileZip(sampleProfileWithBank);
    const { safeUnzip } = await import('../src/utils/zipAssets');
    const unzipped = safeUnzip(zipBytes);

    const profileJson = JSON.parse(strFromU8(unzipped['profile.json']));
    // Leitor legado que lê apenas exams, classes, records
    const legacyExams = profileJson.exams || [];
    const legacyClasses = profileJson.classes || [];
    const legacyRecords = profileJson.records || [];

    expect(legacyExams.length).toBe(1);
    expect(legacyClasses.length).toBe(0);
    expect(legacyRecords.length).toBe(0);
    expect(profileJson.bank).toBeDefined();
  });

  it('summarizeProfileImport sumariza corretamente adições e existências do banco', () => {
    const currentData: ProfileData = {
      exams: [],
      classes: [],
      records: [],
      bank: {
        groups: [bankGroup1],
        tags: [bankTag1],
        questions: [bankQuestion1],
        blueprints: [],
      },
    };

    const summary = summarizeProfileImport(currentData, sampleProfileWithBank);

    expect(summary.newBankQuestions).toBe(1); // bq-2 é nova
    expect(summary.existingBankQuestions).toBe(1); // bq-1 já existia
    expect(summary.bankGroups).toBe(1);
    expect(summary.bankTags).toBe(1);
    expect(summary.bankBlueprints).toBe(1);
  });

  it('mergeBankData mescla grupos, questões e modelos com regras de updatedAt e unificação de tags', () => {
    const currentBank: BankData = {
      groups: [
        {
          id: 'grp-1',
          parentId: null,
          name: 'Matemática Antiga',
          order: 0,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      tags: [
        {
          id: 'tag-local-1',
          name: 'GEOMETRIA', // mesmo nome case-insensitive
          color: 'green',
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      questions: [
        {
          id: 'bq-1',
          groupId: 'grp-1',
          tagIds: ['tag-local-1'],
          type: 'objective',
          prompt: 'Versão antiga da questão 1',
          points: 1,
          options: [],
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
        {
          id: 'bq-only-local',
          groupId: 'grp-1',
          tagIds: ['tag-local-1'],
          type: 'objective',
          prompt: 'Questão apenas local',
          points: 2,
          options: [],
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      blueprints: [],
    };

    const importedBank: BankData = {
      groups: [
        {
          id: 'grp-1',
          parentId: null,
          name: 'Matemática Atualizada',
          order: 0,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-10T00:00:00.000Z', // Mais recente
        },
      ],
      tags: [
        {
          id: 'tag-imported-1',
          name: 'geometria', // Colide case-insensitive com tag-local-1
          color: 'blue',
          createdAt: '2026-10-05T00:00:00.000Z',
          updatedAt: '2026-10-05T00:00:00.000Z',
        },
      ],
      questions: [
        {
          id: 'bq-1',
          groupId: 'grp-1',
          tagIds: ['tag-imported-1'],
          type: 'objective',
          prompt: 'Versão nova da questão 1',
          points: 2,
          options: [],
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-10T00:00:00.000Z', // Mais recente
        },
        {
          id: 'bq-imported-new',
          groupId: 'grp-1',
          tagIds: ['tag-imported-1'],
          type: 'objective',
          prompt: 'Questão importada nova',
          points: 3,
          options: [],
          createdAt: '2026-10-05T00:00:00.000Z',
          updatedAt: '2026-10-05T00:00:00.000Z',
        },
      ],
      blueprints: [
        {
          id: 'bp-1',
          name: 'Modelo Importado',
          blocks: [
            {
              id: 'blk-1',
              source: { kind: 'all' },
              quotas: [
                {
                  id: 'q-1',
                  count: 1,
                  filter: { tagIds: ['tag-imported-1'], notTagIds: [] },
                },
              ],
            },
          ],
          createdAt: '2026-10-05T00:00:00.000Z',
          updatedAt: '2026-10-05T00:00:00.000Z',
        },
      ],
    };

    const merged = mergeBankData(currentBank, importedBank);
    expect(merged).toBeDefined();

    // 1. Grupo atualizado venceu
    expect(merged?.groups.length).toBe(1);
    expect(merged?.groups[0].name).toBe('Matemática Atualizada');

    // 2. Tag unificada para a existente ('tag-local-1')
    expect(merged?.tags.length).toBe(1);
    expect(merged?.tags[0].id).toBe('tag-local-1');

    // 3. Questões: bq-1 atualizada venceu e sua tag foi remapeada para tag-local-1
    expect(merged?.questions.length).toBe(3);
    const q1 = merged?.questions.find((q) => q.id === 'bq-1');
    expect(q1?.prompt).toBe('Versão nova da questão 1');
    expect(q1?.tagIds).toEqual(['tag-local-1']);

    // Questão local preservada
    const qLocal = merged?.questions.find((q) => q.id === 'bq-only-local');
    expect(qLocal).toBeDefined();

    // Questão importada adicionada e com tag remapeada
    const qImported = merged?.questions.find((q) => q.id === 'bq-imported-new');
    expect(qImported?.tagIds).toEqual(['tag-local-1']);

    // 4. Blueprint importado remapeou quota filter tagIds
    expect(merged?.blueprints.length).toBe(1);
    expect(merged?.blueprints[0].blocks[0].quotas[0].filter.tagIds).toEqual(['tag-local-1']);
  });

  it('mergeProfiles preserva banco local se arquivo importado não tiver banco', () => {
    const currentData: ProfileData = {
      exams: [],
      classes: [],
      records: [],
      bank: sampleBank,
    };
    const importedDataWithoutBank: ProfileData = {
      exams: [examWithImage],
      classes: [],
      records: [],
    };

    const { mergedData } = mergeProfiles(currentData, importedDataWithoutBank);
    expect(mergedData.bank).toBeDefined();
    expect(mergedData.bank?.questions.length).toBe(2);
  });
});
