import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { paginateQuestions } from '../src/components/preview/ExamPrintView';
import { Question } from '../src/types/exam';

const makeQuestions = (count: number): Question[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `q-${i + 1}`,
    type: 'objective',
    prompt: `Enunciado da questão ${i + 1}`,
    points: 1,
    options: [
      { id: `opt-${i}-a`, label: 'A', text: 'Alternativa A', isCorrect: true },
      { id: `opt-${i}-b`, label: 'B', text: 'Alternativa B', isCorrect: false },
      { id: `opt-${i}-c`, label: 'C', text: 'Alternativa C', isCorrect: false },
      { id: `opt-${i}-d`, label: 'D', text: 'Alternativa D', isCorrect: false },
      { id: `opt-${i}-e`, label: 'E', text: 'Alternativa E', isCorrect: false },
    ],
  }));

describe('paper regression guard', () => {
  const previewDir = path.resolve(__dirname, '../src/components/preview');
  const printCssPath = path.resolve(__dirname, '../src/styles/print.css');

  it('ensures no file in src/components/preview contains dark: utility classes', () => {
    const files = fs.readdirSync(previewDir).filter((f) => f.endsWith('.tsx'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(path.join(previewDir, file), 'utf-8');
      const matches = content.match(/dark:[a-zA-Z0-9_\-\/]+/g);
      expect(
        matches,
        `File ${file} must not contain dark: classes, found: ${matches?.join(', ')}`
      ).toBeNull();
    }
  });

  it('ensures every preview root component contains the paper class', () => {
    const files = fs.readdirSync(previewDir).filter((f) => f.endsWith('.tsx'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(previewDir, file), 'utf-8');
      expect(
        content.includes('paper'),
        `File ${file} must declare class "paper" on root preview element`
      ).toBe(true);
    }
  });

  it('ensures print.css redeclares light variables inside @media print', () => {
    const printCss = fs.readFileSync(printCssPath, 'utf-8');

    expect(printCss).toContain('@media print');
    expect(printCss).toContain('--c-white: 255 255 255;');
    expect(printCss).toContain('--c-page: 255 255 255;');
    expect(printCss).toContain('--slate-900: 15 23 42;');
  });

  it('ensures strict A4 geometry (210mm x 297mm) and margin: 0 in @page', () => {
    const printCss = fs.readFileSync(printCssPath, 'utf-8');

    expect(printCss).toContain('size: A4 portrait;');
    expect(printCss).toContain('margin: 0;');
    expect(printCss).toContain('width: 210mm !important;');
    expect(printCss).toContain('height: 297mm !important;');
  });

  it('ensures AnswerSheetView and ExamPrintView use discrete 297mm A4 sheets with bottom-pinned footers', () => {
    const printCss = fs.readFileSync(printCssPath, 'utf-8');

    expect(printCss).toContain('break-after: page !important;');
    expect(printCss).toContain('page-break-after: always !important;');
    expect(printCss).toContain('break-inside: avoid !important;');
    expect(printCss).toContain('page-break-inside: avoid !important;');

    const answerSheetFile = fs.readFileSync(
      path.join(previewDir, 'AnswerSheetView.tsx'),
      'utf-8'
    );
    expect(answerSheetFile).toContain('avoid-break');
    expect(answerSheetFile).toContain('w-28 h-28');

    const examPrintFile = fs.readFileSync(
      path.join(previewDir, 'ExamPrintView.tsx'),
      'utf-8'
    );
    expect(examPrintFile).toContain('avoid-break');
    expect(examPrintFile).toContain('mt-auto');
    expect(examPrintFile).toContain("height: '277mm'");
    expect(printCss).toContain('display: flex !important;');
    expect(printCss).toContain('justify-content: space-between !important;');
  });

  it('paginates single-column questions onto a new page when a question does not fit completely', () => {
    const questions = makeQuestions(5);
    // Page 1 has 600px available; each question is 220px -> Q1 + Q2 = 440px fit on Page 1;
    // Q3 (440 + 220 = 660 > 600) must move entirely to Page 2.
    const heights = [220, 220, 220, 220, 220];
    const pages = paginateQuestions(questions, heights, false, 600, 700);

    expect(pages).toHaveLength(2);
    expect(pages[0].col1.map((e) => e.index)).toEqual([0, 1]);
    expect(pages[0].col2).toHaveLength(0);
    expect(pages[1].col1.map((e) => e.index)).toEqual([2, 3, 4]);
    expect(pages[1].col2).toHaveLength(0);
  });

  it('paginates two-column questions across col1 and col2 before overflowing to a second A4 sheet', () => {
    const questions = makeQuestions(6);
    // Page 1 has 500px per column; each question is 220px:
    // Page 1 col1 -> Q1, Q2 (440px)
    // Page 1 col2 -> Q3, Q4 (440px)
    // Page 2 col1 -> Q5, Q6 (440px)
    const heights = [220, 220, 220, 220, 220, 220];
    const pages = paginateQuestions(questions, heights, true, 500, 650);

    expect(pages).toHaveLength(2);
    expect(pages[0].col1.map((e) => e.index)).toEqual([0, 1]);
    expect(pages[0].col2.map((e) => e.index)).toEqual([2, 3]);
    expect(pages[1].col1.map((e) => e.index)).toEqual([4, 5]);
    expect(pages[1].col2).toHaveLength(0);
  });
});
