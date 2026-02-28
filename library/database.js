import { Pool } from 'pg';
import { queryKeys } from './queries';

let pool = null;

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
} catch (error) {
  console.warn('Database connection failed, running in offline mode:', error.message);
}

export const query = async (key, params) => {
  if (!pool) {
    throw new Error('Database not connected - running in offline mode');
  }

  const text = queryKeys[key];
  if (!text) {
    throw new Error(`Query key "${key}" not found`);
  }
  const res = await pool.query(text, params);
  return res;
};