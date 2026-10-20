import React, { useState, useRef, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { BankTag, TagColor } from '../../types/bank';
import { TAG_COLORS } from '../../utils/bank/tags';
import { TagBadge } from './TagBadge';
import { cn } from '../ui/cn';

export interface TagInputProps {
  selectedTagIds: string[];
  tags: BankTag[];
  onChange: (tagIds: string[]) => void;
  onCreateTag?: (name: string, color: TagColor) => Promise<BankTag | null>;
  maxTags?: number;
  disabled?: boolean;
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  selectedTagIds,
  tags,
  onChange,
  onCreateTag,
  maxTags = 20,
  disabled = false,
  className,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedColor, setSelectedColor] = useState<TagColor>('blue');
  const inputRef = useRef<HTMLInputElement>(null);

  const tagsById = useMemo(() => {
    return new Map(tags.map((t) => [t.id, t]));
  }, [tags]);

  const selectedTags = useMemo(() => {
    return selectedTagIds
      .map((id) => tagsById.get(id))
      .filter((t): t is BankTag => Boolean(t));
  }, [selectedTagIds, tagsById]);

  // Suggestions filtered by input text, excluding already selected tags
  const suggestions = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase();
    return tags.filter((t) => {
      if (selectedTagIds.includes(t.id)) return false;
      if (!trimmed) return true;
      return t.name.toLowerCase().includes(trimmed);
    });
  }, [tags, selectedTagIds, inputValue]);

  // Check if trimmed input exactly matches an existing tag
  const exactMatch = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed) return null;
    return tags.find((t) => t.name.toLowerCase() === trimmed) ?? null;
  }, [tags, inputValue]);

  const handleSelectTag = (tagId: string) => {
    if (selectedTagIds.length >= maxTags) return;
    if (!selectedTagIds.includes(tagId)) {
      onChange([...selectedTagIds, tagId]);
    }
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };

  const handleCreateNew = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || selectedTagIds.length >= maxTags) return;

    if (exactMatch) {
      handleSelectTag(exactMatch.id);
      return;
    }

    if (onCreateTag) {
      const created = await onCreateTag(trimmed, selectedColor);
      if (created) {
        onChange([...selectedTagIds, created.id]);
        setInputValue('');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactMatch) {
        handleSelectTag(exactMatch.id);
      } else if (suggestions.length === 1 && inputValue.trim()) {
        handleSelectTag(suggestions[0].id);
      } else if (inputValue.trim()) {
        handleCreateNew();
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedTagIds.length > 0) {
      handleRemoveTag(selectedTagIds[selectedTagIds.length - 1]);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={cn('relative flex flex-col gap-1.5', className)}>
      {/* Container with chips and input */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex flex-wrap items-center gap-1.5 min-h-10 px-2.5 py-1.5 rounded-lg border bg-white transition cursor-text',
          isFocused
            ? 'border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-300 hover:border-slate-400',
          disabled && 'opacity-60 pointer-events-none'
        )}
      >
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            onRemove={disabled ? undefined : () => handleRemoveTag(tag.id)}
          />
        ))}

        {selectedTagIds.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay slightly to allow suggestion clicks
              setTimeout(() => setIsFocused(false), 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedTags.length === 0
                ? 'Adicionar etiquetas (digite e pressione Enter)...'
                : 'Adicionar...'
            }
            disabled={disabled}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            aria-label="Etiquetas da questão"
          />
        )}
      </div>

      {/* Suggestions and Create Popover */}
      {isFocused && (suggestions.length > 0 || inputValue.trim()) && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-overlay text-xs flex flex-col gap-1">
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-2 py-1">
                Etiquetas existentes
              </span>
              {suggestions.slice(0, 8).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectTag(tag.id);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition text-left"
                >
                  <TagBadge name={tag.name} color={tag.color} />
                  <span className="text-meta text-slate-400">Selecionar</span>
                </button>
              ))}
            </div>
          )}

          {inputValue.trim() && !exactMatch && onCreateTag && (
            <div className="border-t border-slate-100 pt-1.5 mt-1 px-1 flex flex-col gap-1.5">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreateNew();
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 font-medium transition text-left"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Criar etiqueta &quot;<strong>{inputValue.trim()}</strong>&quot;
                </span>
              </button>

              <div className="flex items-center gap-1.5 px-1">
                <span className="text-[10px] text-slate-400">Cor:</span>
                <div className="flex items-center gap-1">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedColor(c);
                      }}
                      className={cn(
                        'w-4 h-4 rounded-full border transition flex items-center justify-center',
                        selectedColor === c
                          ? 'ring-2 ring-indigo-500 scale-110'
                          : 'opacity-70 hover:opacity-100'
                      )}
                    >
                      <TagBadge name="" color={c} className="p-0 border-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
