import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const inputClass =
  'h-8 w-full rounded-sm border border-hub-border-strong bg-hub-bg px-2 font-mono text-[12px] text-hub-text ' +
  'placeholder:font-sans placeholder:text-hub-text-muted/60 ' +
  'focus-visible:border-hub-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hub-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const textareaClass =
  'min-h-20 w-full resize-y rounded-sm border border-hub-border-strong bg-hub-bg px-2 py-1.5 font-sans text-[12px] text-hub-text ' +
  'placeholder:text-hub-text-muted/60 focus-visible:border-hub-accent focus-visible:outline-2 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-hub-accent';

export const selectClass =
  'h-8 w-full rounded-sm border border-hub-border-strong bg-hub-bg px-2 font-mono text-[12px] text-hub-text ' +
  'focus-visible:border-hub-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hub-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  labelHint?: string;
}

export function Field({ id, label, hint, error, required, children, labelHint }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.1em] text-hub-text-muted">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-hub-accent">
              *
            </span>
          )}
        </label>
        {labelHint && <span className="font-mono text-[10px] text-hub-text-muted/70">{labelHint}</span>}
      </div>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-[11px] leading-4 text-hub-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[11px] leading-4 text-status-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function fieldAria(id: string, hint?: string, error?: string | null) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ');
  return {
    'aria-describedby': describedBy.length > 0 ? describedBy : undefined,
    'aria-invalid': error ? true : undefined,
  } as const;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`${inputClass} ${className}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea {...rest} className={`${textareaClass} ${className}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props;
  return <select {...rest} className={`${selectClass} ${className}`} />;
}
