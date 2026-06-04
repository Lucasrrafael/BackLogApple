import { sql } from '../lib/db.js';
import { requireSecret } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT id FROM tasks WHERE done = true ORDER BY id`;
      return res.status(200).json(rows.map(r => r.id));
    }

    if (req.method === 'POST') {
      requireSecret(req, res);
      const { id, done } = req.body ?? {};
      if (id === undefined || done === undefined) {
        return res.status(400).json({ error: 'id e done são obrigatórios' });
      }
      await sql`
        UPDATE tasks SET done = ${done}, updated_at = NOW() WHERE id = ${id}
      `;
      const { rows } = await sql`SELECT id FROM tasks WHERE done = true ORDER BY id`;
      return res.status(200).json(rows.map(r => r.id));
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    if (err.message === 'Unauthorized') return;
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
