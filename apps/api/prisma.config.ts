import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// One .env at the repository root serves every app.
config({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
