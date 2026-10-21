import { describe, expect, it } from 'vitest';

import { isValidPort, parseListenerLines, parsePortFromLine, parseScriptPort } from '@/lib/server/process/ports';

describe('parsePortFromLine', () => {
  it('lê a linha Local do Next/Vite', () => {
    expect(parsePortFromLine('- Local: http://localhost:3002')).toBe(3002);
    expect(parsePortFromLine('  ➜  Local:   http://localhost:5173/')).toBe(5173);
  });

  it('ignora ANSI antes de casar', () => {
    expect(parsePortFromLine('\u001B[32m- Local:\u001B[0m http://localhost:4321')).toBe(4321);
  });

  it('lê "started server on" e "listening on"', () => {
    expect(parsePortFromLine('started server on 0.0.0.0:3000')).toBe(3000);
    expect(parsePortFromLine('Server listening on http://127.0.0.1:8080')).toBe(8080);
  });

  it('não confunde tempo de boot com porta', () => {
    expect(parsePortFromLine('ready in 3002ms')).toBeNull();
    expect(parsePortFromLine('compiled successfully in 12.3s')).toBeNull();
  });

  it('rejeita portas fora da faixa de usuário', () => {
    expect(parsePortFromLine('http://localhost:80')).toBeNull();
    expect(parsePortFromLine('http://localhost:70000')).toBeNull();
  });
});

describe('parseScriptPort', () => {
  it('aceita -p e --port com espaço ou =', () => {
    expect(parseScriptPort('next dev -p 3002')).toBe(3002);
    expect(parseScriptPort('vite --port=5173')).toBe(5173);
    expect(parseScriptPort('node server.js --port 4321')).toBe(4321);
  });

  it('não casa flags parecidas nem ausência de valor', () => {
    expect(parseScriptPort('next dev --profile 2')).toBeNull();
    expect(parseScriptPort('next dev --port')).toBeNull();
    expect(parseScriptPort(null)).toBeNull();
  });
});

describe('parseListenerLines', () => {
  it('lê a saída do Get-NetTCPConnection', () => {
    const parsed = parseListenerLines('3000 4711\r\n3100 8123\r\n');
    expect([...parsed.entries()]).toEqual([
      [3000, 4711],
      [3100, 8123],
    ]);
  });

  it('lê netstat -ano filtrando LISTENING', () => {
    const raw = [
      '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4711',
      '  TCP    127.0.0.1:3100         0.0.0.0:0              LISTENING       8123',
      '  TCP    127.0.0.1:55000        127.0.0.1:443          ESTABLISHED     9999',
    ].join('\r\n');

    const parsed = parseListenerLines(raw);
    expect(parsed.get(3000)).toBe(4711);
    expect(parsed.get(3100)).toBe(8123);
    expect(parsed.has(55000)).toBe(false);
  });
});

describe('isValidPort', () => {
  it('aceita apenas inteiros entre 1024 e 65535', () => {
    expect(isValidPort(1024)).toBe(true);
    expect(isValidPort(65_535)).toBe(true);
    expect(isValidPort(1023)).toBe(false);
    expect(isValidPort(65_536)).toBe(false);
    expect(isValidPort(Number.NaN)).toBe(false);
  });
});
