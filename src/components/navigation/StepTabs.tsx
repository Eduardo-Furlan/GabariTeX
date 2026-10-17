import React from 'react';
import {
  FileEdit,
  Shuffle,
  Printer,
  Camera,
  GraduationCap,
} from 'lucide-react';
import { Route, StepId } from '../../router/hashRouter';
import { useProfile } from '../../context/ProfileContext';

interface StepTabsProps {
  currentRoute: Route;
  onNavigate: (route: Route) => void;
}

interface StepItem {
  id: StepId;
  number: number;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const StepTabs: React.FC<StepTabsProps> = ({ currentRoute, onNavigate }) => {
  const { activeExamId, records } = useProfile();

  const isExamRoute = currentRoute.type === 'exam_step';
  const activeStep = isExamRoute ? currentRoute.step : null;

  // Filtra registros da prova ativa (ou todos se não houver isolamento por examId)
  const examRecordsCount = activeExamId
    ? records.filter((r) => !r.examId || r.examId === activeExamId).length
    : 0;

  const steps: StepItem[] = [
    {
      id: 'criar',
      number: 1,
      label: 'Criar',
      icon: <FileEdit className="w-3.5 h-3.5" />,
    },
    {
      id: 'versoes',
      number: 2,
      label: 'Versões',
      icon: <Shuffle className="w-3.5 h-3.5" />,
    },
    {
      id: 'imprimir',
      number: 3,
      label: 'Imprimir',
      icon: <Printer className="w-3.5 h-3.5" />,
    },
    {
      id: 'corrigir',
      number: 4,
      label: 'Corrigir',
      icon: <Camera className="w-3.5 h-3.5" />,
    },
    {
      id: 'notas',
      number: 5,
      label: 'Notas',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
      badge: examRecordsCount > 0 ? examRecordsCount : undefined,
    },
  ];

  const handleStepClick = (stepId: StepId) => {
    if (stepId === 'corrigir' && !activeExamId) {
      onNavigate({ type: 'scanner' });
      return;
    }
    if (!activeExamId) return;
    onNavigate({
      type: 'exam_step',
      examId: activeExamId,
      step: stepId,
    });
  };

  return (
    <div className="no-print bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav
          className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1.5 scrollbar-none"
          aria-label="Etapas da avaliação"
        >
          {steps.map((s) => {
            const isActive = isExamRoute && activeStep === s.id;
            const isDisabled = !activeExamId && s.id !== 'corrigir';

            return (
              <button
                key={s.id}
                type="button"
                disabled={isDisabled}
                onClick={() => handleStepClick(s.id)}
                aria-current={isActive ? 'page' : undefined}
                title={isDisabled ? 'Abra ou crie uma prova para acessar as etapas' : `Ir para etapa ${s.number}: ${s.label}`}
                className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                    : isDisabled
                    ? 'border-transparent text-slate-400 cursor-not-allowed opacity-60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive
                      ? 'bg-indigo-600 text-on-accent'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {s.number}
                </span>
                {s.icon}
                <span>{s.label}</span>
                {s.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                    {s.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

