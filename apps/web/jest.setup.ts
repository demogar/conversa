import packageJson from './package.json';
import '@testing-library/jest-dom';

// next.config.ts inlines these into the build; tests read the same values.
process.env.CONVERSA_VERSION = packageJson.version;
