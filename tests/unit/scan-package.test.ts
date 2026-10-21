import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readPackageJson } from '@/lib/server/discovery/scan';

const fixtures: string[] = [];

async function writePackage(contents: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-scan-'));

  fixtures.push(dir);
  await fs.writeFile(path.join(dir, 'package.json'), contents, 'utf8');

  return dir;
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('readPackageJson', () => {
  it('deriva a porta de dev/start/preview com precedência', async () => {
    const dir = await writePackage(
      JSON.stringify({
        name: 'fixture',
        scripts: {
          build: 'next build',
          start: 'next start --port=3105',
          dev: 'next dev -p 3002',
        },
      }),
    );

    const info = await readPackageJson(dir);

    expect(info?.scripts).toEqual(['build', 'start', 'dev']);
    expect(info?.declaredPort).toBe(3002);
  });

  it('cai para qualquer script com --port e tolera JSON inválido', async () => {
    const withOtherScript = await writePackage(
      JSON.stringify({ scripts: { serve: 'node server.js --port 4321' } }),
    );
    const invalid = await writePackage('{ not-json');

    expect((await readPackageJson(withOtherScript))?.declaredPort).toBe(4321);
    expect(await readPackageJson(invalid)).toBeNull();
  });
});
