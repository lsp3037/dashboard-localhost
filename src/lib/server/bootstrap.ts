import 'server-only';

import { closeDb, getDb } from '@/lib/server/db';
import { getProcessManager } from '@/lib/server/process/manager';
import { reconcileOrphanRuns } from '@/lib/server/process/reconcile';

/**
 * Bootstrap do servidor (§6.8): abre/migra o SQLite, reconcilia runs órfãs e registra o
 * shutdown síncrono. Chamado uma única vez por instância em `instrumentation.ts`.
 */

interface HubRuntimeGlobal {
  __hubBootstrapped?: boolean;
  __hubShutdownHooked?: boolean;
}

const globalForRuntime = globalThis as typeof globalThis & HubRuntimeGlobal;

function shutdown(): void {
  try {
    getProcessManager().shutdownSync();
  } catch (error) {
    console.error('[hub] shutdown: falha ao encerrar processos:', error);
  }

  try {
    closeDb();
  } catch (error) {
    console.error('[hub] shutdown: falha ao fechar o banco:', error);
  }
}

function installShutdownHandlers(): void {
  if (globalForRuntime.__hubShutdownHooked === true) return;
  globalForRuntime.__hubShutdownHooked = true;

  const onSignal = (signal: NodeJS.Signals): void => {
    console.info(`[hub] ${signal} recebido; encerrando runs ativas.`);
    shutdown();
    process.off(signal, onSignal);
    process.exit(0);
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  // `exit` não espera promises: só o kill síncrono funciona aqui.
  process.on('exit', shutdown);
}

export async function bootstrapHub(): Promise<void> {
  // Abre o SQLite antes de qualquer rota para que a migração aconteça uma única vez.
  getDb();
  installShutdownHandlers();

  if (globalForRuntime.__hubBootstrapped === true) return;
  globalForRuntime.__hubBootstrapped = true;

  await reconcileOrphanRuns();
}
