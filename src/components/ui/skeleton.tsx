interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-sm border border-hub-border bg-hub-surface-raised/60 ${className}`}
    />
  );
}

/** Skeleton do grid: mesma malha do dashboard para não pular layout. */
export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando projetos">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="border border-hub-border bg-hub-surface p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="ml-auto h-6 w-16" />
          </div>
          <Skeleton className="mt-3 h-2.5 w-24" />
          <Skeleton className="mt-3 h-3 w-36" />
          <Skeleton className="mt-3 h-2.5 w-full" />
        </div>
      ))}
    </div>
  );
}
