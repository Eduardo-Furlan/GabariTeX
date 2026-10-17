import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { ExamHeaderEditor } from '../components/editor/ExamHeaderEditor';
import { QuestionList } from '../components/editor/QuestionList';
import { ImportQuestionsModal } from '../components/editor/ImportQuestionsModal';
import { Exam } from '../types/exam';

export const EditorScreen: React.FC = () => {
  const { exam, exams, store, updateExam, importQuestions, loadSampleMathExam } = useProfile();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleExamChange = (updated: Exam) => {
    updateExam(updated);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
            Comece a montar sua avaliação do zero através dos botões abaixo, importe questões de outra prova ou carregue a prova modelo de Matemática.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={loadSampleMathExam}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded-xl text-xs font-bold shadow-sm transition"
            >
              <BookOpen className="w-4 h-4" /> Carregar Exemplo Completo de Matemática
            </button>
            {exams.length > 1 && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition"
              >
                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Importar de Outra Prova
              </button>
            )}
          </div>
        </div>
      )}

      <QuestionList
        questions={exam.questions}
        onChange={(updatedQuestions) => handleExamChange({ ...exam, questions: updatedQuestions })}
        onOpenImportModal={() => setIsImportModalOpen(true)}
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
    </div>
  );
};

