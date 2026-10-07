import React, { useState, useEffect, useCallback } from 'react';
import { Exam, ExamVersion, GradingRecord } from './types/exam';
import { initialSampleExam, emptyExam } from './utils/sampleExam';
import { generateExamVersions } from './utils/randomizer';
import {
  loadExamFromStorage,
  saveExamToStorage,
  loadGradebookFromStorage,
  saveGradebookToStorage,
  exportExamToJson,
} from './utils/storage';
import { Navbar, ActiveTab } from './components/Navbar';
import { ExamHeaderEditor } from './components/editor/ExamHeaderEditor';
import { QuestionList } from './components/editor/QuestionList';
import { ExamPrintView } from './components/preview/ExamPrintView';
import { AnswerSheetView } from './components/preview/AnswerSheetView';
import { CameraScanner } from './components/scanner/CameraScanner';
import { PhotoUploader } from './components/scanner/PhotoUploader';
import { PasswordModal } from './components/scanner/PasswordModal';
import { GradingModal } from './components/scanner/GradingModal';
import { GradebookTable } from './components/gradebook/GradebookTable';
import { DecryptedQrPayload } from './types/omr';
import { Printer, Shuffle, Eye, ShieldCheck, BookOpen, KeyRound, CheckCircle2, RefreshCw } from 'lucide-react';
import './styles/print.css';

type PrintMode = 'complete' | 'exam_only' | 'answersheet_only' | 'all_versions';

