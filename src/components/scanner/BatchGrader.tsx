import React, { useReducer, useRef, useState, useEffect, useCallback } from 'react';
import * as m from 'motion/react-m';
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
  Eye,
  Check,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import {
  RemoteSessionInfo,
  NetworkInterfaceInfo,
  startRemoteCamera,
  stopRemoteCamera,
  getRemoteCameraStatus,
  getNetworkInterfaces,
  reportRemotePhoto,
  mapPhotoResultToReport,
  listenRemotePhotos,
  listenRemoteStopped,
} from '../../platform/remoteCamera';
import { getFileSignature } from '../../utils/batchQueue';
import { RemoteCameraPanel } from './RemoteCameraPanel';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Modal } from '../ui/Modal';
import { ProgressBar } from '../ui/ProgressBar';
import { CountUp } from '../ui/CountUp';
import { Bubble } from '../ui/Bubble';
import { BubbleLoader } from '../ui/BubbleLoader';

export interface BatchGraderProps {
  teacherPassword: string;
  candidatePasswords?: string[];
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
  onOpenRemoteCamera?: () => void;
  onRunningChange?: (isRunning: boolean) => void;
  incomingRemotePhoto?: {
    file: File;
    id: string;
    target?: 'qr' | 'sheet';
    timestamp: number;
  } | null;
  remoteReceivedCount?: number;
}

