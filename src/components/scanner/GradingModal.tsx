import React, { useState } from 'react';
import { GradingRecord } from '../../types/exam';
import { CheckCircle2, XCircle, AlertCircle, Award, Save, RefreshCw } from 'lucide-react';

interface GradingModalProps {
  initialRecord: GradingRecord;
  onSave: (record: GradingRecord) => void;
  onCancel: () => void;
}

export const GradingModal: React.FC<GradingModalProps> = ({
  initialRecord,
  onSave,
  onCancel,
}) => {
  const [record, setRecord] = useState<GradingRecord>(initialRecord);

  const handleSave = () => {
    onSave(record);
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 70) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (percentage >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Resultado da Correção</h3>
          </div>
          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 font-black text-xs rounded-md">
            VERSÃO {record.versionLetter}
          </span>
        </div>

        {/* Painel de Pontuação */}
        <div className="my-5 flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase block">Nota Final</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900">
                {record.totalScore.toFixed(2)}
              </span>
              <span className="text-sm font-medium text-slate-500">
                / {record.maxScore.toFixed(2)} pts
              </span>
            </div>
          </div>

          <div
            className={`px-4 py-2 rounded-xl border font-bold text-lg ${getScoreColor(
              record.percentage
            )}`}
          >
            {record.percentage.toFixed(1)}% de aproveitamento
          </div>
        </div>

        {/* Dados do Aluno */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Nome do Aluno(a)
            </label>
            <input
              type="text"
              placeholder="Digite o nome do aluno"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={record.studentName}
              onChange={(e) => setRecord({ ...record, studentName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Matrícula / RA
            </label>
            <input
              type="text"
              placeholder="Ex: 20261045"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={record.studentId}
              onChange={(e) => setRecord({ ...record, studentId: e.target.value })}
            />
          </div>
        </div>

        {/* Detalhamento Questão a Questão */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
            Espelho de Correção das Questões Objetivas:
          </label>
          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {record.answers.map((a) => (
              <div
                key={a.questionNumber}
                className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 w-8">Q{a.questionNumber}</span>
                  {a.status === 'correct' && (
                    <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Marcado:{' '}
                      {a.markedOption} (Correto)
                    </span>
                  )}
                  {a.status === 'wrong' && (
                    <span className="flex items-center gap-1 text-rose-700 font-semibold">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" /> Marcado: {a.markedOption} |
                      Gabarito: {a.correctOption}
                    </span>
                  )}
                  {a.status === 'blank' && (
                    <span className="flex items-center gap-1 text-amber-700 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Em Branco (Gabarito:{' '}
                      {a.correctOption})
                    </span>
                  )}
                  {a.status === 'multiple' && (
                    <span className="flex items-center gap-1 text-purple-700 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-purple-600" /> Rasura / Dupla
                      marcação
                    </span>
                  )}
                </div>

                <div className="font-mono font-bold text-slate-700">
                  {a.pointsEarned.toFixed(1)} / {a.maxPoints.toFixed(1)} pt
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Descartar / Escanear Novamente
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
          >
            <Save className="w-3.5 h-3.5" /> Salvar Nota no Livro
          </button>
        </div>
      </div>
    </div>
  );
};
