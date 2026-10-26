import type { ReactNode } from 'react';

interface TooltipProps {
  /** Texto do tooltip — também vira `title` para fallback nativo. */
  label: string;
  children: ReactNode;
  /** Lado onde o balão aparece. */
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Tooltip sem dependência: aparece em hover e em focus-within (funciona com
 * botões desabilitados porque o wrapper continua recebendo o ponteiro).
 */
export function Tooltip({ label, children, side = 'top', className = '' }: TooltipProps) {
  const position =
    side === 'top'
      ? 'bottom-full mb-1.5 origin-bottom'
      : 'top-full mt-1.5 origin-top';

  return (
    <span className={`group/tt relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={[
          'pointer-events-none absolute left-1/2 z-30 w-max max-w-[16rem] -translate-x-1/2',
          'border border-hub-border-strong bg-hub-surface-raised px-2 py-1',
          'text-[11px] leading-4 text-hub-text opacity-0 transition-opacity duration-150',
          'group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          position,
        ].join(' ')}
      >
        {label}
      </span>
    </span>
  );
}
