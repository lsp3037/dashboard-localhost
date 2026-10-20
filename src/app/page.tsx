import type { Metadata } from 'next';

import { ProjectBrowser } from '@/components/project-browser';
import { loadInventory } from '@/lib/server/overview';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inventário',
};

export default function DashboardPage() {
  const { projects, roots, lastScanLabel, lastScanTitle } = loadInventory();

  return (
    <ProjectBrowser
      projects={projects}
      roots={roots}
      lastScanLabel={lastScanLabel}
      lastScanTitle={lastScanTitle}
    />
  );
}
