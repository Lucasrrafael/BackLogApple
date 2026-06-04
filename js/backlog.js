import * as api from './api.js';

// ── State ──────────────────────────────────────────────────────────────────

let tasks = [];
let hideDone = localStorage.getItem('mc_hide_done_v1') === 'true';
let activeFilter = localStorage.getItem('mc_filter_v1') || 'all';
let pollingTimer = null;
let modalOpen = false;
let pendingWrite = false;

const DIFF_ORDER = { dificil: 1, medio: 2, facil: 3 };
const DIFF_LABEL = { dificil: 'Difícil', medio: 'Médio', facil: 'Fácil' };

// ── Boot ───────────────────────────────────────────────────────────────────

async function init() {
  setupFilterListeners();
  setupHideDoneListener();
  setupAddCardListener();

  showLoading(true);
  await loadTasks();
  showLoading(false);

  startPolling();
}

// ── Data loading ───────────────────────────────────────────────────────────

async function loadTasks() {
  try {
    tasks = await api.fetchTasks();
  } catch (e) {
    showToast('Erro ao carregar tasks', true);
    return;
  }
  renderAll();
}

// ── Polling ────────────────────────────────────────────────────────────────

function startPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(async () => {
    if (modalOpen || pendingWrite) return;
    try {
      const fresh = await api.fetchTasks();
      if (JSON.stringify(fresh) !== JSON.stringify(tasks)) {
        tasks = fresh;
        renderAll();
      }
    } catch (_) { /* silent */ }
  }, 8000);
}

// ── Render ─────────────────────────────────────────────────────────────────

function renderAll() {
  ['dificil', 'medio', 'facil'].forEach(diff => {
    const grid = document.getElementById(`grid-${diff}`);
    const slice = tasks.filter(t => t.difficulty === diff);
    grid.innerHTML = slice.map(buildCardHTML).join('');
    slice.forEach(t => attachCardListeners(t.id));
  });
  applyFilter(activeFilter);
  applyHideDone();
  updateProgress();
  updateSectionCounts();
  checkEmptyState();
  setFilterActive(activeFilter);
  setHideDoneActive(hideDone);
}

function buildCardHTML(task) {
  const diff = task.difficulty;
  const isDone = task.done;
  return `
    <div class="card${isDone ? ' done' : ''}" data-id="${task.id}" data-difficulty="${diff}">
      <div class="card-header">
        <span class="badge ${diff}">${DIFF_LABEL[diff]}</span>
        <div class="card-header-right">
          <label class="done-checkbox">
            <input type="checkbox" ${isDone ? 'checked' : ''}/>
            <span class="check-icon"></span>
            <span class="done-label">Concluir</span>
          </label>
          <button class="delete-btn" title="Apagar card" aria-label="Apagar ${task.id}">🗑</button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-id">${task.id}</div>
        <div class="card-title">${task.title}</div>
        ${task.description ? `
        <details>
          <summary>Descrição / Sub-tarefas <span class="chevron">▼</span></summary>
          <div class="details-body ${diff}">${task.description}</div>
        </details>` : ''}
        ${task.impl_guide ? `
        <details>
          <summary>Guia de Implementação Swift (iOS 15) <span class="chevron">▼</span></summary>
          <div class="details-body ${diff}">${task.impl_guide}</div>
        </details>` : ''}
      </div>
    </div>`;
}

function attachCardListeners(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card) return;
  const cb = card.querySelector('input[type="checkbox"]');
  cb.addEventListener('change', () => onToggleDone(card, cb, id));
  card.querySelector('.delete-btn').addEventListener('click', () => onDeleteCard(id));
}

// ── Toggle done ────────────────────────────────────────────────────────────

