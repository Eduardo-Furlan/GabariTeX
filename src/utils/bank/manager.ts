import {
  BankGroup,
  BankTag,
  BankQuestion,
  Blueprint,
  BankMeta,
  BankData,
  TagColor,
} from '../../types/bank';
import { Exam } from '../../types/exam';
import { SaveResult } from '../storage';
import { ProfileStore } from '../../storage/profileStore';
import { toast } from '../../components/ui/toastStore';
import {
  createGroup as createGroupInTree,
  renameGroup as renameGroupInTree,
  moveGroup as moveGroupInTree,
  deleteGroup as deleteGroupFromTree,
  countQuestionsByGroup,
  DeleteGroupStrategy,
} from './tree';
import {
  findOrCreateTag,
  renameTag as renameTagInList,
  updateTagColor as updateTagColorInList,
  deleteTag as deleteTagFromList,
  mergeTags as mergeTagsInList,
} from './tags';
import { validateBankQuestion } from './questions';
import { normalizeBlueprint, validateBlueprint } from './blueprint';
import {
  buildQuestionUsageMap,
  buildUsageCounts,
  ExamWithQuestions,
} from './usage';

export interface BankState {
  isLoaded: boolean;
  isLoading: boolean;
  groups: BankGroup[];
  tags: BankTag[];
  questions: BankQuestion[];
  blueprints: Blueprint[];
  usageExams: readonly ExamWithQuestions[];
}

export class BankManager {
  private isLoaded = false;
  private isLoading = false;
  private groups: BankGroup[] = [];
  private tags: BankTag[] = [];
  private questions: BankQuestion[] = [];
  private blueprints: Blueprint[] = [];
  private usageExams: readonly ExamWithQuestions[] = [];

  private loadingPromise: Promise<void> | null = null;

  constructor(
    private store?: ProfileStore,
    initialExams?: readonly ExamWithQuestions[],
    private onChange?: (state: BankState) => void,
    initialData?: Partial<BankData>
  ) {
    if (initialExams) {
      this.usageExams = initialExams;
    }
    if (initialData) {
      this.isLoaded = true;
      this.groups = initialData.groups ? [...initialData.groups] : [];
      this.tags = initialData.tags ? [...initialData.tags] : [];
      this.questions = initialData.questions ? [...initialData.questions] : [];
      this.blueprints = initialData.blueprints ? [...initialData.blueprints] : [];
    }
  }

  getState(): BankState {
    return {
      isLoaded: this.isLoaded,
      isLoading: this.isLoading,
      groups: this.groups,
      tags: this.tags,
      questions: this.questions,
      blueprints: this.blueprints,
      usageExams: this.usageExams,
    };
  }

  private notify() {
    this.onChange?.(this.getState());
  }

  setStore(store: ProfileStore | undefined) {
    this.store = store;
  }

  setUsageExams(exams: readonly ExamWithQuestions[]) {
    this.usageExams = exams;
    this.notify();
  }

  getQuestionCountByGroup(): Map<string | null, { own: number; total: number }> {
    return countQuestionsByGroup(this.questions, this.groups, false);
  }

  getUsageMap(): Map<string, string[]> {
    return buildQuestionUsageMap(this.usageExams);
  }

  getUsageCounts(): Map<string, number> {
    return buildUsageCounts(this.getUsageMap());
  }

  resetBankCache(): void {
    this.isLoaded = false;
    this.isLoading = false;
    this.loadingPromise = null;
    this.groups = [];
    this.tags = [];
    this.questions = [];
    this.blueprints = [];
    this.notify();
  }

  async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (!this.store) {
      console.warn('[BankManager] Nenhum store disponível para carregar banco.');
      return;
    }
    const store = this.store;

    this.isLoading = true;
    this.notify();

    const p = (async () => {
      try {
        const [meta, qs] = await Promise.all([
          store.getBankMeta(),
          store.listBankQuestions(),
        ]);

        this.groups = meta.groups || [];
        this.tags = meta.tags || [];
        this.blueprints = meta.blueprints || [];
        this.questions = qs || [];

        if (this.usageExams.length === 0) {
          try {
            const metas = await store.listExams();
            const fullExams = await Promise.all(metas.map((m) => store.getExam(m.id)));
            const valid = fullExams.filter((e): e is Exam => Boolean(e));
            this.usageExams = valid;
          } catch {
            this.usageExams = [];
          }
        }

        this.isLoaded = true;
      } catch (err) {
        console.error('[BankManager] Erro ao carregar banco:', err);
        toast.error('Erro ao carregar o Banco de Questões.');
      } finally {
        this.isLoading = false;
        this.loadingPromise = null;
        this.notify();
      }
    })();

