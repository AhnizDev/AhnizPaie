import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ahnizpaie_db',
    password: process.env.DB_PASSWORD || 'votre_mot_de_passe',
    port: process.env.DB_PORT || 5432,
});

export { pool };
export default pool;
