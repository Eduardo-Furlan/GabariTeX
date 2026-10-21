import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TextRuleEditor } from '../src/components/generator/TextRuleEditor';
import { Blueprint, BankGroup, BankTag } from '../src/types/bank';

const groups = [
  { id: 'm', name: 'Matemática', parentId: null, order: 0, createdAt: '', updatedAt: '' },
] as BankGroup[];
const tags = [{ id: 't1', name: 'fácil', color: 'blue', createdAt: '', updatedAt: '' }] as unknown as BankTag[];
const blueprint: Blueprint = {
  id: 'bp',
  name: 'Teste',
  blocks: [
    {
      id: 'b1',
      source: { kind: 'group', groupId: 'm', descendants: true },
      quotas: [{ id: 'q1', count: 2, filter: { tagIds: [], notTagIds: [] } }],
    },
  ],
  createdAt: '',
  updatedAt: '',
};

describe('TextRuleEditor (SSR)', () => {
  it('renders the textarea wired for autocomplete, with no dropdown until the user types', () => {
    const html = renderToString(
      <TextRuleEditor blueprint={blueprint} onChange={() => {}} groups={groups} tags={tags} />
    );
    expect(html).toContain('<textarea');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('Sugestões:'); // the old chips bar is gone
    expect(html).toContain('Matemática');
  });
});