export const App: React.FC = () => {
  const [exam, setExam] = useState<Exam>(() => {
    return loadExamFromStorage() || emptyExam;
  });

  const [versions, setVersions] = useState<ExamVersion[]>([]);
  const [selectedVersionLetter, setSelectedVersionLetter] = useState<string>('A');
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [printMode, setPrintMode] = useState<PrintMode>('complete');
  const [showAnswerSheetPreview, setShowAnswerSheetPreview] = useState<boolean>(true);

  const [teacherPassword, setTeacherPassword] = useState<string>(() => {
    return (
      localStorage.getItem('mcorr_teacher_password') ||
      exam.password ||
      'senha123'
    );
  });

  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [gradingModalRecord, setGradingModalRecord] = useState<GradingRecord | null>(null);
  const [activePayload, setActivePayload] = useState<DecryptedQrPayload | null>(null);

  const [records, setRecords] = useState<GradingRecord[]>(() => {
    return loadGradebookFromStorage();
  });

  const updateTeacherPassword = (newPass: string) => {
    setTeacherPassword(newPass);
    localStorage.setItem('mcorr_teacher_password', newPass);
    setExam((prev) => ({ ...prev, password: newPass }));
  };

  // Atualiza as versões da prova sempre que as questões ou configurações mudarem
  const refreshVersions = useCallback(async (currentExam: Exam) => {
    try {
      const generated = await generateExamVersions(currentExam);
      setVersions(generated);
      if (generated.length > 0 && !generated.some((v) => v.versionLetter === selectedVersionLetter)) {
        setSelectedVersionLetter(generated[0].versionLetter);
      }
    } catch (err) {
      console.error('Erro ao gerar versões', err);
    }
  }, [selectedVersionLetter]);

  useEffect(() => {
    saveExamToStorage(exam);
    refreshVersions(exam);
  }, [exam, refreshVersions]);

  useEffect(() => {
    saveGradebookToStorage(records);
  }, [records]);

  const handleExamChange = (updated: Exam) => {
    setExam(updated);
    if (updated.password) {
      setTeacherPassword(updated.password);
      localStorage.setItem('mcorr_teacher_password', updated.password);
    }
  };

  const handleLoadSample = () => {
    if (
      exam.questions.length === 0 ||
      confirm('Deseja carregar a prova modelo de Cálculo/Matemática? Suas alterações atuais serão substituídas.')
    ) {
      setExam(initialSampleExam);
      updateTeacherPassword(initialSampleExam.password);
    }
  };

  const handleClearExam = () => {
    if (
      confirm(
        'Tem certeza de que deseja limpar toda a prova? Todas as informações de cabeçalho, instruções e questões cadastradas serão apagadas.'
      )
    ) {
      setExam(emptyExam);
      localStorage.removeItem('mcorr_exam_data');
      setVersions([]);
    }
  };

  const handleImportJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Exam;
        if (parsed.header && parsed.questions) {
          setExam(parsed);
          if (parsed.password) {
            updateTeacherPassword(parsed.password);
          }
          alert('Prova importada com sucesso!');
        } else {
          alert('Arquivo JSON inválido.');
        }
      } catch {
        alert('Erro ao processar arquivo JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleSelectExamVersion = (v: ExamVersion) => {
    const pointsMap: Record<number, number> = {};
    const subjectiveQuestions: number[] = [];

    v.questions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (q.type === 'subjective') {
        subjectiveQuestions.push(qNum);
      } else {
        pointsMap[qNum] = q.points;
      }
    });

    setActivePayload({
      examId: exam.id,
      version: v.versionLetter,
      key: v.objectiveAnswerKey,
      points: pointsMap,
      totalQuestions: v.questions.length,
      subjectiveQuestions,
    });
  };

  const handleGradeSaved = (newRecord: GradingRecord) => {
    setRecords((prev) => [newRecord, ...prev]);
    setGradingModalRecord(null);
  };

  const currentVersion = versions.find((v) => v.versionLetter === selectedVersionLetter) || versions[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 overflow-x-hidden print:bg-white print:min-h-0 print:overflow-visible">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExportJson={() => exportExamToJson(exam)}
        onImportJson={handleImportJson}
        onLoadSample={handleLoadSample}
        onClearExam={handleClearExam}
        hasQuestions={exam.questions.length > 0}
        gradedCount={records.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 print:p-0 print:m-0 print:max-w-none">
        {/* ABA 1: CRIAR PROVA */}
        {activeTab === 'editor' && (
          <div className="space-y-6">
            <ExamHeaderEditor exam={exam} onChange={handleExamChange} />

            {exam.questions.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-indigo-200 p-8 text-center my-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Nenhuma questão cadastrada
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Comece a montar sua avaliação do zero através dos botões abaixo, ou carregue a prova modelo de Matemática para explorar as funcionalidades com KaTeX, alternativas e dissertativas.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    <BookOpen className="w-4 h-4" /> Carregar Exemplo Completo de Matemática
                  </button>
                </div>
              </div>
            )}

            <QuestionList
              questions={exam.questions}
              onChange={(updatedQuestions) => handleExamChange({ ...exam, questions: updatedQuestions })}
            />
          </div>
        )}

        {/* ABA 2: VERSÕES & GABARITOS */}
        {activeTab === 'versions' && (
          <div className="space-y-6">
            {/* Seletor de Versões */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Shuffle className="w-5 h-5 text-indigo-600" />
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
                          ? 'bg-indigo-600 text-white shadow-sm'
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
                {/* Painel do Gabarito Oficial (100% visível, sem scrollbar horizontal) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-4 border-b pb-3 flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        Gabarito Oficial — Versão {currentVersion.versionLetter}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Chave de respostas codificada e protegida no QR Code da Versão {currentVersion.versionLetter}.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Protegido por Senha
                      </span>

                      <button
                        type="button"
                        onClick={() => setShowAnswerSheetPreview(!showAnswerSheetPreview)}
                        className="flex items-center gap-1.5 px-3 py-1 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
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
                              <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
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
                        <Eye className="w-4 h-4 text-indigo-600" />
                        Pré-visualização da Folha de Respostas A4 (Versão {currentVersion.versionLetter})
                      </span>
                    </div>

                    {/* Aviso para telas pequenas */}
                    <div className="block lg:hidden mb-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 leading-relaxed">
                      💡 <strong>Visualização A4 no Celular:</strong> A folha abaixo é exibida na proporção oficial de impressão A4. Deslize horizontalmente para inspecionar todas as seções (QR Code, cabeçalho e bolinhas).
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
        )}

        {/* ABA 3: IMPRIMIR / SALVAR PDF */}
        {activeTab === 'print' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  Central de Impressão A4 / Exportação PDF
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  O modo &quot;Prova Completa&quot; coloca o Cartão-Resposta padronizado como Folha 1 (capa), seguido pelas folhas de questões.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
                <div className="flex flex-wrap sm:flex-nowrap bg-slate-100 rounded-lg p-1 text-xs font-semibold gap-1 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setPrintMode('complete')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                      printMode === 'complete' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Prova Completa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('exam_only')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                      printMode === 'exam_only' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Apenas Caderno
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('answersheet_only')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                      printMode === 'answersheet_only' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Apenas Cartão
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('all_versions')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition text-center whitespace-nowrap ${
                      printMode === 'all_versions' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({versions.length})
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-between sm:justify-start">
                  {printMode !== 'all_versions' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-600 font-medium">Versão:</span>
                      <select
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        value={selectedVersionLetter}
                        onChange={(e) => setSelectedVersionLetter(e.target.value)}
                      >
                        {versions.map((v) => (
                          <option key={v.versionLetter} value={v.versionLetter}>
                            Versão {v.versionLetter}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Aviso no celular para Tab 3 */}
            <div className="block lg:hidden p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 leading-relaxed no-print">
              💡 <strong>Visualização A4 no Celular:</strong> As páginas abaixo estão no tamanho real de impressão A4. Deslize horizontalmente para inspecionar. Para imprimir ou salvar em PDF no celular, use o botão <strong>Imprimir / Salvar PDF</strong> acima.
            </div>

            {/* Visualização de Páginas A4 com Quebras Visíveis */}
            <div className="print-area-wrapper w-full overflow-x-auto py-4 print:p-0 print:m-0 print:bg-white print:overflow-visible">
              <div className="min-w-fit mx-auto flex flex-col items-center">
                {printMode === 'complete' && currentVersion && (
                  <div className="w-full flex flex-col items-center">
                    <AnswerSheetView version={currentVersion} header={exam.header} />
                    <div className="a4-page-separator">
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
                  <AnswerSheetView version={currentVersion} header={exam.header} />
                </div>
              )}

              {printMode === 'all_versions' && (
                <div className="w-full flex flex-col items-center">
                  {versions.map((v, idx) => (
                    <React.Fragment key={v.versionLetter}>
                      <AnswerSheetView version={v} header={exam.header} />
                      <div className="a4-page-separator">
                        Quebra de Página A4 — Caderno de Questões (Versão {v.versionLetter})
                      </div>
                      <ExamPrintView
                        version={v}
                        header={exam.header}
                        twoColumns={exam.twoColumns}
                      />
                      {idx < versions.length - 1 && (
                        <div className="a4-page-separator text-indigo-700 border-indigo-300 font-bold">
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
        )}

        {/* ABA 4: CORRETOR OMR (AUTÔNOMO) */}
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            {/* Banner de Operação Autônoma e Senha da Prova */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">
                      Corretor Óptico em 2 Passos
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                      O gabarito oficial está criptografado no QR Code de cada folha. Para correção em papel físico, use o fluxo em 2 passos: primeiro trave a versão (lendo o QR Code de perto ou selecionando-o abaixo), depois enquadre a folha e corrija em lote.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-amber-50/60 border border-amber-200 rounded-xl p-2.5 w-full sm:w-auto">
                  <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase">
                      Senha Mestra para Descriptografia:
                    </label>
                    <input
                      type="text"
                      placeholder="Senha da prova"
                      value={teacherPassword}
                      onChange={(e) => updateTeacherPassword(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-amber-300 rounded font-mono font-bold bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 mt-0.5"
                    />
                  </div>
                </div>
              </div>

              {/* Seletor / Status da Versão Travada */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Versão Travada para Correção:</span>
                  {activePayload ? (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-lg flex items-center gap-1.5 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> VERSÃO {activePayload.version}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-medium text-xs rounded-lg">
                      Nenhuma (Modo Auto via QR Code na Câmera)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {versions.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-medium">Travar:</span>
                      {versions.map((v) => (
                        <button
                          key={v.versionLetter}
                          type="button"
                          onClick={() => handleSelectExamVersion(v)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                            activePayload?.version === v.versionLetter
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {v.versionLetter}
                        </button>
                      ))}
                    </div>
                  )}

                  {activePayload && (
                    <button
                      type="button"
                      onClick={() => setActivePayload(null)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      <RefreshCw className="w-3 h-3" /> Destravar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CameraScanner
                teacherPassword={teacherPassword}
                activePayload={activePayload}
                onLockPayload={(payload) => setActivePayload(payload)}
                onUnlockPayload={() => setActivePayload(null)}
                onGraded={(res) => setGradingModalRecord(res)}
                onRequestPasswordChange={() => setShowPasswordModal(true)}
                availableVersions={versions}
                onSelectExamVersion={handleSelectExamVersion}
              />
              <PhotoUploader
                teacherPassword={teacherPassword}
                activePayload={activePayload}
                onLockPayload={(payload) => setActivePayload(payload)}
                onGraded={(res) => setGradingModalRecord(res)}
                availableVersions={versions}
                onSelectExamVersion={handleSelectExamVersion}
              />
            </div>
          </div>
        )}

        {/* ABA 5: LIVRO DE NOTAS */}
        {activeTab === 'gradebook' && (
          <GradebookTable
            records={records}
            onDeleteRecord={(id) => setRecords((prev) => prev.filter((r) => r.id !== id))}
            onClearAll={() => {
              if (confirm('Tem certeza de que deseja apagar todas as notas corrigidas?')) {
                setRecords([]);
              }
            }}
          />
        )}
      </main>

      {/* MODAL DE SENHA */}
      {showPasswordModal && (
        <PasswordModal
          currentPassword={teacherPassword}
          onSavePassword={updateTeacherPassword}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      {/* MODAL DE CORREÇÃO E CONFIRMAÇÃO DE NOTA */}
      {gradingModalRecord && (
        <GradingModal
          initialRecord={gradingModalRecord}
          onSave={handleGradeSaved}
          onCancel={() => setGradingModalRecord(null)}
        />
      )}
    </div>
  );
};
