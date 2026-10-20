import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'bg-hub-accent text-hub-bg hover:bg-hub-accent-strong focus-visible:outline-hub-accent border border-transparent',
  secondary:
    'border border-hub-border-strong bg-hub-surface-raised text-hub-text hover:border-hub-accent hover:text-hub-accent focus-visible:outline-hub-accent',
  ghost:
    'border border-transparent text-hub-text-muted hover:bg-hub-surface-raised hover:text-hub-text focus-visible:outline-hub-accent',
  danger:
    'border border-status-error/60 bg-transparent text-status-error hover:bg-status-error/10 focus-visible:outline-status-error',
};

const SIZE_CLASS: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-7 gap-1.5 px-2 text-[11px]',
  md: 'h-8 gap-2 px-3 text-[12px]',
};

interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function buttonClass({ variant = 'secondary', size = 'md', className = '' }: ButtonClassOptions = {}): string {
  return [
    'inline-flex select-none items-center justify-center rounded-sm font-medium tracking-tight',
    'transition-[color,background-color,border-color,transform] duration-150 ease-out active:translate-y-px',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0',
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  ]
    .filter((part) => part.length > 0)
    .join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} {...props} className={buttonClass({ variant, size, className })} />;
}
