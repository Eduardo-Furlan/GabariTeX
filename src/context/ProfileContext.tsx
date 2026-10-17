import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Exam, ExamVersion, GradingRecord, Classroom, Question } from '../types/exam';
import { ProfileData, ProfileSettings, ExamMeta } from '../types/profile';
import { initialSampleExam, emptyExam } from '../utils/sampleExam';
import { generateExamVersions } from '../utils/randomizer';
import { generateExamPassword } from '../utils/crypto';
import { createLatestGate } from '../utils/latestGate';
import {
  loadActiveClassIdFromStorage,
  saveActiveClassIdToStorage,
  SaveResult,
} from '../utils/storage';
import { addStudent } from '../utils/classrooms';
import { isWithinLimit, MAX_QUESTIONS } from '../utils/examLimits';
import { getProfileStore } from '../storage';
import { ProfileStore } from '../storage/profileStore';
import { buildProfileZip } from '../utils/profileZip';
import { saveFile } from '../platform/files';
import { useAutosave, AutosaveState } from '../hooks/useAutosave';
import { DecryptedQrPayload, GradingEvidence } from '../types/omr';
import { buildPayload } from '../utils/payload';
import { computeExamFingerprint } from '../utils/fingerprint';
import {
  triggerDesktopSnapshot,
  checkAndRunDailySnapshot,
} from '../platform/snapshots';

export interface ExamSwitchPromptState {
  targetExamId: string;
  targetExamName: string;
  pendingPayload?: DecryptedQrPayload;
  pendingRecord?: GradingRecord;
}

export interface ProfileContextType {
  store: ProfileStore;
  isLoadingProfile: boolean;
  exams: ExamMeta[];
  exam: Exam;
  activeExamId: string;
  versions: ExamVersion[];
  selectedVersionLetter: string;
  setSelectedVersionLetter: (letter: string) => void;
  teacherPassword: string;
  allExamPasswords: Record<string, string>;
  candidatePasswords: string[];
  records: GradingRecord[];
  classes: Classroom[];
  activeClassId: string | null;
  setActiveClassId: (id: string | null) => void;
  profileSettings: ProfileSettings;
  autosaveState: AutosaveState;
  hasStorageError: boolean;
  isExamCorrupted: boolean;

  // Modals e painéis
  isExportImportOpen: boolean;
  setIsExportImportOpen: (open: boolean) => void;
  exportProfileData: ProfileData | null;
  setExportProfileData: (data: ProfileData | null) => void;

  // Scanner e Correção
  scannerMode: 'single' | 'batch';
  setScannerMode: (m: 'single' | 'batch') => void;
  isBatchProcessing: boolean;
  setIsBatchProcessing: (b: boolean) => void;
  activePayload: DecryptedQrPayload | null;
  setActivePayload: (p: DecryptedQrPayload | null) => void;
  handleLockPayload: (p: DecryptedQrPayload | null) => void;
  handlePhotoGraded: (record: GradingRecord, evidence?: GradingEvidence) => void;
  handleBatchSaveRecords: (newRecords: GradingRecord[]) => void;
  handleSelectExamVersion: (v: ExamVersion) => void;
  gradingSession: { record: GradingRecord; evidence?: GradingEvidence } | null;
  setGradingSession: (s: { record: GradingRecord; evidence?: GradingEvidence } | null) => void;
  examSwitchPrompt: ExamSwitchPromptState | null;
  setExamSwitchPrompt: (p: ExamSwitchPromptState | null) => void;

  // Ações de Prova
  selectActiveExam: (id: string | null) => Promise<void>;
  ensureExamExists: (
    examId: string,
    versionLetter?: string,
    payload?: DecryptedQrPayload
  ) => Promise<ExamMeta>;
  createExam: (title?: string) => Promise<Exam>;
  duplicateExam: (id: string) => Promise<Exam | undefined>;
  renameExam: (id: string, newTitle: string) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  shareExam: (id: string) => Promise<void>;
  loadSampleMathExam: () => Promise<void>;
  updateExam: (updated: Exam) => void;
  moveQuestion: (questionId: string, direction: 'up' | 'down') => void;
  duplicateQuestion: (questionId: string) => Question | undefined;
  importQuestions: (questionsToImport: Question[]) => number;
  clearCurrentExam: () => void;
  updateTeacherPassword: (newPass: string) => void;

