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

interface MobileTabBarProps {
  currentRoute: Route;
  onNavigate: (route: Route) => void;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ currentRoute, onNavigate }) => {
  const { activeExamId, records } = useProfile();

  const isExamRoute = currentRoute.type === 'exam_step';
  const activeStep = isExamRoute ? currentRoute.step : null;

  const examRecordsCount = activeExamId
    ? records.filter((r) => !r.examId || r.examId === activeExamId).length
    : 0;

  const steps: Array<{
    id: StepId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'criar', label: 'Criar', icon: FileEdit },
    { id: 'versoes', label: 'Versões', icon: Shuffle },
    { id: 'imprimir', label: 'Imprimir', icon: Printer },
    { id: 'corrigir', label: 'Corrigir', icon: Camera },
    { id: 'notas', label: 'Notas', icon: GraduationCap, badge: examRecordsCount > 0 ? examRecordsCount : undefined },
  ];

  const handleStepClick = (stepId: StepId) => {
    if (stepId === 'corrigir') {
      if (activeExamId) {
        onNavigate({
          type: 'exam_step',
          examId: activeExamId,
          step: 'corrigir',
        });
      } else {
        onNavigate({ type: 'scanner' });
      }
      return;
    }
    if (!activeExamId) {
      onNavigate({ type: 'exams' });
      return;
    }
    onNavigate({
      type: 'exam_step',
      examId: activeExamId,
      step: stepId,
    });
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação móvel"
    >
      <div className="grid grid-cols-5 h-13 items-center">
        {steps.map((s) => {
          const isActive =
            (isExamRoute && activeStep === s.id) ||
            (currentRoute.type === 'scanner' && s.id === 'corrigir');
          const Icon = s.icon;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStepClick(s.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center h-full w-full py-1 min-h-[44px] transition ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-300 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                {s.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold rounded-full">
                    {s.badge > 99 ? '99+' : s.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight leading-none">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

