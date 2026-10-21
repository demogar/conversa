import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import mola from '@demogar/mola-ui/eslint';

const config = [
  ...nextVitals,
  ...nextTypescript,
  // The design system's rules: tokens only, no radius, no borders on controls…
  mola.configs.recommended,
  {
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'] },
];

export default config;