    this.loadingPromise = p;
    return p;
  }

  private async persistMeta(
    nextGroups: BankGroup[],
    nextTags: BankTag[],
    nextBlueprints: Blueprint[]
  ): Promise<SaveResult> {
    if (!this.store) return { ok: false, reason: 'unknown' };
    const meta: BankMeta = {
      schema: 1,
      groups: nextGroups,
      tags: nextTags,
      blueprints: nextBlueprints,
    };
    return this.store.putBankMeta(meta);
  }

  async createGroup(input: {
    name: string;
    parentId: string | null;
    id?: string;
  }): Promise<BankGroup | null> {
    try {
      const res = createGroupInTree(this.groups, input);
      const prevGroups = this.groups;
      this.groups = res.groups;
      this.notify();

      const saveRes = await this.persistMeta(res.groups, this.tags, this.blueprints);
      if (!saveRes.ok) {
        this.groups = prevGroups;
        this.notify();
        toast.error('Erro ao salvar novo grupo.');
        return null;
      }
      return res.newGroup;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar grupo.';
      toast.error(msg);
      return null;
    }
  }

  async renameGroup(id: string, name: string): Promise<boolean> {
    try {
      const res = renameGroupInTree(this.groups, id, name);
      const prevGroups = this.groups;
      this.groups = res.groups;
      this.notify();

      const saveRes = await this.persistMeta(res.groups, this.tags, this.blueprints);
      if (!saveRes.ok) {
        this.groups = prevGroups;
        this.notify();
        toast.error('Erro ao renomear grupo.');
        return false;
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao renomear grupo.';
      toast.error(msg);
      return false;
    }
  }

  async moveGroup(
    id: string,
    targetParentId: string | null,
    targetIndex?: number
  ): Promise<boolean> {
    try {
      const res = moveGroupInTree(this.groups, id, targetParentId, targetIndex);
      const prevGroups = this.groups;
      this.groups = res.groups;
      this.notify();

      const saveRes = await this.persistMeta(res.groups, this.tags, this.blueprints);
      if (!saveRes.ok) {
        this.groups = prevGroups;
        this.notify();
        toast.error('Erro ao mover grupo.');
        return false;
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao mover grupo.';
      toast.error(msg);
      return false;
    }
  }

  async deleteGroup(id: string, strategy: DeleteGroupStrategy): Promise<boolean> {
    if (!this.store) return false;
    try {
      const res = deleteGroupFromTree(this.groups, this.questions, id, strategy);
      const prevGroups = this.groups;
      const prevQuestions = this.questions;

      let nextQuestions = this.questions;
      if (strategy.kind === 'delete') {
        const delSet = new Set(res.deletedQuestionIds);
        nextQuestions = this.questions.filter((q) => !delSet.has(q.id));
      } else {
        const remapMap = new Map(res.remappedQuestions.map((r) => [r.id, r.newGroupId]));
        nextQuestions = this.questions.map((q) =>
          remapMap.has(q.id) ? { ...q, groupId: remapMap.get(q.id)! } : q
        );
      }

      this.groups = res.groups;
      this.questions = nextQuestions;
      this.notify();

      if (strategy.kind === 'delete' && res.deletedQuestionIds.length > 0) {
        await this.store.deleteBankQuestions(res.deletedQuestionIds);
      } else if (strategy.kind === 'move' && res.remappedQuestions.length > 0) {
        const remapMap = new Map(res.remappedQuestions.map((r) => [r.id, r.newGroupId]));
        const modified = nextQuestions.filter((q) => remapMap.has(q.id));
        const qRes = await this.store.putBankQuestions(modified);
        if (!qRes.ok) {
          this.groups = prevGroups;
          this.questions = prevQuestions;
          this.notify();
          toast.error('Erro ao reassociar questões do grupo.');
          return false;
        }
      }

      const metaRes = await this.persistMeta(res.groups, this.tags, this.blueprints);
      if (!metaRes.ok) {
        this.groups = prevGroups;
        this.questions = prevQuestions;
        this.notify();
        toast.error('Erro ao excluir grupo.');
        return false;
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir grupo.';
      toast.error(msg);
      return false;
    }
  }

  async createTag(name: string, color?: TagColor): Promise<BankTag | null> {
    try {
      const res = findOrCreateTag(this.tags, name, color);
      if (res.tags.length === this.tags.length) {
        return res.tag;
      }

      const prevTags = this.tags;
      this.tags = res.tags;
      this.notify();

      const saveRes = await this.persistMeta(this.groups, res.tags, this.blueprints);
      if (!saveRes.ok) {
        this.tags = prevTags;
        this.notify();
        toast.error('Erro ao salvar etiqueta.');
        return null;
      }
      return res.tag;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar etiqueta.';
      toast.error(msg);
      return null;
    }
  }

  async renameTag(id: string, name: string): Promise<boolean> {
    try {
      const res = renameTagInList(this.tags, id, name);
      const prevTags = this.tags;
      this.tags = res.tags;
      this.notify();

      const saveRes = await this.persistMeta(this.groups, res.tags, this.blueprints);
      if (!saveRes.ok) {
        this.tags = prevTags;
        this.notify();
        toast.error('Erro ao renomear etiqueta.');
        return false;
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao renomear etiqueta.';
      toast.error(msg);
      return false;
    }
  }

  async updateTagColor(id: string, color: TagColor): Promise<boolean> {
    try {
      const res = updateTagColorInList(this.tags, id, color);
      const prevTags = this.tags;
      this.tags = res.tags;
      this.notify();

      const saveRes = await this.persistMeta(this.groups, res.tags, this.blueprints);
      if (!saveRes.ok) {
        this.tags = prevTags;
        this.notify();
        toast.error('Erro ao atualizar cor da etiqueta.');
        return false;
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar cor.';
      toast.error(msg);
      return false;
    }
  }

  async deleteTag(id: string): Promise<boolean> {
    if (!this.store) return false;
    try {
      const res = deleteTagFromList(this.tags, this.questions, id);
      const prevTags = this.tags;
      const prevQuestions = this.questions;

      const updatedMap = new Map(res.updatedQuestions.map((q) => [q.id, q]));
      const nextQuestions = this.questions.map((q) =>
        updatedMap.has(q.id) ? updatedMap.get(q.id)! : q
      );

      this.tags = res.tags;
      this.questions = nextQuestions;
      this.notify();

      if (res.updatedQuestions.length > 0) {
        const qRes = await this.store.putBankQuestions(res.updatedQuestions);
        if (!qRes.ok) {
          this.tags = prevTags;
          this.questions = prevQuestions;
          this.notify();
          toast.error('Erro ao atualizar questões vinculadas à etiqueta.');
          return false;
        }
      }

      const metaRes = await this.persistMeta(this.groups, res.tags, this.blueprints);
      if (!metaRes.ok) {
        this.tags = prevTags;
        this.questions = prevQuestions;
        this.notify();
        toast.error('Erro ao excluir etiqueta.');
        return false;
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir etiqueta.';
      toast.error(msg);
      return false;
    }
  }

  async mergeTags(sourceTagId: string, targetTagId: string): Promise<boolean> {
    if (!this.store) return false;
    try {
      const res = mergeTagsInList(this.tags, this.questions, sourceTagId, targetTagId);
      const prevTags = this.tags;
      const prevQuestions = this.questions;

      const updatedMap = new Map(res.updatedQuestions.map((q) => [q.id, q]));
      const nextQuestions = this.questions.map((q) =>
        updatedMap.has(q.id) ? updatedMap.get(q.id)! : q
      );

      this.tags = res.tags;
      this.questions = nextQuestions;
      this.notify();

      if (res.updatedQuestions.length > 0) {
        const qRes = await this.store.putBankQuestions(res.updatedQuestions);
        if (!qRes.ok) {
          this.tags = prevTags;
          this.questions = prevQuestions;
          this.notify();
          toast.error('Erro ao atualizar questões na mesclagem de etiquetas.');
          return false;
        }
      }

      const metaRes = await this.persistMeta(this.groups, res.tags, this.blueprints);
      if (!metaRes.ok) {
        this.tags = prevTags;
        this.questions = prevQuestions;
        this.notify();
        toast.error('Erro ao mesclar etiquetas.');
        return false;
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao mesclar etiquetas.';
      toast.error(msg);
      return false;
    }
  }

  async saveQuestion(question: BankQuestion): Promise<SaveResult> {
    if (!this.store) return { ok: false, reason: 'unknown' };
    const val = validateBankQuestion(question);
    if (!val.valid) {
      const firstErr = val.errors[0] || 'Questão inválida.';
      toast.error(firstErr);
      return { ok: false, error: new Error(firstErr), reason: 'unknown' };
    }

    const prevQuestions = this.questions;
    const exists = this.questions.some((q) => q.id === question.id);
    const nextQuestions = exists
      ? this.questions.map((q) => (q.id === question.id ? question : q))
      : [question, ...this.questions];

    this.questions = nextQuestions;
    this.notify();

    const res = await this.store.putBankQuestions([question]);
    if (!res.ok) {
      this.questions = prevQuestions;
      this.notify();
      toast.error('Erro ao salvar questão no banco.');
      return res;
    }
    return { ok: true };
  }

  async saveQuestions(qs: BankQuestion[]): Promise<SaveResult> {
    if (!this.store) return { ok: false, reason: 'unknown' };
    for (const q of qs) {
      const val = validateBankQuestion(q);
      if (!val.valid) {
        const firstErr = val.errors[0] || 'Questão inválida.';
        toast.error(`Questão inválida (${q.id}): ${firstErr}`);
        return { ok: false, error: new Error(firstErr), reason: 'unknown' };
      }
    }

    const prevQuestions = this.questions;
    const incomingMap = new Map(qs.map((q) => [q.id, q]));
    const nextQuestions: BankQuestion[] = [];

    for (const existing of this.questions) {
      if (incomingMap.has(existing.id)) {
        nextQuestions.push(incomingMap.get(existing.id)!);
        incomingMap.delete(existing.id);
      } else {
        nextQuestions.push(existing);
      }
    }
    for (const fresh of incomingMap.values()) {
      nextQuestions.unshift(fresh);
    }

    this.questions = nextQuestions;
    this.notify();

    const res = await this.store.putBankQuestions(qs);
    if (!res.ok) {
      this.questions = prevQuestions;
      this.notify();
      toast.error('Erro ao salvar lote de questões.');
      return res;
    }
    return { ok: true };
  }

  async deleteQuestions(ids: string[]): Promise<boolean> {
    if (!this.store || ids.length === 0) return true;
    const prevQuestions = this.questions;
    const idSet = new Set(ids);
    this.questions = this.questions.filter((q) => !idSet.has(q.id));
    this.notify();

    try {
      await this.store.deleteBankQuestions(ids);
      return true;
    } catch {
      this.questions = prevQuestions;
      this.notify();
      toast.error('Erro ao excluir questões.');
      return false;
    }
  }

  async archiveQuestions(ids: string[], archived: boolean): Promise<boolean> {
    if (!this.store || ids.length === 0) return true;
    const prevQuestions = this.questions;
    const idSet = new Set(ids);
    const now = new Date().toISOString();

    const nextQuestions = this.questions.map((q) =>
      idSet.has(q.id) ? { ...q, archived, updatedAt: now } : q
    );
    this.questions = nextQuestions;
    this.notify();

    const modified = nextQuestions.filter((q) => idSet.has(q.id));
    const res = await this.store.putBankQuestions(modified);
    if (!res.ok) {
      this.questions = prevQuestions;
      this.notify();
      toast.error('Erro ao atualizar arquivamento das questões.');
      return false;
    }
    return true;
  }

  async saveBlueprint(bp: Blueprint): Promise<SaveResult> {
    const norm = normalizeBlueprint(bp);
    const val = validateBlueprint(norm, {
      validGroupIds: new Set(this.groups.map((g) => g.id)),
      validTagIds: new Set(this.tags.map((t) => t.id)),
    });
    if (!val.valid) {
      const firstErr = val.errors[0] || 'Blueprint inválido.';
      toast.error(firstErr);
      return { ok: false, error: new Error(firstErr), reason: 'unknown' };
    }

    const prevBlueprints = this.blueprints;
    const exists = this.blueprints.some((b) => b.id === norm.id);
    const nextBlueprints = exists
      ? this.blueprints.map((b) => (b.id === norm.id ? norm : b))
      : [norm, ...this.blueprints];

    this.blueprints = nextBlueprints;
    this.notify();

    const res = await this.persistMeta(this.groups, this.tags, nextBlueprints);
    if (!res.ok) {
      this.blueprints = prevBlueprints;
      this.notify();
      toast.error('Erro ao salvar blueprint.');
      return res;
    }
    return { ok: true };
  }

  async deleteBlueprint(id: string): Promise<boolean> {
    const prevBlueprints = this.blueprints;
    const nextBlueprints = this.blueprints.filter((b) => b.id !== id);
    this.blueprints = nextBlueprints;
    this.notify();

    const res = await this.persistMeta(this.groups, this.tags, nextBlueprints);
    if (!res.ok) {
      this.blueprints = prevBlueprints;
      this.notify();
      toast.error('Erro ao excluir blueprint.');
      return false;
    }
    return true;
  }

  async replaceBank(data: BankData): Promise<SaveResult> {
    if (!this.store) return { ok: false, reason: 'unknown' };
    const res = await this.store.replaceBank(data);
    if (!res.ok) {
      toast.error('Erro ao substituir banco de questões.');
      return res;
    }

    this.groups = data.groups || [];
    this.tags = data.tags || [];
    this.blueprints = data.blueprints || [];
    this.questions = data.questions || [];
    this.isLoaded = true;
    this.notify();
    return { ok: true };
  }
}
