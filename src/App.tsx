import React, { useEffect } from 'react';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { useHashRouter } from './router/hashRouter';
import { AppHeader } from './components/navigation/AppHeader';
import { ContextBar } from './components/navigation/ContextBar';
import { StepTabs } from './components/navigation/StepTabs';
import { MobileTabBar } from './components/navigation/MobileTabBar';

import { ExamsScreen } from './screens/ExamsScreen';
import { ClassesScreen } from './screens/ClassesScreen';
import { EditorScreen } from './screens/EditorScreen';
import { VersionsScreen } from './screens/VersionsScreen';
import { PrintScreen } from './screens/PrintScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { GradebookScreen } from './screens/GradebookScreen';

import { ProfileExportImportModal } from './components/profile/ProfileExportImportModal';
import { GradingModal } from './components/scanner/GradingModal';
import { UpdatePrompt } from './components/pwa/UpdatePrompt';
import { Exam } from './types/exam';
import { ProfileData, ProfileSettings } from './types/profile';
import { BookOpen, Loader2 } from 'lucide-react';
import './styles/print.css';

const AppContent: React.FC = () => {
  const {
    isLoadingProfile,
    exams,
    exam,
    activeExamId,
    selectActiveExam,
    classes,
    activeClassId,
    setActiveClassId,
    records,
    handleGradeSaved,
    gradingSession,
    setGradingSession,
    examSwitchPrompt,
    setExamSwitchPrompt,
    setActivePayload,
    isExportImportOpen,
    setIsExportImportOpen,
    exportProfileData,
    setExportProfileData,
    profileSettings,
    reloadProfile,
    store,
  } = useProfile();

  const { route, navigate } = useHashRouter();

  // Redireciona se a rota for exam_step mas a prova não existir
  useEffect(() => {
    if (isLoadingProfile) return;

    if (route.type === 'exam_step') {
      const exists = exams.some((e) => e.id === route.examId);
      if (!exists && exams.length > 0) {
        navigate({ type: 'exams' });
      } else if (exists && exam.id !== route.examId) {
        selectActiveExam(route.examId);
      }
    }
  }, [isLoadingProfile, route, exams, exam.id, selectActiveExam, navigate]);

  const handleOpenExportImport = async (_mode?: 'export' | 'import') => {
    try {
      const fullExams = await Promise.all(exams.map((m) => store.getExam(m.id)));
      const validExams = fullExams.filter((e): e is Exam => Boolean(e));
      const examMap = new Map(validExams.map((e) => [e.id, e]));
      if (exam.id) {
        examMap.set(exam.id, exam);
      }

      setExportProfileData({
        exams: Array.from(examMap.values()),
        classes,
        records,
      });
      setIsExportImportOpen(true);
    } catch (err) {
      console.error('Erro ao preparar exportação do perfil:', err);
    }
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
    if (settings) {
      await store.putSettings(settings);
    }
    await reloadProfile();
    setIsExportImportOpen(false);
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-300 animate-spin" />
          <span className="text-xs font-semibold text-slate-500">
            Carregando avaliações e perfil...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-slate-800 flex flex-col pb-16 md:pb-0">
      {/* 1. Cabeçalho de Navegação (Nível 1) */}
      <AppHeader
        currentRoute={route}
        onNavigate={navigate}
        onOpenExportImport={handleOpenExportImport}
      />

      {/* 2. Barra de Contexto (Prova e Turma ativas) */}
      <ContextBar currentRoute={route} onNavigate={navigate} />

      {/* 3. Etapas da Prova Ativa (Nível 2 - Desktop) */}
      {route.type === 'exam_step' && (
        <StepTabs currentRoute={route} onNavigate={navigate} />
      )}

      {/* 4. Telas / Conteúdo Principal */}
      <main className="flex-1 flex flex-col">
        {route.type === 'exams' && (
          <ExamsScreen
            onNavigate={navigate}
            onOpenExportImport={handleOpenExportImport}
          />
        )}

        {route.type === 'classes' && <ClassesScreen />}

        {route.type === 'exam_step' && (
          <>
            {route.step === 'criar' && <EditorScreen />}
            {route.step === 'versoes' && <VersionsScreen />}
            {route.step === 'imprimir' && <PrintScreen />}
            {route.step === 'corrigir' && <ScannerScreen onNavigate={navigate} />}
            {route.step === 'notas' && (
              <GradebookScreen
                onNavigate={navigate}
                onOpenExportImport={handleOpenExportImport}
              />
            )}
          </>
        )}
      </main>

      {/* 5. Barra Inferior Fixa para Mobile (Plano 10 §2.2) */}
      <MobileTabBar currentRoute={route} onNavigate={navigate} />

      {/* 6. Modais Globais */}
      {/* Modal de confirmação/edição manual de nota pós-leitura OMR */}
      {gradingSession && (
        <GradingModal
          initialRecord={gradingSession.record}
          evidence={gradingSession.evidence}
          classes={classes}
          activeClassId={activeClassId}
          onSelectActiveClass={setActiveClassId}
          records={records}
          onOpenClassManager={() => navigate({ type: 'classes' })}
          onSave={handleGradeSaved}
          onCancel={() => setGradingSession(null)}
        />
      )}

      {/* Modal de Exportação / Importação de Perfil ZIP */}
      {isExportImportOpen && exportProfileData && (
        <ProfileExportImportModal
          isOpen={isExportImportOpen}
          onClose={() => setIsExportImportOpen(false)}
          currentData={exportProfileData}
          currentSettings={profileSettings}
          activeExamId={exam.id || activeExamId}
          onProfileImported={handleProfileImported}
        />
      )}

      {/* Diálogo de troca de prova ativa caso folha de outra prova seja escaneada */}
      {examSwitchPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0">
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
                  await selectActiveExam(targetId);
                  if (pending) setActivePayload(pending);
                  if (pendingRec) handleGradeSaved(pendingRec);
                  navigate({ type: 'exam_step', examId: targetId, step: 'corrigir' });
                }}
                className="px-4 py-2 text-xs font-bold text-on-accent bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
              >
                Trocar para &quot;{examSwitchPrompt.targetExamName}&quot;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificações e controle de versão do PWA */}
      <UpdatePrompt />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ProfileProvider>
      <AppContent />
    </ProfileProvider>
  );
};
