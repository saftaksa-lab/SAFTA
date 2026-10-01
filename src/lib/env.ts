import 'dotenv/config';

/**
 * Reads from `process.env` rather than `import.meta.env` on purpose: this module is
 * shared by the Astro server and by `scripts/seed-admin.ts`, which runs outside Vite.
 */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. See .env.example.`);
  }
  return value;
}

export const env = {
  BETTER_AUTH_SECRET: required('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: required('BETTER_AUTH_URL'),
  DATABASE_PATH: process.env.DATABASE_PATH || './data/safta.db',
  /** Uploaded image bytes. Never under `public/`, which is build input. */
  UPLOAD_PATH: process.env.UPLOAD_PATH || './data/uploads',
  ADMIN_EMAIL: required('ADMIN_EMAIL'),
  ADMIN_PASSWORD: required('ADMIN_PASSWORD'),
  ADMIN_NAME: process.env.ADMIN_NAME || 'Administrator',
};
