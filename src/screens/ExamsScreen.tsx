import React, { useState, useRef, useEffect } from 'react';
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
  Sparkles,
  Search,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { ExamMeta } from '../types/profile';
import { useProfile } from '../context/ProfileContext';
import { Route } from '../router/hashRouter';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Surface } from '../components/ui/Surface';
import { Badge } from '../components/ui/Badge';
import { Bubble } from '../components/ui/Bubble';
import { Modal } from '../components/ui/Modal';
import { EmptyState, BubbleGridIllustration } from '../components/ui/EmptyState';
import { useRetained } from '../hooks/useRetained';
import { cn } from '../components/ui/cn';

interface ExamsScreenProps {
  onNavigate: (route: Route) => void;
  onOpenExportImport: (mode?: 'export' | 'import') => void;
}

let hasMountedExamsScreen = false;

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

  const isFirstMountRef = useRef(!hasMountedExamsScreen);

  useEffect(() => {
    hasMountedExamsScreen = true;
    isFirstMountRef.current = false;
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [examToDelete, setExamToDelete] = useState<ExamMeta | null>(null);

  const retainedExamToDelete = useRetained(examToDelete);

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
    await createExam();
  };

  const handleLoadSample = async () => {
    await loadSampleMathExam();
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
    <div className="screen-enter max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Cabeçalho da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              <BookOpen className="w-4 h-4" />
            </div>
            <h1 className="font-display text-headline font-bold text-slate-900 tracking-tight">
              Biblioteca de Provas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Gerencie todas as suas avaliações, alterne a prova ativa ou exporte backups.
          </p>
        </div>

        {/* Ações principais */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />}
            onClick={() => onOpenExportImport('import')}
          >
            Importar Perfil
          </Button>

          <Button
            variant="ghost"
            size="sm"
            icon={<Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />}
            onClick={handleLoadSample}
          >
            Modelo Matemática
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            onClick={() => onNavigate({ type: 'bank_generate' })}
          >
            Gerar a Partir do Banco
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleCreateNew}
          >
            Nova Prova
          </Button>
        </div>
      </div>

      {/* Busca e Filtros */}
      {exams.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar prova por título..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
                aria-label="Limpar busca"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span
            aria-live="polite"
            className="text-xs text-slate-500 font-medium tabular-nums"
          >
            {`${filteredExams.length} ${filteredExams.length === 1 ? 'prova' : 'provas'}`}
          </span>
        </div>
      )}

      {/* Estado Vazio (Primeiro Acesso) */}
      {exams.length === 0 ? (
        <EmptyState
          illustration={<BubbleGridIllustration />}
          title="Nenhuma avaliação cadastrada ainda"
          description="Comece criando sua primeira prova do zero, experimente a prova modelo pronta ou restaure um backup."
          className="max-w-3xl"
          actions={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left mt-2">
              <button
                type="button"
                onClick={handleCreateNew}
                className="p-5 rounded-card bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition group flex flex-col justify-between text-left"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-3 group-hover:scale-105 transition-transform">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    Criar Prova do Zero
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Defina o cabeçalho, adicione questões de múltipla escolha ou dissertativas e configure a pontuação.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 group-hover:translate-x-1 transition-transform">
                  <span>Começar agora</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={handleLoadSample}
                className="p-5 rounded-card bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition group flex flex-col justify-between text-left"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-3 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    Usar Prova Modelo
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Explore uma avaliação completa de Matemática com equações LaTeX, gabarito e versões pré-configuradas.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 group-hover:translate-x-1 transition-transform">
                  <span>Carregar exemplo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onOpenExportImport('import')}
                className="p-5 rounded-card bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-xs transition group flex flex-col justify-between text-left"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    Importar Perfil / Prova
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Restaure um arquivo ZIP contendo provas, turmas e notas exportados de outro aparelho.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-300 group-hover:translate-x-1 transition-transform">
                  <span>Importar arquivo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          }
        />
      ) : filteredExams.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6 text-slate-400" />}
          title={`Nenhuma prova encontrada para "${searchQuery}"`}
          description="Verifique o termo digitado ou limpe o campo de busca para exibir todas as avaliações."
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchQuery('')}
            >
              Limpar filtro de busca
            </Button>
          }
        />
      ) : (
        /* Grade de Cartões de Prova */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
          <AnimatePresence initial={isFirstMountRef.current}>
            {filteredExams.map((ex) => {
              const isActive = ex.id === activeExamId;
              const isEditing = editingId === ex.id;

              return (
                <m.div
                  key={ex.id}
                  layout="position"
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
                  transition={{
                    duration: 0.22,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="h-full"
                >
                  <Surface
                    className={cn(
                      'group h-full p-5 flex flex-col justify-between transition-colors duration-150',
                      isActive
                        ? 'border-indigo-500 dark:border-indigo-500 shadow-xs'
                        : 'hover:border-slate-300 hover:shadow-xs'
                    )}
                  >
                    <div>
                      {/* Topo do Card: Selo Ativa e Ações de Menu */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        {isActive ? (
                          <Badge tone="accent" dot>
                            Prova Ativa
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {ex.id.slice(0, 8)}
                          </span>
                        )}

                        <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 coarse:opacity-100 transition-opacity">
                          <IconButton
                            label="Renomear prova"
                            size="sm"
                            tone="ghost"
                            onClick={() => handleStartRename(ex)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </IconButton>

                          <IconButton
                            label="Duplicar prova"
                            size="sm"
                            tone="ghost"
                            onClick={() => duplicateExam(ex.id)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </IconButton>

                          <IconButton
                            label="Exportar esta prova (ZIP)"
                            size="sm"
                            tone="ghost"
                            onClick={() => shareExam(ex.id)}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </IconButton>

                          <IconButton
                            label="Excluir prova"
                            size="sm"
                            tone="danger"
                            onClick={() => setExamToDelete(ex)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconButton>
                        </div>
                      </div>

                      {/* Título da Prova com Cross-fade */}
                      <div className="min-h-[44px] flex items-center mb-2">
                        <AnimatePresence mode="wait" initial={false}>
                          {isEditing ? (
                            <m.div
                              key="editing"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.14 }}
                              className="flex items-center gap-1.5 w-full"
                            >
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(ex.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                autoFocus
                                className="w-full text-sm font-bold px-2.5 py-1 rounded-lg border border-indigo-400 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <IconButton
                                label="Salvar"
                                size="sm"
                                tone="accent"
                                onClick={() => handleSaveRename(ex.id)}
                              >
                                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                              </IconButton>
                              <IconButton
                                label="Cancelar"
                                size="sm"
                                tone="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="w-4 h-4" />
                              </IconButton>
                            </m.div>
                          ) : (
                            <m.h3
                              key="title"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.14 }}
                              onClick={() => handleOpenExam(ex.id)}
                              className="font-display text-base font-bold text-slate-900 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors line-clamp-2"
                              title={ex.name}
                            >
                              {ex.name}
                            </m.h3>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Metadados: Questões · Notas · Data */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-5">
                        <span className="tabular-nums">
                          {`${ex.questionCount} ${ex.questionCount === 1 ? 'questão' : 'questões'}`}
                        </span>
                        {ex.recordCount !== undefined && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1.5">
                              {ex.recordCount > 0 ? (
                                <>
                                  <Bubble state="correct" size="sm" label="Notas corrigidas">
                                    <Check className="w-2.5 h-2.5" />
                                  </Bubble>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">
                                    {`${ex.recordCount} ${ex.recordCount === 1 ? 'nota corrigida' : 'notas corrigidas'}`}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-400 tabular-nums">
                                  0 notas
                                </span>
                              )}
                            </span>
                          </>
                        )}
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-meta text-slate-400">
                          {`Editada em ${formatDate(ex.updatedAt)}`}
                        </span>
                      </div>
                    </div>

                    {/* Botão de Abrir */}
                    <Button
                      variant={isActive ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => handleOpenExam(ex.id)}
                      iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                      className="w-full justify-between"
                    >
                      <span>{isActive ? 'Continuar Editando' : 'Abrir Prova'}</span>
                    </Button>
                  </Surface>
                </m.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        open={examToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setExamToDelete(null);
        }}
        size="sm"
        title={`Excluir Prova "${retainedExamToDelete?.name ?? ''}"?`}
        description="Esta ação removerá a prova permanentemente."
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExamToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (retainedExamToDelete) {
                  const id = retainedExamToDelete.id;
                  setExamToDelete(null);
                  await deleteExam(id);
                }
              }}
            >
              Confirmar Exclusão
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-300">
            <AlertTriangle className="w-6 h-6" />
          </div>

          {retainedExamToDelete?.recordCount !== undefined && retainedExamToDelete.recordCount > 0 && (
            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
              Atenção: existem {retainedExamToDelete.recordCount} notas de correção vinculadas a esta avaliação que também serão apagadas!
            </p>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Dica: você pode exportar um backup (ZIP) antes de apagar.</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};
