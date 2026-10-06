import React from 'react';
import { ExamHeader, ExamVersion } from '../../types/exam';

interface SolutionSheetViewProps {
  versions: ExamVersion[];
  header: ExamHeader;
}

export const SolutionSheetView: React.FC<SolutionSheetViewProps> = ({ versions, header }) => {
  return (
    <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-300 max-w-[210mm] mx-auto my-6 text-black avoid-break">
      <div className="border-b-2 border-black pb-3 mb-4 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wider">Gabarito Oficial do Professor</h1>
        <h2 className="text-sm font-semibold text-slate-800">
          {header.institution} — {header.course} ({header.examTitle})
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Docente: {header.professor} | Data: {header.date}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {versions.map((v) => {
          return (
            <div key={v.versionLetter} className="border-2 border-slate-800 rounded-lg p-3 bg-slate-50/50">
              <div className="text-center pb-2 mb-2 border-b-2 border-slate-800">
                <span className="text-xs font-bold text-slate-600 block">Tipo de Prova</span>
                <span className="text-lg font-black text-indigo-900">VERSÃO {v.versionLetter}</span>
              </div>

              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500">
                    <th className="py-1 text-left">Questão</th>
                    <th className="py-1 text-right">Gabarito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {v.questions.map((q, idx) => {
                    const qNum = idx + 1;
                    const opt = v.objectiveAnswerKey[qNum];
                    return (
                      <tr key={q.id} className="hover:bg-slate-100">
                        <td className="py-1 font-bold text-slate-700">Q{qNum}</td>
                        <td className="py-1 text-right">
                          {q.type === 'objective' ? (
                            <span className="inline-block w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-center leading-6">
                              {opt || '-'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic font-sans font-medium">
                              Questão dissertativa
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};
