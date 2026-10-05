import React from 'react';
import { ExamHeader, ExamVersion } from '../../types/exam';
import { MathView } from '../MathView';

interface ExamPrintViewProps {
  version: ExamVersion;
  header: ExamHeader;
  twoColumns?: boolean;
}

export const ExamPrintView: React.FC<ExamPrintViewProps> = ({
  version,
  header,
  twoColumns = false,
}) => {
  return (
    <div className="a4-sheet text-black font-serif leading-normal flex flex-col justify-between">
      <div>
        {/* Cabeçalho Oficial do Caderno de Questões */}
        <div className="border-b-2 border-black pb-3 mb-5 font-sans">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-4">
              <h1 className="text-base font-extrabold uppercase tracking-wider text-black">
                {header.institution || 'Instituição de Ensino'}
              </h1>
              <h2 className="text-sm font-bold text-slate-800">
                {header.course || 'Disciplina'} — {header.examTitle || 'Avaliação'}
              </h2>
              <div className="text-xs text-slate-700 mt-1 flex items-center gap-3">
                <span>Docente: <strong>{header.professor || 'Docente'}</strong></span>
                <span>•</span>
                <span>Data: <strong>{header.date || '___/___/______'}</strong></span>
              </div>
            </div>

            <div className="text-center border-2 border-black px-4 py-1.5 bg-slate-50 shrink-0">
              <span className="block text-[10px] uppercase font-bold text-slate-500">Caderno</span>
              <span className="text-xl font-black">VERSÃO {version.versionLetter}</span>
            </div>
          </div>

          {/* Campo de Identificação Rápida */}
          <div className="mt-3 pt-2 border-t border-slate-300 text-xs flex justify-between gap-6">
            <div className="flex-1 flex items-baseline">
              <span className="font-bold mr-2">Aluno(a):</span>
              <div className="border-b border-black flex-1" />
            </div>
            <div className="w-48 flex items-baseline">
              <span className="font-bold mr-2">Matrícula:</span>
              <div className="border-b border-black flex-1" />
            </div>
          </div>

          {header.instructions && (
            <div className="mt-2 text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-300 leading-snug">
              <strong>Instruções: </strong>
              <MathView content={header.instructions} />
            </div>
          )}
        </div>

        {/* Questões */}
        {version.questions.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-serif italic text-sm">
            Nenhuma questão adicionada a esta prova ainda.
          </div>
        ) : (
          <div className={twoColumns ? 'two-column-layout' : 'space-y-6'}>
            {version.questions.map((q, idx) => (
              <div key={q.id} className="avoid-break mb-6 text-sm">
                <div className="font-sans font-bold text-slate-900 mb-1 flex items-baseline gap-1.5">
                  <span className="text-sm">Questão {idx + 1}.</span>
                  <span className="text-xs font-normal text-slate-600">({q.points.toFixed(1)} pt)</span>
                </div>

                <div className="text-justify leading-relaxed mb-2 font-serif text-[13.5px]">
                  <MathView content={q.prompt} />
                </div>

                {q.imageUrl && (
                  <div className="my-3 text-center avoid-break">
                    <img
                      src={q.imageUrl}
                      alt={q.imageCaption || `Figura Questão ${idx + 1}`}
                      className="max-h-48 mx-auto rounded border border-slate-200"
                    />
                    {q.imageCaption && (
                      <p className="text-xs text-slate-600 italic mt-1 font-sans">
                        {q.imageCaption}
                      </p>
                    )}
                  </div>
                )}

                {q.type === 'objective' && q.options && (
                  <div className="space-y-1.5 pl-2 font-sans text-xs">
                    {q.options.map((opt) => (
                      <div key={opt.id} className="flex items-start gap-2">
                        <span className="font-bold min-w-[18px]">({opt.label})</span>
                        <div className="flex-1">
                          <MathView content={opt.text} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'subjective' && (
                  <div className="mt-3 pl-1 font-sans">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Espaço para Resposta / Demonstração:
                    </span>
                    <div className="space-y-3.5 border-t border-slate-300 pt-1">
                      {Array.from({ length: q.linesForAnswer || 8 }).map((_, lineIdx) => (
                        <div key={lineIdx} className="border-b border-slate-300 h-3" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé do Caderno */}
      <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-sans mt-6">
        <span>{header.institution || 'Avaliação Acadêmica'} — {header.course}</span>
        <span>Caderno de Questões | Versão {version.versionLetter}</span>
      </div>
    </div>
  );
};
