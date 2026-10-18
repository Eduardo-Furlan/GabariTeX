import React, { useState, useRef } from 'react';
import {
  FileText,
  Users,
  ChevronDown,
  Check,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { Route } from '../../router/hashRouter';
import { Popover } from '../ui/Popover';
import { cn } from '../ui/cn';

interface ContextBarProps {
  currentRoute: Route;
  onNavigate: (route: Route) => void;
}

export const ContextBar: React.FC<ContextBarProps> = ({ currentRoute, onNavigate }) => {
  const {
    exams,
    exam,
    activeExamId,
    selectActiveExam,
    createExam,
    classes,
    activeClassId,
    setActiveClassId,
  } = useProfile();

  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);

  const examButtonRef = useRef<HTMLButtonElement>(null);
  const classButtonRef = useRef<HTMLButtonElement>(null);

  const activeClassName = activeClassId
    ? classes.find((c) => c.id === activeClassId)?.name || 'Turma não encontrada'
    : 'Todas as Turmas';

  const examTitle =
    exam.header?.examTitle ||
    exams.find((e) => e.id === activeExamId)?.name ||
    'Sem título';

  const handleSelectExam = async (id: string) => {
    setExamDropdownOpen(false);
    await selectActiveExam(id);
    if (currentRoute.type === 'exam_step') {
      onNavigate({ type: 'exam_step', examId: id, step: currentRoute.step });
    } else {
      onNavigate({ type: 'exam_step', examId: id, step: 'criar' });
    }
  };

  const handleCreateNewExam = async () => {
    setExamDropdownOpen(false);
    const newExam = await createExam();
    onNavigate({ type: 'exam_step', examId: newExam.id, step: 'criar' });
  };

  return (
    <div className="border-t border-slate-200/80 bg-slate-50/70 py-1 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Contextos: Prova Ativa & Turma Ativa */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Seletor de Prova Ativa */}
          <div className="relative flex-1 sm:flex-initial">
            <button
              ref={examButtonRef}
              type="button"
              onClick={() => {
                setExamDropdownOpen(!examDropdownOpen);
                setClassDropdownOpen(false);
              }}
              className={cn(
                'w-full sm:w-auto flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                examDropdownOpen && 'border-slate-300 bg-slate-100'
              )}
              aria-haspopup="listbox"
              aria-expanded={examDropdownOpen}
              title="Alternar prova ativa"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-slate-500 font-medium shrink-0">Prova:</span>
                <span className="truncate max-w-[140px] sm:max-w-[200px] font-bold">
                  {activeExamId ? examTitle : 'Modo Autônomo (Auto QR)'}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150',
                  examDropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Dropdown de Provas */}
            <Popover
              open={examDropdownOpen}
              onOpenChange={setExamDropdownOpen}
              anchorRef={examButtonRef}
              align="start"
              className="w-72 sm:w-80 py-1"
            >
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-meta font-bold text-slate-600">
                  Alternar Prova Ativa
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setExamDropdownOpen(false);
                    onNavigate({ type: 'exams' });
                  }}
                  className="text-meta text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 font-semibold"
                >
                  <span>Ver todas</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div role="listbox" aria-label="Provas" className="max-h-60 overflow-y-auto py-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={!activeExamId}
                  onClick={async () => {
                    setExamDropdownOpen(false);
                    onNavigate({ type: 'scanner' });
                    await selectActiveExam(null);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-100',
                    !activeExamId && 'bg-indigo-50 dark:bg-indigo-500/10 font-bold'
                  )}
                >
                  <div className="truncate pr-2">
                    <span className="text-slate-800 block truncate font-bold">
                      Modo Autônomo (Sem prova fixa)
                    </span>
                    <span className="text-meta text-slate-500 block">
                      Auto-identificação via QR Code de qualquer prova
                    </span>
                  </div>
                  {!activeExamId && (
                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                </button>

                {exams.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-slate-500">
                    Nenhuma prova encontrada.
                  </div>
                ) : (
                  exams.map((ex) => {
                    const isSelected = ex.id === activeExamId;
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectExam(ex.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition',
                          isSelected && 'bg-indigo-50 dark:bg-indigo-500/10 font-bold'
                        )}
                      >
                        <div className="truncate pr-2">
                          <span className="text-slate-800 block truncate">{ex.name}</span>
                          <span className="text-meta text-slate-500 block">
                            {ex.questionCount} {ex.questionCount === 1 ? 'questão' : 'questões'}
                            {ex.recordCount !== undefined && ` · ${ex.recordCount} notas`}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="p-1.5 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={handleCreateNewExam}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Criar Nova Prova</span>
                </button>
              </div>
            </Popover>
          </div>

          {/* Seletor de Turma Ativa */}
          <div className="relative flex-1 sm:flex-initial">
            <button
              ref={classButtonRef}
              type="button"
              onClick={() => {
                setClassDropdownOpen(!classDropdownOpen);
                setExamDropdownOpen(false);
              }}
              className={cn(
                'w-full sm:w-auto flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                classDropdownOpen && 'border-slate-300 bg-slate-100'
              )}
              aria-haspopup="listbox"
              aria-expanded={classDropdownOpen}
              title="Filtrar por turma ativa"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-slate-500 font-medium shrink-0">Turma:</span>
                <span className="truncate max-w-[120px] sm:max-w-[160px] font-bold">
                  {activeClassName}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150',
                  classDropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Dropdown de Turmas */}
            <Popover
              open={classDropdownOpen}
              onOpenChange={setClassDropdownOpen}
              anchorRef={classButtonRef}
              align="start"
              className="w-64 sm:w-72 py-1"
            >
              <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-meta font-bold text-slate-600">
                  Filtrar por Turma
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setClassDropdownOpen(false);
                    onNavigate({ type: 'classes' });
                  }}
                  className="text-meta text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 font-semibold"
                >
                  <span>Gerenciar</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div role="listbox" aria-label="Turmas" className="max-h-60 overflow-y-auto py-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={!activeClassId}
                  onClick={() => {
                    setActiveClassId(null);
                    setClassDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-100',
                    !activeClassId && 'bg-indigo-50 dark:bg-indigo-500/10 font-bold'
                  )}
                >
                  <span className="text-slate-800">Todas as Turmas (Sem filtro)</span>
                  {!activeClassId && (
                    <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  )}
                </button>

                {classes.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-slate-500">
                    Nenhuma turma cadastrada.
                  </div>
                ) : (
                  classes.map((cls) => {
                    const isSelected = cls.id === activeClassId;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setActiveClassId(cls.id);
                          setClassDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition',
                          isSelected && 'bg-indigo-50 dark:bg-indigo-500/10 font-bold'
                        )}
                      >
                        <div className="truncate pr-2">
                          <span className="text-slate-800 block truncate font-medium">
                            {cls.name}
                          </span>
                          <span className="text-meta text-slate-500 block">
                            {cls.students?.length || 0} alunos
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="p-1.5 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setClassDropdownOpen(false);
                    onNavigate({ type: 'classes' });
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Turma</span>
                </button>
              </div>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
};
