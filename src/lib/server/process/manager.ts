import 'server-only';

import fs from 'node:fs/promises';

import { getConfig } from '@/lib/server/config';
import { resolveAllowedPath } from '@/lib/server/discovery/paths';
import {
  alreadyRunning,
  killFailed,
  maxRunning,
  notRunning,
  portInUse,
  projectMissing,
} from '@/lib/server/errors';
import { buildProjectCommand, parseScriptPort, readScriptCommand, resolveRunnableScript } from '@/lib/server/process/command';
import { killTree, killTreeSync } from '@/lib/server/process/kill';
import { getProcessName, listListeners } from '@/lib/server/process/ports';
import { startRun } from '@/lib/server/process/runner';
import type { RunHandle, RunState } from '@/lib/server/process/runner';
import type { ProjectRow } from '@/lib/server/repos/projects';
import { finishRun, getActiveRun, getActiveRuns, markRunRunning } from '@/lib/server/repos/runs';
import type { RunRow } from '@/lib/server/repos/runs';
import type { RunStatus } from '@/lib/shared/types';

/**
 * Dono dos processos do hub (§2.4) — C5, C7, C8.
 *
 * Singleton em `globalThis` porque o HMR do Next recarrega módulos: um `Map` de módulo
 * perderia a referência dos filhos vivos. Lock por projeto serializa start/stop, e o
 * índice único parcial em `process_runs` é a segunda barreira (durável).
 *
 * Regra inegociável: o hub **nunca** mata um listener que não iniciou (§6.7).
 */

export interface ProcessManager {
  /** Inicia um run; `script === null` usa o script padrão do projeto. */
  start(project: ProjectRow, script?: string | null): Promise<RunState>;
  stop(projectId: string): Promise<RunState>;
  getRun(projectId: string): RunState | null;
  /** `true` só para PIDs de runs deste hub (raiz de cada árvore). */
  ownsPid(pid: number): boolean;
  /** Recupera um run já ativo no banco (reconciliação do boot) sem matar nada. */
  adoptRun(run: RunRow): RunState;
  activeCount(): number;
  /** Shutdown síncrono: `exit` não espera promises (§6.8). */
  shutdownSync(): void;
}

interface ProcessGlobal {
  __hubProcessManager?: ProcessManager;
  __hubHandles?: Map<string, RunHandle>;
  __hubLocks?: Map<string, Promise<void>>;
}

const globalForProcess = globalThis as typeof globalThis & ProcessGlobal;

function getSharedHandles(): Map<string, RunHandle> {
  if (globalForProcess.__hubHandles === undefined) {
    globalForProcess.__hubHandles = new Map<string, RunHandle>();
  }
  return globalForProcess.__hubHandles;
}

function getSharedLocks(): Map<string, Promise<void>> {
  if (globalForProcess.__hubLocks === undefined) {
    globalForProcess.__hubLocks = new Map<string, Promise<void>>();
  }
  return globalForProcess.__hubLocks;
}

function isActiveStatus(status: RunStatus): boolean {
  return status === 'starting' || status === 'running' || status === 'stopping';
}

function toRunState(run: RunRow): RunState {
  return {
    runId: run.id,
    projectId: run.projectId,
    script: run.script,
    command: run.command,
    pid: run.pid,
    pidStartedAt: run.pidStartedAt,
    port: run.port,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    exitCode: run.exitCode,
    errorCode: run.errorCode,
  };
}

