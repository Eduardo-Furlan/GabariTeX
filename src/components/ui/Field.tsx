import React, { forwardRef, useId } from 'react';
import { cn } from './cn';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  error,
  id,
  className,
  children,
}) => {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div>{children}</div>
      {hint && !error && (
        <p id={hintId} className="text-meta text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-meta font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full h-10 px-3 rounded-lg border bg-white text-body text-slate-900 placeholder:text-slate-400',
          'transition focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400',
          error
            ? 'border-rose-400 focus:ring-rose-400'
            : 'border-slate-300 hover:border-slate-400',
          'disabled:opacity-50 disabled:bg-slate-50 disabled:pointer-events-none',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full min-h-[80px] p-3 rounded-lg border bg-white text-body text-slate-900 placeholder:text-slate-400',
          'transition focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400',
          error
            ? 'border-rose-400 focus:ring-rose-400'
            : 'border-slate-300 hover:border-slate-400',
          'disabled:opacity-50 disabled:bg-slate-50 disabled:pointer-events-none',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full h-10 px-3 rounded-lg border bg-white text-body text-slate-900',
          'transition focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400',
          error
            ? 'border-rose-400 focus:ring-rose-400'
            : 'border-slate-300 hover:border-slate-400',
          'disabled:opacity-50 disabled:bg-slate-50 disabled:pointer-events-none',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';