async function onToggleDone(card, cb, id) {
  const done = cb.checked;

  // Optimistic update
  const task = tasks.find(t => t.id === id);
  if (task) task.done = done;
  card.classList.toggle('done', done);
  updateProgress();
  updateSectionCounts();

  const secret = await ensureSecret();
  if (!secret) { cb.checked = !done; if (task) task.done = !done; card.classList.toggle('done', !done); updateProgress(); return; }

  pendingWrite = true;
  try {
    await api.postDone(id, done);
    applyHideDone();
    checkEmptyState();
  } catch (e) {
    // Revert
    if (task) task.done = !done;
    cb.checked = !done;
    card.classList.toggle('done', !done);
    updateProgress();
    showToast(e.status === 401 ? 'Senha incorreta' : 'Erro ao salvar', true);
    if (e.status === 401) api.clearSecret();
  } finally {
    pendingWrite = false;
  }
}

// ── Delete card ────────────────────────────────────────────────────────────

async function onDeleteCard(id) {
  if (!confirm(`Apagar o card ${id}? Esta ação não pode ser desfeita.`)) return;

  const secret = await ensureSecret();
  if (!secret) return;

  pendingWrite = true;
  try {
    await api.deleteTask(id);
    tasks = tasks.filter(t => t.id !== id);
    const card = document.querySelector(`[data-id="${id}"]`);
    card?.remove();
    updateProgress();
    updateSectionCounts();
    checkEmptyState();
    showToast(`${id} apagado`);
  } catch (e) {
    showToast(e.status === 401 ? 'Senha incorreta' : 'Erro ao apagar', true);
    if (e.status === 401) api.clearSecret();
  } finally {
    pendingWrite = false;
  }
}

// ── Create card ────────────────────────────────────────────────────────────

function setupAddCardListener() {
  document.getElementById('addCardBtn').addEventListener('click', openCreateModal);
  document.getElementById('cancelCreate').addEventListener('click', closeCreateModal);
  document.getElementById('confirmCreate').addEventListener('click', onConfirmCreate);
  document.getElementById('createModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCreateModal();
  });

  // Secret modal
  document.getElementById('cancelSecret').addEventListener('click', () => {
    closeSecretModal();
    resolveSecret(null);
  });
  document.getElementById('confirmSecret').addEventListener('click', () => {
    const val = document.getElementById('secretInput').value.trim();
    api.setSecret(val);
    closeSecretModal();
    resolveSecret(val);
  });
  document.getElementById('secretInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirmSecret').click();
  });
}

function openCreateModal() {
  document.getElementById('newTitle').value = '';
  document.getElementById('newDifficulty').value = 'facil';
  document.getElementById('newDescription').value = '';
  document.getElementById('newImplGuide').value = '';
  document.getElementById('createModal').removeAttribute('hidden');
  document.getElementById('newTitle').focus();
  modalOpen = true;
}

function closeCreateModal() {
  document.getElementById('createModal').setAttribute('hidden', '');
  modalOpen = false;
}

