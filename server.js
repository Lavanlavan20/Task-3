import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { nanoid } from 'nanoid';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

let records = [];

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/records', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase();
  let data = records;
  if (q) {
    data = records.filter((r) =>
      (r.title || '').toLowerCase().includes(q) ||
      (r.details || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q)
    );
  }
  res.json({ data });
});

app.post('/api/records', (req, res) => {
  const { title = '', details = '' } = req.body || {};
  const id = nanoid(8);
  const createdAt = new Date().toISOString();
  const rec = { id, title, details, createdAt };
  records.unshift(rec);
  res.status(201).json(rec);
});

app.get('/api/records/:id', (req, res) => {
  const rec = records.find((r) => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json(rec);
});

app.delete('/api/records/:id', (req, res) => {
  const idx = records.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [deleted] = records.splice(idx, 1);
  res.json({ deleted });
});

app.post('/api/run', async (req, res) => {
  const { command } = req.body || {};
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command is required' });
  }
  if (command.length > 200) {
    return res.status(400).json({ error: 'command too long' });
  }

  const child = spawn(command, {
    shell: true,
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';
  const maxBytes = 200000; // ~200KB cap

  child.stdout.on('data', (d) => {
    if (stdout.length < maxBytes) stdout += d.toString();
  });
  child.stderr.on('data', (d) => {
    if (stderr.length < maxBytes) stderr += d.toString();
  });

  const timeoutMs = 20000; // 20s timeout
  const timeout = setTimeout(() => {
    try {
      child.kill('SIGTERM');
    } catch {}
  }, timeoutMs);

  child.on('close', (code) => {
    clearTimeout(timeout);
    res.json({ code, stdout, stderr });
  });

  child.on('error', (err) => {
    clearTimeout(timeout);
    res.status(500).json({ error: err.message });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
