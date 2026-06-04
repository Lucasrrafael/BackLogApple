import { sql } from '../lib/db.js';
import { requireSecret } from '../lib/auth.js';

const DIFF_ORDER = { dificil: 1, medio: 2, facil: 3 };

function sortTasks(rows) {
  return [...rows].sort((a, b) => {
    const d = (DIFF_ORDER[a.difficulty] || 9) - (DIFF_ORDER[b.difficulty] || 9);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM tasks`;
      return res.status(200).json(sortTasks(rows));
    }

    if (req.method === 'POST') {
      requireSecret(req, res);
      const { title, difficulty, description = '', impl_guide = '' } = req.body ?? {};
      if (!title || !difficulty) {
        return res.status(400).json({ error: 'title e difficulty são obrigatórios' });
      }
      if (!['facil', 'medio', 'dificil'].includes(difficulty)) {
        return res.status(400).json({ error: 'difficulty inválido' });
      }

      const { rows: idRows } = await sql`
        SELECT id FROM tasks WHERE id ~ '^MC-[0-9]+$'
      `;
      const nums = idRows.map(r => parseInt(r.id.slice(3), 10)).filter(n => !isNaN(n));
      const maxNum = nums.length ? Math.max(...nums) : 45;
      const newId = `MC-${String(maxNum + 1).padStart(3, '0')}`;

      const safeDesc = description
        ? `<p>${escapeHtml(description)}</p>`
        : '';
      const safeImpl = impl_guide
        ? `<p>${escapeHtml(impl_guide)}</p>`
        : '';

      const { rows } = await sql`
        INSERT INTO tasks (id, title, difficulty, description, impl_guide, done, is_custom)
        VALUES (${newId}, ${title}, ${difficulty}, ${safeDesc}, ${safeImpl}, false, true)
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      requireSecret(req, res);
      const { id } = req.query ?? {};
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      await sql`DELETE FROM tasks WHERE id = ${id}`;
      return res.status(200).json({ deleted: id });
    }

    if (req.method === 'PATCH') {
      requireSecret(req, res);
      const { id, title, done, description, impl_guide } = req.body ?? {};
      if (!id) return res.status(400).json({ error: 'id obrigatório' });

      const { rows: cur } = await sql`SELECT * FROM tasks WHERE id = ${id}`;
      if (!cur.length) return res.status(404).json({ error: 'task não encontrada' });
      const t = cur[0];

      await sql`
        UPDATE tasks SET
          title      = ${title      ?? t.title},
          done       = ${done       ?? t.done},
          description= ${description ?? t.description},
          impl_guide = ${impl_guide  ?? t.impl_guide},
          updated_at = NOW()
        WHERE id = ${id}
      `;
      const { rows } = await sql`SELECT * FROM tasks WHERE id = ${id}`;
      return res.status(200).json(rows[0]);
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    if (err.message === 'Unauthorized') return;
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
