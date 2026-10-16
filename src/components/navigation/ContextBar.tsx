import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Users,
  ChevronDown,
  Check,
  Plus,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { Route } from '../../router/hashRouter';

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

  const examRef = useRef<HTMLDivElement>(null);
  const classRef = useRef<HTMLDivElement>(null);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (examRef.current && !examRef.current.contains(e.target as Node)) {
        setExamDropdownOpen(false);
      }
      if (classRef.current && !classRef.current.contains(e.target as Node)) {
        setClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeClassName = activeClassId
    ? classes.find((c) => c.id === activeClassId)?.name || 'Turma não encontrada'
    : 'Todas as Turmas';

  const examTitle = exam.header?.examTitle || (exams.find((e) => e.id === activeExamId)?.name) || 'Sem título';

  const handleSelectExam = async (id: string) => {
    setExamDropdownOpen(false);
    await selectActiveExam(id);
    // Preserva a etapa atual se for exam_step, senão vai para criar
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
    <div className="bg-slate-50 border-b border-slate-200 py-1.5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Contextos: Prova Ativa & Turma Ativa */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {/* Seletor de Prova Ativa */}
          <div className="relative flex-1 sm:flex-initial" ref={examRef}>
            <button
              type="button"
              onClick={() => {
                setExamDropdownOpen(!examDropdownOpen);
                setClassDropdownOpen(false);
              }}
              className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition"
              aria-expanded={examDropdownOpen}
              title="Alternar prova ativa"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300 shrink-0" />
                <span className="text-slate-500 font-medium shrink-0">Prova:</span>
                <span className="truncate max-w-[140px] sm:max-w-[220px] font-bold">
                  {activeExamId ? examTitle : 'Nenhuma prova selecionada'}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                  examDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown de Provas */}
            {examDropdownOpen && (
              <div className="absolute left-0 mt-1 w-72 sm:w-80 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                    Alternar Prova Ativa
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setExamDropdownOpen(false);
                      onNavigate({ type: 'exams' });
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-0.5 font-semibold"
                  >
                    <span>Ver todas</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
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
                          onClick={() => handleSelectExam(ex.id)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                            isSelected ? 'bg-indigo-50 dark:bg-indigo-500/10 font-bold' : ''
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="text-slate-800 block truncate">{ex.name}</span>
                            <span className="text-[10px] text-slate-500 block">
                              {ex.questionCount} {ex.questionCount === 1 ? 'questão' : 'questões'}
                              {ex.recordCount !== undefined && ` · ${ex.recordCount} notas`}
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-300 shrink-0" />
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
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold transition shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Criar Nova Prova</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Seletor de Turma Ativa */}
          <div className="relative flex-1 sm:flex-initial" ref={classRef}>
            <button
              type="button"
              onClick={() => {
                setClassDropdownOpen(!classDropdownOpen);
                setExamDropdownOpen(false);
              }}
              className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-2xs transition"
              aria-expanded={classDropdownOpen}
              title="Filtrar por turma ativa"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300 shrink-0" />
                <span className="text-slate-500 font-medium shrink-0">Turma:</span>
                <span className="truncate max-w-[120px] sm:max-w-[180px] font-bold">
                  {activeClassName}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                  classDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown de Turmas */}
            {classDropdownOpen && (
              <div className="absolute left-0 mt-1 w-64 sm:w-72 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                    Filtrar por Turma
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setClassDropdownOpen(false);
                      onNavigate({ type: 'classes' });
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-0.5 font-semibold"
                  >
                    <span>Gerenciar</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClassId(null);
                      setClassDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                      activeClassId === null ? 'bg-indigo-50 dark:bg-indigo-500/10 font-bold' : ''
                    }`}
                  >
                    <span className="text-slate-800">Todas as Turmas (sem filtro)</span>
                    {activeClassId === null && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-300 shrink-0" />
                    )}
                  </button>

                  {classes.map((cls) => {
                    const isSelected = cls.id === activeClassId;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          setActiveClassId(cls.id);
                          setClassDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                          isSelected ? 'bg-indigo-50 dark:bg-indigo-500/10 font-bold' : ''
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="text-slate-800 block truncate">{cls.name}</span>
                          <span className="text-[10px] text-slate-500 block">
                            {cls.students?.length ?? 0} {(cls.students?.length ?? 0) === 1 ? 'aluno' : 'alunos'}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-300 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Atalho rápido para biblioteca caso não haja prova ativa */}
        {!activeExamId && (
          <button
            type="button"
            onClick={() => onNavigate({ type: 'exams' })}
            className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-1 font-semibold"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Abrir Biblioteca de Provas</span>
          </button>
        )}
      </div>
    </div>
  );
};

