import { query } from '@/library/database';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const result = await query('GET_USERS');
      res.status(200).json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}