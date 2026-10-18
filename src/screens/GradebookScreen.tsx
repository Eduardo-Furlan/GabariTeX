import React from 'react';
import { useProfile } from '../context/ProfileContext';
import { GradebookTable } from '../components/gradebook/GradebookTable';
import { GradingRecord } from '../types/exam';
import { Route } from '../router/hashRouter';
import { confirmDialog } from '../components/ui/confirmStore';

interface GradebookScreenProps {
  onNavigate: (route: Route) => void;
  onOpenExportImport: (mode?: 'export' | 'import') => void;
}

export const GradebookScreen: React.FC<GradebookScreenProps> = ({
  onNavigate,
  onOpenExportImport,
}) => {
  const {
    records,
    updateRecords,
    classes,
    activeClassId,
    setActiveClassId,
    exam,
    exams,
    activeExamId,
    selectActiveExam,
  } = useProfile();

  const handleUpdateRecord = (updatedRecord: GradingRecord) => {
    updateRecords((prev) =>
      prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
    );
  };

  const handleDeleteRecord = (id: string) => {
    updateRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAll = async () => {
    const ok = await confirmDialog({
      title: 'Limpar Notas',
      message: 'Tem certeza de que deseja apagar todas as notas corrigidas desta prova?',
      tone: 'danger',
      confirmLabel: 'Limpar notas',
    });
    if (ok) {
      updateRecords((prev) => prev.filter((r) => r.examId && r.examId !== exam.id));
    }
  };

  return (
    <div className="screen-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <GradebookTable
        records={records}
        classes={classes}
        activeClassId={activeClassId}
        onSelectActiveClass={setActiveClassId}
        onOpenClassManager={() => onNavigate({ type: 'classes' })}
        onUpdateRecord={handleUpdateRecord}
        onDeleteRecord={handleDeleteRecord}
        onClearAll={handleClearAll}
        onOpenBackupPanel={onOpenExportImport}
        exam={exam}
        exams={exams}
        activeExamId={exam.id || activeExamId}
        onSelectActiveExam={async (id) => {
          await selectActiveExam(id);
          onNavigate({ type: 'exam_step', examId: id, step: 'notas' });
        }}
        onUpdateRecords={(newRecords) => updateRecords(newRecords)}
      />
    </div>
  );
};

