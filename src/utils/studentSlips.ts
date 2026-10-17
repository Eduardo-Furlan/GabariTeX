import { GradingRecord } from '../types/exam';

export interface StudentSlipOptions {
  examTitle?: string;
  targetScore?: number;
  classroomName?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateStudentSlipsHtml(
  records: GradingRecord[],
  options: StudentSlipOptions = {}
): string {
  const { examTitle = 'Gabarito Oficial', targetScore = 10, classroomName } = options;

  const slipsHtml = records
    .map((r) => {
      const scaledScore =
        r.maxScore > 0
          ? (r.totalScore / r.maxScore) * targetScore
          : (r.percentage / 100) * targetScore;

      const objectiveBadges = r.answers
        .map((a) => {
          if (a.annulled) {
            return `<div class="badge badge-annulled"><strong>Q${a.questionNumber}:</strong> Anulada</div>`;
          }
          if (a.isCorrect) {
            return `<div class="badge badge-correct"><strong>Q${a.questionNumber}:</strong> ${
              escapeHtml(a.markedOption || '—')
            } ✓</div>`;
          }
          const marked =
            a.status === 'blank'
              ? '—'
              : a.status === 'multiple'
              ? '⊘'
              : a.markedOption || '—';
          return `<div class="badge badge-wrong"><strong>Q${a.questionNumber}:</strong> ${escapeHtml(
            marked
          )} <span class="key">(${escapeHtml(a.correctOption)})</span> ✗</div>`;
        })
        .join('');

      const subjectiveHtml =
        r.subjectiveAnswers && r.subjectiveAnswers.length > 0
          ? `<div class="subj-row">
              <span class="sec-title">Dissertativas:</span>
              <div class="subj-grid">
                ${r.subjectiveAnswers
                  .map(
                    (s) =>
                      `<span class="subj-item">D${s.questionNumber}: <strong>${
                        s.pointsEarned !== null ? s.pointsEarned.toFixed(1) : 'Pendente'
                      }</strong>/${s.maxPoints.toFixed(1)}</span>`
                  )
                  .join('')}
              </div>
            </div>`
          : '';

      return `
        <div class="slip">
          <div class="slip-header">
            <div class="title-line">
              <span class="exam-title">${escapeHtml(examTitle)}</span>
              ${classroomName ? `<span class="class-name">${escapeHtml(classroomName)}</span>` : ''}
            </div>
            <div class="student-line">
              <span class="student-name">${escapeHtml(r.studentName || 'Não identificado')}</span>
              ${r.studentId ? `<span class="student-ra">RA: ${escapeHtml(r.studentId)}</span>` : ''}
            </div>
            <div class="meta-line">
              <span>Versão: <strong>${escapeHtml(r.versionLetter)}</strong></span>
              <span>Acertos: <strong>${r.percentage.toFixed(0)}%</strong></span>
              <span class="score-highlight">Nota: <strong>${scaledScore.toFixed(2)}</strong> / ${targetScore}</span>
            </div>
          </div>
          <div class="answers-grid">
            ${objectiveBadges}
          </div>
          ${subjectiveHtml}
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Espelhos de Resposta - ${escapeHtml(examTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10px;
      color: #0f172a;
      background: #f8fafc;
      padding: 8mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    .slips-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6mm;
    }
    .slip {
      border: 1.5px dashed #94a3b8;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .slip-header {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .title-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .exam-title {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #4338ca;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70%;
    }
    .class-name {
      font-weight: 600;
      color: #475569;
    }
    .student-line {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 4px;
    }
    .student-name {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70%;
    }
    .student-ra {
      font-family: monospace;
      font-size: 10px;
      color: #475569;
    }
    .meta-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 3px;
      font-size: 9.5px;
      color: #334155;
    }
    .score-highlight {
      font-size: 11px;
      color: #1e293b;
    }
    .score-highlight strong {
      font-size: 13px;
      color: #0f172a;
    }
    .answers-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 2.5px;
      align-content: flex-start;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1.5px 4px;
      border-radius: 3px;
      font-size: 8.5px;
      font-family: monospace;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .badge-correct {
      background-color: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
      font-weight: 600;
    }
    .badge-wrong {
      background-color: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }
    .badge-wrong .key {
      color: #b91c1c;
      font-weight: 700;
    }
    .badge-annulled {
      background-color: #fef3c7;
      border-color: #fde68a;
      color: #92400e;
      font-weight: 600;
    }
    .subj-row {
      margin-top: 5px;
      padding-top: 4px;
      border-top: 1px dashed #e2e8f0;
      font-size: 8.5px;
    }
    .sec-title {
      font-weight: 700;
      color: #475569;
      margin-right: 4px;
    }
    .subj-grid {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .subj-item {
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 3px;
      color: #334155;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="slips-container">
    ${slipsHtml}
  </div>
</body>
</html>`;
}

export function printStudentSlips(
  records: GradingRecord[],
  options: StudentSlipOptions = {}
): void {
  if (records.length === 0) return;
  const html = generateStudentSlipsHtml(records, options);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Falha ao acionar impressão via iframe', e);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2000);
    }
  }, 350);
}

