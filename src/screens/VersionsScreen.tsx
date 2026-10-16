import React, { useState } from 'react';
import {
  Shuffle,
  ShieldCheck,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { AnswerSheetView } from '../components/preview/AnswerSheetView';

export const VersionsScreen: React.FC = () => {
  const {
    exam,
    versions,
    selectedVersionLetter,
    setSelectedVersionLetter,
  } = useProfile();

  const [showAnswerSheetPreview, setShowAnswerSheetPreview] = useState<boolean>(true);

  const currentVersion =
    versions.find((v) => v.versionLetter === selectedVersionLetter) || versions[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Seletor de Versões */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            Versões Randomizadas ({versions.length} {versions.length === 1 ? 'versão' : 'versões'})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cada versão reordena questões e alternativas. O QR Code armazena o gabarito oficial encriptado com a senha da prova.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Visualizar Versão:</span>
          <div className="flex gap-1.5">
            {versions.map((v) => (
              <button
                key={v.versionLetter}
                type="button"
                onClick={() => setSelectedVersionLetter(v.versionLetter)}
                className={`w-9 h-9 rounded-lg font-bold text-xs transition ${
                  selectedVersionLetter === v.versionLetter
                    ? 'bg-indigo-600 text-on-accent shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {v.versionLetter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {currentVersion && (
        <div className="space-y-6">
          {/* Painel do Gabarito Oficial */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4 border-b pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                  Gabarito Oficial (Versão {currentVersion.versionLetter})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chave de respostas codificada e protegida no QR Code da Versão {currentVersion.versionLetter}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Protegido por Senha
                </span>

                <button
                  type="button"
                  onClick={() => setShowAnswerSheetPreview(!showAnswerSheetPreview)}
                  className="flex items-center gap-1.5 px-3 py-1 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
                  <span>{showAnswerSheetPreview ? 'Ocultar Cartão A4' : 'Visualizar Cartão A4'}</span>
                </button>
              </div>
            </div>

            {currentVersion.questions.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">
                Nenhuma questão cadastrada para esta versão.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {currentVersion.questions.map((q, idx) => {
                  const qNum = idx + 1;
                  const opt = currentVersion.objectiveAnswerKey[qNum];
                  return (
                    <div
                      key={q.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between font-mono"
                    >
                      <span className="text-xs font-bold text-slate-700">Q{qNum}</span>
                      {q.type === 'objective' ? (
                        <span className="w-7 h-7 rounded-full bg-indigo-600 text-on-accent font-bold text-xs flex items-center justify-center shadow-sm">
                          {opt || '-'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic font-sans font-medium">
                          Dissertativa
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pré-visualização da Folha de Respostas A4 */}
          {showAnswerSheetPreview && (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4 border-b pb-3 flex-wrap gap-2">
                <span className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                  Pré-visualização da Folha de Respostas A4 (Versão {currentVersion.versionLetter})
                </span>
              </div>

              {/* Aviso para telas pequenas */}
              <div className="block lg:hidden mb-4 p-3 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <strong>Visualização A4 no Celular:</strong> A folha abaixo é exibida na proporção oficial de impressão A4. Deslize horizontalmente para inspecionar todas as seções (QR Code, cabeçalho e bolinhas).
              </div>

              <div className="w-full overflow-x-auto pb-4">
                <div className="min-w-fit mx-auto flex justify-center">
                  <AnswerSheetView version={currentVersion} header={exam.header} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

