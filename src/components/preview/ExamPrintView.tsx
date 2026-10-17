import React, { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';
import { ExamHeader, ExamVersion, Question } from '../../types/exam';
import { MathView } from '../MathView';

interface ExamPrintViewProps {
  version: ExamVersion;
  header: ExamHeader;
  twoColumns?: boolean;
}

export interface QuestionEntry {
  question: Question;
  index: number;
}

export interface ExamPageData {
  col1: QuestionEntry[];
  col2: QuestionEntry[];
}

/**
 * Distribui questões inteiras em páginas A4 discretas (1 ou 2 colunas),
 * garantindo que nenhuma questão ou alternativa seja cortada ao meio.
 */
export function paginateQuestions(
  questions: Question[],
  questionHeights: number[],
  twoColumns: boolean,
  availFirstPagePx: number,
  availContPagePx: number
): ExamPageData[] {
  if (questions.length === 0) {
    return [{ col1: [], col2: [] }];
  }

  const pages: ExamPageData[] = [];
  let currentPageIdx = 0;
  let col1: QuestionEntry[] = [];
  let col2: QuestionEntry[] = [];
  let activeCol: 1 | 2 = 1;
  let usedHeight = 0;

  const getMaxColHeight = (pageIdx: number) =>
    pageIdx === 0 ? availFirstPagePx : availContPagePx;

  for (let i = 0; i < questions.length; i++) {
    const entry: QuestionEntry = { question: questions[i], index: i };
    const qHeight = questionHeights[i] ?? 130;
    const maxH = getMaxColHeight(currentPageIdx);

    const currentCol = activeCol === 1 ? col1 : col2;

    if (currentCol.length === 0) {
      // Coluna vazia: se estivermos na coluna 2 e a questão for maior que a altura útil da página 1,
      // mas couber melhor em uma nova página de continuação, abre nova página
      if (activeCol === 2 && col1.length > 0 && qHeight > maxH) {
        pages.push({ col1, col2 });
        currentPageIdx++;
        col1 = [entry];
        col2 = [];
        activeCol = 1;
        usedHeight = qHeight;
      } else {
        currentCol.push(entry);
        usedHeight = qHeight;
      }
      continue;
    }

    if (usedHeight + qHeight <= maxH) {
      currentCol.push(entry);
      usedHeight += qHeight;
    } else if (twoColumns && activeCol === 1) {
      // Não cabe no restante da coluna 1: tenta colocar inteira no topo da coluna 2
      if (qHeight <= maxH) {
        activeCol = 2;
        col2.push(entry);
        usedHeight = qHeight;
      } else {
        // Questão é alta demais para a coluna 2 desta página; inicia nova página
        pages.push({ col1, col2 });
        currentPageIdx++;
        col1 = [entry];
        col2 = [];
        activeCol = 1;
        usedHeight = qHeight;
      }
    } else {
      // Não cabe na página atual: joga a questão inteira para a próxima folha A4
      pages.push({ col1, col2 });
      currentPageIdx++;
      col1 = [entry];
      col2 = [];
      activeCol = 1;
      usedHeight = qHeight;
    }
  }

  if (col1.length > 0 || col2.length > 0) {
    pages.push({ col1, col2 });
  }

  return pages.length > 0 ? pages : [{ col1: [], col2: [] }];
}

const ExamFirstPageHeader: React.FC<{
  header: ExamHeader;
  versionLetter: string;
}> = ({ header, versionLetter }) => (
  <div className="pb-3.5 shrink-0 font-sans avoid-break">
    <div className="border-b-2 border-black pb-2.5">
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-4">
          <h1 className="text-base font-extrabold uppercase tracking-wider text-black">
            {header.institution || 'Instituição de Ensino'}
          </h1>
          <h2 className="text-sm font-bold text-slate-800">
            {header.course || 'Disciplina'}: {header.examTitle || 'Avaliação'}
          </h2>
          <div className="text-xs text-slate-700 mt-1 flex items-center gap-3">
            <span>
              Docente: <strong>{header.professor || 'Docente'}</strong>
            </span>
            <span>•</span>
            <span>
              Data: <strong>{header.date || '___/___/______'}</strong>
            </span>
          </div>
        </div>

        <div className="text-center border-2 border-black px-4 py-1.5 bg-slate-50 shrink-0">
          <span className="block text-[10px] uppercase font-bold text-slate-500">Caderno</span>
          <span className="text-xl font-black">VERSÃO {versionLetter}</span>
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
  </div>
);

const ExamContinuationHeader: React.FC<{
  header: ExamHeader;
  versionLetter: string;
  pageNumber: number;
  totalPages: number;
}> = ({ header, versionLetter, pageNumber, totalPages }) => (
  <div className="pb-3 shrink-0 font-sans avoid-break">
    <div className="border-b-2 border-black pb-1.5 flex justify-between items-center text-xs">
      <div className="font-bold text-slate-800 truncate pr-4">
        <span className="uppercase">{header.institution || 'Instituição de Ensino'}</span>
        {' — '}
        <span>
          {header.course || 'Disciplina'}: {header.examTitle || 'Avaliação'}
        </span>
      </div>
      <div className="font-black text-black shrink-0 border border-black px-2.5 py-0.5 bg-slate-50 text-[11px]">
        VERSÃO {versionLetter} • FOLHA {pageNumber}/{totalPages}
      </div>
    </div>
  </div>
);

const ExamPageFooter: React.FC<{
  header: ExamHeader;
  versionLetter: string;
  pageNumber: number;
  totalPages: number;
}> = ({ header, versionLetter, pageNumber, totalPages }) => (
  <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-sans mt-auto shrink-0 avoid-break bg-white">
    <span>
      {header.institution || 'Avaliação Acadêmica'}: {header.course}
    </span>
    <span>
      Caderno de Questões | Versão {versionLetter}
      {totalPages > 1 ? `. Folha ${pageNumber} de ${totalPages}` : ''}
    </span>
  </div>
);

const QuestionBlock: React.FC<{
  question: Question;
  index: number;
  onImageLoad?: () => void;
}> = ({ question: q, index: idx, onImageLoad }) => (
  <div className="avoid-break text-sm">
    <div className="font-sans font-bold text-slate-900 mb-1 flex items-baseline gap-1.5">
      <span className="text-sm">Questão {idx + 1}.</span>
      <span className="text-xs font-normal text-slate-600">({q.points.toFixed(1)} pt)</span>
    </div>

    <div className="text-justify leading-relaxed mb-2 font-serif text-[13.5px]">
      <MathView content={q.prompt} />
    </div>

    {q.imageUrl && (
      <div className="my-2.5 text-center avoid-break">
        <img
          src={q.imageUrl}
          alt={q.imageCaption || `Figura Questão ${idx + 1}`}
          onLoad={onImageLoad}
          className="max-h-48 mx-auto rounded border border-slate-200"
        />
        {q.imageCaption && (
          <p className="text-xs text-slate-600 italic mt-1 font-sans">{q.imageCaption}</p>
        )}
      </div>
    )}

    {q.type === 'objective' && q.options && (
      <div className="space-y-1.5 pl-2 font-sans text-xs">
        {q.options.map((opt) => (
          <div key={opt.id} className="flex items-start gap-2 avoid-break">
            <span className="font-bold min-w-[18px]">({opt.label})</span>
            <div className="flex-1">
              <MathView content={opt.text} />
            </div>
          </div>
        ))}
      </div>
    )}

    {q.type === 'subjective' && (
      <div className="mt-2.5 pl-1 font-sans avoid-break">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
          Espaço para Resposta:
        </span>
        <div className="space-y-2.5 border-t border-slate-300 pt-1">
          {Array.from({ length: q.linesForAnswer || 8 }).map((_, lineIdx) => (
            <div key={lineIdx} className="border-b border-slate-300 h-2.5" />
          ))}
        </div>
      </div>
    )}
  </div>
);

export const ExamPrintView: React.FC<ExamPrintViewProps> = ({
  version,
  header,
  twoColumns = false,
}) => {
  const usableHeightRulerRef = useRef<HTMLDivElement>(null);
  const firstHeaderMeasureRef = useRef<HTMLDivElement>(null);
  const contHeaderMeasureRef = useRef<HTMLDivElement>(null);
  const footerMeasureRef = useRef<HTMLDivElement>(null);
  const questionsMeasureRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<ExamPageData[]>(() => [
    {
      col1: version.questions.map((question, index) => ({ question, index })),
      col2: [],
    },
  ]);

  const recalculatePages = useCallback(() => {
    const fallbackPagePx = (277 * 96) / 25.4; // 277mm (297mm - 20mm padding)
    const rawPagePx = usableHeightRulerRef.current?.getBoundingClientRect().height || 0;
    const usableHeightPx = rawPagePx > 100 ? rawPagePx : fallbackPagePx;

    const firstHeaderH =
      firstHeaderMeasureRef.current?.getBoundingClientRect().height || 175;
    const contHeaderH =
      contHeaderMeasureRef.current?.getBoundingClientRect().height || 48;
    const footerH = footerMeasureRef.current?.getBoundingClientRect().height || 34;

    const SAFETY_BUFFER_PX = 10;
    const availFirstPage = Math.max(
      120,
      usableHeightPx - firstHeaderH - footerH - SAFETY_BUFFER_PX
    );
    const availContPage = Math.max(
      120,
      usableHeightPx - contHeaderH - footerH - SAFETY_BUFFER_PX
    );

    const measureNodes =
      questionsMeasureRef.current?.querySelectorAll<HTMLElement>('[data-question-measure]');
    const heights: number[] = version.questions.map((_, idx) => {
      const node = measureNodes?.[idx];
      const measured = node?.getBoundingClientRect().height || 0;
      return measured > 0 ? measured : 130;
    });

    const computedPages = paginateQuestions(
      version.questions,
      heights,
      twoColumns,
      availFirstPage,
      availContPage
    );

    setPages((prev) => {
      if (prev.length === computedPages.length) {
        const same = prev.every(
          (p, idx) =>
            p.col1.length === computedPages[idx].col1.length &&
            p.col2.length === computedPages[idx].col2.length &&
            p.col1.every((item, i) => item.question.id === computedPages[idx].col1[i]?.question.id) &&
            p.col2.every((item, i) => item.question.id === computedPages[idx].col2[i]?.question.id)
        );
        if (same) return prev;
      }
      return computedPages;
    });
  }, [version.questions, twoColumns, header]);

  useLayoutEffect(() => {
    recalculatePages();
  }, [recalculatePages]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      recalculatePages();
    });
    if (questionsMeasureRef.current) ro.observe(questionsMeasureRef.current);
    if (firstHeaderMeasureRef.current) ro.observe(firstHeaderMeasureRef.current);
    if (usableHeightRulerRef.current) ro.observe(usableHeightRulerRef.current);

    if (document.fonts) {
      document.fonts.ready.then(() => recalculatePages());
    }

    window.addEventListener('beforeprint', recalculatePages);
    window.addEventListener('resize', recalculatePages);
    return () => {
      ro.disconnect();
      window.removeEventListener('beforeprint', recalculatePages);
      window.removeEventListener('resize', recalculatePages);
    };
  }, [recalculatePages]);

  return (
    <>
      {/* Container invisível de medição em escala real A4 (186mm × 277mm úteis) */}
      <div
        aria-hidden="true"
        className="no-print fixed top-0 -left-[9999px] invisible pointer-events-none text-black font-serif leading-normal"
        style={{ width: '186mm' }}
      >
        <div ref={usableHeightRulerRef} style={{ height: '277mm' }} />
        <div ref={firstHeaderMeasureRef}>
          <ExamFirstPageHeader header={header} versionLetter={version.versionLetter} />
        </div>
        <div ref={contHeaderMeasureRef}>
          <ExamContinuationHeader
            header={header}
            versionLetter={version.versionLetter}
            pageNumber={2}
            totalPages={2}
          />
        </div>
        <div ref={footerMeasureRef}>
          <ExamPageFooter
            header={header}
            versionLetter={version.versionLetter}
            pageNumber={1}
            totalPages={1}
          />
        </div>
        <div
          ref={questionsMeasureRef}
          className={twoColumns ? 'w-1/2 pl-4 border-l border-transparent' : 'w-full'}
        >
          {version.questions.map((q, idx) => (
            <div key={q.id} data-question-measure={idx} className="pb-4">
              <QuestionBlock question={q} index={idx} onImageLoad={recalculatePages} />
            </div>
          ))}
        </div>
      </div>

      {/* Folhas A4 discretas e independentes para cada página do Caderno de Questões */}
      {pages.map((page, pageIdx) => (
        <React.Fragment key={`exam-page-${version.versionLetter}-${pageIdx}`}>
          {pageIdx > 0 && (
            <div className="a4-page-separator no-print">
              Quebra de Página A4 — Caderno de Questões (Folha {pageIdx + 1} de {pages.length})
            </div>
          )}

          <div className="a4-sheet paper exam-sheet-container text-black font-serif leading-normal flex flex-col justify-between relative">
            <div
              className="w-full flex-1 flex flex-col justify-between min-h-0 relative"
              style={{ height: '277mm', minHeight: '277mm', maxHeight: '277mm' }}
            >
              {/* Cabeçalho no topo da folha */}
              {pageIdx === 0 ? (
                <ExamFirstPageHeader header={header} versionLetter={version.versionLetter} />
              ) : (
                <ExamContinuationHeader
                  header={header}
                  versionLetter={version.versionLetter}
                  pageNumber={pageIdx + 1}
                  totalPages={pages.length}
                />
              )}

              {/* Área central de questões (ocupa todo o espaço entre cabeçalho e rodapé) */}
              {version.questions.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center py-16 text-slate-400 font-serif italic text-sm">
                  Nenhuma questão adicionada a esta prova ainda.
                </div>
              ) : twoColumns ? (
                <div className="flex-1 min-h-0 flex flex-row items-stretch overflow-hidden">
                  <div className="w-1/2 pr-4 flex flex-col min-w-0">
                    {page.col1.map((entry) => (
                      <div key={entry.question.id} className="pb-4 avoid-break">
                        <QuestionBlock
                          question={entry.question}
                          index={entry.index}
                          onImageLoad={recalculatePages}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="w-1/2 pl-4 border-l border-slate-300 flex flex-col min-w-0">
                    {page.col2.map((entry) => (
                      <div key={entry.question.id} className="pb-4 avoid-break">
                        <QuestionBlock
                          question={entry.question}
                          index={entry.index}
                          onImageLoad={recalculatePages}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  {page.col1.map((entry) => (
                    <div key={entry.question.id} className="pb-4 avoid-break">
                      <QuestionBlock
                        question={entry.question}
                        index={entry.index}
                        onImageLoad={recalculatePages}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Rodapé sempre colado na base da folha A4 */}
              <ExamPageFooter
                header={header}
                versionLetter={version.versionLetter}
                pageNumber={pageIdx + 1}
                totalPages={pages.length}
              />
            </div>
          </div>
        </React.Fragment>
      ))}
    </>
  );
};
