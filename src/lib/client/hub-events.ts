'use client';

/** Barramento leve entre componentes client (scan em andamento e toasts). */

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
}

export interface ToastItem extends ToastInput {
  id: string;
}

type ToastListener = (toast: ToastItem) => void;
type ScanListener = (scanning: boolean) => void;

const toastListeners = new Set<ToastListener>();
const scanListeners = new Set<ScanListener>();

export function pushToast(input: ToastInput): void {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const item: ToastItem = { ...input, id };
  for (const listener of toastListeners) listener(item);
}

export function subscribeToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

/** O botão Escanear avisa o grid para exibir skeleton; o fim do scan restaura. */
export function setScanning(scanning: boolean): void {
  for (const listener of scanListeners) listener(scanning);
}

export function subscribeScanning(listener: ScanListener): () => void {
  scanListeners.add(listener);
  return () => {
    scanListeners.delete(listener);
  };
}

/** "+2 novos, 1 atualizado" a partir dos contadores do scan. */
export function describeScan(counters: {
  added: number;
  updated: number;
  unchanged: number;
  missing: number;
  skipped: number;
}): string {
  const plural = (value: number, singular: string, pluralForm: string): string =>
    `${value} ${value === 1 ? singular : pluralForm}`;

  const primary: string[] = [];
  if (counters.added > 0) primary.push(`${counters.added} ${counters.added === 1 ? 'novo' : 'novos'}`);
  if (counters.updated > 0) primary.push(`${counters.updated} ${counters.updated === 1 ? 'atualizado' : 'atualizados'}`);

  const extra: string[] = [];
  if (counters.missing > 0) extra.push(plural(counters.missing, 'ausente', 'ausentes'));
  if (counters.skipped > 0) extra.push(plural(counters.skipped, 'ignorado', 'ignorados'));

  if (primary.length === 0 && extra.length === 0) {
    return counters.unchanged > 0
      ? `${plural(counters.unchanged, 'projeto', 'projetos')} sem mudanças`
      : 'Nada encontrado nas raízes monitoradas.';
  }

  const head = primary.length > 0 ? `+${primary.join(', ')}` : '';
  const tail = extra.join(', ');

  return [head, tail].filter((part) => part.length > 0).join(' · ');
}
