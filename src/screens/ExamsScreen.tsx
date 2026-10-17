import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Check,
  X,
  Share2,
  AlertTriangle,
  FolderArchive,
  Calendar,
  Sparkles,
  Search,
  ArrowRight,
  FileCheck2,
  Upload,
} from 'lucide-react';
import { ExamMeta } from '../types/profile';
import { useProfile } from '../context/ProfileContext';
import { Route } from '../router/hashRouter';

interface ExamsScreenProps {
  onNavigate: (route: Route) => void;
  onOpenExportImport: (mode?: 'export' | 'import') => void;
}

export const ExamsScreen: React.FC<ExamsScreenProps> = ({
  onNavigate,
  onOpenExportImport,
}) => {
  const {
    exams,
    activeExamId,
    selectActiveExam,
    createExam,
    loadSampleMathExam,
    duplicateExam,
    renameExam,
    deleteExam,
    shareExam,
  } = useProfile();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [examToDelete, setExamToDelete] = useState<ExamMeta | null>(null);

  const filteredExams = exams.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRename = (exam: ExamMeta) => {
    setEditingId(exam.id);
    setEditingTitle(exam.name);
  };

  const handleSaveRename = async (id: string) => {
    if (editingTitle.trim()) {
      await renameExam(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleOpenExam = async (id: string) => {
    await selectActiveExam(id);
    onNavigate({ type: 'exam_step', examId: id, step: 'criar' });
  };

  const handleCreateNew = async () => {
    const newExam = await createExam();
    onNavigate({ type: 'exam_step', examId: newExam.id, step: 'criar' });
  };

  const handleLoadSample = async () => {
    await loadSampleMathExam();
    if (activeExamId) {
      onNavigate({ type: 'exam_step', examId: activeExamId, step: 'criar' });
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              <BookOpen className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Biblioteca de Provas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie todas as suas avaliações, alterne a prova ativa ou exporte backups.
          </p>
        </div>

        {/* Ações principais */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenExportImport('import')}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition"
          >
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
            <span>Importar Perfil</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl shadow-2xs hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
          >
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            <span>Modelo Matemática</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Prova</span>
          </button>
        </div>
      </div>

      {/* Busca e Filtros */}
      {exams.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar prova por título..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filteredExams.length} {filteredExams.length === 1 ? 'prova' : 'provas'}
          </span>
        </div>
      )}

      {/* Estado Vazio (Primeiro Acesso) */}
      {exams.length === 0 ? (
        <div className="py-8 space-y-6">
          <div className="text-center max-w-md mx-auto">
            <h2 className="text-base font-bold text-slate-800">
              Nenhuma avaliação cadastrada ainda
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Comece criando sua primeira prova do zero, experimente a prova modelo pronta ou restaure um backup.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {/* Card 1: Criar do zero */}
            <button
              type="button"
              onClick={handleCreateNew}
              className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md transition text-left group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-4 group-hover:scale-105 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  Criar Prova do Zero
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Defina o cabeçalho, adicione questões de múltipla escolha ou dissertativas e configure a pontuação.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 group-hover:translate-x-1 transition-transform">
                <span>Começar agora</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Card 2: Usar modelo */}
            <button
              type="button"
              onClick={handleLoadSample}
              className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md transition text-left group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-4 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  Usar Prova Modelo
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Explore uma avaliação completa de Matemática com equações LaTeX, gabarito e versões pré-configuradas.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 group-hover:translate-x-1 transition-transform">
                <span>Carregar exemplo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Card 3: Importar Perfil */}
            <button
              type="button"
              onClick={() => onOpenExportImport('import')}
              className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition text-left group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 mb-4 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  Importar Perfil / Prova
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Restaure um arquivo ZIP contendo provas, turmas e notas exportados de outro aparelho.
                </p>
              </div>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-300 group-hover:translate-x-1 transition-transform">
                <span>Importar arquivo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            Nenhuma prova encontrada para &quot;{searchQuery}&quot;
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-300 hover:underline font-semibold"
          >
            Limpar filtro de busca
          </button>
        </div>
      ) : (
        /* Grade de Cartões de Prova */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((ex) => {
            const isActive = ex.id === activeExamId;
            const isEditing = editingId === ex.id;

            return (
              <div
                key={ex.id}
                className={`p-5 rounded-2xl bg-white border transition flex flex-col justify-between ${
                  isActive
                    ? 'border-indigo-300 dark:border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  {/* Topo do Card: Selo Ativa e Ações de Menu */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                        <Check className="w-3 h-3" /> Prova Ativa
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ID: {ex.id.slice(0, 8)}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartRename(ex)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Renomear prova"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => duplicateExam(ex.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Duplicar prova"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => shareExam(ex.id)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition"
                        title="Exportar esta prova (ZIP)"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setExamToDelete(ex)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                        title="Excluir prova"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Título da Prova */}
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 mb-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(ex.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="w-full text-sm font-bold px-2 py-1 rounded border border-indigo-400 bg-white text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(ex.id)}
                        className="p-1.5 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded"
                        title="Salvar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h3
                      onClick={() => handleOpenExam(ex.id)}
                      className="text-base font-bold text-slate-900 mb-2 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-300 transition line-clamp-2"
                      title={ex.name}
                    >
                      {ex.name}
                    </h3>
                  )}

                  {/* Metadados: Questões, Notas, Data */}
                  <div className="space-y-1.5 text-xs text-slate-500 mb-5">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {ex.questionCount} {ex.questionCount === 1 ? 'questão' : 'questões'}
                      </span>
                      {ex.recordCount !== undefined && (
                        <>
                          <span>·</span>
                          <span
                            className={
                              ex.recordCount > 0
                                ? 'font-semibold text-emerald-600 dark:text-emerald-300'
                                : 'text-slate-400'
                            }
                          >
                            {ex.recordCount} {ex.recordCount === 1 ? 'nota corrigida' : 'notas corrigidas'}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Editada em {formatDate(ex.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Botão de Abrir */}
                <button
                  type="button"
                  onClick={() => handleOpenExam(ex.id)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-on-accent shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <span>{isActive ? 'Continuar Editando' : 'Abrir Prova'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {examToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-300 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-2">
              Excluir Prova &quot;{examToDelete.name}&quot;?
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Esta ação removerá a prova permanentemente.
              {examToDelete.recordCount !== undefined && examToDelete.recordCount > 0 && (
                <span className="block mt-2 font-bold text-rose-700 dark:text-rose-300">
                  Atenção: existem {examToDelete.recordCount} notas de correção vinculadas a esta avaliação que também serão apagadas!
                </span>
              )}
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 mb-5 flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Dica: você pode exportar um backup (ZIP) antes de apagar.</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExamToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = examToDelete.id;
                  setExamToDelete(null);
                  await deleteExam(id);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-on-accent text-xs font-bold rounded-lg shadow-sm transition"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

