// ── State ──────────────────────────────────────────────
let tasks = JSON.parse(localStorage.getItem('doflow-tasks') || '[]');
let currentFilter = 'all';
let currentSearch = '';
let currentSort   = 'newest';
let editingId     = null;

// ── DOM refs ───────────────────────────────────────────
const taskInput      = document.getElementById('task-input');
const prioritySelect = document.getElementById('priority-select');
const categorySelect = document.getElementById('category-select');
const dueDateInput   = document.getElementById('due-date');
const addBtn         = document.getElementById('add-btn');
const taskList       = document.getElementById('task-list');
const emptyState     = document.getElementById('empty-state');
const searchInput    = document.getElementById('search-input');
const sortSelect     = document.getElementById('sort-select');
const filterTabs     = document.querySelectorAll('.filter-tab');
const totalCount     = document.getElementById('total-count');
const activeCount    = document.getElementById('active-count');
const doneCount      = document.getElementById('done-count');
const progressBar    = document.getElementById('progress-bar');
const progressLabel  = document.getElementById('progress-label');
const clearCompleted = document.getElementById('clear-completed');
const clearAll       = document.getElementById('clear-all');
const currentDate    = document.getElementById('current-date');

// Modal
const modalOverlay = document.createElement('div');
modalOverlay.className = 'modal-overlay';
modalOverlay.innerHTML = `
  <div class="modal">
    <div class="modal-title">✦ Edit Task</div>
    <input type="text" class="modal-input" id="edit-text" maxlength="120" />
    <div class="modal-row">
      <select class="priority-select" id="edit-priority">
        <option value="low">🟢 Low</option>
        <option value="medium">🟡 Medium</option>
        <option value="high">🔴 High</option>
      </select>
      <select class="category-select" id="edit-category">
        <option value="general">📋 General</option>
        <option value="work">💼 Work</option>
        <option value="personal">🏠 Personal</option>
        <option value="health">💪 Health</option>
        <option value="shopping">🛒 Shopping</option>
      </select>
      <input type="date" class="due-date-input" id="edit-due" />
    </div>
    <div class="modal-actions">
      <button class="modal-cancel" id="modal-cancel">Cancel</button>
      <button class="modal-save" id="modal-save">Save Changes</button>
    </div>
  </div>
`;
document.body.appendChild(modalOverlay);

// ── Helpers ────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function save() {
  localStorage.setItem('doflow-tasks', JSON.stringify(tasks));
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0,0,0,0);
  return due < today;
}

function setDateBadge() {
  const d = new Date();
  currentDate.textContent = d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

// ── Render ─────────────────────────────────────────────
function getFilteredSorted() {
  let list = [...tasks];

  // Filter
  if (currentFilter === 'active')    list = list.filter(t => !t.completed);
  if (currentFilter === 'completed') list = list.filter(t => t.completed);
  if (currentFilter === 'high')      list = list.filter(t => t.priority === 'high');

  // Search
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter(t => t.text.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }

  // Sort
  if (currentSort === 'newest')   list.sort((a,b) => b.createdAt - a.createdAt);
  if (currentSort === 'oldest')   list.sort((a,b) => a.createdAt - b.createdAt);
  if (currentSort === 'alpha')    list.sort((a,b) => a.text.localeCompare(b.text));
  if (currentSort === 'priority') {
    const p = { high: 0, medium: 1, low: 2 };
    list.sort((a,b) => p[a.priority] - p[b.priority]);
  }
  if (currentSort === 'duedate') {
    list.sort((a,b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }

  return list;
}

function updateStats() {
  const total     = tasks.length;
  const done      = tasks.filter(t => t.completed).length;
  const active    = total - done;
  const pct       = total === 0 ? 0 : Math.round((done / total) * 100);

  totalCount.textContent   = total;
  activeCount.textContent  = active;
  doneCount.textContent    = done;
  progressBar.style.width  = pct + '%';
  progressLabel.textContent = pct + '% complete';
}

function render() {
  const list = getFilteredSorted();
  taskList.innerHTML = '';

  if (list.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
    list.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
      li.dataset.id = task.id;

      const overdue = isOverdue(task.dueDate) && !task.completed;
      const duePart = task.dueDate
        ? `<span class="task-due ${overdue ? 'overdue' : ''}">
             ${overdue ? '⚠' : '📅'} ${formatDate(task.dueDate)}
           </span>`
        : '';

      const catEmojis = { general:'📋', work:'💼', personal:'🏠', health:'💪', shopping:'🛒' };

      li.innerHTML = `
        <div class="task-checkbox"></div>
        <div class="task-body">
          <div class="task-text">${escapeHtml(task.text)}</div>
          <div class="task-meta">
            <span class="task-tag tag-category">${catEmojis[task.category] || '📋'} ${task.category}</span>
            <span class="task-tag tag-priority-${task.priority}">${task.priority}</span>
            ${duePart}
            <span class="task-created">${timeAgo(task.createdAt)}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action-btn edit-btn" title="Edit">✎</button>
          <button class="task-action-btn delete-btn" title="Delete">✕</button>
        </div>
      `;

      // Toggle complete
      li.querySelector('.task-checkbox').addEventListener('click', () => toggleTask(task.id));
      li.querySelector('.task-text').addEventListener('click', () => toggleTask(task.id));

      // Edit
      li.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEdit(task.id);
      });

      // Delete
      li.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(task.id, li);
      });

      taskList.appendChild(li);
    });
  }

  updateStats();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Actions ────────────────────────────────────────────
