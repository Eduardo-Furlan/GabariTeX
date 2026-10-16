import React, { useState, useEffect, useCallback } from 'react';
import { Exam, ExamVersion, GradingRecord, Classroom } from './types/exam';
import { initialSampleExam, emptyExam } from './utils/sampleExam';
import { generateExamVersions } from './utils/randomizer';
import { generateExamPassword } from './utils/crypto';
import {
  exportExamToJson,
  loadActiveClassIdFromStorage,
  saveActiveClassIdToStorage,
  SaveResult,
} from './utils/storage';
import { addStudent } from './utils/classrooms';
import { Navbar, ActiveTab } from './components/Navbar';
import { ExamHeaderEditor } from './components/editor/ExamHeaderEditor';
import { QuestionList } from './components/editor/QuestionList';
import { ExamPrintView } from './components/preview/ExamPrintView';
import { AnswerSheetView } from './components/preview/AnswerSheetView';
import { isWithinLimit, MAX_QUESTIONS } from './utils/examLimits';
import { PhotoUploader } from './components/scanner/PhotoUploader';
import { BatchGrader } from './components/scanner/BatchGrader';
import { PasswordModal } from './components/scanner/PasswordModal';
import { GradingModal } from './components/scanner/GradingModal';
import { GradebookTable } from './components/gradebook/GradebookTable';
import { ClassroomManager } from './components/classrooms/ClassroomManager';
import { ExamLibraryModal } from './components/library/ExamLibraryModal';
import { ProfileExportImportModal } from './components/profile/ProfileExportImportModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getProfileStore } from './storage';
import { ProfileData, ProfileSettings, ExamMeta } from './types/profile';
import { buildProfileZip } from './utils/profileZip';
import { saveFile } from './platform/files';
import { useAutosave } from './hooks/useAutosave';
import { printPage } from './platform/print';
import { DecryptedQrPayload, GradingEvidence } from './types/omr';
import { buildPayload } from './utils/payload';
import { computeExamFingerprint } from './utils/fingerprint';
import {
  Printer,
  Shuffle,
  Eye,
  EyeOff,
  ShieldCheck,
  BookOpen,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Camera,
  Files,
  GraduationCap,
  Monitor,
  Loader2,
} from 'lucide-react';
import './styles/print.css';

type PrintMode = 'complete' | 'exam_only' | 'answersheet_only' | 'all_versions';

