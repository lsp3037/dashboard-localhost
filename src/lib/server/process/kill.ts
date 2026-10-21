import 'server-only';

import { execFile, execFileSync } from 'node:child_process';

/**
 * Kill restrito à árvore do run (§6.6) — C6.
 *
 * Protocolo: validar a identidade do PID (`CreationDate` do WMI em UTC, tolerância 2 s),
 * abortar se o PID foi reciclado, e só então `taskkill /PID <pid> /T /F`.
 * Nunca `taskkill /IM`, nunca matar PID que o hub não iniciou.
 */

export const PID_START_TOLERANCE_MS = 2_000;

const POWERSHELL_TIMEOUT_MS = 3_000;
const TASKKILL_TIMEOUT_MS = 10_000;

const POWERSHELL_ARGS: readonly string[] = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];

/** `taskkill` retorna 128 quando o processo já não existe; tratado como sucesso idempotente. */
const TASKKILL_ALREADY_GONE = 128;

/** Data/hora do WMI. Formatos aceitos: ISO (`…Z`/offset) e DTMF (`yyyyMMddHHmmss.ffffff±UUU`). */
export function parseProcessDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const dtmf = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.(\d{1,6})([+-]\d{3})$/.exec(trimmed);

  if (dtmf !== null) {
    const [, year, month, day, hour, minute, second, fraction, offset] = dtmf;
    const millis = Number.parseInt((fraction ?? '').padEnd(3, '0').slice(0, 3), 10);
    const offsetMinutes = Number.parseInt(offset ?? '+000', 10);
    const utc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      millis,
    );

    return new Date(utc - offsetMinutes * 60_000).toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

/** Comparação de instantes com tolerância (o WMI trunca microssegundos). */
export function isSameInstant(actualIso: string, expectedIso: string, toleranceMs = PID_START_TOLERANCE_MS): boolean {
  const actual = Date.parse(actualIso);
  const expected = Date.parse(expectedIso);

  if (Number.isNaN(actual) || Number.isNaN(expected)) return false;

  return Math.abs(actual - expected) <= toleranceMs;
}

function readCreationDate(pid: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !Number.isInteger(pid) || pid <= 0) {
      resolve(null);
      return;
    }

    const script =
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${String(pid)}" -ErrorAction SilentlyContinue; ` +
      "$p.CreationDate.ToUniversalTime().ToString('o')";

    execFile(
      'powershell.exe',
      [...POWERSHELL_ARGS, script],
      { windowsHide: true, timeout: POWERSHELL_TIMEOUT_MS, encoding: 'utf8' },
      (error, stdout) => {
        if (error !== null) {
          resolve(null);
          return;
        }

        resolve(parseProcessDate(stdout));
      },
    );
  });
}

function runTaskkill(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'taskkill.exe',
      ['/PID', String(pid), '/T', '/F'],
      { windowsHide: true, timeout: TASKKILL_TIMEOUT_MS, encoding: 'utf8' },
      (error) => {
        if (error === null) {
          resolve();
          return;
        }

        if (error.code === TASKKILL_ALREADY_GONE) {
          resolve();
          return;
        }

        reject(error);
      },
    );
  });
}

export interface ProcessProbe {
  /** `CreationDate` do PID em ISO UTC, ou `null` se o processo não existe. */
  readCreationDate(pid: number): Promise<string | null>;
  /** `taskkill /PID <pid> /T /F`; resolve também quando o processo já morreu. */
  runTaskkill(pid: number): Promise<void>;
}

export const defaultProcessProbe: ProcessProbe = { readCreationDate, runTaskkill };

export type KillFailureReason = 'no_pid' | 'identity_unknown' | 'identity_mismatch' | 'already_gone';

export interface KillResult {
  readonly killed: boolean;
  readonly reason?: KillFailureReason;
}

/**
 * Encerra a árvore de um run. Não lança por "processo já morreu" (idempotente);
 * lança somente se o `taskkill` falhar por outro motivo (→ 500 KILL_FAILED na rota).
 */
export async function killTree(
  pid: number | null,
  expectedStartedAtIso: string | null,
  probe: ProcessProbe = defaultProcessProbe,
): Promise<KillResult> {
  if (pid === null || !Number.isInteger(pid) || pid <= 0) {
    return { killed: false, reason: 'no_pid' };
  }

  // Sem identidade não há como provar que o PID ainda é o nosso: nunca matar no escuro.
  if (expectedStartedAtIso === null) {
    return { killed: false, reason: 'identity_unknown' };
  }

  const actualStartedAt = await probe.readCreationDate(pid);

  if (actualStartedAt === null) {
    return { killed: false, reason: 'already_gone' };
  }

  if (!isSameInstant(actualStartedAt, expectedStartedAtIso)) {
    return { killed: false, reason: 'identity_mismatch' };
  }

  await probe.runTaskkill(pid);
  return { killed: true };
}

/**
 * Variante síncrona usada apenas no shutdown do hub (`SIGINT`/`SIGTERM`/`exit`):
 * o processo está terminando e `exit` não espera promises. Nunca lança.
 */
export function killTreeSync(pid: number | null): void {
  if (pid === null || !Number.isInteger(pid) || pid <= 0) return;
  if (process.platform !== 'win32') return;

  try {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      timeout: TASKKILL_TIMEOUT_MS,
      stdio: 'ignore',
    });
  } catch {
    // Processo pode já ter morrido (exit 128) ou estar inacessível: shutdown não falha por isso.
  }
}

/** PID vivo **e** `CreationDate` compatível: usado pela reconciliação do boot (§6.8). */
export async function isProcessAliveWithIdentity(
  pid: number,
  expectedStartedAtIso: string | null,
  probe: ProcessProbe = defaultProcessProbe,
): Promise<boolean> {
  if (expectedStartedAtIso === null) return false;

  const actualStartedAt = await probe.readCreationDate(pid);
  if (actualStartedAt === null) return false;

  return isSameInstant(actualStartedAt, expectedStartedAtIso);
}