async function onConfirmCreate() {
  const title = document.getElementById('newTitle').value.trim();
  const difficulty = document.getElementById('newDifficulty').value;
  const description = document.getElementById('newDescription').value.trim();
  const impl_guide = document.getElementById('newImplGuide').value.trim();

  if (!title) { document.getElementById('newTitle').focus(); return; }

  const secret = await ensureSecret();
  if (!secret) return;

  const btn = document.getElementById('confirmCreate');
  btn.disabled = true;
  pendingWrite = true;

  try {
    const task = await api.createTask({ title, difficulty, description, impl_guide });
    tasks.push(task);
    closeCreateModal();

    const grid = document.getElementById(`grid-${task.difficulty}`);
    grid.insertAdjacentHTML('beforeend', buildCardHTML(task));
    attachCardListeners(task.id);
    applyFilter(activeFilter);
    applyHideDone();
    updateProgress();
    updateSectionCounts();
    checkEmptyState();
    showToast(`${task.id} criado!`);

    document.querySelector(`[data-id="${task.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    showToast(e.status === 401 ? 'Senha incorreta' : 'Erro ao criar card', true);
    if (e.status === 401) api.clearSecret();
  } finally {
    btn.disabled = false;
    pendingWrite = false;
  }
}

// ── Secret prompt ──────────────────────────────────────────────────────────

let resolveSecret = () => {};

async function ensureSecret() {
  if (api.getSecret()) return api.getSecret();
  return new Promise(resolve => {
    resolveSecret = resolve;
    openSecretModal();
  });
}

function openSecretModal() {
  document.getElementById('secretInput').value = '';
  document.getElementById('secretModal').removeAttribute('hidden');
  document.getElementById('secretInput').focus();
  modalOpen = true;
}

function closeSecretModal() {
  document.getElementById('secretModal').setAttribute('hidden', '');
  modalOpen = false;
}

// ── Filters ────────────────────────────────────────────────────────────────

function setupFilterListeners() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      localStorage.setItem('mc_filter_v1', activeFilter);
      applyFilter(activeFilter);
      setFilterActive(activeFilter);
      updateSectionCounts();
      checkEmptyState();
    });
  });
}

function setupHideDoneListener() {
  document.getElementById('hideDoneBtn').addEventListener('click', () => {
    hideDone = !hideDone;
    localStorage.setItem('mc_hide_done_v1', hideDone);
    applyHideDone();
    setHideDoneActive(hideDone);
    updateSectionCounts();
    checkEmptyState();
  });
}

function applyFilter(filter) {
  document.querySelectorAll('.card').forEach(card => {
    const diff = card.dataset.difficulty;
    const visible = filter === 'all' || diff === filter;
    card.dataset.filterVisible = visible ? 'true' : 'false';
    refreshVisibility(card);
  });

  ['dificil', 'medio', 'facil'].forEach(section => {
    const show = filter === 'all' || filter === section;
    const titleEl = document.querySelector(`.section-title[data-section="${section}"]`);
    const gridEl = document.getElementById(`grid-${section}`);
    const hrEl = titleEl?.previousElementSibling;
    if (titleEl) titleEl.style.display = show ? '' : 'none';
    if (gridEl) gridEl.style.display = show ? '' : 'none';
    if (hrEl?.classList.contains('section-divider')) hrEl.style.display = show ? '' : 'none';
  });
}

function applyHideDone() {
  document.querySelectorAll('.card').forEach(card => {
    card.dataset.doneHidden = (hideDone && card.classList.contains('done')) ? 'true' : 'false';
    refreshVisibility(card);
  });
}

function refreshVisibility(card) {
  const filterOk = card.dataset.filterVisible !== 'false';
  const doneHidden = card.dataset.doneHidden === 'true';
  card.classList.toggle('hidden', !filterOk || doneHidden);
}

// ── Progress & counts ──────────────────────────────────────────────────────

function updateProgress() {
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  document.getElementById('progressLabel').textContent = `${done} / ${total} tasks concluídas`;
  const pct = total > 0 ? (done / total) * 100 : 0;
  document.getElementById('progressFill').style.width = pct + '%';
}

function updateSectionCounts() {
  ['dificil', 'medio', 'facil'].forEach(section => {
    const grid = document.getElementById(`grid-${section}`);
    if (!grid) return;
    const cards = grid.querySelectorAll('.card');
    const visible = grid.querySelectorAll('.card:not(.hidden)').length;
    const total = cards.length;
    const done = [...cards].filter(c => c.classList.contains('done')).length;
    const el = document.getElementById(`count-${section}`);
    if (el) el.textContent = `${done}/${total} concluídas · ${visible} visíveis`;
  });
}

function checkEmptyState() {
  const anyVisible = [...document.querySelectorAll('.card')].some(c => !c.classList.contains('hidden'));
  document.getElementById('emptyState').style.display = anyVisible ? 'none' : 'block';
}

function setFilterActive(filter) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
}

function setHideDoneActive(active) {
  document.getElementById('hideDoneBtn').classList.toggle('active', active);
}

// ── Loading state ──────────────────────────────────────────────────────────

function showLoading(show) {
  document.getElementById('loadingState').style.display = show ? 'block' : 'none';
  document.querySelector('main .content').style.display = show ? 'none' : '';
}

// ── Toast ──────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Start ──────────────────────────────────────────────────────────────────

init();
