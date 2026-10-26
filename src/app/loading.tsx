import { ProjectGridSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="animate-reveal space-y-4">
      <ProjectGridSkeleton count={6} />
    </div>
  );
}
