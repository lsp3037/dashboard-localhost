import type { StatusTone } from '@/lib/shared/view-model';

const DOT_CLASS: Readonly<Record<StatusTone, string>> = {
  idle: 'bg-status-idle',
  starting: 'bg-status-starting animate-pulse',
  running: 'bg-status-running',
  error: 'bg-status-error',
  blocked: 'bg-status-blocked',
};

interface StatusDotProps {
  tone: StatusTone;
  /** Texto sempre visível: status nunca depende só de cor (§5.5). */
  label: string;
  className?: string;
}

export function StatusDot({ tone, label, className = '' }: StatusDotProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[tone]}`} />
      <span className="text-[11px] leading-4 text-hub-text-muted">{label}</span>
    </span>
  );
}
