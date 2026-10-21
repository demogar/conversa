import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

// In development one .env at the repository root serves every app. In
// production the variables come from the container environment instead.
for (const candidate of ['.env', '../../.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    config({ path, quiet: true });
    break;
  }
}
