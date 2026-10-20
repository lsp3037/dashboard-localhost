import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'warn' | 'error' | 'muted';

const TONE_CLASS: Readonly<Record<BadgeTone, string>> = {
  neutral: 'border-hub-border-strong bg-hub-surface-raised text-hub-text-muted',
  accent: 'border-hub-accent/40 bg-hub-accent/10 text-hub-accent',
  warn: 'border-status-starting/40 bg-status-starting/10 text-status-starting',
  error: 'border-status-error/40 bg-status-error/10 text-status-error',
  muted: 'border-hub-border bg-transparent text-hub-text-muted',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}

export function Badge({ children, tone = 'neutral', className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={[
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5',
        'text-[10px] font-medium uppercase leading-4 tracking-[0.08em]',
        TONE_CLASS[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
