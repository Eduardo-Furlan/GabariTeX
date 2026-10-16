import { Exam, GradingRecord, QuestionType } from '../types/exam';
import { computeExamFingerprint } from './fingerprint';
import { buildVersionLayouts } from './randomizer';
import { isPartial } from './grading';
import { saveFile } from '../platform/files';

export interface ItemStats {
  questionId: string;
  originalNumber: number; // Posição 1-based na prova original
  prompt: string;
  type: QuestionType;
  annulled?: 'give_points' | 'discard';
  respondents: number;
  correctPct: number; // 0..100 (%)
  blankPct: number; // 0..100 (%)
  multiplePct: number; // 0..100 (%)
  optionPct: Record<string, number>; // por alternativa na ORDEM ORIGINAL (A..E) (0..100%)
  correctOptionLabel: string; // Letra da alternativa correta no editor original
  flags: Array<'muito_dificil' | 'muito_facil' | 'possivel_erro_gabarito'>;
}

export interface ExamSummaryStats {
  mean: number;
  median: number;
  min: number;
  max: number;
}

export interface ItemAnalysisResult {
  items: ItemStats[];
  used: number;
  excluded: number;
  summary: ExamSummaryStats;
}

/**
 * Realiza a análise estatística por questão (taxa de acerto, distribuição de alternativas,
 * flags pedagógicas e resumo de notas) agregando todas as versões embaralhadas.
 *
 * Considera apenas registros com a mesma impressão digital (fingerprint) da prova atual.
 */
