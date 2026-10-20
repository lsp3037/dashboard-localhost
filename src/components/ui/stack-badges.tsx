import { Badge } from '@/components/ui/badge';
import { stackLabel } from '@/lib/shared/labels';
import type { ProjectKind } from '@/lib/shared/types';

interface StackBadgesProps {
  stack: readonly string[];
  kind: ProjectKind;
  /** Quantos badges exibir antes de resumir em "+n". */
  max?: number;
}

/** Tags de stack do scan; `non-node` vira "sem app" (§5.2). */
export function StackBadges({ stack, kind, max = 3 }: StackBadgesProps) {
  if (kind === 'non-node' || stack.length === 0) {
    return (
      <Badge tone="muted" title="Sem package.json nem .git — listado, não iniciável">
        sem app
      </Badge>
    );
  }

  const visible = stack.slice(0, max);
  const hidden = stack.slice(max);

  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <Badge key={tag} tone="neutral">
          {stackLabel(tag)}
        </Badge>
      ))}
      {hidden.length > 0 && (
        <Badge tone="muted" title={hidden.map(stackLabel).join(' · ')}>
          +{hidden.length}
        </Badge>
      )}
    </span>
  );
}
