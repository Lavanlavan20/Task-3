const statusEl = document.getElementById('status');
const form = document.getElementById('record-form');
const searchInput = document.getElementById('search');
const listEl = document.getElementById('records');
const resultCount = document.getElementById('result-count');
const cmdForm = document.getElementById('cmd-form');
const cmdInput = document.getElementById('command');
const outputEl = document.getElementById('output');

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function recordItem(rec) {
  const li = document.createElement('li');
  li.className = 'bg-white border rounded-lg p-4 flex flex-col gap-2';

  const top = document.createElement('div');
  top.className = 'flex items-start justify-between gap-3';

  const title = document.createElement('h3');
  title.className = 'font-medium';
  title.textContent = rec.title || '(untitled)';

  const del = document.createElement('button');
  del.className = 'rounded bg-red-600 text-white text-sm px-3 py-1 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500';
  del.textContent = 'Delete';
  del.addEventListener('click', async () => {
    if (!confirm('Delete this record?')) return;
    try {
      await api(`/api/records/${rec.id}`, { method: 'DELETE' });
      setStatus('Record deleted');
      await loadRecords(searchInput.value.trim());
    } catch (e) {
      setStatus(e.message);
    }
  });

  top.append(title, del);

  const meta = document.createElement('div');
  meta.className = 'text-xs text-gray-500';
  meta.textContent = `id: ${rec.id} · created: ${new Date(rec.createdAt).toLocaleString()}`;

  const details = document.createElement('p');
  details.className = 'text-sm text-gray-700';
  details.textContent = rec.details || '';

  li.append(top, meta, details);
  return li;
}

async function loadRecords(q = '') {
  try {
    setStatus('Loading...');
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    const { data } = await api(`/api/records${query}`);
    listEl.replaceChildren();
    data.forEach((r) => listEl.appendChild(recordItem(r)));
    resultCount.textContent = `${data.length} record(s)`;
    setStatus('');
  } catch (e) {
    setStatus(e.message);
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const title = fd.get('title')?.toString().trim() || '';
  const details = fd.get('details')?.toString().trim() || '';
  try {
    await api('/api/records', { method: 'POST', body: JSON.stringify({ title, details }) });
    form.reset();
    setStatus('Record created');
    await loadRecords(searchInput.value.trim());
  } catch (e) {
    setStatus(e.message);
  }
});

// Debounce
let debounceT;
searchInput?.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearTimeout(debounceT);
  debounceT = setTimeout(() => loadRecords(q), 250);
});

cmdForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cmd = cmdInput.value.trim();
  if (!cmd) return;
  outputEl.value = '';
  setStatus('Running command...');
  try {
    const res = await api('/api/run', { method: 'POST', body: JSON.stringify({ command: cmd }) });
    const parts = [];
    parts.push(`Exit code: ${res.code}`);
    if (res.stdout) {
      parts.push('\n--- stdout ---\n');
      parts.push(res.stdout);
    }
    if (res.stderr) {
      parts.push('\n--- stderr ---\n');
      parts.push(res.stderr);
    }
    outputEl.value = parts.join('');
    setStatus('Command finished');
  } catch (e) {
    outputEl.value = '';
    setStatus(e.message);
  }
});

// Initial load
loadRecords();
