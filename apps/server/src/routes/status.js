import { Router } from 'express';
import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';

function resolveStatusDir() {
  if (process.env.STATUS_DIR_PATH) return resolve(process.env.STATUS_DIR_PATH);
  if (process.env.STATUS_FILE_PATH) return resolve(dirname(process.env.STATUS_FILE_PATH));
  return resolve(homedir(), '.claude/codd-status');
}

const STALE_AFTER_MS = 60 * 60 * 1000;
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

async function readSession(file) {
  try {
    const [raw, st] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
    const data = JSON.parse(raw);
    const lastEvent = data.last_event_at ? Date.parse(data.last_event_at) : null;
    const idleSeconds = lastEvent ? Math.max(0, Math.floor((Date.now() - lastEvent) / 1000)) : null;
    const stale = lastEvent ? (Date.now() - lastEvent) > STALE_AFTER_MS : false;
    return { ...data, idle_seconds: idleSeconds, stale, file_mtime: st.mtimeMs };
  } catch (e) {
    return null;
  }
}

export function statusRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const dir = resolveStatusDir();
    if (!existsSync(dir)) {
      return res.json({ available: false, reason: 'status dir does not exist', dir, items: [] });
    }
    try {
      const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
      const items = (await Promise.all(files.map(f => readSession(join(dir, f))))).filter(Boolean);
      items.sort((a, b) => (b.file_mtime || 0) - (a.file_mtime || 0));
      return res.json({ available: true, dir, items });
    } catch (e) {
      return res.json({ available: false, reason: e.message, dir, items: [] });
    }
  });

  router.get('/:session_id', async (req, res) => {
    const sessionId = req.params.session_id;
    if (!SESSION_ID_RE.test(sessionId)) {
      return res.status(400).json({ error: 'invalid session_id' });
    }
    const dir = resolveStatusDir();
    const file = join(dir, `${sessionId}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: 'not found' });
    const data = await readSession(file);
    if (!data) return res.status(500).json({ error: 'parse failed' });
    res.json(data);
  });

  return router;
}
