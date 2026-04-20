import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit reads credentials only from process.env (via .env).
 * No fallbacks for DB_USER or DB_PASSWORD — unset vars fail fast.
 * Empty string for DB_PASSWORD is allowed when explicitly set in .env (DB_PASSWORD=).
 */
const REQUIRED = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

const missing = REQUIRED.filter((key) => process.env[key] === undefined);
if (missing.length > 0) {
  throw new Error(
    `drizzle-kit: missing required environment variables: ${missing.join(', ')}. ` +
      'Set them in .env (no implicit root/empty defaults).'
  );
}

const port = Number(process.env.DB_PORT);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`drizzle-kit: DB_PORT must be an integer between 1 and 65535, got "${process.env.DB_PORT}"`);
}

export default defineConfig({
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});
