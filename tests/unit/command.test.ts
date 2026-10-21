import { describe, expect, it } from 'vitest';

import {
  buildChildEnv,
  buildCommand,
  resolveRunnableScript,
  RUNNERS,
  SCRIPT_NAME_PATTERN,
} from '@/lib/server/process/command';

describe('buildCommand', () => {
  it('usa cmd.exe com shell:false e o runner do package manager', () => {
    expect(buildCommand('npm', 'dev')).toEqual({
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm run dev'],
      display: 'npm run dev',
    });
    expect(buildCommand('pnpm', 'dev').display).toBe('pnpm run dev');
    expect(buildCommand('yarn', 'dev').display).toBe('yarn dev');
    expect(buildCommand('bun', 'dev').display).toBe('bun run dev');
  });

  it('assume npm quando o package manager é desconhecido', () => {
    expect(buildCommand(null, 'start').display).toBe('npm run start');
  });

  it('só aceita nome de script, nunca linha de shell', () => {
    expect(SCRIPT_NAME_PATTERN.test('dev')).toBe(true);
    expect(SCRIPT_NAME_PATTERN.test('dev:web')).toBe(true);
    expect(SCRIPT_NAME_PATTERN.test('dev && calc')).toBe(false);
    expect(SCRIPT_NAME_PATTERN.test('dev; rm -rf')).toBe(false);
    expect(RUNNERS.npm('dev').args).toHaveLength(4);
  });
});

describe('resolveRunnableScript', () => {
  const project = { scripts: ['build', 'dev', 'start'], defaultScript: null };
  const allowed = ['dev', 'start', 'preview'];

  it('usa o default quando executável', () => {
    expect(resolveRunnableScript({ ...project, defaultScript: 'start' }, null, allowed)).toBe('start');
  });

  it('cai no primeiro da allowlist quando não há default', () => {
    expect(resolveRunnableScript(project, null, allowed)).toBe('dev');
  });

  it('rejeita script fora da allowlist ou inexistente', () => {
    expect(() => resolveRunnableScript(project, 'build', allowed)).toThrow(/allowlist/);
    expect(() => resolveRunnableScript(project, 'preview', allowed)).toThrow(/não existe/);
    expect(() => resolveRunnableScript(project, 'dev && calc', allowed)).toThrow(/inválido/);
  });

  it('retorna NO_SCRIPT quando não há nenhum executável', () => {
    expect(() => resolveRunnableScript({ scripts: ['build'], defaultScript: null }, null, allowed)).toThrow(
      /Nenhum script executável/,
    );
  });
});

describe('buildChildEnv', () => {
  const baseEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    PATH: 'C:\\bin',
    PORT: '9999',
    NODE_OPTIONS: '--inspect',
    NEXT_RUNTIME: 'edge',
    __NEXT_PRIVATE_SECRET: 'x',
  };

  it('remove env herdado perigoso e fixa flags não interativas', () => {
    const env = buildChildEnv({
      runId: 'run-1',
      stack: ['next'],
      scriptCommand: 'next dev',
      preferredPort: 3000,
      baseEnv,
    });

    expect(env.PORT).toBe('3000');
    expect(env.NODE_OPTIONS).toBeUndefined();
    expect(env.NEXT_RUNTIME).toBeUndefined();
    expect(env.__NEXT_PRIVATE_SECRET).toBeUndefined();
    expect(env.BROWSER).toBe('none');
    expect(env.NO_COLOR).toBe('1');
    expect(env.HUB_RUN_ID).toBe('run-1');
    expect(env.NODE_ENV).toBe('production');
    expect(env.PATH).toBe('C:\\bin');
  });

  it('não força PORT quando o script já declara a porta', () => {
    const env = buildChildEnv({
      runId: 'run-1',
      stack: ['next'],
      scriptCommand: 'next dev -p 3002',
      preferredPort: 3000,
      baseEnv,
    });

    expect(env.PORT).toBeUndefined();
  });

  it('não injeta PORT em projeto não-Next', () => {
    const env = buildChildEnv({
      runId: 'run-1',
      stack: ['vite', 'react'],
      scriptCommand: 'vite',
      preferredPort: 5173,
      baseEnv,
    });

    expect(env.PORT).toBeUndefined();
  });
});
