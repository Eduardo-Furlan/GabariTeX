import React, { useState, useRef, useEffect } from 'react';
import {
  ProfileData,
  ProfileSettings,
  ProfileExportOptions,
  ProfileImportSummary,
} from '../../types/profile';
import {
  buildProfileZip,
  parseProfileZip,
  summarizeProfileImport,
  mergeProfiles,
} from '../../utils/profileZip';
import { saveFile } from '../../platform/files';
import { saveLastBackupDate } from '../../utils/storage';
import {
  FolderArchive,
  Download,
  Upload,
  Lock,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck2,
  Loader2,
} from 'lucide-react';
import { toast } from '../ui/toastStore';
import { confirmDialog } from '../ui/confirmStore';

interface ProfileExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: ProfileData;
  currentSettings: ProfileSettings;
  activeExamId?: string;
  initialMode?: 'export' | 'import';
  onProfileImported: (
    data: ProfileData,
    settings: ProfileSettings,
    mode?: 'merge' | 'replace'
  ) => void;
}

export const ProfileExportImportModal: React.FC<ProfileExportImportModalProps> = ({
  isOpen,
  onClose,
  currentData,
  currentSettings,
  activeExamId,
  initialMode = 'export',
  onProfileImported,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialMode);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
    }
  }, [isOpen, initialMode]);

  // Export State
  const [exportScope, setExportScope] = useState<'all' | 'custom'>('all');
  const [includeRecords, setIncludeRecords] = useState<boolean>(true);
  const [includeClasses, setIncludeClasses] = useState<boolean>(true);
  const [includePasswords, setIncludePasswords] = useState<boolean>(true);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>(() =>
    currentData.exams.map((e) => e.id)
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Import State
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    summary: ProfileImportSummary;
    parsedData: ProfileData;
    parsedSettings: ProfileSettings;
    passwordsGenerated: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleShareActiveExam = () => {
    if (!activeExamId) return;
    setExportScope('custom');
    setSelectedExamIds([activeExamId]);
    setIncludeRecords(false);
    setIncludeClasses(false);
    setIncludePasswords(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(null);
    try {
      const options: ProfileExportOptions = {
        includeRecords,
        includeClasses,
        includePasswords,
        examIds: exportScope === 'custom' ? selectedExamIds : undefined,
      };

      const zipBytes = await buildProfileZip(currentData, currentSettings, options);

      const d = new Date();
      const yyyy = String(d.getFullYear());
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const filename = `gabaritex-perfil-${yyyy}-${mm}-${dd}.zip`;

      const result = await saveFile({
        suggestedName: filename,
        mime: 'application/zip',
        data: zipBytes,
      });

      if (result.status === 'saved') {
        saveLastBackupDate();
        setExportSuccess(`Perfil exportado com sucesso (${filename}).`);
        setTimeout(() => setExportSuccess(null), 4000);
      }
    } catch (err: unknown) {
      toast.error(`Falha ao exportar perfil: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    setIsImporting(true);
    setImportError(null);
    setImportPreview(null);

    try {
      const buffer = await file.arrayBuffer();
      const zipBytes = new Uint8Array(buffer);
      const parsed = await parseProfileZip(zipBytes);

      const summary = summarizeProfileImport(currentData, parsed.profile);

      setImportPreview({
        summary,
        parsedData: parsed.profile,
        parsedSettings: parsed.settings,
        passwordsGenerated: parsed.passwordsGenerated,
      });
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview) return;

    if (importMode === 'replace') {
      const confirmReplace = await confirmDialog({
        title: 'Substituir Tudo',
        message: 'ATENÇÃO: Você escolheu "Substituir tudo". Todos os dados existentes serão substituídos pelos do arquivo importado. Deseja continuar?',
        tone: 'danger',
        confirmLabel: 'Substituir tudo',
      });
      if (!confirmReplace) return;

      onProfileImported(importPreview.parsedData, importPreview.parsedSettings, 'replace');
    } else {
      const { mergedData, mergedSettings } = mergeProfiles(
        currentData,
        importPreview.parsedData,
        currentSettings,
        importPreview.parsedSettings
      );
      onProfileImported(mergedData, mergedSettings, 'merge');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Arquivo de Perfil (ZIP)</h2>
              <p className="text-xs text-slate-500">
                Backup completo, troca de computador e compartilhamento de avaliações.
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

        {/* Abas */}
        <div className="flex border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exportar Perfil</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'import'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Importar Perfil</span>
          </button>
        </div>

        {/* Conteúdo da Aba Exportar */}
        {activeTab === 'export' && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Aviso de Segurança */}
            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-300 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Aviso de privacidade e segurança:</strong> este arquivo contém as senhas das provas e dados pessoais dos alunos para que você não precise redigitá-las. Armazene o arquivo ZIP em local seguro e de acesso restrito.
              </p>
            </div>

            {/* Escopo de exportação */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Escopo da Exportação
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'all'}
                    onChange={() => setExportScope('all')}
                    className="text-indigo-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Perfil Completo</span>
                    <span className="text-[11px] text-slate-500">
                      Todas as provas ({currentData.exams.length}), turmas e notas
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'custom'}
                    onChange={() => setExportScope('custom')}
                    className="text-indigo-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Personalizado</span>
                    <span className="text-[11px] text-slate-500">
                      Escolha quais provas incluir
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Atalho Compartilhar Prova */}
            {activeExamId && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Compartilhar Prova com Colega</span>
                  <span className="text-slate-500 text-[11px]">
                    Exporta apenas a prova atual, sem dados de alunos e sem senha.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleShareActiveExam}
                  className="px-3 py-1.5 text-xs font-semibold border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition shrink-0"
                >
                  Configurar
                </button>
              </div>
            )}

            {/* Seleção de Provas (se personalizado) */}
            {exportScope === 'custom' && (
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                <span className="text-xs font-bold text-slate-700 block mb-1">
                  Selecione as provas:
                </span>
                {currentData.exams.map((exam) => (
                  <label key={exam.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedExamIds.includes(exam.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExamIds((prev) => [...prev, exam.id]);
                        } else {
                          setSelectedExamIds((prev) => prev.filter((id) => id !== exam.id));
                        }
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>{exam.header.examTitle || exam.id}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Caixas de Opções */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRecords}
                  onChange={(e) => setIncludeRecords(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="font-medium">Incluir notas e correções do livro de notas</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeClasses}
                  onChange={(e) => setIncludeClasses(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="font-medium">Incluir turmas e listas de alunos</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePasswords}
                  onChange={(e) => setIncludePasswords(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="font-medium">Incluir senhas das provas (necessárias para corrigir no corretor)</span>
              </label>
            </div>

            {exportSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                <span>{exportSuccess}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-on-accent bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{isExporting ? 'Compactando...' : 'Exportar Arquivo ZIP'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo da Aba Importar */}
        {activeTab === 'import' && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {!importPreview ? (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".zip"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shadow-sm">
                    {isImporting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {isImporting ? 'Validando arquivo ZIP...' : 'Clique para selecionar o arquivo .zip'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Arquivos exportados pelo GabariTeX contendo provas, turmas e notas.
                    </p>
                  </div>
                </div>

                {importError && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Falha na importação</strong>
                      <p className="mt-0.5">{importError}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Resumo da Importação */}
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-500/5 space-y-3">
                  <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                    <span>Conteúdo Identificado no Arquivo</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-base font-extrabold text-slate-800 block">
                        {importPreview.summary.examsCount}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">Provas</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-base font-extrabold text-slate-800 block">
                        {importPreview.summary.classesCount}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">Turmas</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-base font-extrabold text-slate-800 block">
                        {importPreview.summary.recordsCount}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">Notas</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 pt-1">
                    <p>
                      • <strong>{importPreview.summary.newExams}</strong> novas provas;{' '}
                      <strong>{importPreview.summary.existingExams}</strong> já existentes ({importPreview.summary.newerExams} mais recentes que as suas).
                    </p>
                    <p>
                      • <strong>{importPreview.summary.newClasses}</strong> novas turmas e{' '}
                      <strong>{importPreview.summary.newRecords}</strong> novas notas adicionadas.
                    </p>
                  </div>

                  {importPreview.passwordsGenerated.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300">
                      <strong>Aviso de segurança:</strong> {importPreview.passwordsGenerated.length} prova(s) importada(s) estavam sem senha (modo compartilhamento). Novas senhas foram geradas automaticamente para que possam ser utilizadas no corretor.
                    </div>
                  )}
                </div>

                {/* Escolha do Modo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                    Como aplicar os dados?
                  </label>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      importMode === 'merge'
                        ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-500/5'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="text-indigo-600 mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Mesclar com o perfil atual (Recomendado)</span>
                        <span className="text-[11px] text-slate-500">
                          Preserva as provas e notas existentes. Provas com o mesmo ID são atualizadas se a versão do arquivo for mais recente.
                        </span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      importMode === 'replace'
                        ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-500/5'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-rose-600 mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block text-rose-700 dark:text-rose-300">
                          Substituir tudo (Apaga o perfil atual)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Substitui integralmente todas as provas, turmas e notas deste computador pelo conteúdo deste arquivo.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setImportPreview(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Escolher outro arquivo
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className={`px-5 py-2.5 text-xs font-bold text-on-accent rounded-xl shadow-sm transition ${
                      importMode === 'replace'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    Confirmar e Importar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
