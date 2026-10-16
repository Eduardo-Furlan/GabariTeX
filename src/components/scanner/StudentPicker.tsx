import React, { useState, useMemo } from 'react';
import { Classroom, Student, GradingRecord } from '../../types/exam';
import { searchStudents, normalizeRegistration } from '../../utils/classrooms';
import {
  Users,
  Search,
  CheckCircle2,
  Plus,
  X,
  Keyboard,
  ListFilter,
  Check,
} from 'lucide-react';

interface StudentPickerProps {
  classes: Classroom[];
  selectedClassId: string | null;
  onSelectClassId: (classId: string | null) => void;
  studentName: string;
  onStudentNameChange: (name: string) => void;
  studentId: string;
  onStudentIdChange: (id: string) => void;
  studentRef?: string;
  onStudentRefChange: (ref?: string) => void;
  addToClass: boolean;
  onAddToClassChange: (add: boolean) => void;
  records: GradingRecord[];
  onOpenClassManager: () => void;
}

export const StudentPicker: React.FC<StudentPickerProps> = ({
  classes,
  selectedClassId,
  onSelectClassId,
  studentName,
  onStudentNameChange,
  studentId,
  onStudentIdChange,
  studentRef,
  onStudentRefChange,
  addToClass,
  onAddToClassChange,
  records,
  onOpenClassManager,
}) => {
  const currentClass = classes.find((c) => c.id === selectedClassId);

  // Modo: 'select' (busca na turma) ou 'manual' (digitar campos soltos)
  const [mode, setMode] = useState<'select' | 'manual'>(() => {
    return currentClass && (currentClass.students?.length ?? 0) > 0 && !studentName ? 'select' : 'manual';
  });

  const [query, setQuery] = useState<string>('');

  // Conjunto de IDs e matrículas de alunos que já possuem nota nesta turma
  const correctedStudentsSet = useMemo(() => {
    const refs = new Set<string>();
    const regs = new Set<string>();

    for (const r of records) {
      if (!selectedClassId || r.classId === selectedClassId) {
        if (r.studentRef) refs.add(r.studentRef);
        if (r.studentId) regs.add(normalizeRegistration(r.studentId));
      }
    }

    return { refs, regs };
  }, [records, selectedClassId]);

  // Lista de alunos filtrados e ordenados: pendentes primeiro, corrigidos depois
  const studentList = useMemo(() => {
    if (!currentClass) return [];
    const filtered = searchStudents(currentClass, query);

    const isCorrected = (st: Student) => {
      if (correctedStudentsSet.refs.has(st.id)) return true;
      if (st.registration && correctedStudentsSet.regs.has(normalizeRegistration(st.registration))) {
        return true;
      }
      return false;
    };

    return [...filtered].sort((a, b) => {
      const aCorr = isCorrected(a) ? 1 : 0;
      const bCorr = isCorrected(b) ? 1 : 0;
      if (aCorr !== bCorr) return aCorr - bCorr; // pendentes primeiro
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [currentClass, query, correctedStudentsSet]);

  const handleSelectStudent = (st: Student) => {
    onStudentNameChange(st.name);
    onStudentIdChange(st.registration || '');
    onStudentRefChange(st.id);
  };

  const handleClearSelectedStudent = () => {
    onStudentRefChange(undefined);
    onStudentNameChange('');
    onStudentIdChange('');
  };

  const isStudentCorrected = (st: Student) => {
    if (correctedStudentsSet.refs.has(st.id)) return true;
    if (st.registration && correctedStudentsSet.regs.has(normalizeRegistration(st.registration))) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
      {/* Seletor de Turma e Alternador de Modo */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Turma:
          </label>
          <select
            value={selectedClassId || ''}
            onChange={(e) => {
              const val = e.target.value || null;
              onSelectClassId(val);
              if (!val) {
                setMode('manual');
              }
            }}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Sem turma vinculada</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.students?.length ?? 0} alunos)
              </option>
            ))}
          </select>
          {classes.length === 0 && (
            <button
              type="button"
              onClick={onOpenClassManager}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Criar turma
            </button>
          )}
        </div>

        {currentClass && (currentClass.students?.length ?? 0) > 0 && (
          <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setMode('select')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                mode === 'select'
                  ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3 h-3" /> Escolher na lista
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                mode === 'manual'
                  ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard className="w-3 h-3" /> Digitar à mão
            </button>
          </div>
        )}
      </div>

      {/* Modo 1: Escolha na Turma */}
      {mode === 'select' && currentClass && (
        <div className="space-y-2">
          {studentRef ? (
            /* Aluno Selecionado */
            <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-emerald-200 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 block truncate">
                    {studentName}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                    {studentId ? `Matrícula: ${studentId}` : 'Sem matrícula'} · {currentClass.name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearSelectedStudent}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5"
              >
                <X className="w-3.5 h-3.5" /> Trocar
              </button>
            </div>
          ) : (
            /* Campo de Busca e Lista com Rolagem */
            <div>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Buscar aluno em ${currentClass.name}...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                {studentList.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    Nenhum aluno encontrado para "{query}".
                  </div>
                ) : (
                  studentList.map((st) => {
                    const alreadyGraded = isStudentCorrected(st);

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleSelectStudent(st)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between transition group"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-xs font-semibold text-slate-800 block truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {st.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {st.registration ? `RA: ${st.registration}` : 'Sem matrícula'}
                          </span>
                        </div>
                        {alreadyGraded && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Já corrigido
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modo 2: Digitar à mão */}
      {mode === 'manual' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nome do Aluno:
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => {
                  onStudentNameChange(e.target.value);
                  onStudentRefChange(undefined);
                }}
                placeholder="Ex: João da Silva"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Matrícula / RA:
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => onStudentIdChange(e.target.value)}
                placeholder="Ex: 2026-001"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          {currentClass && (
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 pt-1">
              <input
                type="checkbox"
                checked={addToClass}
                onChange={(e) => onAddToClassChange(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Adicionar automaticamente à turma <strong>{currentClass.name}</strong> ao salvar
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
};
