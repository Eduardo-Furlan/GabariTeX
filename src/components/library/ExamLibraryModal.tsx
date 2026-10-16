import React, { useState } from 'react';
import { ExamMeta } from '../../types/profile';
import {
  BookOpen,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  FileCheck2,
  Share2,
  AlertTriangle,
  FolderArchive,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface ExamLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: ExamMeta[];
  activeExamId: string;
  onSelectActiveExam: (id: string) => void;
  onCreateExam: () => void;
  onLoadSampleExam: () => void;
  onDuplicateExam: (id: string) => void;
  onRenameExam: (id: string, newTitle: string) => void;
  onDeleteExam: (id: string) => void;
  onOpenExportImport: () => void;
  onShareExam: (id: string) => void;
}

export const ExamLibraryModal: React.FC<ExamLibraryModalProps> = ({
  isOpen,
  onClose,
  exams,
  activeExamId,
  onSelectActiveExam,
  onCreateExam,
  onLoadSampleExam,
  onDuplicateExam,
  onRenameExam,
  onDeleteExam,
  onOpenExportImport,
  onShareExam,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [examToDelete, setExamToDelete] = useState<ExamMeta | null>(null);

  if (!isOpen) return null;

  const handleStartRename = (exam: ExamMeta) => {
    setEditingId(exam.id);
    setEditingTitle(exam.name);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      onRenameExam(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Biblioteca de Provas</h2>
              <p className="text-xs text-slate-500">
                Gerencie todas as avaliações deste perfil, alterne a prova ativa ou exporte backups.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onCreateExam}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded-lg shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Prova</span>
            </button>
            <button
              type="button"
              onClick={onLoadSampleExam}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Usar Prova Modelo</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenExportImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Exportar / Importar Perfil (ZIP)</span>
          </button>
        </div>

        {/* Lista de Provas */}
        <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100 space-y-3">
          {exams.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma prova cadastrada</p>
              <p className="text-xs text-slate-500 mt-1">
                Crie uma nova prova ou use a prova modelo para começar.
              </p>
            </div>
          ) : (
            exams.map((exam) => {
              const isActive = exam.id === activeExamId;
              const isEditing = editingId === exam.id;

              return (
                <div
                  key={exam.id}
                  className={`pt-3 first:pt-0 p-4 rounded-xl border transition ${
                    isActive
                      ? 'border-indigo-500/60 bg-indigo-50/20 dark:bg-indigo-500/5'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="px-2 py-1 text-sm border border-indigo-400 rounded-md bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-md"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(exam.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(exam.id)}
                            className="p-1 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded"
                            title="Salvar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-800 truncate">
                            {exam.name}
                          </h3>
                          {isActive && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                              Prova Ativa
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Atualizada em {formatDate(exam.updatedAt)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exam.questionCount} questões</span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
                          {exam.recordCount} {exam.recordCount === 1 ? 'nota lançada' : 'notas lançadas'}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectActiveExam(exam.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded-lg shadow-sm transition"
                        >
                          Abrir
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg">
                          Aberta
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartRename(exam)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                        title="Renomear prova"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDuplicateExam(exam.id)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                        title="Duplicar prova (cria cópia com nova senha)"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onShareExam(exam.id)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition"
                        title="Compartilhar prova (exporta ZIP sem dados de alunos e sem senha)"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setExamToDelete(exam)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                        title="Excluir prova e notas associadas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com contagem */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>{exams.length} {exams.length === 1 ? 'prova no perfil' : 'provas no perfil'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Confirmação de Exclusão */}
      {examToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Excluir a prova &ldquo;{examToDelete.name}&rdquo;?
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {examToDelete.recordCount > 0 ? (
                    <>
                      Esta prova possui <strong>{examToDelete.recordCount} notas lançadas</strong> no livro de notas.{' '}
                      Ao confirmar, <strong>todas as notas desta prova serão apagadas permanentemente</strong>.
                    </>
                  ) : (
                    <>Esta ação removerá a prova deste perfil.</>
                  )}
                </p>
                <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300">
                  <strong>Recomendação:</strong> exporte o perfil em ZIP antes de excluir para ter uma cópia de segurança.
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExamToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteExam(examToDelete.id);
                  setExamToDelete(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-on-accent rounded-lg transition shadow-sm"
              >
                Sim, excluir prova
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