export const App: React.FC = () => {
  const store = getProfileStore();

  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [exam, setExam] = useState<Exam>(emptyExam);
  const [versions, setVersions] = useState<ExamVersion[]>([]);
  const [selectedVersionLetter, setSelectedVersionLetter] = useState<string>('A');
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [printMode, setPrintMode] = useState<PrintMode>('complete');
  const [showAnswerSheetPreview, setShowAnswerSheetPreview] = useState<boolean>(true);

  const [teacherPassword, setTeacherPassword] = useState<string>('');
  const [allExamPasswords, setAllExamPasswords] = useState<Record<string, string>>({});
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showTeacherPassword, setShowTeacherPassword] = useState<boolean>(false);
  const [gradingSession, setGradingSession] = useState<{
    record: GradingRecord;
    evidence?: GradingEvidence;
  } | null>(null);
  const [activePayload, setActivePayload] = useState<DecryptedQrPayload | null>(null);

  const [records, setRecords] = useState<GradingRecord[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>({});

  const [activeClassId, setActiveClassId] = useState<string | null>(() => {
    return loadActiveClassIdFromStorage();
  });

  const [isClassManagerOpen, setIsClassManagerOpen] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState<boolean>(false);
  const [exportProfileData, setExportProfileData] = useState<ProfileData | null>(null);
  const [scannerMode, setScannerMode] = useState<'single' | 'batch'>('single');
  const [isSheetOverflowing, setIsSheetOverflowing] = useState<boolean>(false);

  const [examSwitchPrompt, setExamSwitchPrompt] = useState<{
    targetExamId: string;
    targetExamName: string;
    pendingPayload?: DecryptedQrPayload;
    pendingRecord?: GradingRecord;
  } | null>(null);

  const isExamCorrupted = !isWithinLimit(exam.questions.length);

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

  // Carregamento inicial do Perfil do IndexedDB / Tauri
  useEffect(() => {
    let isCancelled = false;

    async function initProfile() {
      try {
        const [examMetasList, classesList, recordsList, settings] = await Promise.all([
          store.listExams(),
          store.getClasses(),
          store.getRecords(),
          store.getSettings(),
        ]);

        if (isCancelled) return;

        setClasses(classesList);
        setRecords(recordsList);
        setProfileSettings(settings);

        if (examMetasList.length === 0) {
          // Perfil novo / vazio: cria a primeira prova baseada no exemplo com senha gerada
          const newId = crypto.randomUUID();
          const generatedPass = generateExamPassword(8);
          const initialExam: Exam = {
            ...initialSampleExam,
            id: newId,
            password: generatedPass,
            updatedAt: new Date().toISOString(),
          };

          await store.putExam(initialExam);
          if (isCancelled) return;

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

          // Carrega todas as provas para ter o dicionário de senhas na memória
          const loadedAll = await Promise.all(examMetasList.map((m) => store.getExam(m.id)));
          if (isCancelled) return;

          const pwMap: Record<string, string> = {};
          loadedAll.forEach((e) => {
            if (e && e.password) pwMap[e.id] = e.password;
          });
          setAllExamPasswords(pwMap);

          // Identifica prova ativa
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
        if (!isCancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    initProfile();

    return () => {
      isCancelled = true;
    };
  }, [store]);

  const updateTeacherPassword = (newPass: string) => {
    setTeacherPassword(newPass);
    setExam((prev) => ({ ...prev, password: newPass }));
    if (exam.id) {
      setAllExamPasswords((prev) => ({ ...prev, [exam.id]: newPass }));
    }
  };

  const handleSelectActiveClass = (id: string | null) => {
    setActiveClassId(id);
    saveActiveClassIdToStorage(id);
  };

  const handleDisassociateRecordsFromClass = (classId: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.classId === classId) {
          const { classId: _, studentRef: __, ...rest } = r;
          return rest as GradingRecord;
        }
        return r;
      })
    );
  };

  const handleAddStudentToClass = (
    classId: string,
    student: { name: string; registration?: string }
  ) => {
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
  };

  // Atualiza as versões da prova sempre que as questões ou configurações mudarem
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
    if (!isLoadingProfile) {
      refreshVersions(exam);
    }
  }, [exam, refreshVersions, isLoadingProfile]);

  const handleExamChange = (updated: Exam) => {
    if (!isWithinLimit(updated.questions.length)) {
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
  };

  const handleClearExam = () => {
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
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Exam;
        if (parsed.header && parsed.questions) {
          if (!isWithinLimit(parsed.questions.length)) {
            alert(
              `A prova tem ${parsed.questions.length} questões; o máximo é ${MAX_QUESTIONS}. Remova ${parsed.questions.length - MAX_QUESTIONS} e tente novamente.`
            );
            return;
          }
          const imported: Exam = {
            ...parsed,
            id: exam.id, // preserva ID da prova atual
            password: parsed.password || exam.password || generateExamPassword(8),
            updatedAt: new Date().toISOString(),
          };
          setExam(imported);
          setTeacherPassword(imported.password);
          setAllExamPasswords((prev) => ({ ...prev, [imported.id]: imported.password }));
          alert('Prova importada com sucesso!');
        } else {
          alert('Arquivo JSON inválido.');
        }
      } catch {
        alert('Erro ao processar arquivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleSelectExamVersion = (v: ExamVersion) => {
    setActivePayload(
      buildPayload({
        examId: exam.id,
        versionLetter: v.versionLetter,
        questions: v.questions,
        objectiveAnswerKey: v.objectiveAnswerKey,
        examFingerprint: computeExamFingerprint(exam),
      })
    );
  };

  const handleGradeSaved = (
    newRecord: GradingRecord,
    options?: { newStudentToClass?: { classId: string; name: string; registration?: string } }
  ) => {
    const recordToStore: GradingRecord = {
      ...newRecord,
      examId: newRecord.examId || exam.id,
      timestamp: Date.now(),
    };

    setRecords((prev) => [recordToStore, ...prev.filter((r) => r.id !== recordToStore.id)]);

    // Atualiza contagem na lista de provas
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
    setGradingSession(null);
  };

  const handleBatchSaveRecords = (newRecords: GradingRecord[]) => {
    const stamped = newRecords.map((r) => ({
      ...r,
      examId: r.examId || exam.id,
    }));
    const newIds = new Set(stamped.map((r) => r.id));
    setRecords((prev) => [...stamped, ...prev.filter((r) => !newIds.has(r.id))]);

    // Recalcula contagens por prova
    const countsByExam: Record<string, number> = {};
    for (const r of [...stamped, ...records.filter((r) => !newIds.has(r.id))]) {
      if (r.examId) {
        countsByExam[r.examId] = (countsByExam[r.examId] || 0) + 1;
      }
    }
    setExams((prev) =>
      prev.map((e) => ({
        ...e,
        recordCount: countsByExam[e.id] || 0,
      }))
    );
  };

  const handleUpdateRecord = (updatedRecord: GradingRecord) => {
    const stamped = { ...updatedRecord, timestamp: Date.now() };
    setRecords((prev) => prev.map((r) => (r.id === stamped.id ? stamped : r)));
  };

  // Operações da Biblioteca de Provas
  const handleSelectActiveExam = async (id: string) => {
    if (id === exam.id) return;
    examAutosave.flush();
    const target = await store.getExam(id);
    if (target) {
      if (!target.password) {
        target.password = generateExamPassword(8);
        await store.putExam(target);
      }
      setExam(target);
      setTeacherPassword(target.password);
      setAllExamPasswords((prev) => ({ ...prev, [target.id]: target.password }));
      setActivePayload(null);
      const newSettings = { ...profileSettings, activeExamId: id };
      setProfileSettings(newSettings);
      await store.putSettings(newSettings);
    }
  };

  const handleCreateExam = async () => {
    examAutosave.flush();
    const newId = crypto.randomUUID();
    const newPass = generateExamPassword(8);
    const newEx: Exam = {
      ...emptyExam,
      id: newId,
      password: newPass,
      header: {
        ...emptyExam.header,
        examTitle: 'Nova Avaliação',
      },
      updatedAt: new Date().toISOString(),
    };

    await store.putExam(newEx);
    setExams((prev) => [
      {
        id: newId,
        name: newEx.header.examTitle || 'Sem título',
        updatedAt: newEx.updatedAt!,
        questionCount: 0,
        recordCount: 0,
      },
      ...prev,
    ]);
    setAllExamPasswords((prev) => ({ ...prev, [newId]: newPass }));
    setExam(newEx);
    setTeacherPassword(newPass);
    setActivePayload(null);
    const newSettings = { ...profileSettings, activeExamId: newId };
    setProfileSettings(newSettings);
    await store.putSettings(newSettings);
  };

  const handleLoadSampleExam = async () => {
    examAutosave.flush();
    const newId = crypto.randomUUID();
    const newPass = generateExamPassword(8);
    const sampleCopy: Exam = {
      ...initialSampleExam,
      id: newId,
      password: newPass,
      updatedAt: new Date().toISOString(),
    };

    await store.putExam(sampleCopy);
    setExams((prev) => [
      {
        id: newId,
        name: sampleCopy.header.examTitle,
        updatedAt: sampleCopy.updatedAt!,
        questionCount: sampleCopy.questions.length,
        recordCount: 0,
      },
      ...prev,
    ]);
    setAllExamPasswords((prev) => ({ ...prev, [newId]: newPass }));
    setExam(sampleCopy);
    setTeacherPassword(newPass);
    setActivePayload(null);
    const newSettings = { ...profileSettings, activeExamId: newId };
    setProfileSettings(newSettings);
    await store.putSettings(newSettings);
  };

  const handleDuplicateExam = async (id: string) => {
    examAutosave.flush();
    const source = await store.getExam(id);
    if (!source) return;

    const newId = crypto.randomUUID();
    const newPass = generateExamPassword(8);
    const duplicated: Exam = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      header: {
        ...source.header,
        examTitle: `${source.header.examTitle || 'Prova'} (Cópia)`,
      },
      password: newPass,
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
  };

  const handleRenameExam = async (id: string, newTitle: string) => {
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
  };

  const handleDeleteExam = async (id: string) => {
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
        await handleSelectActiveExam(remainingExams[0].id);
      } else {
        await handleCreateExam();
      }
    }
  };

  const handleShareExam = async (id: string) => {
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
  };

  // Abertura do Modal de Exportação / Importação ZIP
  const handleOpenExportImport = async () => {
    examAutosave.flush();
    const fullExams = await Promise.all(exams.map((m) => store.getExam(m.id)));
    const validExams = fullExams.filter((e): e is Exam => Boolean(e));
    const examMap = new Map(validExams.map((e) => [e.id, e]));
    examMap.set(exam.id, exam);

    setExportProfileData({
      exams: Array.from(examMap.values()),
      classes,
      records,
    });
    setIsExportImportOpen(true);
  };

  const handleProfileImported = async (
    data: ProfileData,
    settings: ProfileSettings
  ) => {
    for (const ex of data.exams) {
      await store.putExam(ex);
    }
    await store.putClasses(data.classes);
    await store.putRecords(data.records);
    await store.putSettings(settings);

    const freshMetas = await store.listExams();
    setExams(freshMetas);
    setClasses(data.classes);
    setRecords(data.records);
    setProfileSettings(settings);

    const pwMap: Record<string, string> = {};
    data.exams.forEach((e) => {
      if (e.password) pwMap[e.id] = e.password;
    });
    setAllExamPasswords(pwMap);

    const activeId =
      settings.activeExamId || (data.exams[0] ? data.exams[0].id : null);
    if (activeId) {
      const target =
        data.exams.find((e) => e.id === activeId) || data.exams[0];
      if (target) {
        setExam(target);
        setTeacherPassword(target.password || '');
      }
    }

    setIsExportImportOpen(false);
  };

  // Detecção de Prova diferente no QR Code (Plano 08 §3.2)
  const handleLockPayload = (payload: DecryptedQrPayload | null) => {
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
  };

  const handlePhotoGraded = (
    record: GradingRecord,
    evidence?: GradingEvidence
  ) => {
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
  };

  const currentVersion =
    versions.find((v) => v.versionLetter === selectedVersionLetter) || versions[0];

  const handleTabChange = (tab: ActiveTab) => {
    if (isExamCorrupted && tab !== 'editor' && tab !== 'gradebook') {
      alert(
        `A prova atual possui ${exam.questions.length} questões, excedendo o limite de ${MAX_QUESTIONS}. Remova o excesso na aba "Editar Prova" para acessar esta funcionalidade.`
      );
      return;
    }
    setActiveTab(tab);
  };

  // Senhas candidatas priorizando a prova ativa (§3.3)
  const candidatePasswords = [
    teacherPassword,
    ...Object.values(allExamPasswords).filter((p) => p && p !== teacherPassword),
  ];

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-page">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600">Carregando perfil do GabariTeX...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-page overflow-x-hidden print:bg-white print:min-h-0 print:overflow-visible">
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onExportJson={() => exportExamToJson(exam)}
        onImportJson={handleImportJson}
        onLoadSample={handleLoadSampleExam}
        onClearExam={handleClearExam}
        onOpenBackup={handleOpenExportImport}
        hasQuestions={exam.questions.length > 0}
        gradedCount={records.filter((r) => !r.examId || r.examId === exam.id).length}
        autosaveState={examAutosave}
        exams={exams}
        activeExamId={exam.id}
        onSelectActiveExam={handleSelectActiveExam}
        onOpenLibrary={() => setIsLibraryOpen(true)}
      />

      {isExamCorrupted && (
        <div className="bg-rose-500 text-on-accent px-4 py-3 text-xs sm:text-sm font-semibold shadow-md no-print">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-5 h-5 shrink-0 text-on-accent" />
            <span>
              A prova atual possui {exam.questions.length} questões, excedendo o limite máximo de {MAX_QUESTIONS} suportado na folha de respostas A4. As abas de Versões, Impressão e Corretor estão bloqueadas até que {exam.questions.length - MAX_QUESTIONS} {exam.questions.length - MAX_QUESTIONS === 1 ? 'questão seja removida' : 'questões sejam removidas'}.
            </span>
          </div>
        </div>
      )}

      {hasStorageError && (
        <div className="bg-rose-600 text-on-accent px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md no-print">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full flex-wrap">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-200" />
            <span>
              Não foi possível salvar automaticamente no armazenamento do dispositivo.
              Faça uma exportação do seu perfil ZIP agora para não perder alterações.
            </span>
            <button
              type="button"
              onClick={handleOpenExportImport}
              className="ml-auto shrink-0 px-3 py-1 bg-white text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-xs font-bold transition shadow-sm"
            >
              Exportar Perfil ZIP
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 print:p-0 print:m-0 print:max-w-none">
        {/* ABA 1: CRIAR PROVA */}
        {activeTab === 'editor' && (
          <div className="space-y-6">
            <ExamHeaderEditor exam={exam} onChange={handleExamChange} />

            {exam.questions.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 p-8 text-center my-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mx-auto mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Nenhuma questão cadastrada
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Comece a montar sua avaliação do zero através dos botões abaixo, ou carregue a prova modelo de Matemática para explorar as funcionalidades com KaTeX, alternativas e dissertativas.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleLoadSampleExam}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    <BookOpen className="w-4 h-4" /> Carregar Exemplo Completo de Matemática
                  </button>
                </div>
              </div>
            )}

            <QuestionList
              questions={exam.questions}
              onChange={(updatedQuestions) => handleExamChange({ ...exam, questions: updatedQuestions })}
            />
          </div>
        )}

        {/* ABA 2: VERSÕES & GABARITOS */}
        {activeTab === 'versions' && (
          <div className="space-y-6">
            {/* Seletor de Versões */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Shuffle className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                  Versões Randomizadas ({versions.length} {versions.length === 1 ? 'versão' : 'versões'})
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Cada versão reordena questões e alternativas. O QR Code armazena o gabarito oficial encriptado com a senha da prova.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Visualizar Versão:</span>
                <div className="flex gap-1.5">
                  {versions.map((v) => (
                    <button
                      key={v.versionLetter}
                      type="button"
                      onClick={() => setSelectedVersionLetter(v.versionLetter)}
                      className={`w-9 h-9 rounded-lg font-bold text-xs transition ${
                        selectedVersionLetter === v.versionLetter
                          ? 'bg-indigo-600 text-on-accent shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {v.versionLetter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {currentVersion && (
              <div className="space-y-6">
                {/* Painel do Gabarito Oficial (100% visível, sem scrollbar horizontal) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-4 border-b pb-3 flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        Gabarito Oficial (Versão {currentVersion.versionLetter})
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Chave de respostas codificada e protegida no QR Code da Versão {currentVersion.versionLetter}.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Protegido por Senha
                      </span>

                      <button
                        type="button"
                        onClick={() => setShowAnswerSheetPreview(!showAnswerSheetPreview)}
                        className="flex items-center gap-1.5 px-3 py-1 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
                        <span>{showAnswerSheetPreview ? 'Ocultar Cartão A4' : 'Visualizar Cartão A4'}</span>
                      </button>
                    </div>
                  </div>

                  {currentVersion.questions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6">
                      Nenhuma questão cadastrada para esta versão.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      {currentVersion.questions.map((q, idx) => {
                        const qNum = idx + 1;
                        const opt = currentVersion.objectiveAnswerKey[qNum];
                        return (
                          <div
                            key={q.id}
                            className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between font-mono"
                          >
                            <span className="text-xs font-bold text-slate-700">Q{qNum}</span>
                            {q.type === 'objective' ? (
                              <span className="w-7 h-7 rounded-full bg-indigo-600 text-on-accent font-bold text-xs flex items-center justify-center shadow-sm">
                                {opt || '-'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic font-sans font-medium">
                                Dissertativa
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pré-visualização da Folha de Respostas A4 */}
                {showAnswerSheetPreview && (
                  <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4 border-b pb-3 flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                        Pré-visualização da Folha de Respostas A4 (Versão {currentVersion.versionLetter})
                      </span>
                    </div>

                    {/* Aviso para telas pequenas */}
                    <div className="block lg:hidden mb-4 p-3 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                      <strong>Visualização A4 no Celular:</strong> A folha abaixo é exibida na proporção oficial de impressão A4. Deslize horizontalmente para inspecionar todas as seções (QR Code, cabeçalho e bolinhas).
                    </div>

                    <div className="w-full overflow-x-auto pb-4">
                      <div className="min-w-fit mx-auto flex justify-center">
                        <AnswerSheetView version={currentVersion} header={exam.header} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ABA 3: IMPRIMIR / SALVAR PDF */}
        {activeTab === 'print' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                  Central de Impressão A4 / Exportação PDF
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  O modo &quot;Prova Completa&quot; coloca o Cartão-Resposta padronizado como Folha 1 (capa), seguido pelas folhas de questões.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
                <div className="flex flex-wrap sm:flex-nowrap bg-slate-100 rounded-lg p-1 text-xs font-semibold gap-1 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setPrintMode('complete')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                      printMode === 'complete' ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Prova Completa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('exam_only')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                      printMode === 'exam_only' ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Apenas Caderno
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('answersheet_only')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                      printMode === 'answersheet_only' ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Apenas Cartão
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('all_versions')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                      printMode === 'all_versions' ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({versions.length})
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-between sm:justify-start">
                  {printMode !== 'all_versions' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-600 font-medium">Versão:</span>
                      <select
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        value={selectedVersionLetter}
                        onChange={(e) => setSelectedVersionLetter(e.target.value)}
                      >
                        {versions.map((v) => (
                          <option key={v.versionLetter} value={v.versionLetter}>
                            Versão {v.versionLetter}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isSheetOverflowing || isExamCorrupted}
                    onClick={() => {
                      if (isSheetOverflowing || isExamCorrupted) return;
                      printPage();
                    }}
                    title={
                      isSheetOverflowing
                        ? 'A folha de respostas não cabe em uma página. Reduza o texto do cabeçalho ou o número de questões.'
                        : isExamCorrupted
                        ? `A prova excede o limite de ${MAX_QUESTIONS} questões.`
                        : undefined
                    }
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold shadow-md transition ${
                      isSheetOverflowing || isExamCorrupted
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-on-accent'
                    }`}
                  >
                    <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
                  </button>
                </div>
              </div>
            </div>

            {isSheetOverflowing && (
              <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40 rounded-2xl flex items-center gap-3 text-rose-900 dark:text-rose-200 no-print">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div className="text-xs sm:text-sm font-semibold">
                  A folha de respostas não cabe em uma página. Reduza o texto do cabeçalho ou o número de questões.
                </div>
              </div>
            )}

            {/* Aviso no celular para Tab 3 */}
            <div className="block lg:hidden p-3 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed no-print">
              <strong>Visualização A4 no Celular:</strong> As páginas abaixo estão no tamanho real de impressão A4. Deslize horizontalmente para inspecionar. Para imprimir ou salvar em PDF no celular, use o botão <strong>Imprimir / Salvar PDF</strong> acima.
            </div>

            {/* Visualização de Páginas A4 com Quebras Visíveis */}
            <div className="print-area-wrapper w-full overflow-x-auto py-4 print:p-0 print:m-0 print:bg-white print:overflow-visible">
              <div className="min-w-fit mx-auto flex flex-col items-center">
                {printMode === 'complete' && currentVersion && (
                  <div className="w-full flex flex-col items-center">
                    <AnswerSheetView
                      version={currentVersion}
                      header={exam.header}
                      onOverflowChange={setIsSheetOverflowing}
                    />
                    <div className="a4-page-separator">
                      Quebra de Página A4 — Início do Caderno de Questões
                    </div>
                    <ExamPrintView
                      version={currentVersion}
                      header={exam.header}
                      twoColumns={exam.twoColumns}
                    />
                  </div>
                )}

                {printMode === 'exam_only' && currentVersion && (
                  <div className="w-full flex flex-col items-center">
                    <ExamPrintView
                      version={currentVersion}
                      header={exam.header}
                      twoColumns={exam.twoColumns}
                    />
                  </div>
                )}

                {printMode === 'answersheet_only' && currentVersion && (
                  <div className="w-full flex flex-col items-center">
                    <AnswerSheetView
                      version={currentVersion}
                      header={exam.header}
                      onOverflowChange={setIsSheetOverflowing}
                    />
                  </div>
                )}

                {printMode === 'all_versions' && (
                  <div className="w-full flex flex-col items-center">
                    {versions.map((v, idx) => (
                      <React.Fragment key={v.versionLetter}>
                        <AnswerSheetView
                          version={v}
                          header={exam.header}
                          onOverflowChange={idx === 0 ? setIsSheetOverflowing : undefined}
                        />
                        <div className="a4-page-separator">
                          Quebra de Página A4 — Caderno de Questões (Versão {v.versionLetter})
                        </div>
                        <ExamPrintView
                          version={v}
                          header={exam.header}
                          twoColumns={exam.twoColumns}
                        />
                        {idx < versions.length - 1 && (
                          <div className="a4-page-separator text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30 font-bold">
                            Fim da Versão {v.versionLetter} — Próxima: Versão {versions[idx + 1].versionLetter}
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: CORRETOR OMR (AUTÔNOMO) */}
        {activeTab === 'scanner' && (
          <ErrorBoundary
            fallbackTitle="Erro ao carregar o Corretor Óptico (OMR)"
            onReset={() => setActiveTab('editor')}
          >
            {__DESKTOP__ ? (
              <div className="space-y-6">
                {/* Banner de Operação Autônoma e Senha da Prova */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-800">
                          Corretor Óptico em 2 Passos
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                          O gabarito oficial está criptografado no QR Code de cada folha. Para correção em papel físico, use o fluxo em 2 passos: primeiro trave a versão (lendo o QR Code de perto ou selecionando-o abaixo), depois enquadre a folha e corrija em lote.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-amber-50/60 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-xl p-2.5 w-full sm:w-auto">
                      <KeyRound className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0" />
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase">
                          Senha Mestra desta Prova:
                        </label>
                        <div className="relative flex items-center mt-0.5">
                          <input
                            type={showTeacherPassword ? 'text' : 'password'}
                            placeholder="Senha da prova"
                            value={teacherPassword}
                            onChange={(e) => updateTeacherPassword(e.target.value)}
                            className="px-2.5 pr-8 py-1 text-xs border border-amber-300 dark:border-amber-500/40 rounded font-mono font-bold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 w-full sm:w-44"
                          />
                          <button
                            type="button"
                            onClick={() => setShowTeacherPassword((prev) => !prev)}
                            className="absolute right-1 text-slate-400 hover:text-slate-600 p-1"
                            title={showTeacherPassword ? 'Ocultar senha' : 'Exibir senha'}
                            aria-label={showTeacherPassword ? 'Ocultar senha' : 'Exibir senha'}
                          >
                            {showTeacherPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seletor / Status da Versão Travada */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Versão Travada para Correção:</span>
                      {activePayload ? (
                        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs rounded-lg flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> VERSÃO {activePayload.version}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-medium text-xs rounded-lg">
                          Nenhuma (Selecione abaixo ou tire foto com QR Code)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {versions.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 font-medium">Travar:</span>
                          {versions.map((v, idx) => (
                            <button
                              key={v?.versionLetter || idx}
                              type="button"
                              onClick={() => handleSelectExamVersion(v)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                activePayload?.version === v?.versionLetter
                                ? 'bg-emerald-600 text-on-accent shadow-sm'
                                : 'bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-600 hover:text-on-accent text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                              }`}
                            >
                              {v?.versionLetter || '?'}
                            </button>
                          ))}
                        </div>
                      )}

                      {activePayload && (
                        <button
                          type="button"
                          onClick={() => setActivePayload(null)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 rounded-lg transition"
                        >
                          <RefreshCw className="w-3 h-3" /> Destravar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seletor de Turma Ativa para Correção */}
                <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Turma Ativa para Correção:
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Notas corrigidas serão vinculadas automaticamente a esta turma.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {classes.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setIsClassManagerOpen(true)}
                        className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-lg transition"
                      >
                        + Criar Primeira Turma
                      </button>
                    ) : (
                      <>
                        <select
                          value={activeClassId || ''}
                          onChange={(e) => handleSelectActiveClass(e.target.value || null)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Sem turma fixa (escolher na folha)</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.students?.length ?? 0} alunos)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setIsClassManagerOpen(true)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                        >
                          Gerenciar Turmas
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Seletor de Modo: Individual vs Em Lote */}
                <div className="flex items-center justify-center">
                  <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setScannerMode('single')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition ${
                        scannerMode === 'single'
                          ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      Foto Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setScannerMode('batch')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition ${
                        scannerMode === 'batch'
                          ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Files className="w-4 h-4" />
                      Em Lote
                    </button>
                  </div>
                </div>

                <div className="max-w-4xl mx-auto">
                  {scannerMode === 'single' ? (
                    <PhotoUploader
                      teacherPassword={teacherPassword}
                      candidatePasswords={candidatePasswords}
                      activePayload={activePayload}
                      onLockPayload={handleLockPayload}
                      onGraded={handlePhotoGraded}
                      availableVersions={versions}
                      onSelectExamVersion={handleSelectExamVersion}
                    />
                  ) : (
                    <BatchGrader
                      teacherPassword={teacherPassword}
                      candidatePasswords={candidatePasswords}
                      activePayload={activePayload}
                      availableVersions={versions}
                      onSaveRecords={handleBatchSaveRecords}
                      onLockPayload={handleLockPayload}
                      classes={classes}
                      activeClassId={activeClassId}
                      onSelectActiveClass={handleSelectActiveClass}
                      records={records}
                      onOpenClassManager={() => setIsClassManagerOpen(true)}
                      onAddStudentToClass={handleAddStudentToClass}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto my-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mx-auto mb-5">
                    <Monitor className="w-8 h-8" />
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider mb-4">
                    Em Breve (Coming Soon)
                  </div>

                  <h2 className="text-xl font-bold text-slate-800">
                    Corretor Óptico (OMR) Exclusivo no Aplicativo Desktop
                  </h2>

                  <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-lg mx-auto">
                    Para garantir leitura óptica de alta precisão com processamento nativo de imagem (OpenCV), a correção automática de folhas de respostas não está disponível diretamente no navegador.
                  </p>

                  <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                    Para utilizar o corretor OMR, será necessário baixar o <strong>aplicativo desktop do GabariTeX</strong> (disponível em breve para Windows, macOS e Linux). Você pode continuar criando, embaralhando e imprimindo suas provas e folhas de respostas normalmente por aqui.
                  </div>
                </div>
              </div>
            )}
          </ErrorBoundary>
        )}

        {/* ABA 5: LIVRO DE NOTAS */}
        {activeTab === 'gradebook' && (
          <GradebookTable
            records={records}
            classes={classes}
            activeClassId={activeClassId}
            onSelectActiveClass={handleSelectActiveClass}
            onOpenClassManager={() => setIsClassManagerOpen(true)}
            onUpdateRecord={handleUpdateRecord}
            onDeleteRecord={(id) => setRecords((prev) => prev.filter((r) => r.id !== id))}
            onClearAll={() => {
              if (confirm('Tem certeza de que deseja apagar todas as notas corrigidas desta prova?')) {
                setRecords((prev) => prev.filter((r) => r.examId && r.examId !== exam.id));
              }
            }}
            onOpenBackupPanel={handleOpenExportImport}
            exam={exam}
            exams={exams}
            activeExamId={exam.id}
            onSelectActiveExam={handleSelectActiveExam}
            onUpdateRecords={(newRecords) => setRecords(newRecords)}
          />
        )}
      </main>

      {/* DIÁLOGO: FOLHA DE OUTRA PROVA DA BIBLIOTECA DETECTADA (Plano 08 §3.2) */}
      {examSwitchPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Trocar para a prova desta folha?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Esta folha pertence à prova <strong>&quot;{examSwitchPrompt.targetExamName}&quot;</strong> da sua biblioteca.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Deseja alternar a prova ativa para continuar a correção nela?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExamSwitchPrompt(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Permanecer na prova atual
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = examSwitchPrompt.targetExamId;
                  const pending = examSwitchPrompt.pendingPayload;
                  const pendingRec = examSwitchPrompt.pendingRecord;
                  setExamSwitchPrompt(null);
                  await handleSelectActiveExam(targetId);
                  if (pending) setActivePayload(pending);
                  if (pendingRec) handleGradeSaved(pendingRec);
                }}
                className="px-4 py-2 text-xs font-bold text-on-accent bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
              >
                Trocar para &quot;{examSwitchPrompt.targetExamName}&quot;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SENHA DA PROVA (EDIÇÃO MANUAL) */}
      {showPasswordModal && (
        <PasswordModal
          onSubmitPassword={updateTeacherPassword}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      {/* MODAL DE CORREÇÃO E CONFIRMAÇÃO DE NOTA */}
      {gradingSession && (
        <GradingModal
          initialRecord={gradingSession.record}
          evidence={gradingSession.evidence}
          classes={classes}
          activeClassId={activeClassId}
          onSelectActiveClass={handleSelectActiveClass}
          records={records}
          onOpenClassManager={() => setIsClassManagerOpen(true)}
          onSave={handleGradeSaved}
          onCancel={() => setGradingSession(null)}
        />
      )}

      {/* MODAL DE BIBLIOTECA DE PROVAS (Plano 08 §2.2) */}
      <ExamLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        exams={exams}
        activeExamId={exam.id}
        onSelectActiveExam={(id) => {
          handleSelectActiveExam(id);
          setIsLibraryOpen(false);
        }}
        onCreateExam={handleCreateExam}
        onLoadSampleExam={handleLoadSampleExam}
        onDuplicateExam={handleDuplicateExam}
        onRenameExam={handleRenameExam}
        onDeleteExam={handleDeleteExam}
        onOpenExportImport={() => {
          setIsLibraryOpen(false);
          handleOpenExportImport();
        }}
        onShareExam={handleShareExam}
      />

      {/* MODAL DE EXPORTAÇÃO E IMPORTAÇÃO DE PERFIL ZIP (Plano 08 §5) */}
      {isExportImportOpen && exportProfileData && (
        <ProfileExportImportModal
          isOpen={isExportImportOpen}
          onClose={() => setIsExportImportOpen(false)}
          currentData={exportProfileData}
          currentSettings={profileSettings}
          activeExamId={exam.id}
          onProfileImported={handleProfileImported}
        />
      )}

      {/* MODAL DE GERENCIAMENTO DE TURMAS E ALUNOS */}
      <ClassroomManager
        isOpen={isClassManagerOpen}
        onClose={() => setIsClassManagerOpen(false)}
        classes={classes}
        activeClassId={activeClassId}
        onSelectActiveClass={handleSelectActiveClass}
        onUpdateClasses={setClasses}
        records={records}
        onDisassociateRecordsFromClass={handleDisassociateRecordsFromClass}
      />
    </div>
  );
};
