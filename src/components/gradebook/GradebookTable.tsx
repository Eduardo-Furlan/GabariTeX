import React, { useState } from 'react';
import { GradingRecord } from '../../types/exam';
import { exportGradebookToCsv } from '../../utils/storage';
import { Download, Trash2, ChevronDown, ChevronUp, Users, CheckCircle, XCircle } from 'lucide-react';

interface GradebookTableProps {
  records: GradingRecord[];
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
}

export const GradebookTable: React.FC<GradebookTableProps> = ({
  records,
  onDeleteRecord,
  onClearAll,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-800">Livro de Notas da Turma</h2>
          <span className="ml-2 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full">
            {records.length} {records.length === 1 ? 'prova corrigida' : 'provas corrigidas'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportGradebookToCsv(records)}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" /> Exportar para Excel / CSV
          </button>
          {records.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Histórico
            </button>
          )}
        </div>
      </div>

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
            <span className="text-2xl font-bold text-indigo-700">{averagePercentage.toFixed(1)}%</span>
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
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.percentage >= 50
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
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
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
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
                          <span className="font-semibold text-slate-700 block mb-2">
                            Resumo das Respostas:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {r.answers.map((a) => (
                              <div
                                key={a.questionNumber}
                                className={`p-2 rounded border flex flex-col items-center text-center ${
                                  a.isCorrect
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-rose-50 border-rose-200 text-rose-800'
                                }`}
                              >
                                <span className="font-bold">Q{a.questionNumber}</span>
                                <div className="flex items-center gap-1 my-0.5">
                                  {a.isCorrect ? (
                                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                  )}
                                  <span>{a.markedOption || '—'}</span>
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  Gab: {a.correctOption}
                                </span>
                              </div>
                            ))}
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
