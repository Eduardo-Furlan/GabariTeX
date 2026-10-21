import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { getBankScreenMode } from '../src/utils/bank/screenMode';
import { BankScreen } from '../src/screens/BankScreen';
import { QuestionList } from '../src/components/bank/QuestionList';
import { GroupPicker, handleInlineGroupCreate } from '../src/components/bank/GroupPicker';
import { BankProvider } from '../src/context/BankContext';
import { BankGroup, BankQuestion } from '../src/types/bank';

describe('BankScreen Mode and Inline Group Creation (Hotfix H1)', () => {
  const sampleGroup: BankGroup = {
    id: 'g-mat',
    parentId: null,
    name: 'Matemática',
    order: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const sampleQuestion: BankQuestion = {
    id: 'q1',
    groupId: 'g-mat',
    type: 'objective',
    prompt: 'Qual é o valor de pi?',
    points: 1,
    tagIds: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  describe('getBankScreenMode (Pure Function)', () => {
    it('retorna "empty" quando não há grupos nem questões', () => {
      expect(getBankScreenMode([], [])).toBe('empty');
    });

    it('retorna "normal" quando há apenas grupos', () => {
      expect(getBankScreenMode([sampleGroup], [])).toBe('normal');
    });

    it('retorna "normal" quando há apenas questões', () => {
      expect(getBankScreenMode([], [sampleQuestion])).toBe('normal');
    });

    it('retorna "normal" quando há grupos e questões', () => {
      expect(getBankScreenMode([sampleGroup], [sampleQuestion])).toBe('normal');
    });
  });

  describe('SSR Render Modes in BankScreen', () => {
    it('banco vazio renderiza ambos os CTAs: Criar Primeiro Grupo e Criar Primeira Questão', () => {
      const html = renderToString(
        <BankProvider initialData={{ groups: [], questions: [] }}>
          <BankScreen onNavigate={() => {}} />
        </BankProvider>
      );

      expect(html).toContain('Seu banco de questões está vazio');
      expect(html).toContain('Criar Primeiro Grupo');
      expect(html).toContain('Criar Primeira Questão');
      expect(html).toContain('Criar grupos é opcional, mas recomendado');
    });

    it('banco apenas com grupos renderiza a árvore de grupos e o layout normal', () => {
      const html = renderToString(
        <BankProvider initialData={{ groups: [sampleGroup], questions: [] }}>
          <BankScreen onNavigate={() => {}} />
        </BankProvider>
      );

      // Não deve renderizar a tela de boas-vindas vazia global
      expect(html).not.toContain('Seu banco de questões está vazio');
      // Deve renderizar a árvore com o grupo existente
      expect(html).toContain('Matemática');
      expect(html).toContain('Grupos');
      expect(html).toContain('Novo Grupo');
    });

    it('lista com escopo sem questões renderiza estado vazio contextual', () => {
      const html = renderToString(
        <QuestionList
          groups={[sampleGroup]}
          questions={[]}
          tags={[]}
          selectedGroup={{ kind: 'group', groupId: 'g-mat' }}
          onSelectGroup={() => {}}
          selectedQuestionIds={new Set()}
          onToggleSelectQuestion={() => {}}
          onSelectAllFiltered={() => {}}
          onEditQuestion={() => {}}
          onDuplicateQuestion={() => {}}
          onDeleteQuestion={async () => true}
          onNewQuestion={() => {}}
        />
      );

      expect(html).toContain('Nenhuma questão neste grupo');
      expect(html).toContain('Adicione questões a este grupo para começar a estruturar seu acervo.');
      expect(html).toContain('Nova Questão');
    });
  });

  describe('GroupPicker Inline Group Creation', () => {
    it('botão "Novo Grupo" está presente quando onCreateGroup é fornecido', () => {
      const htmlWithCreate = renderToString(
        <GroupPicker
          groups={[sampleGroup]}
          value={null}
          onChange={() => {}}
          onCreateGroup={async () => null}
        />
      );

      expect(htmlWithCreate).toContain('Novo Grupo');
      expect(htmlWithCreate).toContain('Criar novo grupo');
    });

    it('botão "Novo Grupo" está ausente quando onCreateGroup é omitido', () => {
      const htmlWithoutCreate = renderToString(
        <GroupPicker
          groups={[sampleGroup]}
          value={null}
          onChange={() => {}}
        />
      );

      expect(htmlWithoutCreate).not.toContain('Novo Grupo');
      expect(htmlWithoutCreate).not.toContain('Criar novo grupo');
    });

    it('handleInlineGroupCreate seleciona o novo grupo após criação bem-sucedida', async () => {
      const onChange = vi.fn();
      const createdGroup: BankGroup = {
        id: 'g-nova',
        parentId: null,
        name: 'História',
        order: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      const onCreateGroup = vi.fn().mockResolvedValue(createdGroup);

      const success = await handleInlineGroupCreate(onCreateGroup, 'História', null, onChange);

      expect(success).toBe(true);
      expect(onCreateGroup).toHaveBeenCalledWith({ name: 'História', parentId: null });
      expect(onChange).toHaveBeenCalledWith('g-nova');
    });

    it('handleInlineGroupCreate não altera seleção se criação falhar ou for cancelada', async () => {
      const onChange = vi.fn();
      const onCreateGroup = vi.fn().mockResolvedValue(null);

      const success = await handleInlineGroupCreate(onCreateGroup, 'História', null, onChange);

      expect(success).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
