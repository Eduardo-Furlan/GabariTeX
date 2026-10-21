import React, { useState, useRef } from 'react';
import {
  Upload,
  AlertTriangle,
  FolderDown,
  Loader2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { GroupPicker } from './GroupPicker';
import { useBank } from '../../context/BankContext';
import {
  parseBankShareZip,
  mergeSubtreeIntoBank,
  BankSharePayload,
} from '../../utils/bank/shareZip';
import { toast } from '../ui/toastStore';

export interface BankImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultParentGroupId?: string | null;
}

export const BankImportModal: React.FC<BankImportModalProps> = ({
  isOpen,
  onClose,
  defaultParentGroupId = null,
}) => {
  const { groups, tags, questions, blueprints, replaceBank } = useBank();

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPayload, setParsedPayload] = useState<BankSharePayload | null>(null);
  const [targetParentGroupId, setTargetParentGroupId] = useState<string | null>(
    defaultParentGroupId
  );
  const [isApplying, setIsApplying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setParseError(null);
    setParsedPayload(null);
    setTargetParentGroupId(defaultParentGroupId);
    setIsParsing(false);
    setIsApplying(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelected = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setParsedPayload(null);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const payload = await parseBankShareZip(bytes);
      setParsedPayload(payload);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Falha ao analisar arquivo compactado.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedPayload) return;
    setIsApplying(true);
    try {
      const currentBank = {
        groups,
        tags,
        questions,
        blueprints,
      };

      const result = mergeSubtreeIntoBank(
        currentBank,
        parsedPayload,
        targetParentGroupId
      );

      const saveRes = await replaceBank(result.updatedBank);
      if (!saveRes.ok) {
        throw new Error(
          typeof saveRes.error === 'string'
            ? saveRes.error
            : 'Falha ao persistir questões no banco.'
        );
      }

      const { summary } = result;
      const parts: string[] = [];
      if (summary.questionsAdded > 0) {
        parts.push(`${summary.questionsAdded} novas questões`);
      }
      if (summary.questionsUpdated > 0) {
        parts.push(`${summary.questionsUpdated} atualizadas`);
      }
      if (summary.groupsAdded > 0) {
        parts.push(`${summary.groupsAdded} novos grupos`);
      }

      const msg =
        parts.length > 0
          ? `Importação concluída: ${parts.join(', ')}.`
          : 'Importação concluída: todos os itens já estavam atualizados.';

      toast.success(msg);
      handleReset();
      onClose();
    } catch (err) {
      toast.error(
        `Erro ao importar: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsApplying(false);
    }
  };

  const rootGroup = parsedPayload?.groups.find((g) => g.parentId === null) || parsedPayload?.groups[0];

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleReset();
          onClose();
        }
      }}
      title="Importar Questões do Banco"
      description="Importe um grupo ou acervo compartilhado (.gabaritex-bank.zip)."
      size="md"
    >
      <div className="space-y-4">
        {!parsedPayload ? (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip,.gabaritex-bank.zip"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
              }}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500/50 rounded-card p-8 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition flex flex-col items-center justify-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shadow-sm">
                {isParsing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isParsing
                    ? 'Validando arquivo de banco...'
                    : 'Clique para selecionar o arquivo (.gabaritex-bank.zip)'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Arquivos compactados contendo questões e grupos de taxonomia pedagógica.
                </p>
              </div>
            </div>

            {parseError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-300 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Falha na leitura do arquivo</strong>
                  <p className="mt-0.5">{parseError}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo do Conteúdo */}
            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-500/5 space-y-2.5">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 block">
                Conteúdo do Pacote: {rootGroup?.name || 'Grupo'}
              </span>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <span className="text-base font-extrabold text-slate-800 block">
                    {parsedPayload.questions.length}
                  </span>
                  <span className="text-meta text-slate-500 font-medium">Questões</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <span className="text-base font-extrabold text-slate-800 block">
                    {parsedPayload.groups.length}
                  </span>
                  <span className="text-meta text-slate-500 font-medium">Grupos</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <span className="text-base font-extrabold text-slate-800 block">
                    {parsedPayload.tags.length}
                  </span>
                  <span className="text-meta text-slate-500 font-medium">Etiquetas</span>
                </div>
              </div>

              <p className="text-meta text-slate-600">
                • Etiquetas com nomes idênticos serão unificadas automaticamente mantendo as referências das questões.
              </p>
            </div>

            {/* Grupo de Destino */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Onde posicionar o grupo importado?
              </label>
              <GroupPicker
                groups={groups}
                value={targetParentGroupId}
                onChange={setTargetParentGroupId}
                allowRoot={true}
                rootLabel="Raiz (Nível Superior)"
              />
              <span className="text-meta text-slate-500 block mt-1">
                Caso o grupo já exista na sua biblioteca, ele não será movido; apenas seus dados e questões serão atualizados.
              </span>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={isApplying}
              >
                Escolher outro
              </Button>
              <Button
                variant="primary"
                onClick={handleExecuteImport}
                disabled={isApplying}
                icon={
                  isApplying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderDown className="w-4 h-4" />
                  )
                }
              >
                <span>{isApplying ? 'Importando...' : 'Confirmar e Importar'}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
