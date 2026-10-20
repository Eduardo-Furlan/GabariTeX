import React, { useState } from 'react';
import { BookOpen, Library } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { ExamHeaderEditor } from '../components/editor/ExamHeaderEditor';
import { QuestionList } from '../components/editor/QuestionList';
import { ImportQuestionsModal } from '../components/editor/ImportQuestionsModal';
import { AddFromBankModal } from '../components/editor/AddFromBankModal';
import { SendToBankModal } from '../components/editor/SendToBankModal';
import { Exam, Question } from '../types/exam';
import { EmptyState, BubbleGridIllustration } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';

export const EditorScreen: React.FC = () => {
  const { exam, exams, store, updateExam, importQuestions, loadSampleMathExam } = useProfile();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddFromBankModalOpen, setIsAddFromBankModalOpen] = useState(false);
  const [isSendToBankModalOpen, setIsSendToBankModalOpen] = useState(false);
  const [sendToBankPreselectedId, setSendToBankPreselectedId] = useState<string | null>(null);

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

      <AddFromBankModal
        isOpen={isAddFromBankModalOpen}
        onClose={() => setIsAddFromBankModalOpen(false)}
        currentQuestions={exam.questions}
        onImport={importQuestions}
      />

      <SendToBankModal
        isOpen={isSendToBankModalOpen}
        onClose={() => setIsSendToBankModalOpen(false)}
        examQuestions={exam.questions}
        preselectedQuestionId={sendToBankPreselectedId}
        onQuestionsUpdated={handleQuestionsUpdated}
      />
    </div>
  );
};
