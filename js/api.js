// ── Secret management ──────────────────────────────────────────────────────

const SECRET_KEY = 'backlog_secret';

export function getSecret() {
  return sessionStorage.getItem(SECRET_KEY) ?? '';
}

export function setSecret(s) {
  sessionStorage.setItem(SECRET_KEY, s);
}

export function clearSecret() {
  sessionStorage.removeItem(SECRET_KEY);
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getSecret()}`,
  };
}

// ── Core fetch with 401 handling ───────────────────────────────────────────

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function fetchTasks() {
  return apiFetch('/api/tasks');
}

export async function createTask({ title, difficulty, description, impl_guide }) {
  return apiFetch('/api/tasks', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, difficulty, description, impl_guide }),
  });
}

export async function deleteTask(id) {
  return apiFetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export async function patchTask(id, fields) {
  return apiFetch('/api/tasks', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ id, ...fields }),
  });
}

export async function fetchDone() {
  return apiFetch('/api/done');
}

export async function postDone(id, done) {
  return apiFetch('/api/done', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ id, done }),
  });
}
