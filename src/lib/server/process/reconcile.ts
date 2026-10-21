import 'server-only';

import { isProcessAliveWithIdentity } from '@/lib/server/process/kill';
import type { ProcessProbe } from '@/lib/server/process/kill';
import { getProcessManager } from '@/lib/server/process/manager';
import { findPortForPidTree } from '@/lib/server/process/ports';
import { finishRun, getActiveRuns, updateRunPort } from '@/lib/server/repos/runs';

/**
 * Reconciliação do boot (§6.8) — C8.
 *
 * Regra inegociável: **nunca matar no boot**. Run cujo PID continua vivo e com a mesma
 * identidade é adotado (recuperação após HMR/restart); qualquer outro caso vira `crashed`
 * com `ORPHAN_RECONCILED` para a UI poder mostrar o listener externo.
 */

export interface ReconcileResult {
  readonly adopted: number;
  readonly crashed: number;
}

export async function reconcileOrphanRuns(probe?: ProcessProbe): Promise<ReconcileResult> {
  const manager = getProcessManager();
  const runs = getActiveRuns();
  let adopted = 0;
  let crashed = 0;

  for (const run of runs) {
    const alive =
      run.pid !== null && (await isProcessAliveWithIdentity(run.pid, run.pidStartedAt, probe));

    if (alive && run.pid !== null) {
      // Read-only: descobre a porta só quando o banco não a tem.
      const port = run.port ?? (await findPortForPidTree(run.pid));
      if (port !== null && port !== run.port) updateRunPort(run.id, port);

      manager.adoptRun({ ...run, port });
      adopted += 1;
      continue;
    }

    finishRun(run.id, {
      status: 'crashed',
      errorCode: 'ORPHAN_RECONCILED',
      errorMessage: 'Execução sem processo correspondente no boot; nada foi encerrado.',
    });
    crashed += 1;
  }

  if (adopted > 0 || crashed > 0) {
    console.info(`[hub] reconciliação: ${String(adopted)} run(s) adotada(s), ${String(crashed)} órfã(s).`);
  }

  return { adopted, crashed };
}
