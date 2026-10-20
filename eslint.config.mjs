import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.data/**',
      '.agents/**',
      '.opencode/**',
      '.fixtures/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...nextVitals,
];

export default config;
