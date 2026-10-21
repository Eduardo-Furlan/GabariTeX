import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexedDbProfileStore } from '../src/storage/indexedDbProfileStore';
import { BankData } from '../src/types/bank';
import { getToastsSnapshot } from '../src/components/ui/toastStore';

const DB = 'gabaritex_profile_db';

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => resolve();
  });
}

function seedDb(
  version: number,
  stores: Array<[string, string]>,
  seed?: Record<string, unknown[]>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, version);
    req.onupgradeneeded = () => {
      for (const [name, keyPath] of stores) req.result.createObjectStore(name, { keyPath });
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!seed) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(Object.keys(seed), 'readwrite');
      for (const [name, rows] of Object.entries(seed)) {
        for (const row of rows) tx.objectStore(name).put(row);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

const BASE: Array<[string, string]> = [
  ['exams', 'id'],
  ['records', 'id'],
  ['classes', 'id'],
  ['settings', 'key'],
];

const bank: BankData = {
  groups: [{ id: 'g1', parentId: null, name: 'Mat', order: 0, createdAt: 'x', updatedAt: 'x' }],
  tags: [],
  blueprints: [],
  questions: [
    {
      id: 'q1',
      groupId: 'g1',
      type: 'subjective',
      prompt: 'p',
      points: 1,
      tagIds: [],
      createdAt: 'x',
      updatedAt: 'x',
    } as never,
  ],
};

describe('IndexedDbProfileStore schema repair', () => {
  beforeEach(async () => {
    await deleteDb();
  });

  it('repairs a database at the expected version that lacks the bank stores', async () => {
    await seedDb(2, [...BASE, ['bank_groups', 'id'], ['bank_tags', 'id'], ['bank_questions', 'id']], {
      exams: [{ id: 'e1', header: {}, questions: [] }],
    });
    const store = new IndexedDbProfileStore();
    expect((await store.replaceBank(bank)).ok).toBe(true);
    expect((await store.getBankMeta()).groups).toHaveLength(1);
    expect(await store.listBankQuestions()).toHaveLength(1);
  });

  it('preserves existing exam data while repairing', async () => {
    await seedDb(2, BASE, {
      exams: [{ id: 'e1', header: { examTitle: 'Keep me' }, questions: [], updatedAt: 'x' }],
    });
    const store = new IndexedDbProfileStore();
    await store.getBankMeta();
    expect((await store.listExams()).map((m) => m.id)).toContain('e1');
  });

  it('opens a database whose version is higher than expected', async () => {
    await seedDb(7, BASE);
    const store = new IndexedDbProfileStore();
    expect((await store.replaceBank(bank)).ok).toBe(true);
    expect(await store.listBankQuestions()).toHaveLength(1);
  });

  it('creates everything on a fresh database', async () => {
    const store = new IndexedDbProfileStore();
    expect((await store.replaceBank(bank)).ok).toBe(true);
  });

  it('dispara aviso de bloqueio e rejeita com timeout quando outra conexão sem versionchange bloqueia upgrade', async () => {
    // 1. Cria banco na versão 1 (sem lojas do banco de questões)
    await seedDb(1, BASE, {
      exams: [{ id: 'e1', header: { examTitle: 'Prova V1' }, questions: [] }],
    });

    // 2. Abre uma conexão v1 mantida aberta sem fechar em onversionchange
    const blocker = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onsuccess = () => {
        const db = req.result;
        // Não associa db.onversionchange ou previne fechamento
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });

    try {
      const store = new IndexedDbProfileStore();
      // Configura timeout curto de teste (200ms)
      store.__setOpenTimeoutForTests(200);

      // 3. Tenta abrir o store diretamente
      // Deve rejeitar com o erro de timeout
      await expect((store as any).openDb()).rejects.toThrow(
        /Abertura do IndexedDB expirou \(bloqueada por outra conexão aberta\)/
      );

      // 4. Verifica se o aviso persistente em pt-BR foi disparado
      const toasts = getToastsSnapshot();
      expect(
        toasts.some((t) =>
          t.message.includes(
            'O banco de dados local precisa ser atualizado. Feche as outras abas ou janelas'
          )
        )
      ).toBe(true);
    } finally {
      // 5. Fecha a conexão bloqueadora
      blocker.close();
    }

    // 6. Próxima tentativa de abertura com o bloqueador fechado deve suceder
    const retryStore = new IndexedDbProfileStore();
    expect((await retryStore.replaceBank(bank)).ok).toBe(true);
    expect(await retryStore.listBankQuestions()).toHaveLength(1);
  });
});
