import React, { useState } from 'react';
import { Exam } from '../../types/exam';
import {
  Shield,
  FileText,
  Shuffle,
  Columns,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { generateExamPassword } from '../../utils/crypto';
import { Surface } from '../ui/Surface';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface ExamHeaderEditorProps {
  exam: Exam;
  onChange: (updatedExam: Exam) => void;
}

export const ExamHeaderEditor: React.FC<ExamHeaderEditorProps> = ({ exam, onChange }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingPassword, setPendingPassword] = useState<string>('');

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(exam.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRequestRegeneratePassword = () => {
    const newPwd = generateExamPassword();
    if (exam.questions && exam.questions.length > 0) {
      setPendingPassword(newPwd);
      setConfirmModalOpen(true);
    } else {
      onChange({ ...exam, password: newPwd });
    }
  };

  const handleConfirmPasswordChange = () => {
    if (pendingPassword) {
      onChange({ ...exam, password: pendingPassword });
    }
    setConfirmModalOpen(false);
    setPendingPassword('');
  };

  const handlePasswordInputChange = (value: string) => {
    onChange({ ...exam, password: value });
  };

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
    <Surface tone="default" className="p-6 mb-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="font-display text-lg font-semibold text-slate-800">
          Cabeçalho & Configurações da Prova
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
            <span>Instituição / Universidade</span>
            <span className="text-meta text-slate-400 font-mono font-normal">
              {(exam.header.institution || '').length}/70
            </span>
          </label>
          <input
            type="text"
            maxLength={70}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition"
            placeholder="Ex: Universidade Federal..."
            value={exam.header.institution}
            onChange={(e) => updateHeader('institution', e.target.value)}
          />
        </div>

        <div>
          <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
            <span>Disciplina</span>
            <span className="text-meta text-slate-400 font-mono font-normal">
              {(exam.header.course || '').length}/40
            </span>
          </label>
          <input
            type="text"
            maxLength={40}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition"
            placeholder="Ex: Cálculo I, Álgebra Linear..."
            value={exam.header.course}
            onChange={(e) => updateHeader('course', e.target.value)}
          />
        </div>

        <div>
          <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
            <span>Título da Avaliação</span>
            <span className="text-meta text-slate-400 font-mono font-normal">
              {(exam.header.examTitle || '').length}/50
            </span>
          </label>
          <input
            type="text"
            maxLength={50}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition"
            placeholder="Ex: Prova 1, Exame Final..."
            value={exam.header.examTitle}
            onChange={(e) => updateHeader('examTitle', e.target.value)}
          />
        </div>

        <div>
          <label className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
            <span>Professor(a)</span>
            <span className="text-meta text-slate-400 font-mono font-normal">
              {(exam.header.professor || '').length}/40
            </span>
          </label>
          <input
            type="text"
            maxLength={40}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition"
            placeholder="Nome do docente"
            value={exam.header.professor}
            onChange={(e) => updateHeader('professor', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Data</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition"
            placeholder="DD/MM/AAAA"
            value={exam.header.date}
            onChange={(e) => updateHeader('date', e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 flex items-center justify-between text-amber-700 dark:text-amber-300">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Senha da Prova (QR Code)
            </span>
            <div className="flex items-center gap-1 normal-case font-normal text-meta">
              <button
                type="button"
                onClick={handleCopyPassword}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                title="Copiar senha para a área de transferência"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copied ? 'Copiada' : 'Copiar'}</span>
              </button>
              <button
                type="button"
                onClick={handleRequestRegeneratePassword}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                title="Gerar nova senha aleatória"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Gerar outra</span>
              </button>
            </div>
          </label>
          <div className="relative flex items-center">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full pl-3 pr-10 py-2 border border-amber-300 dark:border-amber-500/40 bg-white text-slate-800 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:outline-none"
              placeholder="Senha de 8 caracteres"
              value={exam.password}
              onChange={(e) => handlePasswordInputChange(e.target.value)}
              title="Esta senha protege o QR code impresso na folha de respostas."
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition p-1"
              title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Instruções Gerais para os Alunos
        </label>
        <textarea
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition"
          placeholder="Instruções impressas no cabeçalho da prova..."
          value={exam.header.instructions}
          onChange={(e) => updateHeader('instructions', e.target.value)}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-slate-500" />
            <label className="text-sm font-medium text-slate-700">Qtd. Versões:</label>
            <select
              className="px-2.5 py-1 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={exam.versionCount}
              onChange={(e) => onChange({ ...exam, versionCount: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}{' '}
                  {n === 1
                    ? 'versão (Única)'
                    : `versões (${Array.from({ length: n }, (_, i) =>
                        String.fromCharCode(65 + i)
                      ).join(', ')})`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="exam-target-score" className="text-sm font-medium text-slate-700">
              Escala de Nota:
            </label>
            <input
              id="exam-target-score"
              type="number"
              min="1"
              max="1000"
              step="0.5"
              className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm bg-white font-semibold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={exam.header.targetScore ?? 10}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value);
                onChange({
                  ...exam,
                  header: {
                    ...exam.header,
                    targetScore: Number.isFinite(parsed) && parsed > 0 ? parsed : 10,
                  },
                });
              }}
              title="Valor máximo para normalização das notas no Livro de Notas (ex: 10 ou 100)"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exam.shuffleQuestions}
              onChange={(e) => onChange({ ...exam, shuffleQuestions: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 h-4 w-4"
            />
            Embaralhar Questões
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exam.shuffleOptions}
              onChange={(e) => onChange({ ...exam, shuffleOptions: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 h-4 w-4"
            />
            Embaralhar Alternativas
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <Columns className="w-4 h-4 text-slate-500" />
            <input
              type="checkbox"
              checked={exam.twoColumns}
              onChange={(e) => onChange({ ...exam, twoColumns: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 h-4 w-4"
            />
            Diagramar em 2 Colunas na Impressão
          </label>
        </div>
      </div>

      {/* Modal de Confirmação de Alteração de Senha */}
      <Modal
        open={confirmModalOpen}
        onOpenChange={(open) => {
          setConfirmModalOpen(open);
          if (!open) setPendingPassword('');
        }}
        size="sm"
        title="Alterar senha da prova?"
        description="Folhas de resposta que já foram impressas com a senha anterior deixarão de abrir no corretor. Deseja realmente aplicar a nova senha?"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirmModalOpen(false);
                setPendingPassword('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-on-accent shadow-xs active:bg-amber-800"
              onClick={handleConfirmPasswordChange}
            >
              Sim, alterar senha
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800">
            Nova senha: {pendingPassword}
          </div>
        </div>
      </Modal>
    </Surface>
  );
};
