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
  {
    // O parser do TS entrega nomes de tipos ao core rule, gerando falsos positivos
    // (`no-unused-vars` em parâmetros de assinatura) e `no-undef` em globais do
    // DOM/Node (`RequestInit`). A versão TypeScript-aware cobre os dois casos.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
];

export default config;
