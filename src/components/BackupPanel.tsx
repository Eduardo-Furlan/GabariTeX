import React, { useState, useEffect, useRef } from 'react';
import { Exam, GradingRecord, Classroom } from '../types/exam';
import {
  buildBackup,
  parseBackup,
  downloadBackupFile,
  downloadGradebookJson,
  parseGradebookExport,
  mergeGradebooks,
  BackupFile,
  MergeSummary,
} from '../utils/backup';
import { loadLastBackupDate } from '../utils/storage';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Lock,
  ArrowRightLeft,
  Calendar,
  ShieldAlert,
  FolderOpen,
} from 'lucide-react';

interface BackupPanelProps {
  exam: Exam;
  gradebook: GradingRecord[];
  classes?: Classroom[];
  teacherPassword?: string;
  onRestoreBackup: (backup: BackupFile) => void;
  onMergeGradebook: (mergedRecords: GradingRecord[], summary: MergeSummary) => void;
  onClose: () => void;
}

export const BackupPanel: React.FC<BackupPanelProps> = ({
  exam,
  gradebook,
  classes,
  teacherPassword,
  onRestoreBackup,
  onMergeGradebook,
  onClose,
}) => {
  const [lastBackup, setLastBackup] = useState<Date | null>(() => loadLastBackupDate());
  const [storageEstimate, setStorageEstimate] = useState<{
    usageMB: number;
    quotaMB: number;
    percent: number;
  } | null>(null);
  const [desktopStoreInfo, setDesktopStoreInfo] = useState<{
    path: string;
    usedBytes: number;
  } | null>(null);

  const [restoreCandidate, setRestoreCandidate] = useState<BackupFile | null>(null);
  const [mergeCandidate, setMergeCandidate] = useState<{
    merged: GradingRecord[];
    summary: MergeSummary;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const backupInputRef = useRef<HTMLInputElement>(null);
  const gradebookInputRef = useRef<HTMLInputElement>(null);

  // Consulta cota de armazenamento no navegador ou pasta do perfil no desktop
  useEffect(() => {
    if (__DESKTOP__) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke<{ path: string; usedBytes: number }>('store_open'))
        .then((info) => setDesktopStoreInfo(info))
        .catch(() => {});
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
      navigator.storage
        .estimate()
        .then((est) => {
          if (est.usage !== undefined && est.quota !== undefined && est.quota > 0) {
            const usageMB = Number((est.usage / (1024 * 1024)).toFixed(2));
            const quotaMB = Number((est.quota / (1024 * 1024)).toFixed(2));
            const percent = Math.min(100, Math.round((est.usage / est.quota) * 100));
            setStorageEstimate({ usageMB, quotaMB, percent });
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleRevealProfileDir = () => {
    if (!__DESKTOP__ || !desktopStoreInfo) return;
    import('@tauri-apps/plugin-opener')
      .then(({ revealItemInDir }) => revealItemInDir(desktopStoreInfo.path))
      .catch(() => {});
  };

  const handleExportFullBackup = () => {
    try {
      const backup = buildBackup(exam, gradebook, teacherPassword, classes);
      downloadBackupFile(backup);
      setLastBackup(new Date());
      setSuccessMessage('Backup completo exportado com sucesso! Guarde o arquivo em local seguro.');
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage('Falha ao exportar backup: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleBackupFileSelect = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const res = parseBackup(content);
      if (res.ok) {
        setRestoreCandidate(res.data);
      } else {
        setErrorMessage(res.error);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Não foi possível ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!restoreCandidate) return;
    onRestoreBackup(restoreCandidate);
    setSuccessMessage('Backup completo restaurado com sucesso!');
    setRestoreCandidate(null);
  };

  const handleExportGradebook = () => {
    try {
      downloadGradebookJson(gradebook);
      setSuccessMessage('Livro de notas exportado em JSON para sincronização.');
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage('Falha ao exportar notas: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleGradebookFileSelect = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const res = parseGradebookExport(content);
      if (res.ok) {
        const mergeResult = mergeGradebooks(gradebook, res.data);
        setMergeCandidate(mergeResult);
      } else {
        setErrorMessage(res.error);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Não foi possível ler o arquivo de notas.');
    };
    reader.readAsText(file);
  };

  const handleConfirmMerge = () => {
    if (!mergeCandidate) return;
    onMergeGradebook(mergeCandidate.merged, mergeCandidate.summary);
    setSuccessMessage(
      `Notas sincronizadas com sucesso! ${mergeCandidate.summary.added} adicionadas, ${mergeCandidate.summary.updated} atualizadas.`
    );
    setMergeCandidate(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white text-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Dados, Backup & Sincronização</h3>
              <p className="text-xs text-slate-500">
                Gerencie cópias de segurança da prova, notas e sincronize entre celular e computador.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagens de Sucesso ou Erro */}
        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 font-bold" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Status de Armazenamento e Lembrete de Backup */}
        <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
          {__DESKTOP__ ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <HardDrive className="w-4 h-4 text-indigo-500" />
                  <span>Pasta do perfil neste computador:</span>
                </div>
                {desktopStoreInfo && (
                  <button
                    type="button"
                    onClick={handleRevealProfileDir}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Mostrar pasta
                  </button>
                )}
              </div>
              {desktopStoreInfo ? (
                <div className="font-mono text-[11px] text-slate-500 break-all">
                  {desktopStoreInfo.path} ({(desktopStoreInfo.usedBytes / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">Armazenamento em disco ativo</div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <HardDrive className="w-4 h-4 text-indigo-500" />
                  <span>Armazenamento local do navegador:</span>
                </div>
                {storageEstimate ? (
                  <span className="font-mono text-slate-500 text-[11px]">
                    {storageEstimate.usageMB} MB / {storageEstimate.quotaMB} MB ({storageEstimate.percent}%)
                  </span>
                ) : (
                  <span className="text-slate-500 text-[11px]">Armazenamento padrão ativo</span>
                )}
              </div>

              {storageEstimate && (
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      storageEstimate.percent > 80
                        ? 'bg-rose-500'
                        : storageEstimate.percent > 50
                        ? 'bg-amber-500'
                        : 'bg-indigo-600 dark:bg-indigo-400'
                    }`}
                    style={{ width: `${Math.max(2, storageEstimate.percent)}%` }}
                  />
                </div>
              )}

              {storageEstimate && storageEstimate.percent > 80 && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Atenção: mais de 80% do espaço de armazenamento está utilizado. Exporte um backup.</span>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Último backup completo:{' '}
                {lastBackup ? (
                  <strong className="text-slate-900 font-medium">
                    {lastBackup.toLocaleDateString('pt-BR')} às{' '}
                    {lastBackup.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                ) : (
                  <strong className="text-amber-600 dark:text-amber-400 font-medium">Nenhum realizado ainda</strong>
                )}
              </span>
            </div>
            <span className="text-[10px]">Persistência automática ativa</span>
          </div>
        </div>

        {/* Aviso de Privacidade de Dados de Alunos */}
        <div className="mt-4 p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Privacidade dos dados:</strong> os nomes, turmas e registros de notas ficam salvos exclusivamente no seu navegador. Os arquivos de backup contêm dados pessoais dos alunos,  armazene-os em local seguro e de acesso restrito.
          </p>
        </div>

        {/* Bloco 1: Backup Completo */}
        <div className="mt-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-indigo-500" /> Backup Completo (Prova + Notas + Senha)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExportFullBackup}
              className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10 hover:bg-indigo-100/70 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-left transition flex items-start gap-3"
            >
              <Download className="w-5 h-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">Exportar Backup Completo</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Gera arquivo JSON com toda a estrutura da prova, banco de questões e notas.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-slate-50 text-left transition flex items-start gap-3"
            >
              <Upload className="w-5 h-5 shrink-0 text-slate-500 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">Restaurar Backup Completo</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Substitui prova, notas e configurações atuais a partir de um backup prévio.
                </div>
              </div>
            </button>

            <input
              ref={backupInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleBackupFileSelect(e.target.files[0]);
                }
              }}
            />
          </div>

          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              <strong>Aviso de segurança:</strong> O arquivo de backup completo contém a senha mestra e dados de
              identificação dos alunos. Guarde-o em local seguro.
            </span>
          </p>
        </div>

        {/* Bloco 2: Sincronização de Notas Entre Aparelhos */}
        <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" /> Sincronizar Notas Entre Aparelhos
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Corrija folhas usando a câmera do seu celular e transfira as notas para consolidar no computador sem
            duplicações.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExportGradebook}
              disabled={gradebook.length === 0}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:bg-slate-50 text-left transition flex items-start gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">Exportar Notas (JSON)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Baixa apenas as {gradebook.length} notas corrigidas para transferir.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => gradebookInputRef.current?.click()}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:bg-slate-50 text-left transition flex items-start gap-3"
            >
              <Upload className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">Importar e Mesclar Notas</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Acrescenta novos registros e atualiza notas sem apagar as existentes.
                </div>
              </div>
            </button>

            <input
              ref={gradebookInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleGradebookFileSelect(e.target.files[0]);
                }
              }}
            />
          </div>
        </div>

        {/* Modal de Confirmação de Restauração Completa */}
        {restoreCandidate && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white text-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Confirmar Restauração Completa</h4>
                  <p className="text-xs text-slate-500">Esta ação substituirá os dados atuais em edição.</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Data do backup:</span>
                  <span className="font-semibold text-slate-900">
                    {new Date(restoreCandidate.exportedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Título da prova:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                    {restoreCandidate.exam.header.examTitle || 'Sem título'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Questões cadastradas:</span>
                  <span className="font-semibold text-slate-900">{restoreCandidate.exam.questions.length} questões</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Notas no livro de notas:</span>
                  <span className="font-semibold text-slate-900">{restoreCandidate.gradebook.length} notas</span>
                </div>
                {restoreCandidate.classes && restoreCandidate.classes.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Turmas cadastradas:</span>
                    <span className="font-semibold text-slate-900">
                      {restoreCandidate.classes.length} {restoreCandidate.classes.length === 1 ? 'turma' : 'turmas'} ({restoreCandidate.classes.reduce((acc, c) => acc + (c.students?.length ?? 0), 0)} alunos)
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Senha mestra inclusa:</span>
                  <span className="font-semibold text-slate-900">
                    {restoreCandidate.teacherPassword ? 'Sim (criptografia ativa)' : 'Não'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestoreCandidate(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-on-accent rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Confirmar e Substituir Tudo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Mesclagem de Notas */}
        {mergeCandidate && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white text-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Mesclar Livro de Notas</h4>
                  <p className="text-xs text-slate-500">Resumo da sincronização de registros:</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                  <span className="block text-lg font-black text-emerald-700 dark:text-emerald-300">
                    +{mergeCandidate.summary.added}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-400">Novas</span>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl">
                  <span className="block text-lg font-black text-indigo-700 dark:text-indigo-300">
                    {mergeCandidate.summary.updated}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-indigo-800 dark:text-indigo-400">
                    Atualizadas
                  </span>
                </div>
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                  <span className="block text-lg font-black text-slate-900">
                    {mergeCandidate.summary.unchanged}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Inalteradas</span>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Total consolidado após a mesclagem: <strong>{mergeCandidate.merged.length} notas</strong>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMergeCandidate(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMerge}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-on-accent rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Confirmar Mesclagem
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
