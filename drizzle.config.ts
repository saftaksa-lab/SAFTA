import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_PATH || './data/safta.db';

// SQLite creates the file but not its directory, and data/ is gitignored, so a
// fresh checkout has none until something makes it.
mkdirSync(dirname(url), { recursive: true });

export default defineConfig({
  dialect: 'sqlite',
  schema: ['./src/db/schema.ts', './src/db/content-schema.ts'],
  out: './drizzle',
  dbCredentials: { url },
});
