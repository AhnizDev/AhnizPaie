import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

pool.on('connect', () => {
  console.log('Connecté à la base de données PostgreSQL (devdb)');
});

pool.on('error', (err) => {
  console.error('Erreur PostgreSQL :', err);
});

export default {
  query: (text, params) => pool.query(text, params),
  pool,
};