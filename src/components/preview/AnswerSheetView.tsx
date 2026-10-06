import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ExamHeader, ExamVersion } from '../../types/exam';

interface AnswerSheetViewProps {
  version: ExamVersion;
  header: ExamHeader;
}

export const AnswerSheetView: React.FC<AnswerSheetViewProps> = ({ version, header }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (version.encryptedQrPayload) {
      QRCode.toDataURL(version.encryptedQrPayload, {
        width: 500,
        margin: 3,
        errorCorrectionLevel: 'L',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Erro ao gerar QR code', err));
    }
  }, [version.encryptedQrPayload]);

  const allQuestions = version.questions;
  const totalQuestions = allQuestions.length;
  const optionsList: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

  // Organiza em 1 ou 2 colunas dependendo da quantidade de questões
  const questionsPerCol = totalQuestions <= 12 ? totalQuestions : Math.ceil(totalQuestions / 2);
  const column1 = allQuestions.slice(0, questionsPerCol);
  const column2 = allQuestions.slice(questionsPerCol);

  return (
    <div className="a4-sheet answer-sheet-print text-black font-sans flex flex-col justify-between relative">
      {/* 4 Marcadores Fiduciais nos Cantos da Folha A4 */}
      <div className="absolute top-2.5 left-2.5 w-7 h-7 bg-black flex items-center justify-center">
        <div className="w-2.5 h-2.5 bg-white" />
      </div>

      <div className="absolute top-2.5 right-2.5 w-7 h-7 bg-black flex items-center justify-center">
        <div className="w-2.5 h-2.5 bg-white" />
      </div>

      <div className="absolute bottom-2.5 left-2.5 w-7 h-7 bg-black flex items-center justify-center">
        <div className="w-2.5 h-2.5 bg-white" />
      </div>

      <div className="absolute bottom-2.5 right-2.5 w-7 h-7 bg-black flex items-center justify-center">
        <div className="w-2.5 h-2.5 bg-white" />
      </div>

      {/* Conteúdo Interno da Folha A4 com margem segura contra colisão dos fiduciais */}
      <div className="px-12 py-2 flex-1 flex flex-col justify-between">
        {/* Cabeçalho Oficial */}
        <div>
          <div className="flex items-start justify-between border-b-2 border-black pb-3">
            <div className="flex-1 pr-4">
              <h1 className="text-lg font-black uppercase tracking-wider text-black">
                {header.institution || 'Instituição de Ensino'}
              </h1>
              <h2 className="text-sm font-bold text-slate-800 mt-0.5">
                {header.course || 'Disciplina'} — {header.examTitle || 'Avaliação'}
              </h2>
              <div className="text-xs text-slate-700 mt-1 flex items-center gap-3">
                <span>Docente: <strong>{header.professor || 'Docente'}</strong></span>
                <span>•</span>
                <span>Data: <strong>{header.date || '___/___/______'}</strong></span>
              </div>
              <div className="mt-2 inline-block bg-black text-white px-3 py-0.5 text-xs font-bold uppercase tracking-wider">
                Folha Oficial de Respostas (Cartão-Resposta)
              </div>
            </div>

            {/* Versão da Prova e QR Code Criptografado */}
            <div className="flex flex-col items-center pl-4 border-l border-slate-300">
              <div className="text-center mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Caderno de Prova
                </span>
                <span className="inline-block px-3 py-0.5 border-2 border-black text-xl font-black bg-slate-100">
                  VERSÃO {version.versionLetter}
                </span>
              </div>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`QR Code Versão ${version.versionLetter}`}
                  className="w-24 h-24 bg-white"
                />
              )}
              <span className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">
                Gabarito Criptografado
              </span>
            </div>
          </div>

          {/* Identificação do Aluno */}
          <div className="mt-4 p-3 border-2 border-black text-xs grid grid-cols-12 gap-3 bg-white">
            <div className="col-span-8">
              <span className="font-bold uppercase tracking-wider text-[11px] block">
                Nome Completo do Aluno(a):
              </span>
              <div className="border-b border-black mt-4 w-full" />
            </div>
            <div className="col-span-4">
              <span className="font-bold uppercase tracking-wider text-[11px] block">
                Matrícula / RA:
              </span>
              <div className="border-b border-black mt-4 w-full" />
            </div>
          </div>

          {/* Instruções de Preenchimento com Amostras Visuais */}
          <div className="mt-3 text-xs bg-slate-50 border border-slate-300 p-2.5 flex items-center justify-between gap-4">
            <div className="leading-snug">
              <strong>Instruções Obrigatórias:</strong> Use caneta esferográfica azul ou preta. Preencha completamente o interior da bolinha. Rasuras, marcações parciais ou duplas anulam a questão.
            </div>
            <div className="flex items-center gap-3 font-mono text-xs shrink-0 bg-white px-2 py-1 border border-slate-200">
              <span className="text-emerald-700 font-bold">Certo: (●)</span>
              <span className="text-rose-700">Errado: (✕) (⊘)</span>
            </div>
          </div>
        </div>

        {/* Grade de Bolinhas (OMR Grid) */}
        <div className="my-5 border-2 border-black p-5 bg-white flex-1 flex flex-col justify-center">
          {totalQuestions === 0 ? (
            <div className="text-center py-8 text-slate-400 font-serif italic text-sm">
              Esta avaliação não possui questões no momento.
            </div>
          ) : (
            <div className={`grid ${column2.length > 0 ? 'grid-cols-2 gap-4 sm:gap-8' : 'grid-cols-1 max-w-md mx-auto w-full'}`}>
              {/* Coluna 1 */}
              <div className="space-y-2.5">
                <div className="flex items-center text-xs font-black text-black border-b-2 border-black pb-1 uppercase tracking-wider">
                  <span className="w-12">Questão</span>
                  <div className="flex-1 flex justify-around">
                    {optionsList.map((opt) => (
                      <span key={opt} className="w-7 text-center">
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
                {column1.map((q, idx) => (
                  <div key={q.id} className="flex items-center text-xs py-1 hover:bg-slate-50">
                    <span className="w-12 font-bold font-mono text-sm">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    {q.type === 'objective' ? (
                      <div className="flex-1 flex justify-around">
                        {optionsList.map((opt) => (
                          <div
                            key={opt}
                            className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center font-bold text-xs select-none bg-white"
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center h-7 text-xs font-semibold text-slate-500 italic">
                        Questão dissertativa
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Coluna 2 (se houver) */}
              {column2.length > 0 && (
                <div className="space-y-2.5 border-l border-slate-300 pl-4 sm:pl-8">
                  <div className="flex items-center text-xs font-black text-black border-b-2 border-black pb-1 uppercase tracking-wider">
                    <span className="w-12">Questão</span>
                    <div className="flex-1 flex justify-around">
                      {optionsList.map((opt) => (
                        <span key={opt} className="w-7 text-center">
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                  {column2.map((q, idx) => {
                    const qNum = questionsPerCol + idx + 1;
                    return (
                      <div key={q.id} className="flex items-center text-xs py-1 hover:bg-slate-50">
                        <span className="w-12 font-bold font-mono text-sm">
                          {String(qNum).padStart(2, '0')}.
                        </span>
                        {q.type === 'objective' ? (
                          <div className="flex-1 flex justify-around">
                            {optionsList.map((opt) => (
                              <div
                                key={opt}
                                className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center font-bold text-xs select-none bg-white"
                              >
                                {opt}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center h-7 text-xs font-semibold text-slate-500 italic">
                            Questão dissertativa
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé e Assinatura do Aluno */}
        <div className="pt-3 border-t-2 border-black flex items-end justify-between text-xs">
          <div className="w-3/5">
            <span className="font-bold text-[11px] uppercase block mb-3">
              Assinatura do Aluno(a):
            </span>
            <div className="border-b border-black w-full" />
          </div>
          <div className="text-right text-[10px] text-slate-600 font-mono">
            <div>Caderno: Versão {version.versionLetter}</div>
            <div>Folha 1 de 1 (Gabarito Oficial)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
