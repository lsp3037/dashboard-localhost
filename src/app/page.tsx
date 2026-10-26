import type { Metadata } from 'next';

import { ProjectBrowser } from '@/components/project-browser';
import { loadInventory } from '@/lib/server/overview';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inventário',
};

export default function DashboardPage() {
  const inventory = loadInventory();
  const { projects, roots, lastScanLabel, lastScanTitle } = inventory;
  const needsOnboarding = (inventory as { needsOnboarding?: boolean }).needsOnboarding ?? false;

  return (
    <ProjectBrowser
      projects={projects}
      roots={roots}
      lastScanLabel={lastScanLabel}
      lastScanTitle={lastScanTitle}
      needsOnboarding={needsOnboarding}
    />
  );
}
