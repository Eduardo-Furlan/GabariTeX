import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TextRuleEditor } from '../src/components/generator/TextRuleEditor';
import { Blueprint, BankGroup, BankTag } from '../src/types/bank';

describe('TextRuleEditor UI (Plano 15 §6.4, Fase 8)', () => {
  it('renderiza textarea com código gerado, botões de idioma e estado de sintaxe válida', () => {
    const group: BankGroup = {
      id: 'g-geo',
      parentId: null,
      name: 'Geometria',
      order: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const bp: Blueprint = {
      id: 'bp-1',
      name: 'Modelo Geometria',
      blocks: [
        {
          id: 'b-1',
          source: { kind: 'group', groupId: 'g-geo', descendants: true },
          quotas: [
            {
              id: 'q-1',
              count: 3,
              filter: { tagIds: [], notTagIds: [] },
            },
          ],
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <TextRuleEditor
        blueprint={bp}
        onChange={() => {}}
        groups={[group]}
        tags={[]}
      />
    );

    expect(html).toContain('DE Geometria');
    expect(html).toContain('INCLUIR 3 questões');
    expect(html).toContain('PT');
    expect(html).toContain('EN');
    expect(html).toContain('Copiar');
    expect(html).toContain('Sintaxe válida e pronta para geração');
  });
});