export function analyzeItems(records: GradingRecord[], exam: Exam): ItemAnalysisResult {
  const currentFingerprint = computeExamFingerprint(exam);

  const matchingRecords = records.filter(
    (r) => r.examFingerprint && r.examFingerprint === currentFingerprint
  );
  const used = matchingRecords.length;
  const excluded = records.length - used;

  // Resumo da turma (apenas registros completos, sem dissertativas pendentes)
  const completeRecords = matchingRecords.filter((r) => !isPartial(r));
  let summary: ExamSummaryStats = { mean: 0, median: 0, min: 0, max: 0 };

  if (completeRecords.length > 0) {
    const scores = completeRecords.map((r) => r.totalScore).sort((a, b) => a - b);
    const sum = scores.reduce((acc, s) => acc + s, 0);
    const mean = Number((sum / scores.length).toFixed(2));
    const min = scores[0];
    const max = scores[scores.length - 1];

    const mid = Math.floor(scores.length / 2);
    const median =
      scores.length % 2 !== 0
        ? scores[mid]
        : Number(((scores[mid - 1] + scores[mid]) / 2).toFixed(2));

    summary = { mean, median, min, max };
  }

  const layouts = buildVersionLayouts(exam);
  const layoutsByVersion = new Map(layouts.map((l) => [l.versionLetter, l]));

  const items: ItemStats[] = [];

  exam.questions.forEach((q, idx) => {
    // Dissertativas e questões anuladas por descarte ficam fora da análise de itens objetivos
    if (q.type !== 'objective' || q.annulled === 'discard') {
      return;
    }

    const originalNumber = idx + 1;
    const correctOpt = q.options?.find((o) => o.isCorrect);
    const correctOptionLabel = correctOpt?.label || '';

    const optionCounts: Record<string, number> = {};
    for (const opt of q.options || []) {
      optionCounts[opt.label] = 0;
    }

    let blankCount = 0;
    let multipleCount = 0;
    let correctCount = 0;
    let questionRespondents = 0;

    for (const record of matchingRecords) {
      const layout = layoutsByVersion.get(record.versionLetter);
      if (!layout) continue;

      const layoutQIndex = layout.questions.findIndex((lq) => lq.id === q.id);
      if (layoutQIndex === -1) continue;

      const qNum = layoutQIndex + 1;
      const ans = record.answers.find((a) => a.questionNumber === qNum);
      if (!ans) continue;

      questionRespondents++;

      if (ans.status === 'blank' || (ans.markedOption === null && ans.status !== 'multiple')) {
        blankCount++;
      } else if (ans.status === 'multiple') {
        multipleCount++;
      } else if (ans.markedOption) {
        // Encontra a opção marcada no layout da versão
        const layoutQ = layout.questions[layoutQIndex];
        const layoutOpt = layoutQ.options?.find((o) => o.label === ans.markedOption);
        if (layoutOpt) {
          // Mapeia para a alternativa original pelo id estável
          const originalOpt = q.options?.find((o) => o.id === layoutOpt.id);
          if (originalOpt) {
            optionCounts[originalOpt.label] = (optionCounts[originalOpt.label] || 0) + 1;
            if (originalOpt.isCorrect) {
              correctCount++;
            }
          }
        }
      }
    }

    let correctPct = 0;
    let blankPct = 0;
    let multiplePct = 0;
    const optionPct: Record<string, number> = {};

    for (const opt of q.options || []) {
      optionPct[opt.label] = 0;
    }

    if (questionRespondents > 0) {
      correctPct = Number(((correctCount / questionRespondents) * 100).toFixed(1));
      blankPct = Number(((blankCount / questionRespondents) * 100).toFixed(1));
      multiplePct = Number(((multipleCount / questionRespondents) * 100).toFixed(1));

      for (const [lbl, count] of Object.entries(optionCounts)) {
        optionPct[lbl] = Number(((count / questionRespondents) * 100).toFixed(1));
      }
    }

    const flags: Array<'muito_dificil' | 'muito_facil' | 'possivel_erro_gabarito'> = [];

    if (questionRespondents > 0) {
      if (correctPct < 30) {
        flags.push('muito_dificil');
      }
      if (correctPct > 90) {
        flags.push('muito_facil');
      }

      // Alerta de possível erro de gabarito:
      // A alternativa mais marcada NÃO é a correta e recebeu >= 50% das respostas, com ao menos 10 respondentes
      if (questionRespondents >= 10) {
        let maxLabel = '';
        let maxCount = -1;
        for (const [lbl, count] of Object.entries(optionCounts)) {
          if (count > maxCount) {
            maxCount = count;
            maxLabel = lbl;
          }
        }

        if (
          maxLabel !== '' &&
          maxLabel !== correctOptionLabel &&
          maxCount / questionRespondents >= 0.5
        ) {
          flags.push('possivel_erro_gabarito');
        }
      }
    }

    items.push({
      questionId: q.id,
      originalNumber,
      prompt: q.prompt,
      type: q.type,
      annulled: q.annulled,
      respondents: questionRespondents,
      correctPct,
      blankPct,
      multiplePct,
      optionPct,
      correctOptionLabel,
      flags,
    });
  });

  return {
    items,
    used,
    excluded,
    summary,
  };
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function formatCsvDecimal(val: number, decimals = 1): string {
  return val.toFixed(decimals).replace('.', ',');
}

/**
 * Gera string CSV com o resultado da análise por questão compatível com planilhas pt-BR (separador ';').
 */
export function generateItemAnalysisCsv(result: ItemAnalysisResult): string {
  const headers = [
    'Questão',
    'Enunciado',
    'Situação',
    'Respondentes',
    '% Acerto',
    '% Em Branco',
    '% Rasura/Múltipla',
    '% A',
    '% B',
    '% C',
    '% D',
    '% E',
    'Gabarito Correto',
    'Sinalizações',
  ];

  const lines = [headers.join(';')];

  for (const item of result.items) {
    const statusText =
      item.annulled === 'give_points'
        ? 'Anulada (pontos para todos)'
        : item.annulled === 'discard'
        ? 'Anulada (desconsiderada)'
        : 'Válida';

    const flagsText = item.flags
      .map((f) => {
        if (f === 'muito_dificil') return 'Muito difícil (<30%)';
        if (f === 'muito_facil') return 'Muito fácil (>90%)';
        if (f === 'possivel_erro_gabarito') return 'Possível erro de gabarito';
        return f;
      })
      .join(', ');

    const row = [
      `Q${item.originalNumber}`,
      escapeCsvField(item.prompt.replace(/\s+/g, ' ').trim()),
      escapeCsvField(statusText),
      item.respondents.toString(),
      formatCsvDecimal(item.correctPct),
      formatCsvDecimal(item.blankPct),
      formatCsvDecimal(item.multiplePct),
      formatCsvDecimal(item.optionPct['A'] ?? 0),
      formatCsvDecimal(item.optionPct['B'] ?? 0),
      formatCsvDecimal(item.optionPct['C'] ?? 0),
      formatCsvDecimal(item.optionPct['D'] ?? 0),
      formatCsvDecimal(item.optionPct['E'] ?? 0),
      item.correctOptionLabel,
      escapeCsvField(flagsText),
    ];

    lines.push(row.join(';'));
  }

  return lines.join('\n');
}

/**
 * Exporta a análise de itens como arquivo CSV via saveFile.
 */
export function exportItemAnalysisToCsv(result: ItemAnalysisResult, examTitle = 'prova'): void {
  const csvBody = generateItemAnalysisCsv(result);
  if (!csvBody) return;
  const safeTitle = examTitle.toLowerCase().replace(/[^a-z0-9]/gi, '_');
  void saveFile({
    suggestedName: `${safeTitle}_analise_itens.csv`,
    mime: 'text/csv;charset=utf-8;',
    data: '\uFEFF' + csvBody,
  });
}

