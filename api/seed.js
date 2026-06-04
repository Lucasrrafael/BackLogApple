import fs from 'fs';
import path from 'path';
import { createPool } from '@vercel/postgres';
import { requireSecret } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST com Authorization Bearer' });
  }

  try {
    requireSecret(req, res);

    const tasksPath = path.join(process.cwd(), 'data', 'tasks.json');
    if (!fs.existsSync(tasksPath)) {
      return res.status(500).json({ error: 'data/tasks.json não encontrado' });
    }

    const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    const pool = createPool();

    const schema = fs.readFileSync(path.join(process.cwd(), 'sql', 'schema.sql'), 'utf8');
    await pool.query(schema);

    for (const t of tasks) {
      await pool.query(
        `INSERT INTO tasks (id, title, difficulty, description, impl_guide, done, is_custom, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (id) DO UPDATE SET
           title       = EXCLUDED.title,
           difficulty  = EXCLUDED.difficulty,
           description = EXCLUDED.description,
           impl_guide  = EXCLUDED.impl_guide,
           updated_at  = NOW()`,
        [t.id, t.title, t.difficulty, t.description, t.impl_guide, t.done, t.is_custom]
      );
    }

    await pool.end();
    return res.status(200).json({ ok: true, count: tasks.length });
  } catch (err) {
    if (err.message === 'Unauthorized') return;
    console.error(err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