  // Ações de Turmas e Notas
  updateClasses: (cls: Classroom[] | ((prev: Classroom[]) => Classroom[])) => void;
  updateRecords: (recs: GradingRecord[] | ((prev: GradingRecord[]) => GradingRecord[])) => void;
  handleAddStudentToClass: (classId: string, student: { name: string; registration?: string }) => void;
  handleDisassociateRecordsFromClass: (classId: string) => void;
  handleGradeSaved: (
    newRecord: GradingRecord,
    options?: { newStudentToClass?: { classId: string; name: string; registration?: string } }
  ) => void;
  reloadProfile: () => Promise<void>;
  flushAll: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useMemo(() => getProfileStore(), []);

  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [exam, setExam] = useState<Exam>(emptyExam);
  const [versions, setVersions] = useState<ExamVersion[]>([]);
  const [selectedVersionLetter, setSelectedVersionLetter] = useState<string>('A');

  const [teacherPassword, setTeacherPassword] = useState<string>('');
  const [allExamPasswords, setAllExamPasswords] = useState<Record<string, string>>({});
  const [activePayload, setActivePayload] = useState<DecryptedQrPayload | null>(null);

  const [records, setRecords] = useState<GradingRecord[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>({});

  const [activeClassId, setActiveClassIdState] = useState<string | null>(() => {
    return loadActiveClassIdFromStorage();
  });

  const [isExportImportOpen, setIsExportImportOpen] = useState<boolean>(false);
  const [exportProfileData, setExportProfileData] = useState<ProfileData | null>(null);
  const [scannerMode, setScannerMode] = useState<'single' | 'batch'>('single');
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);

  const [gradingSession, setGradingSession] = useState<{
    record: GradingRecord;
    evidence?: GradingEvidence;
  } | null>(null);

  const [examSwitchPrompt, setExamSwitchPrompt] = useState<ExamSwitchPromptState | null>(null);

  const isExamCorrupted = !isWithinLimit(exam.questions?.length ?? 0);

  const setActiveClassId = useCallback((id: string | null) => {
    setActiveClassIdState(id);
    saveActiveClassIdToStorage(id);
  }, []);

  // Autosave assíncrono conectado ao ProfileStore
  const okResult: SaveResult = { ok: true };

  const saveExamFn = useCallback(
    (ex: Exam): Promise<SaveResult> | SaveResult => {
      if (!isLoadingProfile && ex.id) {
        return store.putExam(ex);
      }
      return okResult;
    },
    [isLoadingProfile, store]
  );

  const saveGradebookFn = useCallback(
    (recs: GradingRecord[]): Promise<SaveResult> | SaveResult => {
      if (!isLoadingProfile) {
        return store.putRecords(recs);
      }
      return okResult;
    },
    [isLoadingProfile, store]
  );

  const saveClassroomsFn = useCallback(
    (cls: Classroom[]): Promise<SaveResult> | SaveResult => {
      if (!isLoadingProfile) {
        return store.putClasses(cls);
      }
      return okResult;
    },
    [isLoadingProfile, store]
  );

  const examAutosave = useAutosave(exam, saveExamFn, 400, exam.id);
  const gradebookAutosave = useAutosave(records, saveGradebookFn, 300);
  const classroomsAutosave = useAutosave(classes, saveClassroomsFn, 400);

  const hasStorageError =
    examAutosave.status === 'error' ||
    gradebookAutosave.status === 'error' ||
    classroomsAutosave.status === 'error';

  const overallAutosaveStatus: AutosaveState =
    hasStorageError
      ? { status: 'error' }
      : examAutosave.status === 'saving' ||
        gradebookAutosave.status === 'saving' ||
        classroomsAutosave.status === 'saving'
      ? { status: 'saving' }
      : { status: 'saved' };

