import React, { useState } from 'react';
import {
  Printer,
} from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { printPage } from '../platform/print';
import { MAX_QUESTIONS } from '../utils/examLimits';
import { AnswerSheetView } from '../components/preview/AnswerSheetView';
import { ExamPrintView } from '../components/preview/ExamPrintView';
import { Surface } from '../components/ui/Surface';
import { Segmented } from '../components/ui/Segmented';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Select } from '../components/ui/Select';

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

  const printModeOptions: { value: PrintMode; label: string }[] = [
    { value: 'complete', label: 'Prova Completa' },
    { value: 'exam_only', label: 'Apenas Caderno' },
    { value: 'answersheet_only', label: 'Apenas Cartão' },
    { value: 'all_versions', label: `Todas (${versions.length})` },
  ];

  return (
    <div className="screen-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Surface tone="default" className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-base font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            Central de Impressão A4 / Exportação PDF
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            O modo &quot;Prova Completa&quot; coloca o Cartão-Resposta padronizado como Folha 1 (capa), seguido pelas folhas de questões.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
          <Segmented
            options={printModeOptions}
            value={printMode}
            onChange={setPrintMode}
            layoutId="print-mode-pill"
            size="sm"
          />

          <div className="flex items-center gap-2 justify-between sm:justify-start">
            {printMode !== 'all_versions' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600 font-medium">Versão:</span>
                <Select
                  size="sm"
                  value={selectedVersionLetter}
                  onChange={(val) => setSelectedVersionLetter(val)}
                  options={versions.map((v) => ({
                    value: v.versionLetter,
                    label: `Versão ${v.versionLetter}`,
                  }))}
                />
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              disabled={isSheetOverflowing || isExamCorrupted}
              onClick={() => {
                if (isSheetOverflowing || isExamCorrupted) return;
                printPage();
              }}
              icon={<Printer className="w-4 h-4" />}
              title={
                isSheetOverflowing
                  ? 'A folha de respostas não cabe em uma página. Reduza o texto do cabeçalho ou o número de questões.'
                  : isExamCorrupted
                  ? `A prova excede o limite de ${MAX_QUESTIONS} questões.`
                  : undefined
              }
            >
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </Surface>

      {(isSheetOverflowing || isExamCorrupted) && (
        <div className="no-print">
          <Alert tone="danger">
            {isSheetOverflowing
              ? 'A folha de respostas não cabe em uma página. Reduza o texto do cabeçalho ou o número de questões.'
              : `A prova excede o limite de ${MAX_QUESTIONS} questões.`}
          </Alert>
        </div>
      )}

      {/* Aviso no celular para Tab 3 */}
      <div className="block lg:hidden p-3 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed no-print">
        <strong>Visualização A4 no Celular:</strong> As páginas abaixo estão no tamanho real de impressão A4. Deslize horizontalmente para inspecionar. Para imprimir ou salvar em PDF no celular, use o botão <strong>Imprimir / Salvar PDF</strong> acima.
      </div>

      {/* Visualização de Páginas A4 com Quebras Visíveis */}
      <div className="print-area-wrapper desk-surface w-full overflow-x-auto py-4 print:p-0 print:m-0 print:bg-white print:overflow-visible">
        <div className="min-w-fit mx-auto flex flex-col items-center">
          {printMode === 'complete' && currentVersion && (
            <div className="w-full flex flex-col items-center">
              <AnswerSheetView
                version={currentVersion}
                header={exam.header}
                onOverflowChange={setIsSheetOverflowing}
              />
              <div className="a4-page-separator no-print">
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
                  <div className="a4-page-separator no-print">
                    Quebra de Página A4 — Caderno de Questões (Versão {v.versionLetter})
                  </div>
                  <ExamPrintView
                    version={v}
                    header={exam.header}
                    twoColumns={exam.twoColumns}
                  />
                  {idx < versions.length - 1 && (
                    <div className="a4-page-separator no-print text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30 font-bold">
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
