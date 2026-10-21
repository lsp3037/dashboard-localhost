import 'server-only';

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import { getConfig } from '@/lib/server/config';
import { killFailed, spawnFailed } from '@/lib/server/errors';
import { buildChildEnv, buildCommand, readScriptCommand } from '@/lib/server/process/command';
import type { RunnerCommand } from '@/lib/server/process/command';
import { defaultProcessProbe, killTree } from '@/lib/server/process/kill';
import { findPortForPidTree, parsePortFromLine, parseScriptPort } from '@/lib/server/process/ports';
import type { ProjectRow } from '@/lib/server/repos/projects';
import {
  createRun,
  finishRun,
  markRunRunning,
  setRunError,
  setRunStatus,
  updateRunIdentity,
  updateRunPort,
} from '@/lib/server/repos/runs';
import type { RunStatus } from '@/lib/shared/types';

/**
 * Um run = um processo (§2.6, §6.8).
 *
 * Este módulo faz spawn com `shell: false`, lê stdout/stderr linha a linha (ring buffer em
 * memória, sem SSE — F4), detecta a porta (log → script → árvore de PIDs) e grava cada
 * transição em `process_runs`. Matar continua sendo responsabilidade de `kill.ts`.
 */

const MAX_LINE_LENGTH = 8_192;
const EARLY_PORT_PROBE_MS = 5_000;
const MAX_EXIT_WAIT_MS = 5_000;

export interface RunState {
  runId: string;
  projectId: string;
  script: string;
  command: string;
  pid: number | null;
  pidStartedAt: string | null;
  port: number | null;
  status: RunStatus;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  errorCode: string | null;
}

export type LogStream = 'stdout' | 'stderr' | 'system';

export interface LogLine {
  readonly seq: number;
  readonly ts: string;
  readonly stream: LogStream;
  readonly line: string;
}

export interface RunHandle {
  readonly runId: string;
  readonly projectId: string;
  readonly pid: number | null;
  getState(): RunState;
  /** Ring buffer da execução corrente; consumido pelo SSE na F4. */
  getLines(): readonly LogLine[];
  stop(): Promise<RunState>;
  /** Dispara quando o processo termina (inclusive se já terminou antes da inscrição). */
  onEnd(listener: (state: RunState) => void): void;
}

export interface StartRunInput {
  readonly project: ProjectRow;
  readonly script: string;
  readonly command: RunnerCommand;
  /** Valor do script no `package.json`; usado para achar a porta declarada. */
  readonly scriptCommand: string | null;
}

interface FinalResult {
  status: RunStatus;
  exitCode: number | null;
  errorCode: string | null;
}

function attachLineReader(stream: Readable, onLine: (line: string) => void): void {
  let buffer = '';

  stream.setEncoding('utf8');
  stream.on('data', (chunk: string | Buffer) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');

    let index = buffer.indexOf('\n');

    while (index !== -1) {
      const rawLine = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      onLine(rawLine.replace(/\r$/, '').slice(0, MAX_LINE_LENGTH));
      index = buffer.indexOf('\n');
    }

    // Linha patologicamente longa (bundle minificado): trunca em vez de crescer sem limite.
    if (buffer.length > MAX_LINE_LENGTH) {
      onLine(buffer.slice(0, MAX_LINE_LENGTH));
      buffer = '';
    }
  });

  stream.on('end', () => {
    if (buffer.length === 0) return;
    onLine(buffer.replace(/\r$/, ''));
    buffer = '';
  });
}

/**
 * Cria a linha do run, faz o spawn e devolve o handle já com PID/identidade.
 * Falha de spawn → grava `failed`/`SPAWN_FAILED` e lança 500.
 */
