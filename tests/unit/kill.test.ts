import { describe, expect, it, vi } from 'vitest';

import { isSameInstant, killTree, parseProcessDate, type ProcessProbe } from '@/lib/server/process/kill';

describe('parseProcessDate', () => {
  it('converte DTMF do WMI (hora local + offset) para ISO UTC', () => {
    expect(parseProcessDate('20261020175919.123456-240')).toBe('2026-10-20T21:59:19.123Z');
  });

  it('aceita ISO com Z', () => {
    expect(parseProcessDate('2026-10-20T21:59:19.000Z')).toBe('2026-10-20T21:59:19.000Z');
  });

  it('retorna null para lixo', () => {
    expect(parseProcessDate('')).toBeNull();
    expect(parseProcessDate('não é data')).toBeNull();
  });
});

describe('isSameInstant', () => {
  it('tolera até 2 s de diferença', () => {
    expect(isSameInstant('2026-10-20T21:59:19.000Z', '2026-10-20T21:59:21.000Z')).toBe(true);
    expect(isSameInstant('2026-10-20T21:59:19.000Z', '2026-10-20T21:59:22.000Z')).toBe(false);
  });

  it('é falso para datas inválidas', () => {
    expect(isSameInstant('x', '2026-10-20T21:59:19.000Z')).toBe(false);
  });
});

function createProbe(creationDate: string | null): ProcessProbe & {
  readCreationDate: ReturnType<typeof vi.fn>;
  runTaskkill: ReturnType<typeof vi.fn>;
} {
  return {
    readCreationDate: vi.fn(async () => creationDate),
    runTaskkill: vi.fn(async () => undefined),
  };
}

describe('killTree', () => {
  it('não faz nada sem PID ou sem identidade', async () => {
    const probe = createProbe('2026-10-20T21:59:19.000Z');

    await expect(killTree(null, null, probe)).resolves.toEqual({ killed: false, reason: 'no_pid' });
    await expect(killTree(123, null, probe)).resolves.toEqual({ killed: false, reason: 'identity_unknown' });
    expect(probe.runTaskkill).not.toHaveBeenCalled();
  });

  it('trata processo já morto como idempotente', async () => {
    const probe = createProbe(null);

    await expect(killTree(123, '2026-10-20T21:59:19.000Z', probe)).resolves.toEqual({
      killed: false,
      reason: 'already_gone',
    });
    expect(probe.runTaskkill).not.toHaveBeenCalled();
  });

  it('aborta quando o PID foi reciclado', async () => {
    const probe = createProbe('2026-10-20T23:00:00.000Z');

    await expect(killTree(123, '2026-10-20T21:59:19.000Z', probe)).resolves.toEqual({
      killed: false,
      reason: 'identity_mismatch',
    });
    expect(probe.runTaskkill).not.toHaveBeenCalled();
  });

  it('mata a árvore quando a identidade confere', async () => {
    const probe = createProbe('2026-10-20T21:59:19.000Z');

    await expect(killTree(123, '2026-10-20T21:59:19.500Z', probe)).resolves.toEqual({ killed: true });
    expect(probe.runTaskkill).toHaveBeenCalledWith(123);
  });
});
