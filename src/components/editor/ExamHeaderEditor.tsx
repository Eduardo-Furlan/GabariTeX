import React from 'react';
import { Exam } from '../../types/exam';
import { Shield, FileText, Shuffle, Columns } from 'lucide-react';

interface ExamHeaderEditorProps {
  exam: Exam;
  onChange: (updatedExam: Exam) => void;
}

export const ExamHeaderEditor: React.FC<ExamHeaderEditorProps> = ({ exam, onChange }) => {
  const updateHeader = (field: keyof Exam['header'], value: string) => {
    onChange({
      ...exam,
      header: {
        ...exam.header,
        [field]: value,
      },
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <FileText className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-slate-800">Cabeçalho & Configurações da Prova</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Instituição / Universidade
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="Ex: Universidade Federal..."
            value={exam.header.institution}
            onChange={(e) => updateHeader('institution', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Disciplina
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="Ex: Cálculo I, Álgebra Linear..."
            value={exam.header.course}
            onChange={(e) => updateHeader('course', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Título da Avaliação
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="Ex: Prova 1, Exame Final..."
            value={exam.header.examTitle}
            onChange={(e) => updateHeader('examTitle', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
            Professor(a)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="Nome do docente"
            value={exam.header.professor}
            onChange={(e) => updateHeader('professor', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Data</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="DD/MM/AAAA"
            value={exam.header.date}
            onChange={(e) => updateHeader('date', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1 flex items-center gap-1 text-amber-700">
            <Shield className="w-3.5 h-3.5" /> Senha do Gabarito (QR Code)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
            placeholder="Senha para proteger o gabarito"
            value={exam.password}
            onChange={(e) => onChange({ ...exam, password: e.target.value })}
            title="Esta senha protege o QR code impresso na folha de respostas para que os alunos não possam ver o gabarito."
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
          Instruções Gerais para os Alunos
        </label>
        <textarea
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          placeholder="Instruções impressas no cabeçalho da prova..."
          value={exam.header.instructions}
          onChange={(e) => updateHeader('instructions', e.target.value)}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-slate-500" />
            <label className="text-sm font-medium text-slate-700">Qtd. Versões:</label>
            <select
              className="px-2 py-1 border border-slate-300 rounded text-sm bg-white font-semibold"
              value={exam.versionCount}
              onChange={(e) => onChange({ ...exam, versionCount: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'versão (Única)' : `versões (${Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)).join(', ')})`}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={exam.shuffleQuestions}
              onChange={(e) => onChange({ ...exam, shuffleQuestions: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            Embaralhar Questões
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={exam.shuffleOptions}
              onChange={(e) => onChange({ ...exam, shuffleOptions: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            Embaralhar Alternativas
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <Columns className="w-4 h-4 text-slate-500" />
            <input
              type="checkbox"
              checked={exam.twoColumns}
              onChange={(e) => onChange({ ...exam, twoColumns: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            Diagramar em 2 Colunas na Impressão
          </label>
        </div>
      </div>
    </div>
  );
};
