import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';

// MySQL connection pool using mysql2/promise.
// Supports local root user with empty password via env defaults.
const host = process.env.DB_HOST ?? 'localhost';
const port = Number(process.env.DB_PORT ?? 3306);
const user = process.env.DB_USER ?? 'root';
const password = process.env.DB_PASSWORD ?? '';
const database = process.env.DB_NAME ?? 'sportrealtime';

export const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
});

// Drizzle ORM instance configured for MySQL
export const db = drizzle(pool);
