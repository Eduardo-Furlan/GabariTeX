import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Exam, ExamVersion, GradingRecord, Classroom } from '../types/exam';
import { ProfileData, ProfileSettings, ExamMeta } from '../types/profile';
import { initialSampleExam, emptyExam } from '../utils/sampleExam';
import { generateExamVersions } from '../utils/randomizer';
import { generateExamPassword } from '../utils/crypto';
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
  isClassManagerOpen: boolean;
  setIsClassManagerOpen: (open: boolean) => void;
  isLibraryOpen: boolean;
  setIsLibraryOpen: (open: boolean) => void;
  exportProfileData: ProfileData | null;
  setExportProfileData: (data: ProfileData | null) => void;

  // Scanner e Correção
  scannerMode: 'single' | 'batch';
  setScannerMode: (m: 'single' | 'batch') => void;
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
  selectActiveExam: (id: string) => Promise<void>;
  createExam: (title?: string) => Promise<Exam>;
  duplicateExam: (id: string) => Promise<Exam | undefined>;
  renameExam: (id: string, newTitle: string) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  shareExam: (id: string) => Promise<void>;
  loadSampleMathExam: () => Promise<void>;
  updateExam: (updated: Exam) => void;
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

  const [isClassManagerOpen, setIsClassManagerOpen] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState<boolean>(false);
  const [exportProfileData, setExportProfileData] = useState<ProfileData | null>(null);
  const [scannerMode, setScannerMode] = useState<'single' | 'batch'>('single');

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

  const examAutosave = useAutosave(exam, saveExamFn, 400);
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

  const selectActiveExam = useCallback(
    async (id: string) => {
      const target = await store.getExam(id);
      if (target) {
        let pass = target.password;
        if (!pass) {
          pass = generateExamPassword(8);
          target.password = pass;
          await store.putExam(target);
        }
        setExam(target);
        setTeacherPassword(pass);
        setAllExamPasswords((prev) => ({ ...prev, [id]: pass! }));
        setActivePayload(null);
        const newSettings = { ...profileSettings, activeExamId: id };
        setProfileSettings(newSettings);
        await store.putSettings(newSettings);
      }
    },
    [store, profileSettings]
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

  const clearCurrentExam = useCallback(() => {
    if (
      confirm(
        'Tem certeza de que deseja limpar todas as questões e instruções da prova atual?'
      )
    ) {
      const cleared: Exam = {
        ...emptyExam,
        id: exam.id,
        password: exam.password || generateExamPassword(8),
        updatedAt: new Date().toISOString(),
      };
      setExam(cleared);
      setVersions([]);
    }
  }, [exam.id, exam.password]);

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
    (
      newRecord: GradingRecord,
      options?: { newStudentToClass?: { classId: string; name: string; registration?: string } }
    ) => {
      const recordToStore: GradingRecord = {
        ...newRecord,
        examId: newRecord.examId || exam.id,
        timestamp: Date.now(),
      };

      setRecords((prev) => [recordToStore, ...prev.filter((r) => r.id !== recordToStore.id)]);

      setExams((prev) =>
        prev.map((e) =>
          e.id === recordToStore.examId ? { ...e, recordCount: e.recordCount + 1 } : e
        )
      );

      if (options?.newStudentToClass) {
        handleAddStudentToClass(options.newStudentToClass.classId, {
          name: options.newStudentToClass.name,
          registration: options.newStudentToClass.registration,
        });
      }
    },
    [exam.id, handleAddStudentToClass]
  );

  const handleBatchSaveRecords = useCallback(
    (newRecords: GradingRecord[]) => {
      if (newRecords.length === 0) return;

      const stamped = newRecords.map((r) => ({
        ...r,
        examId: r.examId || exam.id,
        timestamp: r.timestamp || Date.now(),
      }));

      const newIds = new Set(stamped.map((r) => r.id));

      setRecords((prev) => {
        const filtered = prev.filter((r) => !newIds.has(r.id));
        return [...stamped, ...filtered];
      });

      const countByExam: Record<string, number> = {};
      stamped.forEach((r) => {
        const eId = r.examId || exam.id;
        countByExam[eId] = (countByExam[eId] || 0) + 1;
      });

      setExams((prev) =>
        prev.map((e) => {
          const added = countByExam[e.id] || 0;
          return added > 0 ? { ...e, recordCount: e.recordCount + added } : e;
        })
      );
    },
    [exam.id]
  );

  const handleLockPayload = useCallback(
    (payload: DecryptedQrPayload | null) => {
      if (payload?.examId && payload.examId !== exam.id) {
        const matchingExam = exams.find((e) => e.id === payload.examId);
        if (matchingExam) {
          setExamSwitchPrompt({
            targetExamId: matchingExam.id,
            targetExamName: matchingExam.name,
            pendingPayload: payload,
          });
          return;
        }
      }
      setActivePayload(payload);
    },
    [exam.id, exams]
  );

  const handlePhotoGraded = useCallback(
    (record: GradingRecord, evidence?: GradingEvidence) => {
      const recordExamId = record.examId || activePayload?.examId;
      if (recordExamId && recordExamId !== exam.id) {
        const matchingExam = exams.find((e) => e.id === recordExamId);
        if (matchingExam) {
          setExamSwitchPrompt({
            targetExamId: matchingExam.id,
            targetExamName: matchingExam.name,
            pendingRecord: { ...record, examId: recordExamId },
          });
          return;
        }
      }
      setGradingSession({
        record: { ...record, examId: recordExamId || exam.id },
        evidence,
      });
    },
    [exam.id, activePayload, exams]
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
    activeExamId: exam.id,
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
    isClassManagerOpen,
    setIsClassManagerOpen,
    isLibraryOpen,
    setIsLibraryOpen,
    exportProfileData,
    setExportProfileData,

    scannerMode,
    setScannerMode,
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
    createExam,
    duplicateExam,
    renameExam,
    deleteExam,
    shareExam,
    loadSampleMathExam,
    updateExam,
    clearCurrentExam,
    updateTeacherPassword,

    updateClasses,
    updateRecords: setRecords,
    handleAddStudentToClass,
    handleDisassociateRecordsFromClass,
    handleGradeSaved,
    reloadProfile: initProfile,
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
