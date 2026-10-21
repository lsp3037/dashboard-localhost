import 'server-only';

import type { PackageManager, ProjectKind } from '@/lib/shared/types';

/** Projeto como o scan o descobriu; ainda não tem id nem id de pai resolvido. */
export interface ScannedProject {
  readonly path: string;
  /** Nome exibido: nome da pasta no disco (ou o escolhido pelo usuário, no cadastro manual). */
  readonly name: string;
  /** `package.json.name`, quando existir e for válido. Nunca é usado como nome exibido. */
  readonly packageName: string | null;
  readonly parentPath: string | null;
  readonly kind: ProjectKind;
  readonly stack: readonly string[];
  readonly packageManager: PackageManager | null;
  readonly scripts: readonly string[];
  /** Porta declarada no script (`-p`/`--port`); só preenche a preferência quando ela ainda é nula. */
  readonly preferredPort: number | null;
  readonly gitBranch: string | null;
  readonly gitHeadAt: string | null;
}
