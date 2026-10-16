import { describe, it, expect } from 'vitest';
import { analyzeItems, generateItemAnalysisCsv } from '../src/utils/itemAnalysis';
import { buildVersionLayouts } from '../src/utils/randomizer';
import { computeExamFingerprint } from '../src/utils/fingerprint';
import { initialSampleExam } from '../src/utils/sampleExam';
import { Exam, GradingRecord } from '../src/types/exam';

describe('Análise por Questão (analyzeItems)', () => {
  const fp = computeExamFingerprint(initialSampleExam);
  const layouts = buildVersionLayouts(initialSampleExam);
  const layoutA = layouts[0];
  const layoutB = layouts[1];

  function createRecord(params: {
    id: string;
    versionLetter: string;
    answers: Array<{ qNum: number; markedOption: string | null; status?: 'correct' | 'wrong' | 'blank' | 'multiple' }>;
    subjective?: Array<{ qNum: number; score: number | null }>;
    fingerprint?: string;
  }): GradingRecord {
    const vLetter = params.versionLetter;
    const layout = layouts.find((l) => l.versionLetter === vLetter) || layoutA;

    const grAnswers = params.answers.map((a) => {
      const q = layout.questions[a.qNum - 1];
      const correctOpt = layout.objectiveAnswerKey[a.qNum] || 'A';
      const isCorrect = a.markedOption === correctOpt;
      const status =
        a.status ||
        (a.markedOption === null ? 'blank' : isCorrect ? 'correct' : 'wrong');

      return {
        questionNumber: a.qNum,
        markedOption: a.markedOption,
        correctOption: correctOpt,
        isCorrect,
        status,
        pointsEarned: isCorrect ? (q?.points || 1) : 0,
        maxPoints: q?.points || 1,
      };
    });

    const subj = params.subjective?.map((s) => ({
      questionNumber: s.qNum,
      maxPoints: 2.5,
      pointsEarned: s.score,
    }));

    const totalScore =
      grAnswers.reduce((sum, a) => sum + a.pointsEarned, 0) +
      (subj?.reduce((sum, s) => sum + (s.pointsEarned ?? 0), 0) ?? 0);
    const maxScore =
      grAnswers.reduce((sum, a) => sum + a.maxPoints, 0) +
      (subj?.reduce((sum, s) => sum + s.maxPoints, 0) ?? 0);

    return {
      id: params.id,
      timestamp: Date.now(),
      studentName: `Aluno ${params.id}`,
      studentId: params.id,
      versionLetter: vLetter,
      totalScore,
      maxScore,
      percentage: maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0,
      answers: grAnswers,
      subjectiveAnswers: subj,
      examId: initialSampleExam.id,
      examFingerprint: params.fingerprint !== undefined ? params.fingerprint : fp,
    };
  }

  it('deve agregar respostas corretamente entre versões com alternativas e posições embaralhadas', () => {
    // Pega a primeira questão objetiva original do exame
    const origQ1 = initialSampleExam.questions[0];
    const origCorrectOpt = origQ1.options?.find((o) => o.isCorrect)!;

    // Encontra onde origQ1 está na Versão A e na Versão B
    const indexInA = layoutA.questions.findIndex((q) => q.id === origQ1.id);
    const qNumA = indexInA + 1;
    const optInA = layoutA.questions[indexInA].options?.find((o) => o.id === origCorrectOpt.id)!;

    const indexInB = layoutB.questions.findIndex((q) => q.id === origQ1.id);
    const qNumB = indexInB + 1;
    const optInB = layoutB.questions[indexInB].options?.find((o) => o.id === origCorrectOpt.id)!;

    // Aluno 1 fez a versão A e marcou a opção correta
    const r1 = createRecord({
      id: 'r1',
      versionLetter: 'A',
      answers: [{ qNum: qNumA, markedOption: optInA.label }],
    });

    // Aluno 2 fez a versão B e marcou a opção correta (que tem outra letra no layout B)
    const r2 = createRecord({
      id: 'r2',
      versionLetter: 'B',
      answers: [{ qNum: qNumB, markedOption: optInB.label }],
    });

    const result = analyzeItems([r1, r2], initialSampleExam);
    const itemStats = result.items.find((it) => it.questionId === origQ1.id);

    expect(itemStats).toBeDefined();
    expect(itemStats?.respondents).toBe(2);
    expect(itemStats?.correctPct).toBe(100);
    // Na ordem original, a alternativa correta é A
    expect(itemStats?.optionPct[origCorrectOpt.label]).toBe(100);
  });

  it('deve desconsiderar questões anuladas com discard e marcar give_points', () => {
    const q1Id = initialSampleExam.questions[0].id;
    const q2Id = initialSampleExam.questions[1].id;

    const modifiedExam: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.map((q) => {
        if (q.id === q1Id) return { ...q, annulled: 'discard' as const };
        if (q.id === q2Id) return { ...q, annulled: 'give_points' as const };
        return q;
      }),
    };

    const r = createRecord({
      id: 'r1',
      versionLetter: 'A',
      answers: [{ qNum: 1, markedOption: 'A' }],
    });

    const result = analyzeItems([r], modifiedExam);
    expect(result.items.some((it) => it.questionId === q1Id)).toBe(false);

    const q2Stats = result.items.find((it) => it.questionId === q2Id);
    expect(q2Stats).toBeDefined();
    expect(q2Stats?.annulled).toBe('give_points');
  });

  it('deve sinalizar muito_dificil (< 30%) e muito_facil (> 90%) nos limiares exatos', () => {
    const origQ1 = initialSampleExam.questions[0];
    const indexInA = layoutA.questions.findIndex((q) => q.id === origQ1.id);
    const qNumA = indexInA + 1;
    const correctOpt = layoutA.objectiveAnswerKey[qNumA];
    const wrongOpt = correctOpt === 'A' ? 'B' : 'A';

    // 10 alunos: 3 acertam -> 30.0% (não deve ter flag muito_dificil, pois não é < 30%)
    const recs30 = Array.from({ length: 10 }, (_, i) =>
      createRecord({
        id: `r-30-${i}`,
        versionLetter: 'A',
        answers: [{ qNum: qNumA, markedOption: i < 3 ? correctOpt : wrongOpt }],
      })
    );
    const res30 = analyzeItems(recs30, initialSampleExam);
    const item30 = res30.items.find((it) => it.questionId === origQ1.id);
    expect(item30?.correctPct).toBe(30.0);
    expect(item30?.flags).not.toContain('muito_dificil');

    // 100 alunos: 29 acertam -> 29.0% (< 30% -> deve ter flag muito_dificil)
    const recs29 = Array.from({ length: 100 }, (_, i) =>
      createRecord({
        id: `r-29-${i}`,
        versionLetter: 'A',
        answers: [{ qNum: qNumA, markedOption: i < 29 ? correctOpt : wrongOpt }],
      })
    );
    const res29 = analyzeItems(recs29, initialSampleExam);
    const item29 = res29.items.find((it) => it.questionId === origQ1.id);
    expect(item29?.correctPct).toBe(29.0);
    expect(item29?.flags).toContain('muito_dificil');

    // 10 alunos: 9 acertam -> 90.0% (não deve ter flag muito_facil, pois não é > 90%)
    const recs90 = Array.from({ length: 10 }, (_, i) =>
      createRecord({
        id: `r-90-${i}`,
        versionLetter: 'A',
        answers: [{ qNum: qNumA, markedOption: i < 9 ? correctOpt : wrongOpt }],
      })
    );
    const res90 = analyzeItems(recs90, initialSampleExam);
    const item90 = res90.items.find((it) => it.questionId === origQ1.id);
    expect(item90?.correctPct).toBe(90.0);
    expect(item90?.flags).not.toContain('muito_facil');

    // 100 alunos: 91 acertam -> 91.0% (> 90% -> deve ter flag muito_facil)
    const recs91 = Array.from({ length: 100 }, (_, i) =>
      createRecord({
        id: `r-91-${i}`,
        versionLetter: 'A',
        answers: [{ qNum: qNumA, markedOption: i < 91 ? correctOpt : wrongOpt }],
      })
    );
    const res91 = analyzeItems(recs91, initialSampleExam);
    const item91 = res91.items.find((it) => it.questionId === origQ1.id);
    expect(item91?.correctPct).toBe(91.0);
    expect(item91?.flags).toContain('muito_facil');
  });

  it('deve sinalizar possivel_erro_gabarito apenas com >= 10 respondentes e >= 50% em alternativa errada', () => {
    const origQ1 = initialSampleExam.questions[0];
    const indexInA = layoutA.questions.findIndex((q) => q.id === origQ1.id);
    const qNumA = indexInA + 1;
    const correctOpt = layoutA.objectiveAnswerKey[qNumA];
    const wrongOpt = correctOpt === 'A' ? 'B' : 'A';

    // Caso 1: 9 respondentes com 8 marcando a alternativa errada (88%)
    // Não deve disparar flag pois tem menos de 10 respondentes
    const recs9 = Array.from({ length: 9 }, (_, i) =>
      createRecord({
        id: `r-9-${i}`,
        versionLetter: 'A',
        answers: [{ qNum: qNumA, markedOption: i === 0 ? correctOpt : wrongOpt }],
      })
    );
    const res9 = analyzeItems(recs9, initialSampleExam);
    const item9 = res9.items.find((it) => it.questionId === origQ1.id);
    expect(item9?.flags).not.toContain('possivel_erro_gabarito');

    // Caso 2: 10 respondentes onde 6 (60%) marcaram a mesma alternativa errada
    // Deve disparar possivel_erro_gabarito
    const recs10 = Array.from({ length: 10 }, (_, i) =>
      createRecord({
        id: `r-10-${i}`,
        versionLetter: 'A',
        answers: [{ qNum: qNumA, markedOption: i < 6 ? wrongOpt : correctOpt }],
      })
    );
    const res10 = analyzeItems(recs10, initialSampleExam);
    const item10 = res10.items.find((it) => it.questionId === origQ1.id);
    expect(item10?.flags).toContain('possivel_erro_gabarito');

    // Caso 3: 10 respondentes onde 60% marcaram a alternativa correta
    // Não deve disparar possivel_erro_gabarito
    const recs10Correct = Array.from({ length: 10 }, (_, i) =>
      createRecord({
        id: `r-10c-${i}`,
        versionLetter: 'A',
        answers: [{ qNum: qNumA, markedOption: i < 6 ? correctOpt : wrongOpt }],
      })
    );
    const res10c = analyzeItems(recs10Correct, initialSampleExam);
    const item10c = res10c.items.find((it) => it.questionId === origQ1.id);
    expect(item10c?.flags).not.toContain('possivel_erro_gabarito');
  });

  it('deve calcular corretamente média, mediana, menor e maior nota ignorando parciais', () => {
    // 3 alunos completos: notas 4.0, 6.0, 8.0
    const r1 = createRecord({ id: '1', versionLetter: 'A', answers: [] });
    r1.totalScore = 4.0;
    const r2 = createRecord({ id: '2', versionLetter: 'A', answers: [] });
    r2.totalScore = 6.0;
    const r3 = createRecord({ id: '3', versionLetter: 'A', answers: [] });
    r3.totalScore = 8.0;

    // Aluno parcial com dissertativa não corrigida
    const rPartial = createRecord({
      id: 'p1',
      versionLetter: 'A',
      answers: [],
      subjective: [{ qNum: 1, score: null }],
    });
    rPartial.totalScore = 10.0; // Não deve entrar na média da turma

    const result = analyzeItems([r1, r2, r3, rPartial], initialSampleExam);
    expect(result.summary.min).toBe(4.0);
    expect(result.summary.max).toBe(8.0);
    expect(result.summary.mean).toBe(6.0);
    expect(result.summary.median).toBe(6.0);
  });

  it('deve gerar CSV compatível contendo cabeçalho e linhas formatadas', () => {
    const r1 = createRecord({
      id: 'r1',
      versionLetter: 'A',
      answers: [{ qNum: 1, markedOption: 'A' }],
    });

    const analysis = analyzeItems([r1], initialSampleExam);
    const csv = generateItemAnalysisCsv(analysis);

    expect(csv).toContain('Questão;Enunciado;Situação;Respondentes;% Acerto');
    expect(csv).toContain('Q1;');
  });
});
