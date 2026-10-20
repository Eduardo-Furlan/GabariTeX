import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {
  BankGroup,
  BankTag,
  BankQuestion,
  Blueprint,
  BankData,
  TagColor,
} from '../types/bank';
import { SaveResult } from '../utils/storage';
import { ProfileStore } from '../storage/profileStore';
import { useProfile } from './ProfileContext';
import { DeleteGroupStrategy } from '../utils/bank/tree';
import { ExamWithQuestions } from '../utils/bank/usage';
import { BankManager, BankState } from '../utils/bank/manager';

export interface BankContextType {
  // Status & loading
  isLoaded: boolean;
  isLoading: boolean;
  ensureLoaded: () => Promise<void>;
  resetBankCache: () => void;

  // Raw collections
  groups: BankGroup[];
  tags: BankTag[];
  questions: BankQuestion[];
  blueprints: Blueprint[];

  // Memoized indexes
  questionCountByGroup: Map<string | null, { own: number; total: number }>;
  usageMap: Map<string, string[]>;
  usageCounts: Map<string, number>;

  // Group actions
  createGroup: (input: { name: string; parentId: string | null; id?: string }) => Promise<BankGroup | null>;
  renameGroup: (id: string, name: string) => Promise<boolean>;
  moveGroup: (id: string, targetParentId: string | null, targetIndex?: number) => Promise<boolean>;
  deleteGroup: (id: string, strategy: DeleteGroupStrategy) => Promise<boolean>;

  // Tag actions
  createTag: (name: string, color?: TagColor) => Promise<BankTag | null>;
  renameTag: (id: string, name: string) => Promise<boolean>;
  updateTagColor: (id: string, color: TagColor) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
  mergeTags: (sourceTagId: string, targetTagId: string) => Promise<boolean>;

  // Question actions
  saveQuestion: (question: BankQuestion) => Promise<SaveResult>;
  saveQuestions: (questions: BankQuestion[]) => Promise<SaveResult>;
  deleteQuestions: (ids: string[]) => Promise<boolean>;
  archiveQuestions: (ids: string[], archived: boolean) => Promise<boolean>;

  // Blueprint actions
  saveBlueprint: (blueprint: Blueprint) => Promise<SaveResult>;
  deleteBlueprint: (id: string) => Promise<boolean>;

  // Atomic replace / import
  replaceBank: (data: BankData) => Promise<SaveResult>;
}

export const BankContext = createContext<BankContextType | null>(null);

function useOptionalProfile() {
  try {
    return useProfile();
  } catch {
    return null;
  }
}

export interface BankProviderProps {
  children: React.ReactNode;
  /** Optional store override (e.g. for isolated testing) */
  store?: ProfileStore;
  /** Optional exams override for usage indexing */
  exams?: readonly ExamWithQuestions[];
}

export const BankProvider: React.FC<BankProviderProps> = ({
  children,
  store: propStore,
  exams: propExams,
}) => {
  const profileCtx = useOptionalProfile();
  const effectiveStore = propStore ?? profileCtx?.store;

  const [managerState, setManagerState] = useState<BankState>(() => ({
    isLoaded: false,
    isLoading: false,
    groups: [],
    tags: [],
    questions: [],
    blueprints: [],
    usageExams: propExams ?? [],
  }));

  const manager = useMemo(() => {
    return new BankManager(effectiveStore, propExams, (nextState) => {
      setManagerState(nextState);
    });
  }, [effectiveStore]);

  // Keep store in sync if it changes
  useEffect(() => {
    manager.setStore(effectiveStore);
  }, [effectiveStore, manager]);

  // Keep usage exams in sync if propExams changes
  useEffect(() => {
    if (propExams) {
      manager.setUsageExams(propExams);
    }
  }, [propExams, manager]);

  // Handle reloadProfile cache reset
  const prevReloadKeyRef = useRef(profileCtx?.profileReloadKey ?? 0);
  useEffect(() => {
    const currentKey = profileCtx?.profileReloadKey ?? 0;
    if (currentKey !== prevReloadKeyRef.current) {
      prevReloadKeyRef.current = currentKey;
      manager.resetBankCache();
    }
  }, [profileCtx?.profileReloadKey, manager]);

  const questionCountByGroup = useMemo(
    () => manager.getQuestionCountByGroup(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manager, managerState.questions, managerState.groups]
  );

  const usageMap = useMemo(
    () => manager.getUsageMap(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manager, managerState.usageExams]
  );

  const usageCounts = useMemo(
    () => manager.getUsageCounts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manager, usageMap]
  );

  const value = useMemo<BankContextType>(
    () => ({
      isLoaded: managerState.isLoaded,
      isLoading: managerState.isLoading,
      groups: managerState.groups,
      tags: managerState.tags,
      questions: managerState.questions,
      blueprints: managerState.blueprints,
      questionCountByGroup,
      usageMap,
      usageCounts,
      ensureLoaded: () => manager.ensureLoaded(),
      resetBankCache: () => manager.resetBankCache(),
      createGroup: (input) => manager.createGroup(input),
      renameGroup: (id, name) => manager.renameGroup(id, name),
      moveGroup: (id, parentId, index) => manager.moveGroup(id, parentId, index),
      deleteGroup: (id, strategy) => manager.deleteGroup(id, strategy),
      createTag: (name, color) => manager.createTag(name, color),
      renameTag: (id, name) => manager.renameTag(id, name),
      updateTagColor: (id, color) => manager.updateTagColor(id, color),
      deleteTag: (id) => manager.deleteTag(id),
      mergeTags: (s, t) => manager.mergeTags(s, t),
      saveQuestion: (q) => manager.saveQuestion(q),
      saveQuestions: (qs) => manager.saveQuestions(qs),
      deleteQuestions: (ids) => manager.deleteQuestions(ids),
      archiveQuestions: (ids, archived) => manager.archiveQuestions(ids, archived),
      saveBlueprint: (bp) => manager.saveBlueprint(bp),
      deleteBlueprint: (id) => manager.deleteBlueprint(id),
      replaceBank: (data) => manager.replaceBank(data),
    }),
    [manager, managerState, questionCountByGroup, usageMap, usageCounts]
  );

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
};

export function useBank(): BankContextType {
  const ctx = useContext(BankContext);
  if (!ctx) {
    throw new Error('useBank deve ser utilizado dentro de um BankProvider');
  }
  return ctx;
}
