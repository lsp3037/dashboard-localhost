import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const serverOnlyStub = fileURLToPath(new URL('./tests/helpers/server-only.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDir,
      // `server-only` lança fora do React Server; nos testes o guarda vira no-op.
      'server-only': serverOnlyStub,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
