/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
