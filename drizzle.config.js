import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config();

console.log('USING DB URL:', process.env.DATABASE_URL_DIRECT ? 'Found ✓' : 'Not found ✗');

if (!process.env.DATABASE_URL_DIRECT) {
  throw new Error('DATABASE_URL_DIRECT is not set in .env file');
}

export default defineConfig({
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT,
  },
});