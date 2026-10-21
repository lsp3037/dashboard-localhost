/**
 * Formatadores isomórficos (sem `node:*`). Todos os rótulos são calculados no servidor
 * e enviados prontos ao client para evitar divergência de hidratação.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const numberFormatter = new Intl.NumberFormat('pt-BR');

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCount(value: number): string {
  return numberFormatter.format(value);
}

export function formatDateTime(iso: string | null): string | null {
  if (iso === null) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return dateTimeFormatter.format(new Date(time));
}

/** "há 12 min", "há 3 h", "há 2 meses" — nunca "há 0 min". */
export function formatRelativeTime(iso: string | null, now: number = Date.now()): string | null {
  if (iso === null) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;

  const diff = now - time;
  const elapsed = Math.abs(diff);
  const prefix = diff < 0 ? 'em' : 'há';

  if (elapsed < 45_000) return 'agora';

  const minutes = Math.round(elapsed / MINUTE);
  if (elapsed < HOUR) return `${prefix} ${minutes} min`;

  const hours = Math.round(elapsed / HOUR);
  if (elapsed < DAY) return `${prefix} ${hours} h`;

  const days = Math.round(elapsed / DAY);
  if (days < 30) return `${prefix} ${days} d`;

  const months = Math.round(days / 30);
  if (months < 12) return `${prefix} ${months} ${months === 1 ? 'mês' : 'meses'}`;

  const years = Math.round(months / 12);
  return `${prefix} ${years} ${years === 1 ? 'ano' : 'anos'}`;
}

/** "5,0 MB" a partir de bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatCount(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${numberFormatter.format(Math.round(kb))} KB`;
  const mb = kb / 1024;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(mb)} MB`;
}

/** "90 s", "3 s", "2 min" — usado nos limites de configuração. */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${formatCount(ms)} ms`;
  if (ms < 60_000) return `${numberFormatter.format(Math.round(ms / 1000))} s`;
  return `${numberFormatter.format(Math.round(ms / 60_000))} min`;
}

/** Uptime de um run: "42 s", "3 min", "1 h 12 min" — `null` se a data de início for inválida. */
export function formatElapsed(startIso: string | null, endIso: string | null, now: number = Date.now()): string | null {
  if (startIso === null) return null;

  const start = Date.parse(startIso);
  if (Number.isNaN(start)) return null;

  const end = endIso === null ? now : Date.parse(endIso);
  if (Number.isNaN(end)) return null;

  const elapsed = Math.max(0, end - start);
  if (elapsed < HOUR) return formatDurationMs(elapsed);

  const hours = Math.floor(elapsed / HOUR);
  const minutes = Math.round((elapsed % HOUR) / MINUTE);
  return minutes === 0 ? `${formatCount(hours)} h` : `${formatCount(hours)} h ${formatCount(minutes)} min`;
}

/**
 * Encurta no meio preservando o começo (raiz) e o fim (nome da pasta):
 * `C:\Projetos\prenatal-saas\apps\web` → `C:\Projetos\prena…\apps\web`.
 */
export function truncateMiddle(value: string, maxLength = 44): string {
  if (value.length <= maxLength) return value;

  const budget = maxLength - 1;
  const head = Math.ceil(budget * 0.55);
  const tail = budget - head;

  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

/** Timestamp mais recente de uma lista de datas ISO; `null` se nenhuma for válida. */
export function latestIso(dates: readonly (string | null | undefined)[]): string | null {
  let latest: number | null = null;
  let latestValue: string | null = null;

  for (const candidate of dates) {
    if (!candidate) continue;
    const time = Date.parse(candidate);
    if (Number.isNaN(time)) continue;
    if (latest === null || time > latest) {
      latest = time;
      latestValue = candidate;
    }
  }

  return latestValue;
}
