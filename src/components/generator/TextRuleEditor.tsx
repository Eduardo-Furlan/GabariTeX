import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Copy,
  Check,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Sparkles,
  Folder,
  Tag as TagIcon,
  Plus,
} from 'lucide-react';
import { Blueprint, BankGroup, BankTag } from '../../types/bank';
import { parse } from '../../utils/bank/query/parser';
import { print } from '../../utils/bank/query/printer';
import { getSuggestions, AutocompleteItem } from '../../utils/bank/query/suggest';
import { Diagnostic } from '../../utils/bank/query/diagnostics';
import { pathOf } from '../../utils/bank/tree';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { toast } from '../ui/toastStore';

export interface TextRuleEditorProps {
  blueprint: Blueprint;
  onChange: (bp: Blueprint) => void;
  groups: BankGroup[];
  tags: BankTag[];
}

export const TextRuleEditor: React.FC<TextRuleEditorProps> = ({
  blueprint,
  onChange,
  groups,
  tags,
}) => {
  const [lang, setLang] = useState<'pt' | 'en'>('pt');
  const [text, setText] = useState(() => print(blueprint.blocks, groups, tags, { lang: 'pt' }));
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [hasCopied, setHasCopied] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalChangeRef = useRef(false);

  // Parse function
  const runParse = useCallback(
    (currentText: string, currentLang: 'pt' | 'en') => {
      const result = parse(currentText, { groups, tags, lang: currentLang });
      setDiagnostics(result.diagnostics);

      // Only update parent if there are valid blocks and no syntax errors
      const hasErrors = result.diagnostics.some((d) => d.severity === 'error');
      if (!hasErrors && result.blocks.length > 0) {
        isInternalChangeRef.current = true;
        onChange({
          ...blueprint,
          blocks: result.blocks,
          updatedAt: new Date().toISOString(),
        });
      }
    },
    [groups, tags, blueprint, onChange]
  );

  // Update text when blueprint changes from outside (e.g. from visual builder)
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    const printed = print(blueprint.blocks, groups, tags, { lang });
    setText(printed);
    runParse(printed, lang);
  }, [blueprint, groups, tags, lang, runParse]);

  // Handle text change with debounce
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Update suggestions at cursor
    const cursorOffset = e.target.selectionStart ?? val.length;
    const items = getSuggestions(val, cursorOffset, { groups, tags, lang });
    setSuggestions(items.slice(0, 8));

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      runParse(val, lang);
    }, 250);
  };

  // Language toggle
  const handleToggleLang = (newLang: 'pt' | 'en') => {
    setLang(newLang);
    const reprinted = print(blueprint.blocks, groups, tags, { lang: newLang });
    setText(reprinted);
    runParse(reprinted, newLang);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
      toast.success('Regras copiadas para a área de transferência.');
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar regras.');
    }
  };

  // Move caret to diagnostic location
  const handleGoToDiagnostic = (d: Diagnostic) => {
    if (!textareaRef.current) return;
    const lines = text.split('\n');
    let offset = 0;
    for (let i = 0; i < d.line - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    offset += Math.max(0, d.col - 1);

    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(offset, offset + Math.max(1, d.length));
  };

  // Insert snippet at caret
  const handleInsertSnippet = (snippet: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart ?? text.length;
    const end = textareaRef.current.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const nextText = `${before}${snippet}${after}`;
    setText(nextText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = start + snippet.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);

    runParse(nextText, lang);
  };

  // Group and Tag insertion options
  const groupOptions = useMemo(() => {
    const list = [...groups];
    list.sort((a, b) => pathOf(groups, a.id).localeCompare(pathOf(groups, b.id), 'pt-BR'));
    return list.map((g) => {
      const fullPath = pathOf(groups, g.id);
      const insert = fullPath.includes(' ') ? `"${fullPath}"` : fullPath;
      return {
        value: insert,
        label: fullPath,
      };
    });
  }, [groups]);

  const tagOptions = useMemo(() => {
    const fn = lang === 'pt' ? 'etiqueta' : 'tag';
    return tags.map((t) => ({
      value: `${fn}("${t.name}")`,
      label: t.name,
    }));
  }, [tags, lang]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
        {/* Quick Insert Buttons for touch/mobile */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select<string>
            size="sm"
            value=""
            placeholder="+ Grupo"
            onChange={(val) => {
              if (val) handleInsertSnippet(val);
            }}
            options={groupOptions}
          />

          <Select<string>
            size="sm"
            value=""
            placeholder="+ Etiqueta"
            onChange={(val) => {
              if (val) handleInsertSnippet(val);
            }}
            options={tagOptions}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const kwFrom = lang === 'pt' ? 'DE' : 'FROM';
              const kwInc = lang === 'pt' ? 'INCLUIR' : 'INCLUDE';
              handleInsertSnippet(`\n${kwFrom} "Grupo" ${kwInc}\n  1 questao\n`);
            }}
          >
            + Bloco
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const kwQ = lang === 'pt' ? 'questao' : 'question';
              handleInsertSnippet(`  1 ${kwQ}\n`);
            }}
          >
            + Linha
          </Button>
        </div>

        {/* Right side: Lang Toggle and Copy */}
        <div className="flex items-center gap-2">
          {/* PT/EN Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleToggleLang('pt')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                lang === 'pt'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PT
            </button>
            <button
              type="button"
              onClick={() => handleToggleLang('en')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                lang === 'en'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            onClick={handleCopy}
            title="Copiar código de regras"
          >
            {hasCopied ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // small delay so suggestion clicks register
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          rows={12}
          spellCheck={false}
          className="w-full p-4 font-mono text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y"
          placeholder={
            lang === 'pt'
              ? 'DE "Matemática" INCLUIR\n  3 questões tipo("objetiva")\n  2 questões tipo("dissertativa")'
              : 'FROM "Math" INCLUDE\n  3 questions type("objective")\n  2 questions type("subjective")'
          }
        />
      </div>

      {/* Autocomplete Bar */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="p-2 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-1.5 flex-wrap">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 px-1">
            Sugestões:
          </span>
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertSnippet(item.insertText);
              }}
              className="px-2 py-1 rounded-md text-xs font-mono bg-slate-50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-indigo-500/30 transition flex items-center gap-1"
            >
              <span>{item.label}</span>
              {item.kind && (
                <span className="text-2xs text-slate-500 font-sans">({item.kind})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Diagnostics / Syntax Status */}
      <div className="space-y-2">
        {diagnostics.length === 0 ? (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">Sintaxe válida e pronta para geração.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {diagnostics.map((d, idx) => {
              const isError = d.severity === 'error';
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleGoToDiagnostic(d)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-2.5 ${
                    isError
                      ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30 hover:border-rose-400'
                      : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30 hover:border-amber-400'
                  }`}
                >
                  {isError ? (
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-semibold ${
                        isError ? 'text-rose-900 dark:text-rose-300' : 'text-amber-900 dark:text-amber-300'
                      }`}
                    >
                      Linha {d.line}, Coluna {d.col}: {d.message}
                    </p>
                    {d.suggestion && (
                      <p className="text-2xs text-slate-600 mt-0.5">
                        Você quis dizer: <code className="font-mono font-semibold">{d.suggestion}</code>? (clique para posicionar o cursor)
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