/** Handle de um run que já estava ativo no banco (adotado no boot ou por consulta de status). */
function createAdoptedHandle(run: RunRow): RunHandle {
  let state = toRunState(run);

  return {
    runId: run.id,
    projectId: run.projectId,
    pid: run.pid,
    getState: () => ({ ...state }),
    getLines: () => [],
    onEnd: () => undefined,
    stop: async () => {
      let result: Awaited<ReturnType<typeof killTree>>;

      try {
        result = await killTree(state.pid, state.pidStartedAt);
      } catch (error) {
        throw killFailed('Não foi possível encerrar a árvore de processos.', {
          runId: state.runId,
          pid: state.pid,
          cause: error instanceof Error ? error.message : 'unknown',
        });
      }

      if (result.killed || result.reason === 'already_gone' || result.reason === 'no_pid') {
        state = {
          ...state,
          status: 'stopped',
          errorCode: null,
          endedAt: new Date().toISOString(),
        };
        finishRun(state.runId, { status: 'stopped', errorCode: null });
        return { ...state };
      }

      const errorCode = result.reason === 'identity_unknown' ? 'PID_UNVERIFIED' : 'PID_MISMATCH';
      state = { ...state, status: 'crashed', errorCode, endedAt: new Date().toISOString() };
      finishRun(state.runId, { status: 'crashed', errorCode });
      return { ...state };
    },
  };
}

async function assertProjectDirectory(projectPath: string): Promise<void> {
  try {
    const stats = await fs.stat(projectPath);
    if (!stats.isDirectory()) throw projectMissing(`O caminho não é um diretório: ${projectPath}`, { path: projectPath });
  } catch (error) {
    if (error instanceof Error && error.name === 'AppError') throw error;
    throw projectMissing(`Pasta não encontrada: ${projectPath}`, { path: projectPath });
  }
}