  const flushAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      examAutosave.flushAsync(),
      gradebookAutosave.flushAsync(),
      classroomsAutosave.flushAsync(),
    ]);
  }, [examAutosave, gradebookAutosave, classroomsAutosave]);

  const examRef = useRef(exam);
  examRef.current = exam;
  const profileSettingsRef = useRef(profileSettings);
  profileSettingsRef.current = profileSettings;
  const flushAllRef = useRef(flushAll);
  flushAllRef.current = flushAll;
  const switchGate = useRef(createLatestGate()).current;

  const persistSettings = useCallback(
    (next: ProfileSettings) => {
      setProfileSettings(next);
      void store.putSettings(next).catch(console.error);
    },
    [store]
  );

  // Fechamento da janela em Desktop (onCloseRequested) com flush de pendências
  useEffect(() => {
    if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let isClosing = false;

    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        const appWindow = getCurrentWindow();
        return appWindow.onCloseRequested(async (event) => {
          if (isClosing) return;
          isClosing = true;
          event.preventDefault();

          try {
            const flushPromise = flushAll();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Flush timeout')), 3000)
            );
            await Promise.race([flushPromise, timeoutPromise]);
          } catch (err) {
            console.warn('[Desktop Close] Erro ou timeout ao salvar antes de fechar:', err);
          } finally {
            await appWindow.destroy();
          }
        });
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.warn('[Desktop Close] Falha ao registrar onCloseRequested:', err);
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [flushAll]);

  // Snapshot diário automático no desktop (3s após o carregamento inicial)
  useEffect(() => {
    if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__ || isLoadingProfile) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const fullExams = await Promise.all(exams.map((m) => store.getExam(m.id)));
        const validExams = fullExams.filter((e): e is Exam => Boolean(e));
        const examMap = new Map(validExams.map((e) => [e.id, e]));
        if (exam.id) examMap.set(exam.id, exam);

        const currentProfileData: ProfileData = {
          exams: Array.from(examMap.values()),
          classes,
          records,
        };

        await checkAndRunDailySnapshot(currentProfileData);
      } catch (err) {
        console.warn('[Desktop Snapshot] Erro ao checar snapshot diário:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isLoadingProfile, exams, exam, classes, records, store]);

  // Carregamento inicial do Perfil
  const initProfile = useCallback(async () => {
    try {
      setIsLoadingProfile(true);
      const [examMetasList, classesList, recordsList, settings] = await Promise.all([
        store.listExams(),
        store.getClasses(),
        store.getRecords(),
        store.getSettings(),
      ]);

      const sanitizedClasses = (classesList || []).map((c) => ({
        ...c,
        students: Array.isArray(c.students) ? c.students : [],
      }));
      setClasses(sanitizedClasses);
      setRecords(recordsList);
      setProfileSettings(settings);

      if (examMetasList.length === 0) {
        const newId = crypto.randomUUID();
        const generatedPass = generateExamPassword(8);
        const initialExam: Exam = {
          ...initialSampleExam,
          id: newId,
          password: generatedPass,
          updatedAt: new Date().toISOString(),
        };

        await store.putExam(initialExam);

        setExam(initialExam);
        setTeacherPassword(generatedPass);
        setAllExamPasswords({ [newId]: generatedPass });
        setExams([
          {
            id: newId,
            name: initialExam.header.examTitle || 'Sem título',
            updatedAt: initialExam.updatedAt!,
            questionCount: initialExam.questions.length,
            recordCount: 0,
          },
        ]);
      } else {
        setExams(examMetasList);

        const loadedAll = await Promise.all(examMetasList.map((m) => store.getExam(m.id)));
        const pwMap: Record<string, string> = {};
        loadedAll.forEach((e) => {
          if (e && e.password) pwMap[e.id] = e.password;
        });
        setAllExamPasswords(pwMap);

        const activeId =
          (settings.activeExamId &&
            examMetasList.some((m) => m.id === settings.activeExamId) &&
            settings.activeExamId) ||
          examMetasList[0].id;

        let targetExam = await store.getExam(activeId);
        if (!targetExam) {
          targetExam = await store.getExam(examMetasList[0].id);
        }

        if (targetExam) {
          if (!targetExam.password) {
            targetExam.password = generateExamPassword(8);
            await store.putExam(targetExam);
          }
          setExam(targetExam);
          setTeacherPassword(targetExam.password);
          setAllExamPasswords((prev) => ({
            ...prev,
            [targetExam!.id]: targetExam!.password,
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [store]);

  useEffect(() => {
    initProfile();
  }, [initProfile]);

  const refreshVersions = useCallback(
    async (currentExam: Exam) => {
      try {
        const generated = await generateExamVersions(currentExam);
        setVersions(generated);
        if (
          generated.length > 0 &&
          !generated.some((v) => v.versionLetter === selectedVersionLetter)
        ) {
          setSelectedVersionLetter(generated[0].versionLetter);
        }
      } catch (err) {
        console.error('Erro ao gerar versões', err);
      }
    },
    [selectedVersionLetter]
  );

  useEffect(() => {
    if (!isLoadingProfile && exam.id) {
      refreshVersions(exam);
    }
  }, [exam, refreshVersions, isLoadingProfile]);

  const updateTeacherPassword = useCallback((newPass: string) => {
    setTeacherPassword(newPass);
    setExam((prev) => ({ ...prev, password: newPass }));
    if (exam.id) {
      setAllExamPasswords((prev) => ({ ...prev, [exam.id]: newPass }));
    }
  }, [exam.id]);

  const ensureExamExists = useCallback(
    async (
      examId: string,
      _versionLetter?: string,
      payload?: DecryptedQrPayload
    ): Promise<ExamMeta> => {
      const existing = exams.find((e) => e.id === examId);
      if (existing) return existing;

      const inStore = await store.getExam(examId);
      if (inStore) {
        const meta: ExamMeta = {
          id: inStore.id,
          name: inStore.header?.examTitle || 'Sem título',
          updatedAt: inStore.updatedAt || new Date().toISOString(),
          questionCount: inStore.questions?.length ?? 0,
          recordCount: records.filter((r) => r.examId === examId).length,
        };
        setExams((prev) => (prev.some((e) => e.id === examId) ? prev : [meta, ...prev]));
        if (inStore.password) {
          setAllExamPasswords((prev) => ({ ...prev, [examId]: inStore.password! }));
        }
        return meta;
      }

      const questionCount =
        payload?.totalQuestions ??
        (payload?.key ? Math.max(...Object.keys(payload.key).map(Number), 0) : 20);

      const questions = [];
      for (let i = 1; i <= questionCount; i++) {
        const correctOpt = payload?.key?.[i] || 'A';
        const isSubj = payload?.subjectiveQuestions?.includes(i);
        const pts =
          (payload?.subjectivePoints && payload.subjectivePoints[i]) ||
          (typeof payload?.points === 'number' ? payload.points : 1);

        questions.push({
          id: `q-rec-${i}`,
          type: isSubj ? ('subjective' as const) : ('objective' as const),
          prompt: `Questão ${i}`,
          points: pts,
          options: [
            { id: `opt-A-${i}`, label: 'A' as const, text: '', isCorrect: correctOpt === 'A' },
            { id: `opt-B-${i}`, label: 'B' as const, text: '', isCorrect: correctOpt === 'B' },
            { id: `opt-C-${i}`, label: 'C' as const, text: '', isCorrect: correctOpt === 'C' },
            { id: `opt-D-${i}`, label: 'D' as const, text: '', isCorrect: correctOpt === 'D' },
            { id: `opt-E-${i}`, label: 'E' as const, text: '', isCorrect: correctOpt === 'E' },
          ],
        });
      }

      const shortId = examId.length > 8 ? examId.slice(0, 8) : examId;
      const recoveredTitle = `Prova Recuperada (${shortId})`;

      const pass = teacherPassword || generateExamPassword(8);
      const recoveredExam: Exam = {
        id: examId,
        header: {
          institution: '',
          course: '',
          professor: '',
          examTitle: recoveredTitle,
          date: new Date().toLocaleDateString('pt-BR'),
          instructions:
            'Prova identificada e recuperada automaticamente via leitura de QR Code no Corretor Óptico.',
        },
        password: pass,
        versionCount: 1,
        shuffleQuestions: false,
        shuffleOptions: false,
        twoColumns: true,
        updatedAt: new Date().toISOString(),
        questions,
      };

      await store.putExam(recoveredExam);

      const meta: ExamMeta = {
        id: examId,
        name: recoveredTitle,
        updatedAt: recoveredExam.updatedAt!,
        questionCount: recoveredExam.questions.length,
        recordCount: 1,
      };

      setExams((prev) => [meta, ...prev.filter((e) => e.id !== examId)]);
      setAllExamPasswords((prev) => ({ ...prev, [examId]: pass }));

      return meta;
    },
    [exams, store, records, teacherPassword]
  );

  const selectActiveExam = useCallback(
    async (id: string | null) => {
      const targetId = id ?? '';
      // idempotente
      if (
        targetId === examRef.current.id &&
        (id !== null || !profileSettingsRef.current.activeExamId)
      ) {
        return;
      }

      const token = switchGate.begin();
      await flushAllRef.current(); // grava edição pendente da prova atual

      if (!id) {
        if (!switchGate.isCurrent(token)) return;
        const autonomousExam: Exam = {
          ...emptyExam,
          id: '',
          header: {
            ...emptyExam.header,
            examTitle: 'Modo Autônomo',
          },
        };
        setExam(autonomousExam);
        setVersions([]);
        setActivePayload(null);
        persistSettings({ ...profileSettingsRef.current, activeExamId: undefined });
        return;
      }

      let target = await store.getExam(id);
      if (!target) {
        await ensureExamExists(id);
        target = await store.getExam(id);
      }
      if (!target || !switchGate.isCurrent(token)) return; // "último vence"

      let pass = target.password;
      if (!pass) {
        pass = generateExamPassword(8);
        target.password = pass;
        await store.putExam(target);
      }
      if (!switchGate.isCurrent(token)) return;

      // commit síncrono, sem awaits no meio
      setExam(target);
      setTeacherPassword(pass);
      setAllExamPasswords((prev) => ({ ...prev, [id]: pass! }));
      setActivePayload(null);
      persistSettings({ ...profileSettingsRef.current, activeExamId: id });
    },
    [store, ensureExamExists, persistSettings, switchGate]
  );

  const createExam = useCallback(
    async (title = 'Nova Prova'): Promise<Exam> => {
      const newId = crypto.randomUUID();
      const newPass = generateExamPassword(8);
      const newExam: Exam = {
        ...emptyExam,
        id: newId,
        password: newPass,
        header: {
          ...emptyExam.header,
          examTitle: title,
        },
        updatedAt: new Date().toISOString(),
      };

      await store.putExam(newExam);
      setExams((prev) => [
        {
          id: newId,
          name: title,
          updatedAt: newExam.updatedAt!,
          questionCount: 0,
          recordCount: 0,
        },
        ...prev,
      ]);
      setAllExamPasswords((prev) => ({ ...prev, [newId]: newPass }));
      setExam(newExam);
      setTeacherPassword(newPass);
      setActivePayload(null);
      const newSettings = { ...profileSettings, activeExamId: newId };
      setProfileSettings(newSettings);
      await store.putSettings(newSettings);
      return newExam;
    },
    [store, profileSettings]
  );

  const duplicateExam = useCallback(
    async (id: string): Promise<Exam | undefined> => {
      const source = await store.getExam(id);
      if (!source) return undefined;

      const newId = crypto.randomUUID();
      const newPass = generateExamPassword(8);
      const duplicated: Exam = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        password: newPass,
        header: {
          ...source.header,
          examTitle: `${source.header.examTitle || 'Prova'} (Cópia)`,
        },
        updatedAt: new Date().toISOString(),
      };

      await store.putExam(duplicated);
      setExams((prev) => [
        {
          id: newId,
          name: duplicated.header.examTitle,
          updatedAt: duplicated.updatedAt!,
          questionCount: duplicated.questions.length,
          recordCount: 0,
        },
        ...prev,
      ]);
      setAllExamPasswords((prev) => ({ ...prev, [newId]: newPass }));
      setExam(duplicated);
      setTeacherPassword(newPass);
      setActivePayload(null);
      const newSettings = { ...profileSettings, activeExamId: newId };
      setProfileSettings(newSettings);
      await store.putSettings(newSettings);
      return duplicated;
    },
    [store, profileSettings]
  );

  const renameExam = useCallback(
    async (id: string, newTitle: string) => {
      const exToRename = await store.getExam(id);
      if (exToRename) {
        exToRename.header.examTitle = newTitle;
        exToRename.updatedAt = new Date().toISOString();
        await store.putExam(exToRename);
        if (exam.id === id) {
          setExam({ ...exToRename });
        }
        setExams((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, name: newTitle, updatedAt: exToRename.updatedAt! } : m
          )
        );
      }
    },
    [store, exam.id]
  );

  const deleteExam = useCallback(
    async (id: string) => {
      if (typeof __DESKTOP__ !== 'undefined' && __DESKTOP__) {
        const hasRecords = records.some((r) => r.examId === id);
        if (hasRecords) {
          try {
            const fullExams = await Promise.all(exams.map((m) => store.getExam(m.id)));
            const validExams = fullExams.filter((e): e is Exam => Boolean(e));
            await triggerDesktopSnapshot(
              { exams: validExams, classes, records },
              'pre-delete'
            );
          } catch (err) {
            console.warn('[Desktop Snapshot] Falha ao criar snapshot pré-exclusão:', err);
          }
        }
      }

      await store.deleteExam(id);
      const remainingExams = exams.filter((e) => e.id !== id);
      setExams(remainingExams);
      setRecords((prev) => prev.filter((r) => r.examId !== id));
      setAllExamPasswords((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      if (exam.id === id) {
        if (remainingExams.length > 0) {
          await selectActiveExam(remainingExams[0].id);
        } else {
          await createExam();
        }
      }
    },
    [store, exams, exam.id, selectActiveExam, createExam]
  );

  const shareExam = useCallback(
    async (id: string) => {
      const targetEx = await store.getExam(id);
      if (targetEx) {
        const zipBlob = await buildProfileZip(
          {
            exams: [targetEx],
            classes: [],
            records: [],
          },
          {},
          {
            includeRecords: false,
            includeClasses: false,
            includePasswords: false,
          }
        );
        const safeTitle = (targetEx.header.examTitle || 'prova')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_');
        await saveFile({
          suggestedName: `gabaritex-prova-${safeTitle}.zip`,
          mime: 'application/zip',
          data: zipBlob,
        });
      }
    },
    [store]
  );

  const loadSampleMathExam = useCallback(async () => {
    const newId = crypto.randomUUID();
    const newPass = generateExamPassword(8);
    const sample: Exam = {
      ...initialSampleExam,
      id: newId,
      password: newPass,
      updatedAt: new Date().toISOString(),
    };
    await store.putExam(sample);
    setExams((prev) => [
      {
        id: newId,
        name: sample.header.examTitle,
        updatedAt: sample.updatedAt!,
        questionCount: sample.questions.length,
        recordCount: 0,
      },
      ...prev,
    ]);
    setAllExamPasswords((prev) => ({ ...prev, [newId]: newPass }));
    setExam(sample);
    setTeacherPassword(newPass);
    setActivePayload(null);
  }, [store]);

  const updateExam = useCallback(
    (updated: Exam) => {
      if (!isWithinLimit(updated.questions?.length ?? 0)) {
        alert(
          `A prova não pode exceder ${MAX_QUESTIONS} questões (máximo suportado na folha de respostas A4). A alteração foi rejeitada.`
        );
        return;
      }
      const stamped = { ...updated, updatedAt: new Date().toISOString() };
      setExam(stamped);
      if (stamped.password) {
        setTeacherPassword(stamped.password);
        setAllExamPasswords((prev) => ({ ...prev, [stamped.id]: stamped.password }));
      }
      setExams((prev) =>
        prev.map((m) =>
          m.id === stamped.id
            ? {
                ...m,
                name: stamped.header.examTitle || 'Sem título',
                questionCount: stamped.questions.length,
                updatedAt: stamped.updatedAt!,
              }
            : m
        )
      );
    },
    []
  );

  const moveQuestion = useCallback(
    (questionId: string, direction: 'up' | 'down') => {
      const idx = exam.questions.findIndex((q) => q.id === questionId);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= exam.questions.length) return;
      const reordered = [...exam.questions];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(targetIdx, 0, moved);
      updateExam({ ...exam, questions: reordered });
    },
    [exam, updateExam]
  );

  const duplicateQuestion = useCallback(
    (questionId: string): Question | undefined => {
      const idx = exam.questions.findIndex((q) => q.id === questionId);
      if (idx === -1) return undefined;
      if (!isWithinLimit(exam.questions.length + 1)) {
        alert(
          `A prova não pode exceder ${MAX_QUESTIONS} questões (máximo suportado na folha de respostas A4).`
        );
        return undefined;
      }
      const source = exam.questions[idx];
      const cloned: Question = {
        ...JSON.parse(JSON.stringify(source)),
        id: crypto.randomUUID(),
        options: source.options
          ? source.options.map((opt) => ({
              ...opt,
              id: crypto.randomUUID(),
            }))
          : undefined,
      };
      const nextQuestions = [...exam.questions];
      nextQuestions.splice(idx + 1, 0, cloned);
      updateExam({ ...exam, questions: nextQuestions });
      return cloned;
    },
    [exam, updateExam]
  );

  const importQuestions = useCallback(
    (questionsToImport: Question[]): number => {
      if (questionsToImport.length === 0) return 0;
      const availableSlots = MAX_QUESTIONS - exam.questions.length;
      if (availableSlots <= 0) {
        alert(
          `A prova já atingiu o limite máximo de ${MAX_QUESTIONS} questões.`
        );
        return 0;
      }
      const slice = questionsToImport.slice(0, availableSlots);
      const clonedList: Question[] = slice.map((q) => ({
        ...JSON.parse(JSON.stringify(q)),
        id: crypto.randomUUID(),
        options: q.options
          ? q.options.map((opt) => ({
              ...opt,
              id: crypto.randomUUID(),
            }))
          : undefined,
      }));
      updateExam({
        ...exam,
        questions: [...exam.questions, ...clonedList],
      });
      return clonedList.length;
    },
    [exam, updateExam]
  );

  const clearCurrentExam = useCallback(() => {
    if (
      confirm(
        'Tem certeza de que deseja limpar todas as questões e instruções da prova atual?'
      )
    ) {
      const now = new Date().toISOString();
      const cleared: Exam = {
        ...emptyExam,
        id: exam.id,
        password: exam.password || generateExamPassword(8),
        updatedAt: now,
      };
      setExam(cleared);
      setVersions([]);
      setExams((prev) =>
        prev.map((m) =>
          m.id === cleared.id
            ? {
                ...m,
                name: cleared.header.examTitle || 'Sem título',
                questionCount: cleared.questions.length,
                updatedAt: now,
              }
            : m
        )
      );
    }
  }, [exam.id, exam.password]);

  // Mantém recordCount sincronizado automaticamente com a lista de registros
  useEffect(() => {
    if (isLoadingProfile) return;
    const counts: Record<string, number> = {};
    for (const r of records) {
      if (r.examId) {
        counts[r.examId] = (counts[r.examId] || 0) + 1;
      }
    }
    setExams((prev) => {
      let changed = false;
      const next = prev.map((e) => {
        const actual = counts[e.id] || 0;
        if (e.recordCount !== actual) {
          changed = true;
          return { ...e, recordCount: actual };
        }
        return e;
      });
      return changed ? next : prev;
    });
  }, [records, isLoadingProfile]);

  const updateClasses = useCallback(
    (clsOrUpdater: Classroom[] | ((prev: Classroom[]) => Classroom[])) => {
      setClasses((prev) => {
        const next = typeof clsOrUpdater === 'function' ? clsOrUpdater(prev) : clsOrUpdater;
        return (next || []).map((c) => ({
          ...c,
          students: Array.isArray(c.students) ? c.students : [],
        }));
      });
    },
    []
  );

  const handleAddStudentToClass = useCallback(
    (classId: string, student: { name: string; registration?: string }) => {
      setClasses((prev) =>
        prev.map((c) => {
          if (c.id !== classId) return c;
          try {
            return addStudent(c, student);
          } catch {
            return c;
          }
        })
      );
    },
    []
  );

  const handleDisassociateRecordsFromClass = useCallback((classId: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.classId === classId) {
          const { classId: _, studentRef: __, ...rest } = r;
          return rest as GradingRecord;
        }
        return r;
      })
    );
  }, []);

  const handleGradeSaved = useCallback(
    async (
      newRecord: GradingRecord,
      options?: { newStudentToClass?: { classId: string; name: string; registration?: string } }
    ) => {
      const recordExamId = newRecord.examId || activePayload?.examId || exam.id;
      const recordToStore: GradingRecord = {
        ...newRecord,
        examId: recordExamId,
        timestamp: Date.now(),
      };

      if (recordExamId && !exams.some((e) => e.id === recordExamId)) {
        await ensureExamExists(recordExamId, recordToStore.versionLetter, activePayload || undefined);
      }

      setRecords((prev) => [recordToStore, ...prev.filter((r) => r.id !== recordToStore.id)]);

      if (options?.newStudentToClass) {
        handleAddStudentToClass(options.newStudentToClass.classId, {
          name: options.newStudentToClass.name,
          registration: options.newStudentToClass.registration,
        });
      }
    },
    [exam.id, activePayload, exams, ensureExamExists, handleAddStudentToClass]
  );

  const handleBatchSaveRecords = useCallback(
    async (newRecords: GradingRecord[]) => {
      if (newRecords.length === 0) return;

      const stamped = newRecords.map((r) => ({
        ...r,
        examId: r.examId || activePayload?.examId || exam.id,
        timestamp: r.timestamp || Date.now(),
      }));

      const unknownExamIds = Array.from(
        new Set(
          stamped
            .map((r) => r.examId)
            .filter((eId): eId is string => Boolean(eId) && !exams.some((e) => e.id === eId))
        )
      );

      for (const uId of unknownExamIds) {
        await ensureExamExists(uId);
      }

      const newIds = new Set(stamped.map((r) => r.id));

      setRecords((prev) => {
        const filtered = prev.filter((r) => !newIds.has(r.id));
        return [...stamped, ...filtered];
      });
    },
    [exam.id, activePayload, exams, ensureExamExists]
  );

  const handleLockPayload = useCallback(
    async (payload: DecryptedQrPayload | null) => {
      setActivePayload(payload);
      if (payload?.examId) {
        if (!exams.some((e) => e.id === payload.examId)) {
          await ensureExamExists(payload.examId, payload.version, payload);
        }
      }
    },
    [exams, ensureExamExists]
  );

  const handlePhotoGraded = useCallback(
    (record: GradingRecord, evidence?: GradingEvidence) => {
      const recordExamId = record.examId || activePayload?.examId || exam.id;
      setGradingSession({
        record: { ...record, examId: recordExamId },
        evidence,
      });
    },
    [exam.id, activePayload]
  );

  const handleSelectExamVersion = useCallback(
    (v: ExamVersion) => {
      setActivePayload(
        buildPayload({
          examId: exam.id,
          versionLetter: v.versionLetter,
          questions: v.questions,
          objectiveAnswerKey: v.objectiveAnswerKey,
          examFingerprint: computeExamFingerprint(exam),
        })
      );
    },
    [exam]
  );

  const candidatePasswords = useMemo(() => {
    return [
      teacherPassword,
      ...Object.values(allExamPasswords).filter((p) => p && p !== teacherPassword),
    ];
  }, [teacherPassword, allExamPasswords]);

  const value: ProfileContextType = {
    store,
    isLoadingProfile,
    exams,
    exam,
    activeExamId: exam.id && exams.some((e) => e.id === exam.id) ? exam.id : '',
    versions,
    selectedVersionLetter,
    setSelectedVersionLetter,
    teacherPassword,
    allExamPasswords,
    candidatePasswords,
    records,
    classes,
    activeClassId,
    setActiveClassId,
    profileSettings,
    autosaveState: overallAutosaveStatus,
    hasStorageError,
    isExamCorrupted,

    isExportImportOpen,
    setIsExportImportOpen,
    exportProfileData,
    setExportProfileData,

    scannerMode,
    setScannerMode,
    isBatchProcessing,
    setIsBatchProcessing,
    activePayload,
    setActivePayload,
    handleLockPayload,
    handlePhotoGraded,
    handleBatchSaveRecords,
    handleSelectExamVersion,
    gradingSession,
    setGradingSession,
    examSwitchPrompt,
    setExamSwitchPrompt,

    selectActiveExam,
    ensureExamExists,
    createExam,
    duplicateExam,
    renameExam,
    deleteExam,
    shareExam,
    loadSampleMathExam,
    updateExam,
    moveQuestion,
    duplicateQuestion,
    importQuestions,
    clearCurrentExam,
    updateTeacherPassword,

    updateClasses,
    updateRecords: setRecords,
    handleAddStudentToClass,
    handleDisassociateRecordsFromClass,
    handleGradeSaved,
    reloadProfile: initProfile,
    flushAll,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export function useProfile(): ProfileContextType {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile deve ser utilizado dentro de um ProfileProvider');
  }
  return ctx;
}
