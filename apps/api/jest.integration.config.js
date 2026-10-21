/** Integration tests: the real app against a dedicated test database (see test/integration/support). */
const swc = [
  '@swc/jest',
  {
    jsc: {
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
      target: 'es2023',
    },
  },
];

/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  rootDir: 'test/integration',
  testRegex: '\\.int-spec\\.ts$',
  transform: {
    '^.+\\.ts$': swc,
    // CommonJS that requires the ESM-only Nest packages; see the transform.
    '/@nestjs/throttler/dist/.+\\.js$': '<rootDir>/support/cjs-to-esm.cjs',
  },
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm/@nestjs\\+throttler)(?!@nestjs/throttler/)'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  globalSetup: '<rootDir>/support/global-setup.ts',
  globalTeardown: '<rootDir>/support/global-teardown.ts',
  testTimeout: 30_000,
};
