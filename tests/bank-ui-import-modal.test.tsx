import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BankImportModal } from '../src/components/bank/BankImportModal';
import { BankProvider } from '../src/context/BankContext';
import { MemoryProfileStore } from '../src/storage/memoryProfileStore';

describe('BankImportModal (Plano 5.3, Fase 9)', () => {
  const store = new MemoryProfileStore();

  it('renderiza modal de importação em SSR sem erros', () => {
    expect(() =>
      renderToString(
        <BankProvider store={store}>
          <BankImportModal
            isOpen={true}
            onClose={() => {}}
            defaultParentGroupId={null}
          />
        </BankProvider>
      )
    ).not.toThrow();
  });
});
