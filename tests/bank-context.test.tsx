import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BankManager } from '../src/utils/bank/manager';
import { BankProvider, useBank } from '../src/context/BankContext';
import { MemoryProfileStore } from '../src/storage/memoryProfileStore';
import { BankQuestion, Blueprint } from '../src/types/bank';

describe('BankContext and BankManager (Plano 15 §5.1, Fase 3)', () => {
  let store: MemoryProfileStore;

  beforeEach(() => {
    store = new MemoryProfileStore();
    vi.clearAllMocks();
  });

  it('deve inicializar descarregado (lazy loading) e carregar sob demanda com ensureLoaded', async () => {
    // Popula a store previamente
    await store.putBankMeta({
      schema: 1,
      groups: [
        {
          id: 'g-mat',
          parentId: null,
          name: 'Matemática',
          order: 0,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      tags: [
        {
          id: 't-facil',
          name: 'Fácil',
          color: 'green',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      blueprints: [],
    });

    const q1: BankQuestion = {
      id: 'q-1',
      groupId: 'g-mat',
      type: 'objective',
      prompt: 'Quanto é 2 + 2?',
      points: 2,
      options: [
        { id: 'opt-a', text: '4', isCorrect: true },
        { id: 'opt-b', text: '5', isCorrect: false },
      ],
      tagIds: ['t-facil'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    await store.putBankQuestions([q1]);

    const manager = new BankManager(store);

    // Estado inicial: não carregado
    expect(manager.getState().isLoaded).toBe(false);
    expect(manager.getState().groups).toEqual([]);
    expect(manager.getState().questions).toEqual([]);

    // Coalesce de chamadas concorrentes
    const p1 = manager.ensureLoaded();
    const p2 = manager.ensureLoaded();
    await Promise.all([p1, p2]);

    expect(manager.getState().isLoaded).toBe(true);
    expect(manager.getState().groups).toHaveLength(1);
    expect(manager.getState().groups[0].name).toBe('Matemática');
    expect(manager.getState().tags).toHaveLength(1);
    expect(manager.getState().questions).toHaveLength(1);
    expect(manager.getState().questions[0].id).toBe('q-1');
  });

  it('deve calcular índices derivados memoizados (questionCountByGroup e usageMap)', async () => {
    const examsMock = [
      {
        id: 'exam-1',
        questions: [{ sourceQuestionId: 'q-1' }, { sourceQuestionId: 'q-2' }],
      },
      {
        id: 'exam-2',
        questions: [{ sourceQuestionId: 'q-1' }],
      },
    ];

    const manager = new BankManager(store, examsMock);
    await manager.ensureLoaded();

    // 1. Grupos e questões
    const g1 = (await manager.createGroup({ name: 'Física', parentId: null }))!;
    expect(g1).not.toBeNull();

    const q1: BankQuestion = {
      id: 'q-1',
      groupId: g1.id,
      type: 'objective',
      prompt: 'Questão 1',
      points: 1,
      options: [
        { id: '1', text: 'A', isCorrect: true },
        { id: '2', text: 'B', isCorrect: false },
      ],
      tagIds: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const qOrphan: BankQuestion = {
      id: 'q-orphan',
      groupId: null,
      type: 'subjective',
      prompt: 'Questão sem grupo',
      points: 2,
      linesForAnswer: 5,
      tagIds: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    await manager.saveQuestions([q1, qOrphan]);

    // Verifica questionCountByGroup
    const counts = manager.getQuestionCountByGroup();
    expect(counts.get(g1.id)).toEqual({ own: 1, total: 1 });
    expect(counts.get(null)).toEqual({ own: 1, total: 1 });

    // Verifica usageMap e usageCounts
    expect(manager.getUsageMap().get('q-1')).toEqual(['exam-1', 'exam-2']);
    expect(manager.getUsageCounts().get('q-1')).toBe(2);
    expect(manager.getUsageCounts().get('q-orphan')).toBeUndefined();
  });

  describe('Operações de Grupos', () => {
    it('deve criar, renomear e mover grupos respeitando limites e atualizações otimistas', async () => {
      const manager = new BankManager(store);
      await manager.ensureLoaded();

      // Cria raiz
      const rootGroup = (await manager.createGroup({ name: 'Biologia', parentId: null }))!;
      expect(rootGroup).not.toBeNull();
      expect(manager.getState().groups).toHaveLength(1);

      // Cria subgrupo
      const subGroup = (await manager.createGroup({ name: 'Genética', parentId: rootGroup.id }))!;
      expect(subGroup.parentId).toBe(rootGroup.id);
      expect(manager.getState().groups).toHaveLength(2);

      // Renomeia
      const okRename = await manager.renameGroup(subGroup.id, 'Genética Molecular');
      expect(okRename).toBe(true);
      expect(manager.getState().groups.find((g) => g.id === subGroup.id)?.name).toBe('Genética Molecular');

      // Tenta renomear para duplicado (deve falhar)
      await manager.createGroup({ name: 'Citologia', parentId: rootGroup.id });
      const okDup = await manager.renameGroup(subGroup.id, 'Citologia');
      expect(okDup).toBe(false);

      // Move subgrupo para a raiz
      const okMove = await manager.moveGroup(subGroup.id, null);
      expect(okMove).toBe(true);
      expect(manager.getState().groups.find((g) => g.id === subGroup.id)?.parentId).toBeNull();
    });

    it('deve excluir grupo com estratégia move e strategy delete', async () => {
      const manager = new BankManager(store);
      await manager.ensureLoaded();

      const gA = (await manager.createGroup({ name: 'Grupo A', parentId: null }))!;
      const gB = (await manager.createGroup({ name: 'Grupo B', parentId: null }))!;

      const q1: BankQuestion = {
        id: 'q-in-a',
        groupId: gA.id,
        type: 'subjective',
        prompt: 'Em A',
        points: 1,
        linesForAnswer: 4,
        tagIds: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      await manager.saveQuestion(q1);

      // Estratégia move para gB
      const okMoveDel = await manager.deleteGroup(gA.id, { kind: 'move', targetGroupId: gB.id });
      expect(okMoveDel).toBe(true);

      expect(manager.getState().groups.some((g) => g.id === gA.id)).toBe(false);
      expect(manager.getState().questions.find((q) => q.id === 'q-in-a')?.groupId).toBe(gB.id);

      // Estratégia delete para gB
      const okDel = await manager.deleteGroup(gB.id, { kind: 'delete' });
      expect(okDel).toBe(true);

      expect(manager.getState().groups.some((g) => g.id === gB.id)).toBe(false);
      expect(manager.getState().questions.some((q) => q.id === 'q-in-a')).toBe(false);
    });

    it('deve realizar rollback se a persistência na store falhar', async () => {
      const manager = new BankManager(store);
      await manager.ensureLoaded();

      // Mocka store.putBankMeta para simular erro
      vi.spyOn(store, 'putBankMeta').mockResolvedValueOnce({
        ok: false,
        reason: 'disk_full',
        error: new Error('Disk full'),
      });

      const res = await manager.createGroup({ name: 'Grupo Falha', parentId: null });
      expect(res).toBeNull();

      // Estado reverteu para vazio
      expect(manager.getState().groups).toHaveLength(0);
    });
  });

  describe('Operações de Etiquetas (Tags)', () => {
    it('deve criar, renomear, alterar cor, excluir e mesclar etiquetas atualizando questões', async () => {
      const manager = new BankManager(store);
      await manager.ensureLoaded();

      const tag1 = (await manager.createTag('Álgebra', 'blue'))!;
      const tag2 = (await manager.createTag('Cálculo', 'teal'))!;
      expect(manager.getState().tags).toHaveLength(2);

      // Cria questão vinculada a tag1
      const q: BankQuestion = {
        id: 'q-tag',
        groupId: null,
        type: 'objective',
        prompt: 'Questão Álgebra',
        points: 2,
        options: [
          { id: '1', text: 'Sim', isCorrect: true },
          { id: '2', text: 'Não', isCorrect: false },
        ],
        tagIds: [tag1.id],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      await manager.saveQuestion(q);

      // Renomeia tag
      await manager.renameTag(tag1.id, 'Álgebra Linear');
      expect(manager.getState().tags.find((t) => t.id === tag1.id)?.name).toBe('Álgebra Linear');

      // Atualiza cor
      await manager.updateTagColor(tag1.id, 'violet');
      expect(manager.getState().tags.find((t) => t.id === tag1.id)?.color).toBe('violet');

      // Mescla tag1 em tag2
      const okMerge = await manager.mergeTags(tag1.id, tag2.id);
      expect(okMerge).toBe(true);
      expect(manager.getState().tags).toHaveLength(1);
      expect(manager.getState().tags[0].id).toBe(tag2.id);
      expect(manager.getState().questions.find((x) => x.id === 'q-tag')?.tagIds).toEqual([tag2.id]);

      // Exclui tag2
      const okDel = await manager.deleteTag(tag2.id);
      expect(okDel).toBe(true);
      expect(manager.getState().tags).toHaveLength(0);
      expect(manager.getState().questions.find((x) => x.id === 'q-tag')?.tagIds).toEqual([]);
    });
  });

  describe('Operações de Questões e Blueprints', () => {
    it('deve validar questões, salvar individualmente e em lote, arquivar e excluir', async () => {
      const manager = new BankManager(store);
      await manager.ensureLoaded();

      // Questão inválida (sem opções corretas)
      const invalidQ: any = {
        id: 'q-inv',
        groupId: null,
        type: 'objective',
        prompt: 'Inválida',
        points: 1,
        options: [
          { id: '1', text: 'A', isCorrect: false },
          { id: '2', text: 'B', isCorrect: false },
        ],
        tagIds: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const resInv = await manager.saveQuestion(invalidQ);
      expect(resInv.ok).toBe(false);
      expect(manager.getState().questions).toHaveLength(0);

      // Questão válida
      const validQ: BankQuestion = {
        id: 'q-val',
        groupId: null,
        type: 'objective',
        prompt: 'Válida',
        points: 2.5,
        options: [
          { id: '1', text: 'A', isCorrect: true },
          { id: '2', text: 'B', isCorrect: false },
        ],
        tagIds: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const resVal = await manager.saveQuestion(validQ);
      expect(resVal.ok).toBe(true);
      expect(manager.getState().questions).toHaveLength(1);

      // Arquiva
      const okArch = await manager.archiveQuestions(['q-val'], true);
      expect(okArch).toBe(true);
      expect(manager.getState().questions[0].archived).toBe(true);

      // Exclui
      const okDel = await manager.deleteQuestions(['q-val']);
      expect(okDel).toBe(true);
      expect(manager.getState().questions).toHaveLength(0);
    });

    it('deve validar e salvar blueprint, e excluir blueprint', async () => {
      const manager = new BankManager(store);
      await manager.ensureLoaded();

      const bp: Blueprint = {
        id: 'bp-1',
        name: 'Prova Trimestral',
        blocks: [
          {
            id: 'b-1',
            source: { kind: 'all' },
            quotas: [
              {
                id: 'q-1',
                count: 5,
                filter: { tagIds: [], notTagIds: [] },
              },
            ],
          },
        ],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const res = await manager.saveBlueprint(bp);
      expect(res.ok).toBe(true);
      expect(manager.getState().blueprints).toHaveLength(1);

      const ok = await manager.deleteBlueprint('bp-1');
      expect(ok).toBe(true);
      expect(manager.getState().blueprints).toHaveLength(0);
    });

    it('deve substituir o banco atomicamente com replaceBank', async () => {
      const manager = new BankManager(store);
      await manager.ensureLoaded();

      const replacementData = {
        groups: [{ id: 'g-rep', parentId: null, name: 'Substituído', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
        tags: [{ id: 't-rep', name: 'Nova', color: 'pink' as const, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
        blueprints: [],
        questions: [],
      };

      const res = await manager.replaceBank(replacementData);
      expect(res.ok).toBe(true);

      expect(manager.getState().groups).toHaveLength(1);
      expect(manager.getState().groups[0].id).toBe('g-rep');
      expect(manager.getState().tags[0].id).toBe('t-rep');
    });

    it('resetBankCache deve descarregar o cache do banco', async () => {
      const manager = new BankManager(store);
      await manager.ensureLoaded();
      expect(manager.getState().isLoaded).toBe(true);

      manager.resetBankCache();
      expect(manager.getState().isLoaded).toBe(false);
      expect(manager.getState().groups).toEqual([]);
      expect(manager.getState().questions).toEqual([]);
    });
  });

  it('SSR smoke test: renderToString com BankProvider não lança erro', () => {
    const Component = () => {
      const bank = useBank();
      return <div>Bank SSR Render: {bank.groups.length} grupos</div>;
    };

    expect(() => {
      const html = renderToString(
        <BankProvider store={store}>
          <Component />
        </BankProvider>
      );
      expect(html).toContain('Bank SSR Render:');
      expect(html).toContain('grupos');
    }).not.toThrow();
  });
});
