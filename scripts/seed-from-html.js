/**
 * Seed script — runs once locally.
 *
 * Prerequisites:
 *   1. npm install
 *   2. Pull env: vercel env pull .env.local
 *   3. Run: node --env-file=.env.local scripts/seed-from-html.js
 *
 * What it does:
 *   • Parses Backlog.html and extracts all 45 cards
 *   • Writes data/tasks.json
 *   • Applies sql/schema.sql to the Neon Postgres database
 *   • Inserts all tasks (upsert — safe to run multiple times)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'node-html-parser';
import { createPool } from '@vercel/postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 1. Parse HTML ──────────────────────────────────────────────────────────

const html = fs.readFileSync(path.join(ROOT, 'Backlog.html'), 'utf8');
const root = parse(html);

const cardEls = root.querySelectorAll('.card[data-id]');

const tasks = cardEls.map(card => {
  const id = card.getAttribute('data-id');
  const difficulty = card.getAttribute('data-difficulty');
  const title = card.querySelector('.card-title')?.text?.trim() ?? '';

  const detailsBodies = card.querySelectorAll('.details-body');
  const description = detailsBodies[0]?.innerHTML?.trim() ?? '';
  const impl_guide  = detailsBodies[1]?.innerHTML?.trim() ?? '';

  return { id, title, difficulty, description, impl_guide, done: false, is_custom: false };
});

console.log(`Extraídos ${tasks.length} cards do HTML.`);

// ── 2. Write data/tasks.json ───────────────────────────────────────────────

const dataDir = path.join(ROOT, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
fs.writeFileSync(
  path.join(dataDir, 'tasks.json'),
  JSON.stringify(tasks, null, 2),
  'utf8'
);
console.log('Escrito: data/tasks.json');

// ── 3. Connect to Postgres and apply schema ────────────────────────────────

if (!process.env.POSTGRES_URL) {
  console.error('POSTGRES_URL não definido. Execute: vercel env pull .env.local e tente novamente com --env-file=.env.local');
  process.exit(1);
}

const pool = createPool({ connectionString: process.env.POSTGRES_URL });

const schema = fs.readFileSync(path.join(ROOT, 'sql', 'schema.sql'), 'utf8');
await pool.query(schema);
console.log('Schema aplicado.');

// ── 4. Upsert all tasks ────────────────────────────────────────────────────

for (const t of tasks) {
  await pool.query(
    `INSERT INTO tasks (id, title, difficulty, description, impl_guide, done, is_custom, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title      = EXCLUDED.title,
       difficulty = EXCLUDED.difficulty,
       description= EXCLUDED.description,
       impl_guide = EXCLUDED.impl_guide,
       updated_at = NOW()`,
    [t.id, t.title, t.difficulty, t.description, t.impl_guide, t.done, t.is_custom]
  );
}

console.log(`${tasks.length} tasks inseridas/atualizadas no banco. Seed concluído!`);
await pool.end();
