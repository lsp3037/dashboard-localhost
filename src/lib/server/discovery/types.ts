import 'server-only';

import type { PackageManager, ProjectKind } from '@/lib/shared/types';

/** Projeto como o scan o descobriu; ainda não tem id nem id de pai resolvido. */
export interface ScannedProject {
  readonly path: string;
  readonly name: string;
  readonly parentPath: string | null;
  readonly kind: ProjectKind;
  readonly stack: readonly string[];
  readonly packageManager: PackageManager | null;
  readonly scripts: readonly string[];
  readonly gitBranch: string | null;
  readonly gitHeadAt: string | null;
}
