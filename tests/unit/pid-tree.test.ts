import { describe, expect, it } from 'vitest';

import { collectPidTree, parseProcessListOutput } from '@/lib/server/process/ports';

describe('parseProcessListOutput', () => {
  it('lê pares pid/pai da saída do Win32_Process', () => {
    expect(parseProcessListOutput('100 1\r\n200 100\r\n300 200\r\n')).toEqual([
      { pid: 100, parentPid: 1 },
      { pid: 200, parentPid: 100 },
      { pid: 300, parentPid: 200 },
    ]);
  });

  it('ignora linhas inválidas', () => {
    expect(parseProcessListOutput('lixo\r\n\r\n12 x\r\n')).toEqual([]);
  });
});

describe('collectPidTree', () => {
  const pairs = parseProcessListOutput(
    ['100 1', '200 100', '300 200', '400 300', '500 1', '600 500'].join('\n'),
  );

  it('coleta a raiz e todos os descendentes por nível', () => {
    expect(collectPidTree(100, pairs)).toEqual([100, 200, 300, 400]);
  });

  it('não inclui irmãos de outra árvore', () => {
    expect(collectPidTree(500, pairs)).toEqual([500, 600]);
  });

  it('respeita o limite de profundidade', () => {
    expect(collectPidTree(100, pairs, 1)).toEqual([100, 200]);
  });

  it('não entra em loop quando o pai aponta para o próprio filho', () => {
    expect(collectPidTree(1, parseProcessListOutput('1 2\n2 1'))).toEqual([1, 2]);
  });
});
