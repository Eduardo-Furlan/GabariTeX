import React, { useState } from 'react';
import {
  Printer,
  AlertTriangle,
} from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { printPage } from '../platform/print';
import { MAX_QUESTIONS } from '../utils/examLimits';
import { AnswerSheetView } from '../components/preview/AnswerSheetView';
import { ExamPrintView } from '../components/preview/ExamPrintView';

type PrintMode = 'complete' | 'exam_only' | 'answersheet_only' | 'all_versions';

export const PrintScreen: React.FC = () => {
  const {
    exam,
    versions,
    selectedVersionLetter,
    setSelectedVersionLetter,
    isExamCorrupted,
  } = useProfile();

  const [printMode, setPrintMode] = useState<PrintMode>('complete');
  const [isSheetOverflowing, setIsSheetOverflowing] = useState<boolean>(false);

  const currentVersion =
    versions.find((v) => v.versionLetter === selectedVersionLetter) || versions[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            Central de Impressão A4 / Exportação PDF
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            O modo &quot;Prova Completa&quot; coloca o Cartão-Resposta padronizado como Folha 1 (capa), seguido pelas folhas de questões.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
          <div className="flex flex-wrap sm:flex-nowrap bg-slate-100 rounded-lg p-1 text-xs font-semibold gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setPrintMode('complete')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                printMode === 'complete' ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Prova Completa
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('exam_only')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                printMode === 'exam_only' ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Apenas Caderno
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('answersheet_only')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                printMode === 'answersheet_only' ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Apenas Cartão
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('all_versions')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                printMode === 'all_versions' ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({versions.length})
            </button>
          </div>

          <div className="flex items-center gap-2 justify-between sm:justify-start">
            {printMode !== 'all_versions' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-medium">Versão:</span>
                <select
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-800"
                  value={selectedVersionLetter}
                  onChange={(e) => setSelectedVersionLetter(e.target.value)}
                >
                  {versions.map((v) => (
                    <option key={v.versionLetter} value={v.versionLetter}>
                      Versão {v.versionLetter}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              disabled={isSheetOverflowing || isExamCorrupted}
              onClick={() => {
                if (isSheetOverflowing || isExamCorrupted) return;
                printPage();
              }}
              title={
                isSheetOverflowing
                  ? 'A folha de respostas não cabe em uma página. Reduza o texto do cabeçalho ou o número de questões.'
                  : isExamCorrupted
                  ? `A prova excede o limite de ${MAX_QUESTIONS} questões.`
                  : undefined
              }
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold shadow-md transition ${
                isSheetOverflowing || isExamCorrupted
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-on-accent'
              }`}
            >
              <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      </div>

      {isSheetOverflowing && (
        <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40 rounded-2xl flex items-center gap-3 text-rose-900 dark:text-rose-200 no-print">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-300 shrink-0" />
          <div className="text-xs sm:text-sm font-semibold">
            A folha de respostas não cabe em uma página. Reduza o texto do cabeçalho ou o número de questões.
          </div>
        </div>
      )}

      {/* Aviso no celular para Tab 3 */}
      <div className="block lg:hidden p-3 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed no-print">
        <strong>Visualização A4 no Celular:</strong> As páginas abaixo estão no tamanho real de impressão A4. Deslize horizontalmente para inspecionar. Para imprimir ou salvar em PDF no celular, use o botão <strong>Imprimir / Salvar PDF</strong> acima.
      </div>

      {/* Visualização de Páginas A4 com Quebras Visíveis */}
      <div className="print-area-wrapper w-full overflow-x-auto py-4 print:p-0 print:m-0 print:bg-white print:overflow-visible">
        <div className="min-w-fit mx-auto flex flex-col items-center">
          {printMode === 'complete' && currentVersion && (
            <div className="w-full flex flex-col items-center">
              <AnswerSheetView
                version={currentVersion}
                header={exam.header}
                onOverflowChange={setIsSheetOverflowing}
              />
              <div className="a4-page-separator">
                Quebra de Página A4 — Início do Caderno de Questões
              </div>
              <ExamPrintView
                version={currentVersion}
                header={exam.header}
                twoColumns={exam.twoColumns}
              />
            </div>
          )}

          {printMode === 'exam_only' && currentVersion && (
            <div className="w-full flex flex-col items-center">
              <ExamPrintView
                version={currentVersion}
                header={exam.header}
                twoColumns={exam.twoColumns}
              />
            </div>
          )}

          {printMode === 'answersheet_only' && currentVersion && (
            <div className="w-full flex flex-col items-center">
              <AnswerSheetView
                version={currentVersion}
                header={exam.header}
                onOverflowChange={setIsSheetOverflowing}
              />
            </div>
          )}

          {printMode === 'all_versions' && (
            <div className="w-full flex flex-col items-center">
              {versions.map((v, idx) => (
                <React.Fragment key={v.versionLetter}>
                  <AnswerSheetView
                    version={v}
                    header={exam.header}
                    onOverflowChange={idx === 0 ? setIsSheetOverflowing : undefined}
                  />
                  <div className="a4-page-separator">
                    Quebra de Página A4 — Caderno de Questões (Versão {v.versionLetter})
                  </div>
                  <ExamPrintView
                    version={v}
                    header={exam.header}
                    twoColumns={exam.twoColumns}
                  />
                  {idx < versions.length - 1 && (
                    <div className="a4-page-separator text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30 font-bold">
                      Fim da Versão {v.versionLetter} — Próxima: Versão {versions[idx + 1].versionLetter}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

