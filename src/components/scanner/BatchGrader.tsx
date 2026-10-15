import React, { useReducer, useRef, useState, useEffect, useCallback } from 'react';
import { ExamVersion, GradingRecord, Classroom } from '../../types/exam';
import { DecryptedQrPayload } from '../../types/omr';
import { gradePhotoFile } from '../../utils/photoPipeline';
import {
  batchReducer,
  initialBatchState,
  getBatchSummary,
  BatchItem,
} from '../../utils/batchQueue';
import { GradingModal } from './GradingModal';
import {
  Upload,
  Files,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Trash2,
  Save,
  Loader2,
  Eye,
  Check,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export interface BatchGraderProps {
  teacherPassword: string;
  activePayload: DecryptedQrPayload | null;
  availableVersions?: ExamVersion[];
  onSaveRecords: (records: GradingRecord[]) => void;
  onLockPayload?: (payload: DecryptedQrPayload) => void;
  classes?: Classroom[];
  activeClassId?: string | null;
  onSelectActiveClass?: (id: string | null) => void;
  records?: GradingRecord[];
  onOpenClassManager?: () => void;
  onAddStudentToClass?: (classId: string, student: { name: string; registration?: string }) => void;
}

export const BatchGrader: React.FC<BatchGraderProps> = ({
  teacherPassword,
  activePayload,
  availableVersions = [],
  onSaveRecords,
  onLockPayload,
  classes = [],
  activeClassId = null,
  onSelectActiveClass,
  records = [],
  onOpenClassManager,
  onAddStudentToClass,
}) => {
  const [state, dispatch] = useReducer(batchReducer, initialBatchState);
  const [reviewingItem, setReviewingItem] = useState<BatchItem | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [confirmSaveAllOpen, setConfirmSaveAllOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRequestedRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const inFlightIdsRef = useRef<Set<string>>(new Set());

  const itemsRef = useRef(state.items);
  itemsRef.current = state.items;

  const teacherPasswordRef = useRef(teacherPassword);
  teacherPasswordRef.current = teacherPassword;

  const activePayloadRef = useRef(activePayload);
  activePayloadRef.current = activePayload;

  const availableVersionsRef = useRef(availableVersions);
  availableVersionsRef.current = availableVersions;

  const onLockPayloadRef = useRef(onLockPayload);
  onLockPayloadRef.current = onLockPayload;

  const currentClass = classes.find((c) => c.id === activeClassId) || null;
  const summary = getBatchSummary(state.items);

  const runQueue = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      while (!cancelRequestedRef.current) {
        const nextItem = itemsRef.current.find(
          (it) => it.status === 'queued' && !inFlightIdsRef.current.has(it.id)
        );

        if (!nextItem) {
          dispatch({ type: 'CANCEL_PROCESSING' });
          inFlightIdsRef.current.clear();
          break;
        }

        inFlightIdsRef.current.add(nextItem.id);
        dispatch({ type: 'SET_ITEM_PROCESSING', id: nextItem.id });

        // Cede controle para o navegador renderizar o status 'processing'
        await new Promise((resolve) => setTimeout(resolve, 30));

        if (cancelRequestedRef.current) break;

        const result = await gradePhotoFile(nextItem.file, {
          teacherPassword: teacherPasswordRef.current,
          lockedPayload: activePayloadRef.current,
          alwaysReadQr: true,
          availableVersions: availableVersionsRef.current,
        });

        if (result.payload && result.payloadSource === 'qr' && !activePayloadRef.current) {
          activePayloadRef.current = result.payload;
          onLockPayloadRef.current?.(result.payload);
        }

        dispatch({ type: 'FINISH_ITEM', id: nextItem.id, result });

        // Pequeno intervalo entre fotos para manter responsividade
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (state.isProcessing && !isRunningRef.current) {
      runQueue();
    }
  }, [state.isProcessing, runQueue]);

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    dispatch({ type: 'ADD_FILES', files: filesArray });
    cancelRequestedRef.current = false;
    inFlightIdsRef.current.clear();
    dispatch({ type: 'START_PROCESSING' });
  };

  const handleCancel = () => {
    cancelRequestedRef.current = true;
    inFlightIdsRef.current.clear();
    dispatch({ type: 'CANCEL_PROCESSING' });
  };

  const handleStart = () => {
    cancelRequestedRef.current = false;
    inFlightIdsRef.current.clear();
    dispatch({ type: 'START_PROCESSING' });
  };

  const handleRetryItem = (id: string) => {
    inFlightIdsRef.current.delete(id);
    dispatch({ type: 'RETRY_ITEM', id });
    cancelRequestedRef.current = false;
    dispatch({ type: 'START_PROCESSING' });
  };

  const handleSaveAllOk = () => {
    const okItems = state.items.filter((it) => it.status === 'ok' && it.result?.record);
    if (okItems.length === 0) return;

    const recordsToSave = okItems.map((it) => {
      const rec = it.result!.record!;
      return {
        ...rec,
        classId: it.classId || rec.classId || activeClassId || undefined,
        studentRef: it.studentRef ?? rec.studentRef,
        studentName: it.studentName?.trim() || rec.studentName,
        studentId: it.studentId?.trim() || rec.studentId,
      };
    });

    onSaveRecords(recordsToSave);
    dispatch({ type: 'MARK_ITEMS_SAVED', ids: okItems.map((it) => it.id) });
  };

  const handleConfirmSaveAllWithReview = () => {
    const eligibleItems = state.items.filter(
      (it) => (it.status === 'ok' || it.status === 'review') && it.result?.record
    );
    if (eligibleItems.length === 0) return;

    const recordsToSave = eligibleItems.map((it) => {
      const rec = it.result!.record!;
      return {
        ...rec,
        classId: it.classId || rec.classId || activeClassId || undefined,
        studentRef: it.studentRef ?? rec.studentRef,
        studentName: it.studentName?.trim() || rec.studentName,
        studentId: it.studentId?.trim() || rec.studentId,
      };
    });

    onSaveRecords(recordsToSave);
    dispatch({ type: 'MARK_ITEMS_SAVED', ids: eligibleItems.map((it) => it.id) });
    setConfirmSaveAllOpen(false);
  };

  const handleSaveSingleItem = (item: BatchItem) => {
    if (!item.result?.record) return;
    const rec = item.result.record;
    const finalized = {
      ...rec,
      classId: item.classId || rec.classId || activeClassId || undefined,
      studentRef: item.studentRef ?? rec.studentRef,
      studentName: item.studentName?.trim() || rec.studentName,
      studentId: item.studentId?.trim() || rec.studentId,
    };
    onSaveRecords([finalized]);
    dispatch({ type: 'MARK_SAVED', id: item.id });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const progressPercent =
    summary.total > 0
      ? Math.round((summary.processedCount / summary.total) * 100)
      : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-6">
      {/* Área de Seleção e Upload em Lote */}
      <div>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Files className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-800">
              Correção em Lote de Cartões-Resposta
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Selecione dezenas de fotos de uma vez para processamento sequencial.
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleAddFiles(e.target.files);
            if (e.target) e.target.value = '';
          }}
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/40'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-10 h-10 mx-auto text-indigo-600 mb-2 opacity-80" />
          <p className="text-sm font-bold text-slate-800">
            Clique aqui ou arraste várias fotos das folhas de respostas
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Formatos suportados: JPG, PNG, WEBP. Fotos de celulares em qualquer orientação são processadas automaticamente.
          </p>
        </div>

        {state.lastDuplicateCount !== undefined && state.lastDuplicateCount > 0 && (
          <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {state.lastDuplicateCount}{' '}
              {state.lastDuplicateCount === 1 ? 'arquivo repetido foi ignorado' : 'arquivos repetidos foram ignorados'}.
            </span>
          </div>
        )}
      </div>

      {/* Barra de Progresso e Sumário da Fila */}
      {summary.total > 0 && (
        <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                Progresso: {summary.processedCount} de {summary.total} fotos
              </span>
              <span className="text-slate-500 font-mono">({progressPercent}%)</span>
            </div>

            <div className="flex items-center gap-2">
              {state.isProcessing ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Pausar / Cancelar
                </button>
              ) : summary.queued > 0 ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-on-accent transition flex items-center gap-1.5 shadow-sm"
                >
                  <Files className="w-3.5 h-3.5" /> Continuar Fila ({summary.queued})
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => dispatch({ type: 'CLEAR_COMPLETED' })}
                disabled={summary.saved === 0 && summary.discarded === 0}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition disabled:opacity-40"
                title="Limpar itens já salvos ou descartados da lista"
              >
                Limpar concluídas
              </button>
            </div>
          </div>

          {/* Barra Visual */}
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Chips de Sumário */}
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-semibold text-slate-700">
              Total: {summary.total}
            </span>
            {summary.ok > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {summary.ok} OK
              </span>
            )}
            {summary.review > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 font-semibold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> {summary.review} Para Revisar
              </span>
            )}
            {summary.error > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 font-semibold text-rose-800 dark:text-rose-300">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> {summary.error} Com Erro
              </span>
            )}
            {summary.saved > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 font-semibold text-indigo-800">
                <Check className="w-3.5 h-3.5 text-indigo-600" /> {summary.saved} Salvas
              </span>
            )}
          </div>
        </div>
      )}

      {/* Lista de Itens da Fila */}
      {state.items.length > 0 && (
        <div className="space-y-3">
          <div className="max-h-[500px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {state.items.map((item, index) => {
              const rec = item.result?.record;
              const evidence = item.result?.evidence;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 text-xs transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    item.status === 'processing'
                      ? 'bg-indigo-50/40'
                      : item.status === 'review'
                      ? 'bg-amber-50/40'
                      : item.status === 'error'
                      ? 'bg-rose-50/30'
                      : item.status === 'saved'
                      ? 'opacity-70 bg-slate-50/50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Miniatura e Identificação */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <span className="font-mono text-slate-400 text-[11px] w-6 shrink-0">
                      #{index + 1}
                    </span>

                    {evidence?.sheetThumbUrl ? (
                      <img
                        src={evidence.sheetThumbUrl}
                        alt="Miniatura da folha"
                        className="w-12 h-16 object-cover rounded border border-slate-200 shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded border border-dashed border-slate-300 flex items-center justify-center shrink-0 bg-slate-50 text-slate-400">
                        {item.status === 'processing' ? (
                          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        ) : (
                          <Files className="w-5 h-5" />
                        )}
                      </div>
                    )}

                    <div className="space-y-0.5 max-w-[220px]">
                      <span className="font-bold text-slate-800 block truncate" title={item.file.name}>
                        {item.file.name}
                      </span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        {(item.file.size / 1024).toFixed(0)} KB
                      </span>

                      {rec && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-bold text-[10px] rounded">
                            Versão {rec.versionLetter}
                          </span>
                          <span className="font-mono font-bold text-slate-700 text-[11px]">
                            {rec.totalScore.toFixed(1)}/{rec.maxScore.toFixed(1)} pt
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Identificação do Aluno (Turma / Nome / Matrícula) */}
                  {item.status !== 'error' && item.status !== 'queued' && (
                    <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
                      {currentClass && currentClass.students.length > 0 && (
                        <select
                          aria-label="Selecionar aluno da turma"
                          disabled={item.status === 'saved' || item.status === 'discarded'}
                          value={item.studentRef ?? item.result?.record?.studentRef ?? ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            if (!selectedId) {
                              dispatch({
                                type: 'UPDATE_STUDENT_INFO',
                                id: item.id,
                                studentRef: undefined,
                              });
                              return;
                            }
                            const st = currentClass.students.find((s) => s.id === selectedId);
                            if (st) {
                              dispatch({
                                type: 'UPDATE_STUDENT_INFO',
                                id: item.id,
                                studentRef: st.id,
                                classId: currentClass.id,
                                studentName: st.name,
                                studentId: st.registration || '',
                              });
                            }
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          <option value="">
                            -- Selecionar de {currentClass.name} (ou digite abaixo) --
                          </option>
                          {currentClass.students.map((st) => {
                            const alreadyGradedInBook = records.some(
                              (r) =>
                                r.studentRef === st.id ||
                                (st.registration &&
                                  r.studentId &&
                                  r.studentId.trim().toLowerCase() ===
                                    st.registration.trim().toLowerCase())
                            );
                            const assignedInBatch = state.items.some(
                              (other) =>
                                other.id !== item.id &&
                                other.status !== 'discarded' &&
                                (other.studentRef ?? other.result?.record?.studentRef) === st.id
                            );
                            return (
                              <option key={st.id} value={st.id}>
                                {st.name}
                                {st.registration ? ` (${st.registration})` : ''}
                                {alreadyGradedInBook
                                  ? ' [Já corrigido]'
                                  : assignedInBatch
                                  ? ' [No lote]'
                                  : ''}
                              </option>
                            );
                          })}
                        </select>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nome do aluno"
                          disabled={item.status === 'saved' || item.status === 'discarded'}
                          value={item.studentName ?? item.result?.record?.studentName ?? ''}
                          onChange={(e) =>
                            dispatch({
                              type: 'UPDATE_STUDENT_INFO',
                              id: item.id,
                              studentName: e.target.value,
                              studentRef: undefined,
                            })
                          }
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <input
                          type="text"
                          placeholder="Matrícula"
                          disabled={item.status === 'saved' || item.status === 'discarded'}
                          value={item.studentId ?? item.result?.record?.studentId ?? ''}
                          onChange={(e) =>
                            dispatch({
                              type: 'UPDATE_STUDENT_INFO',
                              id: item.id,
                              studentId: e.target.value,
                              studentRef: undefined,
                            })
                          }
                          className="px-2.5 py-1 text-xs font-mono border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}

                  {/* Status e Motivo */}
                  <div className="flex flex-col items-start md:items-end gap-1 min-w-[130px]">
                    {item.status === 'queued' && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                        Na fila
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-600" /> Analisando...
                      </span>
                    )}
                    {item.status === 'ok' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> OK
                      </span>
                    )}
                    {item.status === 'review' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Revisar
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Erro
                      </span>
                    )}
                    {item.status === 'saved' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Salva no Livro
                      </span>
                    )}
                    {item.status === 'discarded' && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-400 line-through">
                        Descartada
                      </span>
                    )}

                    {item.reason && (
                      <span className="text-[10px] text-slate-500 max-w-[200px] text-left md:text-right">
                        {item.reason}
                      </span>
                    )}
                  </div>

                  {/* Ações por Item */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(item.status === 'review' || item.status === 'ok') && rec && (
                      <button
                        type="button"
                        onClick={() => setReviewingItem(item)}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition"
                        title="Abrir espelho para conferência manual"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" /> Revisar
                      </button>
                    )}

                    {item.status === 'ok' && (
                      <button
                        type="button"
                        onClick={() => handleSaveSingleItem(item)}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-on-accent transition shadow-sm flex items-center gap-1"
                        title="Salvar esta nota individualmente"
                      >
                        <Save className="w-3.5 h-3.5" /> Salvar
                      </button>
                    )}

                    {item.status === 'error' && (
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item.id)}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition"
                        title="Tentar ler novamente esta foto"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-indigo-600" /> Tentar de novo
                      </button>
                    )}

                    {item.status !== 'saved' && item.status !== 'discarded' && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'DISCARD_ITEM', id: item.id })}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Descartar esta foto do lote"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barra de Ações do Rodapé */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-3">
            <span className="text-xs text-slate-500">
              {summary.saved > 0 && `${summary.saved} ${summary.saved === 1 ? 'nota já gravada' : 'notas já gravadas'}.`}
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              {summary.canSaveOkCount > 0 && (
                <button
                  type="button"
                  onClick={handleSaveAllOk}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-on-accent rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" /> Salvar {summary.canSaveOkCount} aprovadas
                </button>
              )}

              {summary.pendingReview > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmSaveAllOpen(true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-on-accent rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                  title="Salva todas as notas, incluindo as que foram classificadas com dúvida"
                >
                  <AlertTriangle className="w-4 h-4" /> Salvar todas ({summary.canSaveOkCount + summary.pendingReview})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Salvar com Itens Pendentes de Revisão */}
      {confirmSaveAllOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-800">
                Salvar notas não revisadas?
              </h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Existem <strong>{summary.pendingReview} {summary.pendingReview === 1 ? 'folha' : 'folhas'}</strong> com dúvidas de marcação ou rasuras que ainda não foram verificadas manualmente. Deseja salvá-las mesmo assim?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSaveAllOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Voltar e revisar
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveAllWithReview}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-on-accent rounded-lg text-xs font-bold transition shadow-sm"
              >
                Sim, salvar todas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Revisão Individual de Item da Fila */}
      {reviewingItem && reviewingItem.result?.record && (
        <GradingModal
          initialRecord={reviewingItem.result.record}
          evidence={reviewingItem.result.evidence}
          classes={classes}
          activeClassId={activeClassId}
          onSelectActiveClass={onSelectActiveClass}
          records={records}
          onOpenClassManager={onOpenClassManager}
          onSave={(updatedRecord, options) => {
            if (options?.newStudentToClass && onAddStudentToClass) {
              onAddStudentToClass(options.newStudentToClass.classId, {
                name: options.newStudentToClass.name,
                registration: options.newStudentToClass.registration,
              });
            }
            onSaveRecords([updatedRecord]);
            dispatch({ type: 'MARK_SAVED', id: reviewingItem.id });
            setReviewingItem(null);
          }}
          onCancel={() => setReviewingItem(null)}
        />
      )}
    </div>
  );
};
