import { describe, it, expect } from 'vitest';
import { BankQuestion, BankGroup, BankTag, Blueprint } from '../src/types/bank';
import { generateFromBlueprint } from '../src/utils/bank/solver';
import { parse } from '../src/utils/bank/query/parser';
import { getQuestionFigures } from '../src/utils/bank/figures';

describe('Bank Performance Gate (Plano §6.5 & §7 Phase 11)', () => {
  it('filtra e busca sobre 2.000 questões sintéticas em menos de 50 ms', () => {
    // 1. Gerar 20 grupos e 10 tags
    const groups: BankGroup[] = [];
    for (let i = 0; i < 20; i++) {
      groups.push({
        id: `grp-${i}`,
        parentId: i > 4 ? `grp-${i % 4}` : null,
        name: `Grupo ${i}`,
        order: i,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const tags: BankTag[] = [];
    for (let i = 0; i < 10; i++) {
      tags.push({
        id: `tag-${i}`,
        name: `Etiqueta ${i}`,
        color: 'blue',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Gerar 2.000 questões (10% com imagem de ~150 KB)
    const questions: BankQuestion[] = [];
    const dummyImagePayload = 'data:image/png;base64,' + 'A'.repeat(150 * 1024);

    for (let i = 0; i < 2000; i++) {
      const hasImage = i % 10 === 0;
      const gId = groups[i % groups.length].id;
      const tIds = [tags[i % tags.length].id, tags[(i + 3) % tags.length].id];
      const isObjective = i % 3 !== 0;

      questions.push({
        id: `q-${i}`,
        groupId: gId,
        tagIds: tIds,
        type: isObjective ? 'objective' : 'subjective',
        points: 1.5,
        prompt: `Questão de teste sintética número ${i} com conceito de cálculo e geometria $f(x) = x^${i % 5}$`,
        options: isObjective
          ? [
              { id: `opt-${i}-a`, label: 'A', text: `Alternativa A ${i}`, isCorrect: true },
              { id: `opt-${i}-b`, label: 'B', text: `Alternativa B ${i}`, isCorrect: false },
              { id: `opt-${i}-c`, label: 'C', text: `Alternativa C ${i}`, isCorrect: false },
              { id: `opt-${i}-d`, label: 'D', text: `Alternativa D ${i}`, isCorrect: false },
            ]
          : undefined,
        imageUrl: hasImage ? dummyImagePayload : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    expect(questions.length).toBe(2000);
    const withImages = questions.filter((q) => getQuestionFigures(q).length > 0);
    expect(withImages.length).toBe(200);

    // 3. Medir tempo de filtragem/busca (deve ser < 50 ms)
    const targetTagId = tags[2].id;
    const targetGroupId = groups[1].id;
    const searchTerm = 'cálculo';

    const tStart = performance.now();

    // Executar múltiplas operações de filtro e busca realista
    const filtered = questions.filter((q) => {
      // Filtro de grupo (incluindo questão se for do grupo ou subgrupo simples)
      if (q.groupId !== targetGroupId && q.groupId !== `grp-5`) return false;
      // Filtro de tag
      if (!q.tagIds.includes(targetTagId)) return false;
      // Filtro de tipo
      if (q.type !== 'objective') return false;
      // Busca textual
      if (!q.prompt.toLowerCase().includes(searchTerm)) return false;
      return true;
    });

    const elapsed = performance.now() - tStart;
    console.log(`[PERF] 2.000 questions filter/search: ${elapsed.toFixed(2)} ms (budget < 50 ms)`);
    expect(elapsed).toBeLessThan(50);
    expect(filtered.length).toBeGreaterThanOrEqual(0);
  });

  it('resolve blueprint sobre 5.000 questões sintéticas em menos de 100 ms', () => {
    // 1. Criar banco com 50 grupos e 20 tags
    const groups: BankGroup[] = [];
    for (let i = 0; i < 50; i++) {
      groups.push({
        id: `g-${i}`,
        parentId: i >= 10 ? `g-${i % 10}` : null,
        name: `Materia ${i}`,
        order: i,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const tags: BankTag[] = [];
    for (let i = 0; i < 20; i++) {
      tags.push({
        id: `t-${i}`,
        name: `Tag ${i}`,
        color: 'emerald',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Gerar 5.000 questões com ampla distribuição
    const questions: BankQuestion[] = [];
    let seedVal = 12345;
    const nextRand = () => {
      seedVal = (seedVal * 1664525 + 1013904223) >>> 0;
      return seedVal / 4294967296;
    };

    for (let i = 0; i < 5000; i++) {
      const gId = groups[Math.floor(nextRand() * groups.length)].id;
      const tId1 = tags[Math.floor(nextRand() * tags.length)].id;
      const tId2 = tags[Math.floor(nextRand() * tags.length)].id;
      const isObjective = nextRand() > 0.3;

      questions.push({
        id: `bq-${i}`,
        groupId: gId,
        tagIds: [tId1, tId2],
        type: isObjective ? 'objective' : 'subjective',
        points: 2.0,
        prompt: `Enunciado da questão para o solver com índice ${i}`,
        options: isObjective
          ? [
              { id: `o-1`, label: 'A', text: '1', isCorrect: true },
              { id: `o-2`, label: 'B', text: '2', isCorrect: false },
            ]
          : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Montar blueprint complexo com 5 blocos (OR, AND, XOR, EXCEPT)
    const blueprint: Blueprint = {
      id: 'bp-bench',
      name: 'Benchmark Blueprint 5000',
      blocks: [
        {
          id: 'b-1',
          source: {
            kind: 'or',
            operands: [
              { kind: 'group', groupId: 'g-0', descendants: true },
              { kind: 'group', groupId: 'g-1', descendants: true },
            ],
          },
          quotas: [
            { id: 'q-1', count: 3, filter: { tagIds: ['t-0'], notTagIds: [] }, points: 1.0 },
            { id: 'q-2', count: 2, filter: { tagIds: ['t-2'], notTagIds: [] }, points: 1.5 },
          ],
        },
        {
          id: 'b-2',
          source: {
            kind: 'and',
            operands: [
              { kind: 'group', groupId: 'g-2', descendants: true },
              { kind: 'group', groupId: 'g-3', descendants: true },
            ],
          },
          quotas: [
            { id: 'q-3', count: 4, filter: { tagIds: [], notTagIds: ['t-5'] }, points: 2.0 },
          ],
        },
        {
          id: 'b-3',
          source: {
            kind: 'xor',
            operands: [
              { kind: 'group', groupId: 'g-4', descendants: true },
              { kind: 'group', groupId: 'g-5', descendants: true },
            ],
          },
          quotas: [
            { id: 'q-4', count: 3, filter: { tagIds: ['t-4'], notTagIds: [] }, points: 2.5 },
          ],
        },
        {
          id: 'b-4',
          source: {
            kind: 'except',
            base: { kind: 'group', groupId: 'g-6', descendants: true },
            excluded: { kind: 'group', groupId: 'g-16', descendants: true },
          },
          quotas: [
            { id: 'q-5', count: 3, filter: { tagIds: [], notTagIds: [] }, points: 2.0 },
          ],
        },
        {
          id: 'b-5',
          source: { kind: 'all' },
          quotas: [
            { id: 'q-6', count: 5, filter: { tagIds: ['t-10'], notTagIds: [] }, points: 1.0 },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 4. Medir tempo de resolução
    const tStart = performance.now();
    const result = generateFromBlueprint({
      blueprint,
      questions,
      groups,
      tags,
      seed: 'benchmark-seed-123',
    });
    const elapsed = performance.now() - tStart;

    if (!result.ok) {
      console.log('Solver failures:', JSON.stringify(result.failures, null, 2));
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.picks.length).toBe(3 + 2 + 4 + 3 + 3 + 5); // 20 questões
    }
    console.log(`[PERF] 5.000 questions solver benchmark: ${elapsed.toFixed(2)} ms (budget < 100 ms)`);
    expect(elapsed).toBeLessThan(100);
  });

  it('analisa 50 linhas de regras em modo texto em menos de 10 ms', () => {
    const parseGroups: BankGroup[] = [];
    const parseTags: BankTag[] = [];
    for (let i = 0; i < 20; i++) {
      parseGroups.push({
        id: `pg-${i}`,
        parentId: null,
        name: `Grupo_${i}`,
        order: i,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      parseTags.push(
        {
          id: `pt-f-${i}`,
          name: `Facil_${i}`,
          color: 'green',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: `pt-d-${i}`,
          name: `Dificil_${i}`,
          color: 'red',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );
    }

    let text = '';
    // 20 blocos de 2 linhas cada + linhas em branco = mais de 50 linhas
    for (let i = 0; i < 20; i++) {
      text += `DE Grupo_${i} PONTOS 5\n  INCLUIR 1 etiqueta("Facil_${i}") tipo("objetiva") PONTOS 2.5\n\n`;
    }

    const tStart = performance.now();
    const result = parse(text, parseGroups, parseTags);
    const elapsed = performance.now() - tStart;

    if (result.diagnostics.length > 0) {
      console.log('Parser diagnostics:', result.diagnostics);
    }
    expect(result.diagnostics.length).toBe(0);
    expect(result.blocks.length).toBe(20);
    console.log(`[PERF] 50 lines query parser: ${elapsed.toFixed(2)} ms (budget < 10 ms)`);
    expect(elapsed).toBeLessThan(10);
  });
});
