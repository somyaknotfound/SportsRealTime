import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';

const host = process.env.DB_HOST ?? '127.0.0.1';
const port = Number(process.env.DB_PORT ?? 3306);
const user = process.env.DB_USER ?? 'root';
const password = process.env.DB_PASSWORD ?? '';
const database = process.env.DB_NAME ?? 'sportrealtime';

console.log('DB connecting to:', host, user);

export const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
});

export const db = drizzle(pool, { mode: 'default' });