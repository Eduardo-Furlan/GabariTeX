import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { ExamHeader, ExamVersion, Question } from '../../types/exam';
import {
  SHEET,
  getColumnLayout,
  rowWidthPx,
} from '../../utils/sheetLayout';
import { validateExamQuestionCount } from '../../utils/examLimits';

interface AnswerSheetViewProps {
  version: ExamVersion;
  header: ExamHeader;
  onOverflowChange?: (isOverflowing: boolean) => void;
}

const OPTIONS_LIST: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

interface AnswerHeaderRowProps {
  options: ('A' | 'B' | 'C' | 'D' | 'E')[];
}

const AnswerHeaderRow: React.FC<AnswerHeaderRowProps> = ({ options }) => {
  return (
    <div
      className="flex items-center text-xs font-black text-black border-b-2 border-black pb-0.5 uppercase tracking-wider mx-auto"
      style={{ width: `${rowWidthPx()}px` }}
    >
      <div
        className="opacity-0 shrink-0"
        style={{
          width: `${SHEET.MARK_PX}px`,
          height: `${SHEET.MARK_PX}px`,
          marginRight: `${SHEET.MARK_GAP_PX}px`,
        }}
      />
      <span style={{ width: `${SHEET.LABEL_PX}px` }}>Questão</span>
      <div
        className="flex justify-around items-center shrink-0"
        style={{ width: `${SHEET.OPTIONS_PX}px` }}
      >
        {options.map((opt) => (
          <span
            key={opt}
            className="text-center font-black"
            style={{ width: `${SHEET.BUBBLE_PX}px` }}
          >
            {opt}
          </span>
        ))}
      </div>
      <div
        className="opacity-0 shrink-0"
        style={{
          width: `${SHEET.MARK_PX}px`,
          height: `${SHEET.MARK_PX}px`,
          marginLeft: `${SHEET.MARK_GAP_PX}px`,
        }}
      />
    </div>
  );
};

interface AnswerRowProps {
  question: Question;
  questionNumber: number;
  options: ('A' | 'B' | 'C' | 'D' | 'E')[];
}

