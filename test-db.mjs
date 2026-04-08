import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'student',
    password: 'newpassword123',
    database: 'sportrealtime'
});

const [rows] = await conn.execute('SELECT 1');
console.log('DB OK:', rows);
await conn.end();