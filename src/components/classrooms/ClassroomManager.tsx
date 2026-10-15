import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Classroom, Student, GradingRecord } from '../../types/exam';
import {
  createClassroom,
  addStudent,
  updateStudent,
  removeStudent,
  searchStudents,
  parseStudentList,
  mergeIntoClassroom,
  readTextFile,
} from '../../utils/classrooms';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Upload,
  Search,
  X,
  Check,
  AlertTriangle,
  FileSpreadsheet,
  UserCheck,
} from 'lucide-react';

interface ClassroomManagerProps {
  isOpen: boolean;
  onClose: () => void;
  classes: Classroom[];
  activeClassId: string | null;
  onSelectActiveClass: (id: string | null) => void;
  onUpdateClasses: (classes: Classroom[]) => void;
  records: GradingRecord[];
  onDisassociateRecordsFromClass: (classId: string) => void;
}

export const ClassroomManager: React.FC<ClassroomManagerProps> = ({
  isOpen,
  onClose,
  classes,
  activeClassId,
  onSelectActiveClass,
  onUpdateClasses,
  records,
  onDisassociateRecordsFromClass,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(() => {
    return activeClassId || (classes.length > 0 ? classes[0].id : null);
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreatingClass, setIsCreatingClass] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>('');

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState<string>('');

  // Novo aluno rápido na linha inferior
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentReg, setNewStudentReg] = useState<string>('');
  const newStudentNameRef = useRef<HTMLInputElement>(null);

  // Aluno em edição
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentName, setEditStudentName] = useState<string>('');
  const [editStudentReg, setEditStudentReg] = useState<string>('');

  // Confirmação de exclusão de turma
  const [deletingClass, setDeletingClass] = useState<Classroom | null>(null);

  // Modal / Seção de Importação em Massa
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'existing' | 'new'>('existing');
  const [importTargetName, setImportTargetName] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<{
    students: Array<{ name: string; registration?: string }>;
    duplicates: number;
    ignoredLines: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quando o modal abre, inicializa a seleção na turma ativa (ou na primeira turma disponível)
  useEffect(() => {
    if (isOpen) {
      if (activeClassId && classes.some((c) => c.id === activeClassId)) {
        setSelectedClassId(activeClassId);
      } else if (classes.length > 0 && (!selectedClassId || !classes.some((c) => c.id === selectedClassId))) {
        setSelectedClassId(classes[0].id);
      }
    }
  }, [isOpen]);

  // Se a turma selecionada deixar de existir (excluída), seleciona uma turma válida restante
  useEffect(() => {
    if (classes.length > 0 && selectedClassId && !classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(
        activeClassId && classes.some((c) => c.id === activeClassId) ? activeClassId : classes[0].id
      );
    } else if (classes.length === 0) {
      setSelectedClassId(null);
    }
  }, [classes, selectedClassId, activeClassId]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isImportModalOpen) {
          setIsImportModalOpen(false);
        } else if (deletingClass) {
          setDeletingClass(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isImportModalOpen, deletingClass, onClose]);

  if (!isOpen) return null;

  const currentClass = classes.find((c) => c.id === selectedClassId);
  const filteredStudents = currentClass ? searchStudents(currentClass, searchQuery) : [];

  const handleCreateClass = () => {
    if (!newClassName.trim()) return;
    const newClass = createClassroom(newClassName);
    const nextClasses = [...classes, newClass];
    onUpdateClasses(nextClasses);
    setSelectedClassId(newClass.id);
    onSelectActiveClass(newClass.id);
    setNewClassName('');
    setIsCreatingClass(false);
  };

  const handleStartRename = (cls: Classroom) => {
    setEditingClassId(cls.id);
    setEditClassName(cls.name);
  };

  const handleSaveRename = () => {
    if (!editingClassId || !editClassName.trim()) return;
    const nextClasses = classes.map((c) =>
      c.id === editingClassId ? { ...c, name: editClassName.trim(), updatedAt: new Date().toISOString() } : c
    );
    onUpdateClasses(nextClasses);
    setEditingClassId(null);
  };

  const handleConfirmDeleteClass = () => {
    if (!deletingClass) return;
    const classId = deletingClass.id;
    onDisassociateRecordsFromClass(classId);
    const nextClasses = classes.filter((c) => c.id !== classId);
    onUpdateClasses(nextClasses);
    if (activeClassId === classId) {
      onSelectActiveClass(nextClasses.length > 0 ? nextClasses[0].id : null);
    }
    if (selectedClassId === classId) {
      setSelectedClassId(nextClasses.length > 0 ? nextClasses[0].id : null);
    }
    setDeletingClass(null);
  };

  const handleAddStudent = () => {
    if (!currentClass || !newStudentName.trim()) return;
    try {
      let name = newStudentName.trim();
      let reg = newStudentReg.trim();

      // Se o professor digitou nome e matrícula juntos (ex: "João Silva - 123" ou "João Silva | 123")
      if (!reg) {
        const parsed = parseStudentList(name);
        if (parsed.students.length === 1 && parsed.students[0].registration) {
          name = parsed.students[0].name;
          reg = parsed.students[0].registration;
        }
      }

      const updated = addStudent(currentClass, {
        name,
        registration: reg || undefined,
      });
      const nextClasses = classes.map((c) => (c.id === updated.id ? updated : c));
      onUpdateClasses(nextClasses);
      setNewStudentName('');
      setNewStudentReg('');
      newStudentNameRef.current?.focus();
    } catch {
      // Ignora erro de nome vazio
    }
  };

  const handleStartEditStudent = (st: Student) => {
    setEditingStudentId(st.id);
    setEditStudentName(st.name);
    setEditStudentReg(st.registration || '');
  };

  const handleSaveEditStudent = () => {
    if (!currentClass || !editingStudentId || !editStudentName.trim()) return;
    try {
      const updated = updateStudent(currentClass, editingStudentId, {
        name: editStudentName,
        registration: editStudentReg,
      });
      const nextClasses = classes.map((c) => (c.id === updated.id ? updated : c));
      onUpdateClasses(nextClasses);
      setEditingStudentId(null);
    } catch {
      // Ignora
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    if (!currentClass) return;
    const updated = removeStudent(currentClass, studentId);
    const nextClasses = classes.map((c) => (c.id === updated.id ? updated : c));
    onUpdateClasses(nextClasses);
  };

  // Importação em massa
  const handlePastedTextChange = (text: string) => {
    setPastedText(text);
    if (text.trim()) {
      setParsedPreview(parseStudentList(text));
    } else {
      setParsedPreview(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await readTextFile(file);
      setPastedText(content);
      setParsedPreview(parseStudentList(content));
    } catch (err) {
      console.error('Falha ao ler arquivo de texto', err);
    }
    if (e.target) e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!parsedPreview || parsedPreview.students.length === 0) return;

    if (importMode === 'new') {
      const targetName = importTargetName.trim() || 'Nova Turma Importada';
      let newCls = createClassroom(targetName);
      const mergeRes = mergeIntoClassroom(newCls, parsedPreview.students);
      newCls = mergeRes.classroom;
      const nextClasses = [...classes, newCls];
      onUpdateClasses(nextClasses);
      setSelectedClassId(newCls.id);
      onSelectActiveClass(newCls.id);
    } else if (currentClass) {
      const mergeRes = mergeIntoClassroom(currentClass, parsedPreview.students);
      const nextClasses = classes.map((c) => (c.id === currentClass.id ? mergeRes.classroom : c));
      onUpdateClasses(nextClasses);
    }

    setIsImportModalOpen(false);
    setPastedText('');
    setParsedPreview(null);
    setImportTargetName('');
  };

  const recordsCountInDeletingClass = deletingClass
    ? records.filter((r) => r.classId === deletingClass.id).length
    : 0;

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Gerenciador de Turmas e Alunos
              </h2>
              <p className="text-xs text-slate-500">
                Organize seus alunos por turmas para selecionar durante a correção e acompanhar faltantes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo: Painel Dividido (Lista de Turmas à esquerda | Alunos à direita) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Lado Esquerdo: Lista de Turmas */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0 bg-slate-50">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Suas Turmas ({classes.length})
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingClass(true)}
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Nova
              </button>
            </div>

            {/* Input de criação rápida de turma */}
            {isCreatingClass && (
              <div className="p-3 border-b border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30">
                <input
                  type="text"
                  placeholder="Nome da turma (ex: 2º A)"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateClass()}
                  autoFocus
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingClass(false);
                      setNewClassName('');
                    }}
                    className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateClass}
                    disabled={!newClassName.trim()}
                    className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded shadow-sm disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Lista com scroll das turmas */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {classes.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Nenhuma turma cadastrada ainda.
                </div>
              ) : (
                classes.map((cls) => {
                  const isSelected = cls.id === selectedClassId;
                  const isActive = cls.id === activeClassId;
                  const isEditing = cls.id === editingClassId;

                  return (
                    <div
                      key={cls.id}
                      onClick={() => !isEditing && setSelectedClassId(cls.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-xs ${
                        isSelected
                          ? 'bg-indigo-600 text-on-accent shadow-sm'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editClassName}
                              onChange={(e) => setEditClassName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                              autoFocus
                              className="w-full text-xs px-2 py-1 rounded bg-white text-slate-900 border border-slate-300"
                            />
                            <button
                              type="button"
                              onClick={handleSaveRename}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClassId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold truncate">{cls.name}</span>
                            {isActive && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                                  isSelected ? 'bg-indigo-700 text-on-accent' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}
                              >
                                Ativa
                              </span>
                            )}
                          </div>
                        )}
                        <span
                          className={`text-[11px] block mt-0.5 ${
                            isSelected ? 'text-indigo-100' : 'text-slate-400'
                          }`}
                        >
                          {cls.students.length} {cls.students.length === 1 ? 'aluno' : 'alunos'}
                        </span>
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(cls);
                            }}
                            className={`p-1 rounded hover:bg-black/10 transition ${
                              isSelected ? 'text-on-accent' : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title="Renomear turma"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingClass(cls);
                            }}
                            className={`p-1 rounded hover:bg-rose-500/20 hover:text-rose-600 transition ${
                              isSelected ? 'text-on-accent hover:text-rose-200' : 'text-slate-400'
                            }`}
                            title="Excluir turma"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Lado Direito: Alunos da Turma Selecionada */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {currentClass ? (
              <>
                {/* Barra de Ações da Turma */}
                <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">
                      {currentClass.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({currentClass.students.length} alunos)
                    </span>
                    {activeClassId !== currentClass.id && (
                      <button
                        type="button"
                        onClick={() => onSelectActiveClass(currentClass.id)}
                        className="text-xs px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 font-semibold transition"
                      >
                        Definir como Turma Ativa
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar aluno..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36 sm:w-48"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsImportModalOpen(true);
                        setImportMode('existing');
                        setPastedText('');
                        setParsedPreview(null);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-lg border border-indigo-200 dark:border-indigo-800/60 transition"
                    >
                      <Upload className="w-3.5 h-3.5" /> Importar / Colar
                    </button>
                  </div>
                </div>

                {/* Tabela de Alunos */}
                <div className="flex-1 overflow-y-auto p-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="pb-2 w-10">#</th>
                        <th className="pb-2">Nome do Aluno</th>
                        <th className="pb-2 w-36">Matrícula / RA</th>
                        <th className="pb-2 w-20 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            {currentClass.students.length === 0
                              ? 'Nenhum aluno cadastrado nesta turma ainda. Adicione abaixo ou importe uma planilha.'
                              : 'Nenhum aluno encontrado para a busca.'}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st, idx) => {
                          const isEditing = st.id === editingStudentId;

                          return (
                            <tr key={st.id} className="hover:bg-slate-50 group">
                              <td className="py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2.5 font-medium text-slate-800">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editStudentName}
                                    onChange={(e) => setEditStudentName(e.target.value)}
                                    className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 w-full"
                                    autoFocus
                                  />
                                ) : (
                                  st.name
                                )}
                              </td>
                              <td className="py-2.5 font-mono text-slate-600">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editStudentReg}
                                    onChange={(e) => setEditStudentReg(e.target.value)}
                                    placeholder="Opcional"
                                    className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 w-full"
                                  />
                                ) : (
                                  st.registration || '-'
                                )}
                              </td>
                              <td className="py-2.5 text-right">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={handleSaveEditStudent}
                                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingStudentId(null)}
                                      className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditStudent(st)}
                                      className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                      title="Editar aluno"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStudent(st.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                      title="Remover aluno da turma"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Linha Inferior: Adicionar Aluno Rapidamente */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2 flex-wrap shrink-0">
                  <input
                    ref={newStudentNameRef}
                    type="text"
                    placeholder="Nome completo do novo aluno"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                    className="flex-1 min-w-[200px] text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Matrícula / RA (opcional)"
                    value={newStudentReg}
                    onChange={(e) => setNewStudentReg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                    className="w-44 text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddStudent}
                    disabled={!newStudentName.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold rounded-lg shadow-sm disabled:opacity-40 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Aluno
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Users className="w-12 h-12 mb-3 stroke-1 text-slate-300" />
                <h3 className="text-sm font-bold text-slate-700">
                  Nenhuma turma selecionada
                </h3>
                <p className="text-xs max-w-sm mt-1 text-slate-500">
                  Crie uma turma à esquerda ou importe uma planilha para gerenciar alunos e notas.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreatingClass(true)}
                  className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold rounded-lg shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Criar Primeira Turma
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão de Turma */}
      {deletingClass && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Excluir Turma "{deletingClass.name}"?
                </h3>
                <p className="text-xs text-slate-500">
                  Esta ação não apaga as notas lançadas.
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60">
              {recordsCountInDeletingClass > 0 ? (
                <span>
                  <strong>{recordsCountInDeletingClass}</strong>{' '}
                  {recordsCountInDeletingClass === 1
                    ? 'nota ficará sem turma vinculada no Livro de Notas.'
                    : 'notas ficarão sem turma vinculada no Livro de Notas.'}
                </span>
              ) : (
                <span>Nenhuma nota vinculada a esta turma no momento.</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClass}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-on-accent rounded-lg shadow-sm transition"
              >
                Excluir Turma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação em Massa */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Importar Alunos em Massa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {/* Destino da Importação */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase text-[10px]">
                  Destino da Importação:
                </label>
                <div className="flex items-center gap-4 flex-wrap text-xs">
                  {currentClass && (
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'existing'}
                        onChange={() => setImportMode('existing')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Acrescentar à turma atual ({currentClass.name})
                    </label>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'new'}
                      onChange={() => setImportMode('new')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Criar uma nova turma
                  </label>
                </div>

                {importMode === 'new' && (
                  <input
                    type="text"
                    placeholder="Nome da nova turma (ex: 1º Ano B — Matutino)"
                    value={importTargetName}
                    onChange={(e) => setImportTargetName(e.target.value)}
                    className="mt-2.5 w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* Botões de Ação: Upload de Arquivo ou Colar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Cole da planilha ou digite (separe com <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">-</span>, <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">|</span>, <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">;</span> ou <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Tab</span>):
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    <Upload className="w-3 h-3" /> Carregar arquivo .csv/.txt
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => handlePastedTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const target = e.currentTarget;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const val = target.value;
                      const nextVal = val.substring(0, start) + '\t' + val.substring(end);
                      handlePastedTextChange(nextVal);
                      requestAnimationFrame(() => {
                        target.selectionStart = target.selectionEnd = start + 1;
                      });
                    }
                  }}
                  placeholder={`Cole da planilha ou digite um aluno por linha:\nJoão da Silva - 00123\nMaria Santos - 00124\n(ou separe por traço "-", barra "|", ponto e vírgula ";" ou Tab)`}
                  className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Resumo da Análise */}
              {parsedPreview && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                      {parsedPreview.students.length} alunos válidos detectados
                    </span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {parsedPreview.duplicates} repetidos · {parsedPreview.ignoredLines} linhas ignoradas
                    </span>
                  </div>

                  {parsedPreview.students.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white divide-y divide-slate-100">
                      {parsedPreview.students.slice(0, 15).map((st, i) => (
                        <div key={i} className="py-1 flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-800">{st.name}</span>
                          <span className="font-mono text-slate-400">{st.registration || 'Sem matrícula'}</span>
                        </div>
                      ))}
                      {parsedPreview.students.length > 15 && (
                        <div className="pt-1.5 text-center text-[10px] text-slate-400 italic">
                          + {parsedPreview.students.length - 15} outros alunos...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!parsedPreview || parsedPreview.students.length === 0}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded-lg shadow-sm disabled:opacity-40 transition"
              >
                Confirmar Importação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};