const AnswerRow: React.FC<AnswerRowProps> = ({ question, questionNumber, options }) => {
  return (
    <div
      className="flex items-center text-xs py-0 hover:bg-slate-50 mx-auto"
      style={{ width: `${rowWidthPx()}px` }}
    >
      <div
        className="bg-black shrink-0"
        style={{
          width: `${SHEET.MARK_PX}px`,
          height: `${SHEET.MARK_PX}px`,
          marginRight: `${SHEET.MARK_GAP_PX}px`,
        }}
      />
      <span
        className="font-bold font-mono text-xs leading-none"
        style={{ width: `${SHEET.LABEL_PX}px` }}
      >
        {String(questionNumber).padStart(2, '0')}.
      </span>

      {question.type === 'objective' ? (
        <div
          className="flex justify-around items-center shrink-0"
          style={{ width: `${SHEET.OPTIONS_PX}px` }}
        >
          {options.map((opt) => (
            <div
              key={opt}
              className="rounded-full border-2 border-black flex items-center justify-center font-bold text-[11px] select-none bg-white leading-none shrink-0"
              style={{
                width: `${SHEET.BUBBLE_PX}px`,
                height: `${SHEET.BUBBLE_PX}px`,
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex items-center justify-center text-xs font-semibold text-slate-500 italic shrink-0"
          style={{
            width: `${SHEET.OPTIONS_PX}px`,
            height: `${SHEET.BUBBLE_PX}px`,
          }}
        >
          Questão dissertativa
        </div>
      )}

      <div
        className="bg-black shrink-0"
        style={{
          width: `${SHEET.MARK_PX}px`,
          height: `${SHEET.MARK_PX}px`,
          marginLeft: `${SHEET.MARK_GAP_PX}px`,
        }}
      />
    </div>
  );
};

export const AnswerSheetView: React.FC<AnswerSheetViewProps> = ({
  version,
  header,
  onOverflowChange,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const sheetRef = useRef<HTMLDivElement>(null);

  validateExamQuestionCount(version.questions.length);

  useEffect(() => {
    if (version.encryptedQrPayload) {
      QRCode.toDataURL(version.encryptedQrPayload, {
        width: 450,
        margin: 2,
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

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !onOverflowChange) return;

    const checkOverflow = () => {
      const isOverflowing = el.scrollHeight > el.clientHeight + 2;
      onOverflowChange(isOverflowing);
    };

    checkOverflow();

    const observer = new ResizeObserver(() => {
      checkOverflow();
    });
    observer.observe(el);

    if (document.fonts) {
      document.fonts.ready.then(checkOverflow);
    }

    return () => observer.disconnect();
  }, [onOverflowChange, version.questions.length, header]);

  const allQuestions = version.questions;
  const totalQuestions = allQuestions.length;

  const { columns, perColumn } = getColumnLayout(totalQuestions);
  const column1 = allQuestions.slice(0, perColumn);
  const column2 = columns === 2 ? allQuestions.slice(perColumn) : [];

  return (
    <div
      ref={sheetRef}
      className="a4-sheet paper answer-sheet-print text-black font-sans flex flex-col justify-between relative"
    >
      <div className="px-5 py-1.5 flex-1 flex flex-col justify-between">
        {/* Cabeçalho Oficial */}
        <div>
          <div className="flex items-start justify-between border-b-2 border-black pb-1.5">
            <div className="flex-1 pr-3">
              <h1 className="text-base font-black uppercase tracking-wider text-black line-clamp-1">
                {header.institution || 'Instituição de Ensino'}
              </h1>
              <h2 className="text-xs font-bold text-slate-800 mt-0.5 line-clamp-1">
                {header.course || 'Disciplina'} — {header.examTitle || 'Avaliação'}
              </h2>
              <div className="text-[11px] text-slate-700 mt-0.5 flex items-center gap-2">
                <span>Docente: <strong>{header.professor || 'Docente'}</strong></span>
                <span>•</span>
                <span>Data: <strong>{header.date || '___/___/______'}</strong></span>
              </div>
              <div className="mt-1 inline-block bg-black text-on-accent px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                Folha Oficial de Respostas (Cartão-Resposta)
              </div>
            </div>

            {/* Versão da Prova e QR Code Criptografado */}
            <div className="flex flex-col items-center pl-3 border-l border-slate-300 shrink-0">
              <div className="text-center mb-0.5">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">
                  Caderno
                </span>
                <span className="inline-block px-2.5 py-0.5 border-2 border-black text-lg font-black bg-slate-100 leading-none">
                  VERSÃO {version.versionLetter}
                </span>
              </div>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`QR Code Versão ${version.versionLetter}`}
                  className="w-28 h-28 bg-white"
                />
              )}
              <span className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">
                Gabarito Criptografado
              </span>
            </div>
          </div>

          {/* Identificação do Aluno */}
          <div className="mt-1.5 p-1.5 border-2 border-black text-xs grid grid-cols-12 gap-3 bg-white">
            <div className="col-span-8">
              <span className="font-bold uppercase tracking-wider text-[10px] block">
                Nome Completo do Aluno(a):
              </span>
              <div className="border-b border-black mt-2 w-full" />
            </div>
            <div className="col-span-4">
              <span className="font-bold uppercase tracking-wider text-[10px] block">
                Matrícula / RA:
              </span>
              <div className="border-b border-black mt-2 w-full" />
            </div>
          </div>

          {/* Instruções de Preenchimento com Amostras Visuais */}
          <div className="mt-1.5 text-[10px] sm:text-xs bg-slate-50 border border-slate-300 px-2 py-0.5 flex items-center justify-between gap-3">
            <div className="leading-tight">
              <strong>Instruções Obrigatórias:</strong> Use caneta azul ou preta. Preencha completamente a bolinha. Rasuras ou marcações duplas anulam a questão.
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] sm:text-xs shrink-0 bg-white px-2 py-0.5 border border-slate-200">
              <span className="text-emerald-700 font-bold">Certo: (●)</span>
              <span className="text-rose-700">Errado: (✕) (⊘)</span>
            </div>
          </div>
        </div>

        {/* Grade de Bolinhas (OMR Grid) */}
        <div className="my-1.5 border-2 border-black p-2 bg-white flex-1 flex flex-col justify-center relative">
          {/* Marcadores de alinhamento nos 4 cantos da caixa OMR */}
          <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-black flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white" />
          </div>
          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-black flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white" />
          </div>
          <div className="absolute bottom-1.5 left-1.5 w-4 h-4 bg-black flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white" />
          </div>
          <div className="absolute bottom-1.5 right-1.5 w-4 h-4 bg-black flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white" />
          </div>

          {totalQuestions === 0 ? (
            <div className="text-center py-8 text-slate-400 font-serif italic text-sm">
              Esta avaliação não possui questões no momento.
            </div>
          ) : (
            <div
              className={`grid ${
                column2.length > 0 ? 'grid-cols-2 gap-4' : 'grid-cols-1 max-w-md mx-auto w-full'
              }`}
            >
              {/* Coluna 1 */}
              <div className="space-y-0.5">
                <AnswerHeaderRow options={OPTIONS_LIST} />
                {column1.map((q, idx) => (
                  <AnswerRow
                    key={q.id}
                    question={q}
                    questionNumber={idx + 1}
                    options={OPTIONS_LIST}
                  />
                ))}
              </div>

              {/* Coluna 2 (se houver) */}
              {column2.length > 0 && (
                <div className="space-y-0.5 border-l border-slate-300 pl-2 sm:pl-4">
                  <AnswerHeaderRow options={OPTIONS_LIST} />
                  {column2.map((q, idx) => {
                    const qNum = perColumn + idx + 1;
                    return (
                      <AnswerRow
                        key={q.id}
                        question={q}
                        questionNumber={qNum}
                        options={OPTIONS_LIST}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé e Assinatura do Aluno */}
        <div className="pt-1.5 border-t-2 border-black flex items-end justify-between text-xs">
          <div className="w-3/5">
            <span className="font-bold text-[10px] uppercase block mb-1.5">
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