export const BatchGrader: React.FC<BatchGraderProps> = ({
  teacherPassword,
  candidatePasswords,
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
  onOpenRemoteCamera,
  onRunningChange,
  incomingRemotePhoto,
  remoteReceivedCount: propsReceivedCount = 0,
}) => {
  const [state, dispatch] = useReducer(batchReducer, initialBatchState);
  const [reviewingItem, setReviewingItem] = useState<BatchItem | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [confirmSaveAllOpen, setConfirmSaveAllOpen] = useState<boolean>(false);

  // Estado da Câmera Remota Desktop (Plano 13)
  const [remotePanelOpen, setRemotePanelOpen] = useState<boolean>(false);
  const [remoteSession, setRemoteSession] = useState<RemoteSessionInfo | null>(null);
  const [isStartingRemote, setIsStartingRemote] = useState<boolean>(false);
  const [localRemoteReceivedCount, setLocalRemoteReceivedCount] = useState<number>(0);
  const effectiveReceivedCount = propsReceivedCount || localRemoteReceivedCount;
  const [availableInterfaces, setAvailableInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const remoteIdBySignatureRef = useRef<Map<string, string>>(new Map());
  const remoteTargetBySignatureRef = useRef<Map<string, 'qr' | 'sheet'>>(new Map());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRequestedRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const inFlightIdsRef = useRef<Set<string>>(new Set());

  const itemsRef = useRef(state.items);
  itemsRef.current = state.items;

  const teacherPasswordRef = useRef(teacherPassword);
  teacherPasswordRef.current = teacherPassword;

  const candidatePasswordsRef = useRef(candidatePasswords);
  candidatePasswordsRef.current = candidatePasswords;

  const activePayloadRef = useRef(activePayload);
  activePayloadRef.current = activePayload;

  const availableVersionsRef = useRef(availableVersions);
  availableVersionsRef.current = availableVersions;

  const onLockPayloadRef = useRef(onLockPayload);
  onLockPayloadRef.current = onLockPayload;

  // Sincroniza flag de lote ativo com a aplicação para evitar fechamento acidental
  useEffect(() => {
    onRunningChange?.(state.isProcessing);
  }, [state.isProcessing, onRunningChange]);

  // Listener para fotos recebidas da Câmera Remota em lote
  const handleEnqueueRemotePhoto = useCallback(
    (file: File, remoteId?: string, target?: 'qr' | 'sheet') => {
      const sig = getFileSignature(file);
      if (remoteId) {
        remoteIdBySignatureRef.current.set(sig, remoteId);
      }
      if (target) {
        remoteTargetBySignatureRef.current.set(sig, target);
      }
      dispatch({ type: 'ADD_FILES', files: [file] });
      cancelRequestedRef.current = false;
      inFlightIdsRef.current.clear();
      dispatch({ type: 'START_PROCESSING' });
    },
    []
  );

  useEffect(() => {
    if (!incomingRemotePhoto) return;
    const { file, id, target } = incomingRemotePhoto;
    handleEnqueueRemotePhoto(file, id, target);
  }, [incomingRemotePhoto, handleEnqueueRemotePhoto]);

  useEffect(() => {
    if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) return;
    getRemoteCameraStatus().then((s) => {
      if (s) setRemoteSession(s);
    });
    getNetworkInterfaces().then((list) => {
      setAvailableInterfaces(list);
    });

    let unlistenStopped: (() => void) | undefined;
    listenRemoteStopped(() => {
      setRemoteSession(null);
    }).then((un) => {
      unlistenStopped = un;
    });

    let unlistenPhotos: (() => void) | undefined;
    listenRemotePhotos(async (file, id, target) => {
      setLocalRemoteReceivedCount((c) => c + 1);
      handleEnqueueRemotePhoto(file, id, target);
    }).then((un) => {
      unlistenPhotos = un;
    });

    return () => {
      if (unlistenStopped) unlistenStopped();
      if (unlistenPhotos) unlistenPhotos();
    };
  }, [handleEnqueueRemotePhoto]);

  const handleStartRemote = async (ip?: string) => {
    if (!__DESKTOP__) return;
    setIsStartingRemote(true);
    try {
      const s = await startRemoteCamera(ip);
      setRemoteSession(s);
    } finally {
      setIsStartingRemote(false);
    }
  };

  const handleStopRemote = async () => {
    if (__DESKTOP__) {
      await stopRemoteCamera();
    }
    setRemoteSession(null);
  };

  const handleChangeRemoteInterface = async (ip: string) => {
    if (!__DESKTOP__) return;
    setIsStartingRemote(true);
    try {
      const s = await startRemoteCamera(ip);
      setRemoteSession(s);
    } finally {
      setIsStartingRemote(false);
    }
  };

  // Motor sequencial de processamento da fila
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

        const itemTarget =
          remoteTargetBySignatureRef.current.get(nextItem.signature) ||
          (activePayloadRef.current ? 'sheet' : 'qr');

        const result = await gradePhotoFile(nextItem.file, {
          teacherPassword: teacherPasswordRef.current,
          candidatePasswords: candidatePasswordsRef.current,
          lockedPayload: activePayloadRef.current,
          scanTarget: itemTarget,
          alwaysReadQr: false,
          availableVersions: availableVersionsRef.current,
        });

        if (result.status === 'qr_only' && result.payload) {
          activePayloadRef.current = result.payload;
          onLockPayloadRef.current?.(result.payload);
        } else if (result.status === 'graded' && result.payload && !activePayloadRef.current) {
          activePayloadRef.current = result.payload;
          onLockPayloadRef.current?.(result.payload);
        }

        dispatch({ type: 'FINISH_ITEM', id: nextItem.id, result });

        // Reporta resultado de volta para o celular se a foto veio da câmera remota
        if (typeof __DESKTOP__ !== 'undefined' && __DESKTOP__) {
          const remoteId = remoteIdBySignatureRef.current.get(nextItem.signature);
          if (remoteId) {
            const report = mapPhotoResultToReport(result);
            reportRemotePhoto(remoteId, report.status, report.label, report.message).catch(() => {});
          }
        }

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

  const handleAddFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    dispatch({ type: 'ADD_FILES', files: filesArray });
    cancelRequestedRef.current = false;
    inFlightIdsRef.current.clear();
    dispatch({ type: 'START_PROCESSING' });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
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

  const handleStart = () => {
    cancelRequestedRef.current = false;
    dispatch({ type: 'START_PROCESSING' });
  };

  const handleCancel = () => {
    cancelRequestedRef.current = true;
    inFlightIdsRef.current.clear();
    dispatch({ type: 'CANCEL_PROCESSING' });
  };

  const handleRetryItem = (id: string) => {
    inFlightIdsRef.current.delete(id);
    dispatch({ type: 'RETRY_ITEM', id });
    cancelRequestedRef.current = false;
    dispatch({ type: 'START_PROCESSING' });
  };

  const summary = getBatchSummary(state.items);
  const progressPercent = summary.total > 0 ? Math.round((summary.processedCount / summary.total) * 100) : 0;

  const currentClass = classes.find((c) => c.id === activeClassId);

  const buildFinalRecord = (item: BatchItem): GradingRecord | null => {
    const raw = item.result?.record;
    if (!raw) return null;

    const chosenClassId = item.classId ?? activeClassId ?? raw.classId;
    const chosenStudentRef = item.studentRef ?? raw.studentRef;
    const chosenName = item.studentName ?? raw.studentName;
    const chosenId = item.studentId ?? raw.studentId;

    return {
      ...raw,
      classId: chosenClassId || undefined,
      studentRef: chosenStudentRef || undefined,
      studentName: chosenName,
      studentId: chosenId,
    };
  };

  const handleSaveAllOk = () => {
    const okItems = state.items.filter((it) => it.status === 'ok' && it.result?.record);
    const toSave: GradingRecord[] = [];
    const ids: string[] = [];

    for (const it of okItems) {
      const rec = buildFinalRecord(it);
      if (rec) {
        toSave.push(rec);
        ids.push(it.id);
      }
    }

    if (toSave.length > 0) {
      onSaveRecords(toSave);
      for (const id of ids) {
        dispatch({ type: 'MARK_SAVED', id });
      }
    }
  };

  const handleConfirmSaveAllWithReview = () => {
    const candidates = state.items.filter(
      (it) => (it.status === 'ok' || it.status === 'review') && it.result?.record
    );
    const toSave: GradingRecord[] = [];
    const ids: string[] = [];

    for (const it of candidates) {
      const rec = buildFinalRecord(it);
      if (rec) {
        toSave.push(rec);
        ids.push(it.id);
      }
    }

    if (toSave.length > 0) {
      onSaveRecords(toSave);
      for (const id of ids) {
        dispatch({ type: 'MARK_SAVED', id });
      }
    }

    setConfirmSaveAllOpen(false);
  };

  const handleSaveSingleItem = (item: BatchItem) => {
    const rec = buildFinalRecord(item);
    if (!rec) return;

    onSaveRecords([rec]);
    dispatch({ type: 'MARK_SAVED', id: item.id });
  };

  return (
    <div className="bg-white rounded-card shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header do Lote */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Files className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-body font-display font-bold text-slate-900">
              Correção Contínua em Lote
            </h3>
            <p className="text-meta text-slate-500 font-medium">
              Fotografe várias provas seguidas ou selecione dezenas de arquivos de uma vez
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof __DESKTOP__ !== 'undefined' && __DESKTOP__ && (
            <Button
              variant={remoteSession ? 'secondary' : 'primary'}
              size="sm"
              onClick={onOpenRemoteCamera || (() => setRemotePanelOpen(true))}
            >
              {remoteSession ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Celular Conectado
                </span>
              ) : (
                'Parear Câmera do Celular'
              )}
            </Button>
          )}

          {summary.queued > 0 && !state.isProcessing && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStart}
              icon={<Files className="w-4 h-4" />}
            >
              Iniciar Leitura ({summary.queued})
            </Button>
          )}

          {state.isProcessing && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              icon={<AlertTriangle className="w-4 h-4" />}
            >
              Pausar Fila
            </Button>
          )}
        </div>
      </div>

      {/* Dropzone de Inclusão de Arquivos */}
      <div>
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
          className={`border-2 border-dashed rounded-card p-8 text-center cursor-pointer transition transform ${
            isDragging
              ? 'border-indigo-600 bg-indigo-50/60 scale-[1.01]'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-10 h-10 mx-auto text-indigo-600 mb-2 opacity-80" />
          <p className="text-body font-bold text-slate-800">
            Clique aqui ou arraste várias fotos das folhas de respostas
          </p>
          <p className="text-meta text-slate-500 mt-1">
            Formatos suportados: JPG, PNG, WEBP. Fotos de celulares em qualquer orientação são processadas automaticamente.
          </p>
        </div>

        {state.lastDuplicateCount !== undefined && state.lastDuplicateCount > 0 && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-meta text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {state.lastDuplicateCount}{' '}
              {state.lastDuplicateCount === 1 ? 'arquivo repetido foi ignorado' : 'arquivos repetidos foram ignorados'}.
            </span>
          </div>
        )}
      </div>

      {/* Barra de Progresso e Sumário da Fila com CountUp e ProgressBar */}
      {summary.total > 0 && (
        <div className="space-y-3 p-4 rounded-card border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between flex-wrap gap-2 text-meta">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                Progresso: <CountUp value={summary.processedCount} /> de <CountUp value={summary.total} /> fotos
              </span>
              <span className="text-slate-500 font-mono tabular-nums">
                (<CountUp value={progressPercent} />%)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {state.isProcessing ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleCancel}
                  icon={<AlertTriangle className="w-3.5 h-3.5" />}
                >
                  Pausar / Cancelar
                </Button>
              ) : summary.queued > 0 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStart}
                  icon={<Files className="w-3.5 h-3.5" />}
                >
                  Continuar Fila ({summary.queued})
                </Button>
              ) : null}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: 'CLEAR_COMPLETED' })}
                disabled={summary.saved === 0 && summary.discarded === 0}
              >
                Limpar concluídas
              </Button>
            </div>
          </div>

          {/* Barra Visual com ProgressBar primitive */}
          <ProgressBar
            value={progressPercent}
            tone={progressPercent === 100 ? 'ok' : 'accent'}
          />

          {/* Chips de Sumário com CountUp */}
          <div className="flex items-center gap-2 flex-wrap pt-1 text-meta">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-semibold text-slate-700 tabular-nums">
              Total: <CountUp value={summary.total} />
            </span>
            {summary.ok > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 font-semibold text-emerald-800 tabular-nums">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> <CountUp value={summary.ok} /> OK
              </span>
            )}
            {summary.review > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 font-semibold text-amber-900 tabular-nums">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> <CountUp value={summary.review} /> Para Revisar
              </span>
            )}
            {summary.error > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 font-semibold text-rose-800 tabular-nums">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> <CountUp value={summary.error} /> Com Erro
              </span>
            )}
            {summary.saved > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 font-semibold text-indigo-800 tabular-nums">
                <Check className="w-3.5 h-3.5 text-indigo-600" /> <CountUp value={summary.saved} /> Salvas
              </span>
            )}
          </div>
        </div>
      )}

      {/* Lista de Itens da Fila com m.ul e m.li layout="position" */}
      {state.items.length > 0 && (
        <div className="space-y-3">
          <m.ul className="max-h-[500px] overflow-y-auto border border-slate-200 rounded-card divide-y divide-slate-100 bg-white">
            {state.items.map((item, index) => {
              const rec = item.result?.record;
              const evidence = item.result?.evidence;

              return (
                <m.li
                  key={item.id}
                  layout="position"
                  className={`p-3.5 text-body transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
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
                  {/* Miniatura, Status Bubble e Identificação */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="shrink-0 flex items-center justify-center w-6">
                      {item.status === 'queued' && (
                        <Bubble state="empty" size="sm" label="Na fila" />
                      )}
                      {item.status === 'processing' && (
                        <BubbleLoader size="sm" />
                      )}
                      {item.status === 'ok' && (
                        <Bubble state="correct" size="sm" label="OK" />
                      )}
                      {item.status === 'review' && (
                        <Bubble state="review" size="sm" label="Para revisar" />
                      )}
                      {item.status === 'error' && (
                        <Bubble state="wrong" size="sm" label="Erro" />
                      )}
                      {item.status === 'saved' && (
                        <Bubble state="correct" size="sm" label="Salva" />
                      )}
                      {item.status === 'discarded' && (
                        <Bubble state="empty" size="sm" label="Descartada" />
                      )}
                    </div>

                    <span className="font-mono text-slate-400 text-meta w-6 shrink-0 tabular-nums">
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
                          <BubbleLoader size="sm" />
                        ) : (
                          <Files className="w-5 h-5" />
                        )}
                      </div>
                    )}

                    <div className="space-y-0.5 max-w-[220px]">
                      <span className="font-bold text-slate-800 block truncate" title={item.file.name}>
                        {item.file.name}
                      </span>
                      <span className="text-meta text-slate-400 block font-mono tabular-nums">
                        {(item.file.size / 1024).toFixed(0)} KB
                      </span>

                      {rec && (
                        <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-bold text-[10px] rounded">
                            Versão {rec.versionLetter}
                          </span>
                          {rec.examId && (
                            <span
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-mono text-[10px] rounded"
                              title={`ID da Prova: ${rec.examId}`}
                            >
                              {rec.examId.length > 8 ? rec.examId.slice(0, 8) : rec.examId}
                            </span>
                          )}
                          <span className="font-mono font-bold text-slate-700 text-meta tabular-nums">
                            {rec.totalScore.toFixed(1)}/{rec.maxScore.toFixed(1)} pt
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Identificação do Aluno (Turma / Nome / Matrícula) */}
                  {item.status !== 'error' && item.status !== 'queued' && (
                    <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
                      {currentClass && currentClass.students && currentClass.students.length > 0 && (
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
                            const st = currentClass.students?.find((s) => s.id === selectedId);
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
                          className="px-2 py-1 text-meta border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          <option value="">
                            -- Selecionar de {currentClass.name} (ou digite abaixo) --
                          </option>
                          {(currentClass.students || []).map((st) => {
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
                          className="px-2.5 py-1 text-meta border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
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
                          className="px-2.5 py-1 text-meta font-mono border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}

                  {/* Status e Motivo */}
                  <div className="flex flex-col items-start md:items-end gap-1 min-w-[130px]">
                    {item.status === 'queued' && (
                      <span className="px-2 py-0.5 rounded text-meta font-semibold bg-slate-100 text-slate-600">
                        Na fila
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-meta font-semibold bg-indigo-50 text-indigo-700 animate-pulse">
                        <BubbleLoader size="sm" /> Analisando...
                      </span>
                    )}
                    {item.status === 'ok' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-meta font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> OK
                      </span>
                    )}
                    {item.status === 'review' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-meta font-semibold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Revisar
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-meta font-semibold bg-rose-100 text-rose-800">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Erro
                      </span>
                    )}
                    {item.status === 'saved' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-meta font-semibold bg-slate-200 text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Salva no Livro
                      </span>
                    )}
                    {item.status === 'discarded' && (
                      <span className="px-2 py-0.5 rounded text-meta font-semibold bg-slate-100 text-slate-400 line-through">
                        Descartada
                      </span>
                    )}

                    {item.reason && (
                      <span className="text-meta text-slate-500 max-w-[200px] text-left md:text-right">
                        {item.reason}
                      </span>
                    )}
                  </div>

                  {/* Ações por Item */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(item.status === 'review' || item.status === 'ok') && rec && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setReviewingItem(item)}
                        icon={<Eye className="w-3.5 h-3.5 text-indigo-600" />}
                        title="Abrir espelho para conferência manual"
                      >
                        Revisar
                      </Button>
                    )}

                    {item.status === 'ok' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSaveSingleItem(item)}
                        icon={<Save className="w-3.5 h-3.5" />}
                        title="Salvar esta nota individualmente"
                      >
                        Salvar
                      </Button>
                    )}

                    {item.status === 'error' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRetryItem(item.id)}
                        icon={<RotateCcw className="w-3.5 h-3.5 text-indigo-600" />}
                        title="Tentar ler novamente esta foto"
                      >
                        Tentar de novo
                      </Button>
                    )}

                    {item.status !== 'saved' && item.status !== 'discarded' && (
                      <IconButton
                        label="Descartar esta foto do lote"
                        size="sm"
                        tone="danger"
                        onClick={() => dispatch({ type: 'DISCARD_ITEM', id: item.id })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconButton>
                    )}
                  </div>
                </m.li>
              );
            })}
          </m.ul>

          {/* Barra de Ações do Rodapé */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 flex-wrap gap-3">
            <span className="text-meta text-slate-500">
              {summary.saved > 0 && `${summary.saved} ${summary.saved === 1 ? 'nota já gravada' : 'notas já gravadas'}.`}
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              {summary.canSaveOkCount > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAllOk}
                  icon={<FileCheck className="w-4 h-4" />}
                >
                  Salvar {summary.canSaveOkCount} aprovadas
                </Button>
              )}

              {summary.pendingReview > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmSaveAllOpen(true)}
                  icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                  title="Salva todas as notas, incluindo as que foram classificadas com dúvida"
                >
                  Salvar todas ({summary.canSaveOkCount + summary.pendingReview})
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Salvar com Itens Pendentes de Revisão */}
      <Modal
        open={confirmSaveAllOpen}
        onOpenChange={(open) => setConfirmSaveAllOpen(open)}
        title="Salvar notas não revisadas?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmSaveAllOpen(false)}
            >
              Voltar e revisar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmSaveAllWithReview}
            >
              Sim, salvar todas
            </Button>
          </div>
        }
      >
        <p className="text-meta text-slate-600 leading-relaxed pt-1">
          Existem <strong>{summary.pendingReview} {summary.pendingReview === 1 ? 'folha' : 'folhas'}</strong> com dúvidas de marcação ou rasuras que ainda não foram verificadas manualmente. Deseja salvá-las mesmo assim?
        </p>
      </Modal>

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

      {typeof __DESKTOP__ !== 'undefined' && __DESKTOP__ && !onOpenRemoteCamera && (
        <RemoteCameraPanel
          isOpen={remotePanelOpen}
          onClose={() => setRemotePanelOpen(false)}
          session={remoteSession}
          isStarting={isStartingRemote}
          receivedCount={effectiveReceivedCount}
          availableInterfaces={availableInterfaces}
          onStart={handleStartRemote}
          onStop={handleStopRemote}
          onChangeInterface={handleChangeRemoteInterface}
        />
      )}
    </div>
  );
};
