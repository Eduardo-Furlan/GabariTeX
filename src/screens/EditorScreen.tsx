import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { BookOpen, Library } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { useBank } from '../context/BankContext';
import { ExamHeaderEditor } from '../components/editor/ExamHeaderEditor';
import { QuestionList } from '../components/editor/QuestionList';
import { ImportQuestionsModal } from '../components/editor/ImportQuestionsModal';
import { lazyWithRetry } from '../components/ui/lazyWithRetry';
import { Exam, Question } from '../types/exam';
import { EmptyState, BubbleGridIllustration } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';

const AddFromBankModal = lazyWithRetry(() =>
  import('../components/editor/AddFromBankModal').then((m) => ({ default: m.AddFromBankModal }))
);

const SendToBankModal = lazyWithRetry(() =>
  import('../components/editor/SendToBankModal').then((m) => ({ default: m.SendToBankModal }))
);

export const EditorScreen: React.FC = () => {
  const { exam, exams, store, updateExam, importQuestions, loadSampleMathExam } = useProfile();
  const { questions: bankQuestions, ensureLoaded } = useBank();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddFromBankModalOpen, setIsAddFromBankModalOpen] = useState(false);
  const [isSendToBankModalOpen, setIsSendToBankModalOpen] = useState(false);
  const [sendToBankPreselectedId, setSendToBankPreselectedId] = useState<string | null>(null);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const bankQuestionIds = useMemo(
    () => new Set(bankQuestions.map((bq) => bq.id)),
    [bankQuestions]
  );

  const handleExamChange = (updated: Exam) => {
    updateExam(updated);
  };

  const handleOpenSendAllToBank = () => {
    setSendToBankPreselectedId(null);
    setIsSendToBankModalOpen(true);
  };

  const handleOpenSendSingleToBank = (q: Question) => {
    setSendToBankPreselectedId(q.id);
    setIsSendToBankModalOpen(true);
  };

  const handleQuestionsUpdated = (updatedQuestions: Question[]) => {
    updateExam({ ...exam, questions: updatedQuestions });
  };

  return (
    <div className="screen-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <ExamHeaderEditor exam={exam} onChange={handleExamChange} />

      {exam.questions.length === 0 && (
        <EmptyState
          illustration={<BubbleGridIllustration />}
          title="Nenhuma questão cadastrada"
          description="Comece a montar sua avaliação do zero através dos botões abaixo, importe questões de outra prova ou carregue a prova modelo de Matemática."
          className="max-w-2xl my-6"
          actions={
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                variant="primary"
                icon={<BookOpen className="w-4 h-4" />}
                onClick={loadSampleMathExam}
              >
                Carregar Exemplo Completo de Matemática
              </Button>
              <Button
                variant="secondary"
                icon={<Library className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                onClick={() => setIsAddFromBankModalOpen(true)}
              >
                Adicionar do Banco
              </Button>
              {exams.length > 1 && (
                <Button
                  variant="secondary"
                  icon={<BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  onClick={() => setIsImportModalOpen(true)}
                >
                  Importar de Outra Prova
                </Button>
              )}
            </div>
          }
        />
      )}

      <QuestionList
        questions={exam.questions}
        bankQuestionIds={bankQuestionIds}
        onChange={(updatedQuestions) => handleExamChange({ ...exam, questions: updatedQuestions })}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenAddFromBankModal={() => setIsAddFromBankModalOpen(true)}
        onOpenSendToBankModal={handleOpenSendAllToBank}
        onSendQuestionToBank={handleOpenSendSingleToBank}
      />

      <ImportQuestionsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        exams={exams}
        currentExamId={exam.id}
        currentQuestionCount={exam.questions.length}
        store={store}
        onImport={importQuestions}
      />

      {isAddFromBankModalOpen && (
        <Suspense fallback={null}>
          <AddFromBankModal
            isOpen={isAddFromBankModalOpen}
            onClose={() => setIsAddFromBankModalOpen(false)}
            currentQuestions={exam.questions}
            onImport={importQuestions}
          />
        </Suspense>
      )}

      {isSendToBankModalOpen && (
        <Suspense fallback={null}>
          <SendToBankModal
            isOpen={isSendToBankModalOpen}
            onClose={() => setIsSendToBankModalOpen(false)}
            examQuestions={exam.questions}
            preselectedQuestionId={sendToBankPreselectedId}
            onQuestionsUpdated={handleQuestionsUpdated}
          />
        </Suspense>
      )}
    </div>
  );
};