function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.focus();
    taskInput.classList.add('shake');
    setTimeout(() => taskInput.classList.remove('shake'), 400);
    return;
  }

  const task = {
    id:        uid(),
    text,
    priority:  prioritySelect.value,
    category:  categorySelect.value,
    dueDate:   dueDateInput.value || null,
    completed: false,
    createdAt: Date.now()
  };

  tasks.unshift(task);
  save();
  render();

  taskInput.value = '';
  dueDateInput.value = '';
  prioritySelect.value = 'medium';
  categorySelect.value = 'general';
  taskInput.focus();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    save();
    render();
  }
}

function deleteTask(id, el) {
  el.style.transform = 'translateX(40px)';
  el.style.opacity = '0';
  setTimeout(() => {
    tasks = tasks.filter(t => t.id !== id);
    save();
    render();
  }, 250);
}

function openEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingId = id;
  document.getElementById('edit-text').value     = task.text;
  document.getElementById('edit-priority').value  = task.priority;
  document.getElementById('edit-category').value  = task.category;
  document.getElementById('edit-due').value       = task.dueDate || '';
  modalOverlay.classList.add('open');
  document.getElementById('edit-text').focus();
}

function saveEdit() {
  const text = document.getElementById('edit-text').value.trim();
  if (!text) return;
  const task = tasks.find(t => t.id === editingId);
  if (task) {
    task.text     = text;
    task.priority = document.getElementById('edit-priority').value;
    task.category = document.getElementById('edit-category').value;
    task.dueDate  = document.getElementById('edit-due').value || null;
    save();
    render();
  }
  closeModal();
}

function closeModal() {
  modalOverlay.classList.remove('open');
  editingId = null;
}

// ── Event Listeners ────────────────────────────────────
addBtn.addEventListener('click', addTask);

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTask();
});

searchInput.addEventListener('input', () => {
  currentSearch = searchInput.value.trim();
  render();
});

sortSelect.addEventListener('change', () => {
  currentSort = sortSelect.value;
  render();
});

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    render();
  });
});

clearCompleted.addEventListener('click', () => {
  tasks = tasks.filter(t => !t.completed);
  save();
  render();
});

clearAll.addEventListener('click', () => {
  if (tasks.length === 0) return;
  if (confirm('Delete ALL tasks? This cannot be undone.')) {
    tasks = [];
    save();
    render();
  }
});

document.getElementById('modal-save').addEventListener('click', saveEdit);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Shake animation style (injected once)
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-6px)}
    40%{transform:translateX(6px)}
    60%{transform:translateX(-4px)}
    80%{transform:translateX(4px)}
  }
  .shake { animation: shake 0.35s ease; }
`;
document.head.appendChild(shakeStyle);

// ── Init ───────────────────────────────────────────────
setDateBadge();
render();

// Refresh "time ago" every minute
setInterval(() => render(), 60000);