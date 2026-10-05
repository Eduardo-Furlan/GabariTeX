import { ExamHeader, ExamVersion } from '../types/exam';

function sanitizeLatex(text: string): string {
  // Substitui siglas comuns caso estejam inadvertidamente em math mode
  return text
    .replace(/\$(ZF|ZFC|CH|AC|PCP|P|NP)\$/g, '$1')
    .replace(/\\text\{(ZF|ZFC|CH|AC|PCP|P|NP)\}/g, '$1')
    .replace(/\\mathrm\{(ZF|ZFC|CH|AC|PCP|P|NP)\}/g, '$1');
}

export function generateLuaLatexExam(version: ExamVersion, header: ExamHeader): string {
  const lines: string[] = [];

  lines.push('\\documentclass[11pt,a4paper]{article}');
  lines.push('\\usepackage{fontspec}');
  lines.push('\\usepackage{amsmath,amssymb}');
  lines.push('\\usepackage[top=2cm,bottom=2cm,left=2cm,right=2cm]{geometry}');
  lines.push('\\usepackage{enumitem}');
  lines.push('\\usepackage{graphicx}');
  lines.push('\\usepackage{fancyhdr}');
  lines.push('');
  lines.push('\\pagestyle{fancy}');
  lines.push('\\fancyhf{}');
  lines.push(`\\lhead{\\small ${header.institution} -- ${header.course}}`);
  lines.push(`\\rhead{\\small Versão: \\textbf{${version.versionLetter}}}`);
  lines.push('\\cfoot{\\thepage}');
  lines.push('\\renewcommand{\\headrulewidth}{0.4pt}');
  lines.push('');
  lines.push('\\begin{document}');
  lines.push('');
  lines.push('\\begin{center}');
  lines.push(`  {\\LARGE \\textbf{${header.examTitle}}}\\par\\vspace{3pt}`);
  lines.push(`  {\\large ${header.institution} -- ${header.course}}\\par`);
  lines.push(`  {\\normalsize Professor(a): ${header.professor} \\quad Data: ${header.date}}\\par`);
  lines.push(`  {\\large \\textbf{Versão ${version.versionLetter}}}`);
  lines.push('\\end{center}');
  lines.push('\\vspace{6pt}');
  lines.push('');
  lines.push('\\noindent\\fbox{\\parbox{\\textwidth}{%');
  lines.push('  \\vspace{2pt}');
  lines.push('  \\textbf{Nome do Aluno(a):} \\underline{\\hspace{10cm}} \\quad \\textbf{Matrícula:} \\underline{\\hspace{3cm}}\\par\\vspace{4pt}');
  if (header.instructions.trim()) {
    lines.push(`  \\small \\textbf{Instruções:} ${sanitizeLatex(header.instructions)}`);
  }
  lines.push('}}');
  lines.push('\\vspace{12pt}');
  lines.push('');
  lines.push('\\begin{enumerate}[label=\\textbf{Questão \\arabic*.}, leftmargin=*]');

  for (const q of version.questions) {
    lines.push('');
    lines.push(`\\item \\textbf{(${q.points.toFixed(1)} pt)} ${sanitizeLatex(q.prompt)}`);

    if (q.imageUrl) {
      lines.push('\\begin{center}');
      lines.push('  % Imagem da questão');
      lines.push('  % Inserir imagem local com \\includegraphics[width=0.6\\textwidth]{imagem.png}');
      if (q.imageCaption) {
        lines.push(`  \\small \\textit{${sanitizeLatex(q.imageCaption)}}`);
      }
      lines.push('\\end{center}');
    }

    if (q.type === 'objective' && q.options && q.options.length > 0) {
      lines.push('\\begin{enumerate}[label=\\textbf{(\\Alph*)}, itemsep=2pt, topsep=4pt]');
      for (const opt of q.options) {
        lines.push(`  \\item ${sanitizeLatex(opt.text)}`);
      }
      lines.push('\\end{enumerate}');
    } else if (q.type === 'subjective') {
      const lineCount = q.linesForAnswer || 8;
      lines.push('\\vspace{4pt}');
      lines.push(`\\par\\noindent\\rule{\\textwidth}{0.2pt}`);
      for (let i = 1; i < lineCount; i++) {
        lines.push(`\\vspace{14pt}\\par\\noindent\\rule{\\textwidth}{0.2pt}`);
      }
      lines.push('\\vspace{12pt}');
    }
  }

  lines.push('');
  lines.push('\\end{enumerate}');
  lines.push('\\end{document}');

  return lines.join('\n');
}

export function generateLuaLatexAnswerKey(version: ExamVersion, header: ExamHeader): string {
  const lines: string[] = [];

  lines.push('\\documentclass[11pt,a4paper]{article}');
  lines.push('\\usepackage{fontspec}');
  lines.push('\\usepackage{amsmath,amssymb}');
  lines.push('\\usepackage[top=2cm,bottom=2cm,left=2cm,right=2cm]{geometry}');
  lines.push('\\usepackage{booktabs}');
  lines.push('');
  lines.push('\\begin{document}');
  lines.push('\\begin{center}');
  lines.push(`  {\\LARGE \\textbf{Gabarito Oficial -- Versão ${version.versionLetter}}}\\par\\vspace{4pt}`);
  lines.push(`  {\\large ${header.examTitle} -- ${header.course}}\\par`);
  lines.push(`  {\\normalsize Professor: ${header.professor} \\quad Data: ${header.date}}`);
  lines.push('\\end{center}');
  lines.push('\\vspace{12pt}');
  lines.push('');
  lines.push('\\begin{center}');
  lines.push('\\begin{tabular}{cc}');
  lines.push('\\toprule');
  lines.push('\\textbf{Questão} & \\textbf{Alternativa Correta} \\\\');
  lines.push('\\midrule');

  const entries = Object.entries(version.objectiveAnswerKey).sort(
    ([a], [b]) => Number(a) - Number(b)
  );

  for (const [qNum, correctOpt] of entries) {
    lines.push(`${qNum} & \\textbf{${correctOpt}} \\\\`);
  }

  lines.push('\\bottomrule');
  lines.push('\\end{tabular}');
  lines.push('\\end{center}');
  lines.push('\\end{document}');

  return lines.join('\n');
}
