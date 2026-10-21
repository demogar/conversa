import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};

// next/jest leaves node_modules untransformed; the design system and its
// dependencies ship ESM, so they are transformed too.
export default async function jestConfig(): Promise<Config> {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    transformIgnorePatterns: ['/node_modules/(?!.pnpm|@demogar|@base-ui|lucide-react|next-intl|use-intl)'],
  };
}
