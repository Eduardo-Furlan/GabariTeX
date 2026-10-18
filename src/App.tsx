import React, { useEffect, useState, useRef } from 'react';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import { useHashRouter, StepId } from './router/hashRouter';
import { decideRouteSync } from './router/examSync';
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
import { ToastHost } from './components/ui/Toast';
import { ConfirmHost } from './components/ui/ConfirmHost';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';
import { BubbleLoader } from './components/ui/BubbleLoader';
import { useScrolled } from './hooks/useScrolled';
import { useRetained } from './hooks/useRetained';
import { triggerDesktopSnapshot } from './platform/snapshots';
import { Exam } from './types/exam';
import { ProfileData, ProfileSettings } from './types/profile';
import './styles/print.css';

const VALID_STEPS: StepId[] = ['criar', 'versoes', 'imprimir', 'corrigir', 'notas'];

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
    isBatchProcessing,
    profileSettings,
    reloadProfile,
    store,
  } = useProfile();

  const [exportImportMode, setExportImportMode] = useState<'export' | 'import'>('export');
  const { route, navigate } = useHashRouter();

  const lastSyncedExamIdRef = useRef<string | null>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const isScrolled = useScrolled(4);
  const retainedSwitchPrompt = useRetained(examSwitchPrompt);

  const prevStepRef = useRef<StepId | null>(null);
  const [navDir, setNavDir] = useState<'forward' | 'back' | undefined>(undefined);

  // Calcula direção da transição entre etapas
  useEffect(() => {
    if (route.type === 'exam_step') {
      if (prevStepRef.current && prevStepRef.current !== route.step) {
        const prevIdx = VALID_STEPS.indexOf(prevStepRef.current);
        const nextIdx = VALID_STEPS.indexOf(route.step);
        if (prevIdx !== -1 && nextIdx !== -1) {
          setNavDir(nextIdx > prevIdx ? 'forward' : 'back');
        }
      }
      prevStepRef.current = route.step;
    } else {
      prevStepRef.current = null;
      setNavDir(undefined);
    }
  }, [route]);

  // Mede altura do chrome sticky para publicação de --chrome-h
  useEffect(() => {
    if (typeof window === 'undefined' || !chromeRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
        if (h > 0) {
          document.documentElement.style.setProperty('--chrome-h', `${h}px`);
        }
      }
    });
    ro.observe(chromeRef.current);
    return () => ro.disconnect();
  }, []);

  // Sincroniza rota e prova ativa sem disputa ou vai-e-volta
  useEffect(() => {
    if (isLoadingProfile) return;
    const { action, nextLastSyncedExamId } = decideRouteSync({
      route,
      exams,
      lastSyncedExamId: lastSyncedExamIdRef.current,
      currentExamId: exam.id,
      activeExamId,
    });
    lastSyncedExamIdRef.current = nextLastSyncedExamId;

    if (action.type === 'redirect_to_exams') {
      navigate({ type: 'exams' });
    } else if (action.type === 'select_exam') {
      void selectActiveExam(action.examId);
    } else if (action.type === 'select_none') {
      void selectActiveExam(null);
    }
  }, [isLoadingProfile, route, exams, exam.id, activeExamId, selectActiveExam, navigate]);

  const handleOpenExportImport = async (mode: 'export' | 'import' = 'export') => {
    try {
      setExportImportMode(mode);
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
    settings: ProfileSettings,
    mode: 'merge' | 'replace' = 'merge'
  ) => {
    if (typeof __DESKTOP__ !== 'undefined' && __DESKTOP__ && exportProfileData) {
      try {
        await triggerDesktopSnapshot(exportProfileData, 'pre-import');
      } catch (err) {
        console.warn('[Desktop Snapshot] Falha ao criar snapshot pré-importação:', err);
      }
    }

    if (mode === 'replace') {
      const existingList = await store.listExams();
      const importedIds = new Set(data.exams.map((ex) => ex.id));
      for (const existing of existingList) {
        if (!importedIds.has(existing.id)) {
          await store.deleteExam(existing.id);
        }
      }
    }

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
        <div className="flex flex-col items-center gap-4">
          <BubbleLoader size="lg" />
          <span className="text-meta font-medium text-slate-500">
            Carregando avaliações e perfil...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-slate-800 flex flex-col pb-16 md:pb-0">
      {/* 1-3. Chrome Unificado Sticky (Nível 1, Contexto e Etapas) */}
      <div
        ref={chromeRef}
        className="no-print sticky top-0 z-30 chrome-surface transition-shadow duration-150"
        data-scrolled={isScrolled}
      >
        <AppHeader
          currentRoute={route}
          onNavigate={navigate}
          onOpenExportImport={handleOpenExportImport}
        />
        <ContextBar currentRoute={route} onNavigate={navigate} />
        {route.type === 'exam_step' && (
          <StepTabs currentRoute={route} onNavigate={navigate} />
        )}
      </div>

      {/* 4. Telas / Conteúdo Principal */}
      <main className="flex-1 flex flex-col" data-nav-dir={navDir}>
        {route.type === 'exams' && (
          <ExamsScreen
            onNavigate={navigate}
            onOpenExportImport={handleOpenExportImport}
          />
        )}

        {route.type === 'classes' && <ClassesScreen />}

        {route.type === 'scanner' && <ScannerScreen onNavigate={navigate} />}

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

      {/* 5. Barra Inferior Fixa para Mobile */}
      <MobileTabBar currentRoute={route} onNavigate={navigate} />

      {/* 6. Modais Globais */}
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
          initialMode={exportImportMode}
          onProfileImported={handleProfileImported}
        />
      )}

      {/* Diálogo de troca de prova ativa caso folha de outra prova seja escaneada */}
      <Modal
        open={Boolean(examSwitchPrompt)}
        onOpenChange={(open) => {
          if (!open) setExamSwitchPrompt(null);
        }}
        title="Trocar para a prova desta folha?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setExamSwitchPrompt(null)}
            >
              Permanecer na prova atual
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!retainedSwitchPrompt) return;
                const targetId = retainedSwitchPrompt.targetExamId;
                const pending = retainedSwitchPrompt.pendingPayload;
                const pendingRec = retainedSwitchPrompt.pendingRecord;
                setExamSwitchPrompt(null);
                await selectActiveExam(targetId);
                if (pending) setActivePayload(pending);
                if (pendingRec) handleGradeSaved(pendingRec);
                navigate({ type: 'exam_step', examId: targetId, step: 'corrigir' });
              }}
            >
              Trocar de prova
            </Button>
          </>
        }
      >
        <p className="text-body text-slate-600 leading-relaxed">
          Esta folha pertence à prova <strong>&quot;{retainedSwitchPrompt?.targetExamName}&quot;</strong> da sua biblioteca.
        </p>
        <p className="mt-2 text-meta text-slate-500">
          Deseja alternar a prova ativa para continuar a correção nela?
        </p>
      </Modal>

      {/* Notificações e controle de versão do PWA */}
      <UpdatePrompt isBatchProcessing={isBatchProcessing} />

      {/* Hosts Globais de Toast e Confirmação */}
      <ToastHost />
      <ConfirmHost />
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
