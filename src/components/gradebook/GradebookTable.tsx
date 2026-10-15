import React, { useState } from 'react';
import { GradingRecord, OptionLabel } from '../../types/exam';
import { exportGradebookToCsv, loadLastBackupDate } from '../../utils/storage';
import { applyManualOverride, revertOverride, recomputeTotals, ManualChoice } from '../../utils/grading';
import { AnswerChoiceGroup } from '../scanner/AnswerChoiceGroup';
import {
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle,
  XCircle,
  Pencil,
  RotateCcw,
  Database,
  ShieldAlert,
} from 'lucide-react';

interface GradebookTableProps {
  records: GradingRecord[];
  onUpdateRecord?: (record: GradingRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onOpenBackupPanel?: () => void;
}

export const GradebookTable: React.FC<GradebookTableProps> = ({
  records,
  onUpdateRecord,
  onDeleteRecord,
  onClearAll,
  onOpenBackupPanel,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const lastBackupDate = loadLastBackupDate();
  const daysSince = lastBackupDate
    ? Math.floor((Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isBackupStale = records.length > 0 && (daysSince === null || daysSince >= 7);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const averageScore =
    records.length > 0
      ? records.reduce((sum, r) => sum + r.totalScore, 0) / records.length
      : 0;

  const averagePercentage =
    records.length > 0
      ? records.reduce((sum, r) => sum + r.percentage, 0) / records.length
      : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-800">Livro de Notas da Turma</h2>
          <span className="ml-2 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold rounded-full">
            {records.length} {records.length === 1 ? 'prova corrigida' : 'provas corrigidas'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportGradebookToCsv(records)}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-on-accent rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Exportar para Excel / CSV
          </button>
          {records.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 dark:hover:text-red-400 rounded-lg text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Histórico
            </button>
          )}
        </div>
      </div>

      {/* Faixa de Lembrete de Backup */}
      {records.length > 0 && (
        <div
          className={`mb-5 px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between flex-wrap gap-2 transition ${
            isBackupStale
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {isBackupStale ? (
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Database className="w-4 h-4 text-indigo-500 shrink-0" />
            )}
            <span>
              {lastBackupDate
                ? `Último backup completo: ${daysSince === 0 ? 'hoje' : daysSince === 1 ? 'ontem' : `há ${daysSince} dias`}`
                : 'Último backup: nenhum realizado ainda'}
              {isBackupStale && ' — Recomendamos exportar um backup para proteger suas notas contra perdas.'}
            </span>
          </div>
          {onOpenBackupPanel && (
            <button
              type="button"
              onClick={onOpenBackupPanel}
              className={`font-bold text-xs underline transition ${
                isBackupStale
                  ? 'text-amber-800 dark:text-amber-300 hover:text-amber-950'
                  : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-800'
              }`}
            >
              Fazer backup agora
            </button>
          )}
        </div>
      )}

      {records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block">Total de Alunos</span>
            <span className="text-2xl font-bold text-slate-800">{records.length}</span>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block">Média da Turma (Pontos)</span>
            <span className="text-2xl font-bold text-slate-800">{averageScore.toFixed(2)} pts</span>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block">Aproveitamento Médio</span>
            <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{averagePercentage.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nenhuma prova corrigida ainda.</p>
          <p className="text-xs text-slate-400 mt-1">
            Utilize a aba &quot;Corretor OMR&quot; para escanear os cartões-resposta dos alunos.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Aluno</th>
                <th className="py-2.5 px-3">Matrícula</th>
                <th className="py-2.5 px-3 text-center">Versão</th>
                <th className="py-2.5 px-3 text-right">Nota</th>
                <th className="py-2.5 px-3 text-center">Aproveitamento</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="hover:bg-slate-50 transition cursor-pointer" onClick={() => toggleExpand(r.id)}>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {r.studentName || <span className="text-slate-400 italic">Não identificado</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 text-xs">
                      {r.studentId || '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 font-bold text-xs rounded border border-slate-200">
                        {r.versionLetter}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {r.totalScore.toFixed(2)} / {r.maxScore.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          r.percentage >= 70
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : r.percentage >= 50
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                        }`}
                      >
                        {r.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(r.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Ver detalhes"
                        >
                          {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                          title="Excluir nota"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedId === r.id && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={6} className="p-4">
                        <div className="text-xs">
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <span className="font-semibold text-slate-700 block">
                              Resumo e Edição das Respostas:
                            </span>
                            {onUpdateRecord && (
                              <span className="text-[11px] text-slate-500">
                                Clique nos seletores abaixo para corrigir qualquer alternativa diretamente no livro.
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {r.answers.map((a) => {
                              const currentChoice: ManualChoice =
                                a.status === 'blank'
                                  ? 'BLANK'
                                  : a.status === 'multiple'
                                  ? 'INVALID'
                                  : (a.markedOption as OptionLabel) || 'BLANK';

                              return (
                                <div
                                  key={a.questionNumber}
                                  className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 ${
                                    a.isCorrect
                                      ? 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/60'
                                      : 'bg-rose-50/60 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/60'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-800">Q{a.questionNumber}</span>
                                      {a.manualOverride && (
                                        <span
                                          className="flex items-center gap-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-1 py-0.5 rounded font-semibold"
                                          title={`Ajustado manualmente (original: ${a.detectedOption || '—'})`}
                                        >
                                          <Pencil className="w-2.5 h-2.5" /> Editado
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {a.isCorrect ? (
                                        <span className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 font-bold">
                                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                          {a.markedOption}
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-0.5 text-rose-700 dark:text-rose-300 font-bold">
                                          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                          {a.markedOption || (a.status === 'multiple' ? 'Rasura' : 'Branco')}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-500 ml-1">
                                        (Gab: {a.correctOption})
                                      </span>
                                    </div>
                                  </div>

                                  {onUpdateRecord ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 mt-1 gap-1">
                                      <AnswerChoiceGroup
                                        size="sm"
                                        value={currentChoice}
                                        onChange={(choice) => {
                                          const updatedAnswers = r.answers.map((ans) =>
                                            ans.questionNumber === a.questionNumber
                                              ? applyManualOverride(ans, choice)
                                              : ans
                                          );
                                          onUpdateRecord(recomputeTotals({ ...r, answers: updatedAnswers }));
                                        }}
                                      />
                                      {a.manualOverride && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedAnswers = r.answers.map((ans) =>
                                              ans.questionNumber === a.questionNumber
                                                ? revertOverride(ans)
                                                : ans
                                            );
                                            onUpdateRecord(recomputeTotals({ ...r, answers: updatedAnswers }));
                                          }}
                                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 transition"
                                          title="Restaurar valor detectado originalmente"
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-500 text-right">
                                      {a.pointsEarned.toFixed(1)} / {a.maxPoints.toFixed(1)} pt
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