export async function startRun(input: StartRunInput): Promise<RunHandle> {
  const config = getConfig();
  const { project, script, command, scriptCommand } = input;
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  const state: RunState = {
    runId,
    projectId: project.id,
    script,
    command: command.display,
    pid: null,
    pidStartedAt: null,
    port: null,
    status: 'starting',
    startedAt,
    endedAt: null,
    exitCode: null,
    errorCode: null,
  };

  createRun({ id: runId, projectId: project.id, script, command: command.display, startedAt });

  const env = buildChildEnv({
    runId,
    stack: project.stack,
    scriptCommand,
    preferredPort: project.preferredPort,
  });

  const child = spawn(command.file, [...command.args], {
    cwd: project.path,
    shell: false,
    windowsHide: true,
    detached: false,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const spawnError = await new Promise<Error | null>((resolve) => {
    const onError = (error: Error): void => {
      resolve(error);
    };

    child.once('error', onError);
    child.once('spawn', () => {
      child.off('error', onError);
      resolve(null);
    });
  });

  if (spawnError !== null) {
    finishRun(runId, { status: 'failed', errorCode: 'SPAWN_FAILED', errorMessage: spawnError.message });
    throw spawnFailed('Falha ao iniciar o processo do projeto.', { runId, script });
  }

  const pid = child.pid ?? null;
  if (pid !== null) {
    state.pid = pid;
    // Identidade do PID ANTES de qualquer possibilidade de stop (anti-reuso, §6.6).
    state.pidStartedAt = await defaultProcessProbe.readCreationDate(pid);
    updateRunIdentity(runId, pid, state.pidStartedAt);
  }

  const lines: LogLine[] = [];
  const endListeners: Array<(finalState: RunState) => void> = [];
  let seq = 0;
  let ended = false;
  let bootTimer: NodeJS.Timeout | null = null;
  let earlyProbeTimer: NodeJS.Timeout | null = null;
  let exitObserved = false;
  const exitWaiters: Array<() => void> = [];

  const snapshot = (): RunState => ({ ...state });

  const clearTimers = (): void => {
    if (bootTimer !== null) {
      clearTimeout(bootTimer);
      bootTimer = null;
    }

    if (earlyProbeTimer !== null) {
      clearTimeout(earlyProbeTimer);
      earlyProbeTimer = null;
    }
  };

  const finalize = (result: FinalResult): RunState => {
    if (ended) return snapshot();

    ended = true;
    state.status = result.status;
    state.exitCode = result.exitCode;
    state.errorCode = result.errorCode;
    state.endedAt = new Date().toISOString();

    clearTimers();
    finishRun(runId, { status: result.status, exitCode: result.exitCode, errorCode: result.errorCode });

    for (const listener of endListeners) {
      try {
        listener(snapshot());
      } catch (error) {
        console.error('[hub] runner: listener de fim falhou:', error);
      }
    }

    return snapshot();
  };

  const adoptPort = (port: number): void => {
    if (ended) return;

    if (state.status === 'starting') {
      state.port = port;
      state.status = 'running';
      markRunRunning(runId, port);
      clearTimers();
      return;
    }

    if (state.port !== port) {
      state.port = port;
      updateRunPort(runId, port);
    }
  };

  const pushLine = (stream: LogStream, line: string): void => {
    seq += 1;
    lines.push({ seq, ts: new Date().toISOString(), stream, line });

    const limit = config.logBufferLines;
    if (lines.length > limit) lines.splice(0, lines.length - limit);
  };

  const handleLine = (stream: LogStream, line: string): void => {
    pushLine(stream, line);

    if (state.port !== null || ended) return;

    const port = parsePortFromLine(line);
    if (port !== null) adoptPort(port);
  };

  attachLineReader(child.stdout, (line) => {
    handleLine('stdout', line);
  });

  attachLineReader(child.stderr, (line) => {
    handleLine('stderr', line);
  });

  /**
   * Timeout de boot (§6.8): não mata. Tenta script → árvore de PIDs e, sem porta,
   * marca `running` com `port = null` + `BOOT_TIMEOUT`.
   */
  bootTimer = setTimeout(() => {
    bootTimer = null;
    if (ended || state.status !== 'starting') return;

    void (async () => {
      const fallback =
        parseScriptPort(scriptCommand) ?? (state.pid === null ? null : await findPortForPidTree(state.pid));

      if (ended || state.status !== 'starting') return;

      if (fallback !== null) {
        adoptPort(fallback);
        return;
      }

      state.status = 'running';
      markRunRunning(runId, null);
      setRunError(runId, 'BOOT_TIMEOUT', 'Porta não detectada dentro do tempo de boot; processo mantido vivo.');
    })();
  }, config.bootTimeoutMs);
  bootTimer.unref();

  if (pid !== null) {
    earlyProbeTimer = setTimeout(() => {
      earlyProbeTimer = null;
      if (ended || state.status !== 'starting' || state.port !== null) return;

      void (async () => {
        const declared = parseScriptPort(scriptCommand);
        if (declared !== null) {
          adoptPort(declared);
          return;
        }

        const fromTree = await findPortForPidTree(pid);
        if (fromTree !== null) adoptPort(fromTree);
      })();
    }, Math.min(EARLY_PORT_PROBE_MS, Math.floor(config.bootTimeoutMs / 2)));
    earlyProbeTimer.unref();
  }

  child.on('error', (error: Error) => {
    console.error('[hub] runner: erro no processo filho:', error.message);
  });

  child.once('exit', (code, signal) => {
    exitObserved = true;

    const wasStopping = state.status === 'stopping';

    if (wasStopping || code === 0) {
      finalize({ status: 'stopped', exitCode: code, errorCode: null });
    } else {
      finalize({
        status: 'crashed',
        exitCode: code,
        errorCode: signal === null ? null : `SIGNAL_${signal}`,
      });
    }

    for (const waiter of exitWaiters.splice(0)) waiter();
  });

  const waitForExit = (timeoutMs: number): Promise<boolean> => {
    if (exitObserved || ended) return Promise.resolve(true);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, timeoutMs);
      timer.unref();

      exitWaiters.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  };

  return {
    runId,
    projectId: project.id,
    pid,
    getState: snapshot,
    getLines: () => [...lines],
    onEnd: (listener) => {
      if (ended) {
        listener(snapshot());
        return;
      }

      endListeners.push(listener);
    },
    stop: async () => {
      if (ended) return snapshot();

      const previousStatus = state.status;

      if (state.status === 'starting' || state.status === 'running') {
        state.status = 'stopping';
        setRunStatus(runId, 'stopping');
      }

      let result: Awaited<ReturnType<typeof killTree>>;

      try {
        result = await killTree(state.pid, state.pidStartedAt);
      } catch (error) {
        // Kill falhou: o processo continua vivo, então o run volta ao estado anterior.
        state.status = previousStatus;
        setRunStatus(runId, previousStatus);
        throw killFailed('Não foi possível encerrar a árvore de processos.', {
          runId,
          pid: state.pid,
          cause: error instanceof Error ? error.message : 'unknown',
        });
      }

      if (!result.killed) {
        if (result.reason === 'identity_mismatch') {
          setRunError(runId, 'PID_MISMATCH', 'PID reciclado: kill abortado por segurança.');
          return finalize({ status: 'crashed', exitCode: state.exitCode, errorCode: 'PID_MISMATCH' });
        }

        if (result.reason === 'identity_unknown') {
          setRunError(runId, 'PID_UNVERIFIED', 'Sem identidade do PID; kill abortado por segurança.');
          return finalize({ status: 'crashed', exitCode: state.exitCode, errorCode: 'PID_UNVERIFIED' });
        }

        // already_gone / no_pid: nada a matar, o run já não existe.
        return finalize({ status: 'stopped', exitCode: state.exitCode, errorCode: null });
      }

      const exited = await waitForExit(MAX_EXIT_WAIT_MS);

      if (!exited) {
        return finalize({ status: 'stopped', exitCode: state.exitCode, errorCode: 'KILL_TIMEOUT' });
      }

      return snapshot();
    },
  };
}

/** Reexport para a rota/montagem do comando, mantendo o runner como ponto de entrada. */
export { buildCommand, readScriptCommand };
