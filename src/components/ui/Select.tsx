import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useId,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from './cn';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface SelectOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  options?: (SelectOption<T> | T)[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  variant?: 'field' | 'inline';
  className?: string;
  buttonClassName?: string;
  popoverClassName?: string;
  align?: 'start' | 'end';
  id?: string;
  name?: string;
  error?: boolean;
  'aria-label'?: string;
  title?: string;
  children?: React.ReactNode;
}

export function Select<T extends string = string>({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = 'Selecione...',
  disabled = false,
  size = 'md',
  variant = 'field',
  className,
  buttonClassName,
  popoverClassName,
  align = 'start',
  id,
  name,
  error = false,
  'aria-label': ariaLabel,
  title,
  children,
}: SelectProps<T>) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalVal, setInternalVal] = useState<T>(
    value ?? defaultValue ?? ('' as T)
  );

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalVal;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typeaheadBuffer = useRef('');
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left?: number;
    right?: number;
    minWidth: number;
    transform?: string;
  } | null>(null);

  // Normalize options from options prop or children
  const normalizedOptions: SelectOption<T>[] = useMemo(() => {
    if (options && options.length > 0) {
      return options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      );
    }
    if (children) {
      const parsed: SelectOption<T>[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.props) {
          const optValue = child.props.value !== undefined ? String(child.props.value) : '';
          parsed.push({
            value: optValue as T,
            label: child.props.children ?? optValue,
            disabled: child.props.disabled,
          });
        }
      });
      return parsed;
    }
    return [];
  }, [options, children]);

  const selectedOption = useMemo(
    () => normalizedOptions.find((opt) => opt.value === currentValue),
    [normalizedOptions, currentValue]
  );

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldFlip = spaceBelow < 220 && rect.top > spaceBelow;

    const top = shouldFlip ? Math.max(8, rect.top - 4) : rect.bottom + 4;
    const transform = shouldFlip ? 'translateY(-100%)' : 'none';

    setCoords({
      top,
      left: align === 'start' ? rect.left : undefined,
      right: align === 'end' ? window.innerWidth - rect.right : undefined,
      minWidth: Math.max(rect.width, 140),
      transform,
    });
  }, [align]);

  // Position updates
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Sync highlightedIndex on open
  useEffect(() => {
    if (isOpen) {
      const currIdx = normalizedOptions.findIndex((opt) => opt.value === currentValue);
      setHighlightedIndex(currIdx >= 0 ? currIdx : 0);
    }
  }, [isOpen, normalizedOptions, currentValue]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [isOpen, highlightedIndex]);

  // Click outside and Escape handling
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectOption = useCallback(
    (opt: SelectOption<T>) => {
      if (opt.disabled) return;
      if (!isControlled) {
        setInternalVal(opt.value);
      }
      onChange?.(opt.value);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [isControlled, onChange]
  );

  const moveHighlight = useCallback(
    (direction: 'next' | 'prev' | 'first' | 'last') => {
      if (normalizedOptions.length === 0) return;
      let nextIdx = highlightedIndex;

      if (direction === 'first') {
        nextIdx = 0;
      } else if (direction === 'last') {
        nextIdx = normalizedOptions.length - 1;
      } else if (direction === 'next') {
        nextIdx = (highlightedIndex + 1) % normalizedOptions.length;
      } else if (direction === 'prev') {
        nextIdx = (highlightedIndex - 1 + normalizedOptions.length) % normalizedOptions.length;
      }

      // Skip disabled items if possible
      for (let i = 0; i < normalizedOptions.length; i++) {
        if (!normalizedOptions[nextIdx]?.disabled) {
          setHighlightedIndex(nextIdx);
          break;
        }
        nextIdx =
          direction === 'prev'
            ? (nextIdx - 1 + normalizedOptions.length) % normalizedOptions.length
            : (nextIdx + 1) % normalizedOptions.length;
      }
    },
    [highlightedIndex, normalizedOptions]
  );

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        if (e.key === 'ArrowUp') {
          moveHighlight('last');
        } else {
          moveHighlight('first');
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight('next');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight('prev');
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveHighlight('first');
    } else if (e.key === 'End') {
      e.preventDefault();
      moveHighlight('last');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0 && normalizedOptions[highlightedIndex]) {
        selectOption(normalizedOptions[highlightedIndex]);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typeahead search
      e.preventDefault();
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
      typeaheadBuffer.current += e.key.toLowerCase();
      typeaheadTimer.current = setTimeout(() => {
        typeaheadBuffer.current = '';
      }, 500);

      const query = typeaheadBuffer.current;
      const foundIdx = normalizedOptions.findIndex((opt) => {
        if (opt.disabled) return false;
        const text = typeof opt.label === 'string' ? opt.label : String(opt.value);
        return text.toLowerCase().startsWith(query);
      });
      if (foundIdx >= 0) {
        setHighlightedIndex(foundIdx);
      }
    }
  };

  const isClient = typeof window !== 'undefined' && typeof document !== 'undefined';

  return (
    <div className={cn('relative inline-block', className)}>
      {/* Hidden native select for accessibility and form integration */}
      <select
        id={id}
        name={name}
        value={currentValue}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const val = e.target.value as T;
          if (!isControlled) setInternalVal(val);
          onChange?.(val);
        }}
        className="sr-only pointer-events-none"
      >
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {typeof opt.label === 'string' ? opt.label : opt.value}
          </option>
        ))}
      </select>

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        title={title}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'inline-flex items-center justify-between gap-2 font-medium transition-colors select-none',
          variant === 'field' && 'rounded-lg border bg-white text-slate-800',
          variant === 'field' && (size === 'sm' ? 'h-8 px-2.5 py-1 text-xs' : 'h-10 px-3 py-2 text-sm'),
          variant === 'field' &&
            (error
              ? 'border-rose-400 focus:ring-2 focus:ring-rose-400'
              : 'border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'),
          variant === 'inline' &&
            'bg-transparent text-slate-700 hover:text-slate-900 font-semibold text-meta px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          buttonClassName
        )}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Listbox in Portal */}
      {isClient &&
        isOpen &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              right: coords.right,
              minWidth: coords.minWidth,
              transform: coords.transform,
            }}
            className={cn(
              'z-50 bg-white border border-slate-200',
              'rounded-card shadow-raised overflow-hidden max-h-60 overflow-y-auto py-1 transition-opacity duration-100',
              popoverClassName
            )}
          >
            {normalizedOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">
                Nenhuma opção
              </div>
            ) : (
              normalizedOptions.map((opt, idx) => {
                const isSelected = opt.value === currentValue;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    ref={(el) => (optionRefs.current[idx] = el)}
                    id={`${selectId}-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    data-highlighted={isHighlighted}
                    onClick={() => selectOption(opt)}
                    onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                    className={cn(
                      'px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer select-none transition-colors',
                      opt.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                      !opt.disabled && isHighlighted && 'bg-slate-100',
                      isSelected
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-500/10'
                        : 'text-slate-800'
                    )}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
