import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { detectStack } from '@/lib/server/discovery/stack';
import { buildProjectCommand } from '@/lib/server/process/command';
import { toProjectView } from '@/lib/shared/view-model';
import type { ProjectDTO } from '@/lib/shared/types';

const fixtures: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-laravel-test-'));
  fixtures.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('detectStack', () => {
  it('detecta Laravel e PHP por arquivo artisan', () => {
    const stack = detectStack({ fileNames: ['artisan', 'composer.json'] });
    expect(stack).toContain('laravel');
    expect(stack).toContain('php');
  });

  it('detecta Laravel e PHP por laravel-vite-plugin', () => {
    const stack = detectStack({ dependencies: ['laravel-vite-plugin', 'vite', 'tailwindcss'] });
    expect(stack).toContain('laravel');
    expect(stack).toContain('php');
    expect(stack).toContain('vite');
    expect(stack).toContain('tailwind');
  });

  it('detecta Python e Django por manage.py', () => {
    const stack = detectStack({ fileNames: ['manage.py'] });
    expect(stack).toContain('django');
    expect(stack).toContain('python');
  });
});

describe('buildProjectCommand para Laravel', () => {
  it('usa composer run dev quando composer.json possui script dev', async () => {
    const dir = await makeTempDir();
    await fs.writeFile(
      path.join(dir, 'composer.json'),
      JSON.stringify({ scripts: { dev: '@php artisan dev' } }),
      'utf8',
    );

    const cmd = await buildProjectCommand(dir, 'npm', 'dev', ['laravel', 'php']);
    expect(cmd.display).toBe('composer run dev');
  });

  it('roda PHP serve e Vite juntos quando composer.json não possui dev mas package.json possui', async () => {
    const dir = await makeTempDir();
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite' } }),
      'utf8',
    );

    const cmd = await buildProjectCommand(dir, 'npm', 'dev', ['laravel', 'php']);
    expect(cmd.display).toBe('php artisan serve & npm run dev');
  });

  it('roda apenas php artisan serve quando não possui package.json com dev', async () => {
    const dir = await makeTempDir();
    const cmd = await buildProjectCommand(dir, 'npm', 'dev', ['laravel', 'php']);
    expect(cmd.display).toBe('php artisan serve');
  });
});

describe('toProjectView com Laravel', () => {
  const baseProject: ProjectDTO = {
    id: 'test-laravel',
    name: 'Tele Educa SES',
    packageName: null,
    path: 'C:\\Projetos\\Tele Educa SES',
    parentId: null,
    isHub: false,
    kind: 'node',
    hidden: false,
    missing: false,
    stack: ['laravel', 'php', 'vite'],
    packageManager: 'npm',
    scripts: ['dev', 'build'],
    runnableScripts: ['dev'],
    defaultScript: 'dev',
    preferredPort: 8000,
    notes: null,
    gitBranch: 'main',
    gitHeadAt: null,
    run: {
      id: 'run-1',
      status: 'running',
      port: 5173, // Vite port captured by runner
      startedAt: new Date().toISOString(),
    },
    lastRun: null,
  };

  it('prioriza porta 8000 do Laravel sobre a porta 5173 do Vite', () => {
    const view = toProjectView(baseProject);
    expect(view.cardPort).toBe(8000);
  });
});
