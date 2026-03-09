import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';


const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables for Drizzle: ${missing.join(', ')}`
  );
}

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT);
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME;

export default defineConfig({
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: host,
    port: port,
    user: user,
    password: password,
    database: database,
  },
});