function createProcessManager(): ProcessManager {
  const handles = getSharedHandles();
  const locks = getSharedLocks();

  /** Fila por projeto: nunca há duas transições de start/stop concorrendo pelo mesmo id. */
  const withLock = <T>(projectId: string, task: () => Promise<T>): Promise<T> => {
    const previous = locks.get(projectId) ?? Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );

    locks.set(projectId, tail);
    void tail.then(() => {
      if (locks.get(projectId) === tail) locks.delete(projectId);
    });

    return run;
  };

  const adoptRun = (run: RunRow): RunState => {
    const existing = handles.get(run.projectId);

    if (existing !== undefined && existing.runId === run.id) {
      return existing.getState();
    }

    const handle = createAdoptedHandle(run);
    handles.set(run.projectId, handle);

    // Normaliza `starting` órfão que ainda tem PID vivo para `running`.
    if (run.status !== 'running') markRunRunning(run.id, run.port);

    return handle.getState();
  };

  const forget = (projectId: string, runId: string): void => {
    const current = handles.get(projectId);
    if (current !== undefined && current.runId === runId) handles.delete(projectId);
  };

  const ownsPid = (pid: number): boolean => {
    for (const handle of handles.values()) {
      if (handle.pid === pid) return true;
    }

    return false;
  };

  const start = (project: ProjectRow, script: string | null = null): Promise<RunState> =>
    withLock(project.id, async () => {
      const running = handles.get(project.id);
      if (running !== undefined && isActiveStatus(running.getState().status)) {
        throw alreadyRunning(`Projeto ${project.name} já está rodando.`, {
          projectId: project.id,
          runId: running.runId,
          pid: running.getState().pid,
        });
      }

      const dbActive = getActiveRun(project.id);
      if (dbActive !== null) {
        adoptRun(dbActive);
        throw alreadyRunning(`Projeto ${project.name} já está rodando.`, {
          projectId: project.id,
          runId: dbActive.id,
          pid: dbActive.pid,
        });
      }

      const config = getConfig();

      if (project.missing) {
        throw projectMissing(`Pasta não encontrada: ${project.path}`, { projectId: project.id, path: project.path });
      }

      // C1 antes de qualquer spawn: caminho fora da allowlist → 403.
      const projectPath = resolveAllowedPath(project.path);
      await assertProjectDirectory(projectPath);

      // C2: allowlist + existência no package.json → 422.
      const runnableScript = resolveRunnableScript(project, script, config.allowedScripts);

      const activeRuns = getActiveRuns();
      if (activeRuns.length >= config.maxRunning) {
        throw maxRunning(`Limite de ${String(config.maxRunning)} execuções simultâneas atingido.`, {
          maxRunning: config.maxRunning,
          activeRuns: activeRuns.length,
        });
      }

      const isLaravel = project.stack.includes('laravel');
      const scriptCommand = await readScriptCommand(projectPath, runnableScript);
      const targetPort = isLaravel
        ? (project.preferredPort ?? 8000)
        : (parseScriptPort(scriptCommand) ?? project.preferredPort);

      // C7: porta ocupada nunca é resolvida matando o dono.
      if (targetPort !== null) {
        const hubRun = activeRuns.find((run) => run.port === targetPort);

        if (hubRun !== undefined) {
          throw alreadyRunning(`Porta ${String(targetPort)} já pertence a uma execução do hub.`, {
            port: targetPort,
            pid: hubRun.pid,
            projectId: hubRun.projectId,
            owner: 'hub',
          });
        }

        const listeners = await listListeners();
        const ownerPid = listeners.get(targetPort);

        if (ownerPid !== undefined) {
          if (ownsPid(ownerPid)) {
            throw alreadyRunning(`Porta ${String(targetPort)} já pertence a uma execução do hub.`, {
              port: targetPort,
              pid: ownerPid,
              owner: 'hub',
            });
          }

          const processName = await getProcessName(ownerPid);

          throw portInUse(
            `Porta ${String(targetPort)} ocupada por ${processName ?? 'processo externo'} (PID ${String(ownerPid)}).`,
            { port: targetPort, pid: ownerPid, owner: 'external', processName },
          );
        }
      }

      const command = await buildProjectCommand(projectPath, project.packageManager, runnableScript, project.stack);
      const handle = await startRun({ project, script: runnableScript, command, scriptCommand });

      handles.set(project.id, handle);
      handle.onEnd(() => {
        forget(project.id, handle.runId);
      });

      return handle.getState();
    });

  const stop = (projectId: string): Promise<RunState> =>
    withLock(projectId, async () => {
      let handle = handles.get(projectId);

      if (handle === undefined) {
        const dbActive = getActiveRun(projectId);

        if (dbActive === null) {
          throw notRunning('Nenhum processo ativo para este projeto.', { projectId });
        }

        handle = createAdoptedHandle(dbActive);
        handles.set(projectId, handle);
      }

      const finalState = await handle.stop();
      handles.delete(projectId);

      return finalState;
    });

  const getRun = (projectId: string): RunState | null => {
    const handle = handles.get(projectId);
    if (handle !== undefined) return handle.getState();

    const dbActive = getActiveRun(projectId);
    if (dbActive === null) return null;

    return adoptRun(dbActive);
  };

  const activeCount = (): number => {
    let count = 0;

    for (const handle of handles.values()) {
      if (isActiveStatus(handle.getState().status)) count += 1;
    }

    return count;
  };

  const shutdownSync = (): void => {
    for (const handle of [...handles.values()]) {
      const state = handle.getState();
      if (!isActiveStatus(state.status)) continue;

      killTreeSync(state.pid);

      try {
        finishRun(state.runId, {
          status: 'stopped',
          exitCode: null,
          errorCode: 'HUB_SHUTDOWN',
          errorMessage: 'Hub encerrado; árvore de processos finalizada no shutdown.',
        });
      } catch (error) {
        console.error('[hub] shutdown: falha ao encerrar run no banco:', error);
      }
    }

    handles.clear();
  };

  return { start, stop, getRun, ownsPid, adoptRun, activeCount, shutdownSync };
}

export function getProcessManager(): ProcessManager {
  // Em desenvolvimento ou após HMR, recria o manager delegando para os maps compartilhados em globalThis.
  delete globalForProcess.__hubProcessManager;
  return createProcessManager();
}
