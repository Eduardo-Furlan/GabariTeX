import React from 'react';
import * as m from 'motion/react-m';
import {
  FileEdit,
  Shuffle,
  Printer,
  Camera,
  GraduationCap,
} from 'lucide-react';
import { Route, StepId } from '../../router/hashRouter';
import { useProfile } from '../../context/ProfileContext';
import { Bubble } from '../ui/Bubble';
import { cn } from '../ui/cn';

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
  const { activeExamId, recordCountByExam } = useProfile();

  const isExamRoute = currentRoute.type === 'exam_step';
  const activeStep = isExamRoute ? currentRoute.step : null;

  const examRecordsCount = activeExamId ? recordCountByExam[activeExamId] ?? 0 : 0;

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
    <div className="hidden md:block border-t border-slate-200/80 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav
          className="flex space-x-1 sm:space-x-1.5 overflow-x-auto py-1 scrollbar-none"
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
                title={
                  isDisabled
                    ? 'Abra ou crie uma prova para acessar as etapas'
                    : `Ir para etapa ${s.number}: ${s.label}`
                }
                className={cn(
                  'relative shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  isActive
                    ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                    : isDisabled
                    ? 'text-slate-400 cursor-not-allowed opacity-60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )}
              >
                {isActive && (
                  <m.span
                    layoutId="step-pill"
                    className="absolute inset-0 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 shadow-2xs -z-0"
                    transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
                    aria-hidden="true"
                  />
                )}
                <Bubble
                  state={isActive ? 'filled' : 'empty'}
                  size="sm"
                  className={cn(
                    'relative z-10 w-4 h-4 text-[10px] font-bold',
                    !isActive && 'border-slate-300 text-slate-600'
                  )}
                  aria-hidden="true"
                >
                  {s.number}
                </Bubble>
                <span className="relative z-10">{s.icon}</span>
                <span className="relative z-10">{s.label}</span>
                {s.badge !== undefined && (
                  <span
                    key={s.badge}
                    className="relative z-10 ml-0.5 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full animate-pop"
                  >
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
