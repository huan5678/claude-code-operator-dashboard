import { Router } from 'express';
import { appendFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_FILE = resolve(__dirname, '../../data/audit/identity.jsonl');

function sha256(s) {
  return createHash('sha256').update(s ?? '', 'utf8').digest('hex');
}

async function writeAudit(entry) {
  try {
    await mkdir(dirname(AUDIT_FILE), { recursive: true, mode: 0o700 });
    await appendFile(AUDIT_FILE, JSON.stringify(entry) + '\n', { mode: 0o600 });
  } catch (e) {
    console.error('[audit] failed to write identity audit log:', e.message);
  }
}

export function identityRouter(reader) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try { res.json({ items: await reader.listIdentityFiles() }); }
    catch (e) { next(e); }
  });

  router.get('/:name', async (req, res, next) => {
    try {
      const item = await reader.getIdentityFile(req.params.name);
      if (!item) return res.status(404).json({ error: 'not found' });
      res.json(item);
    } catch (e) { next(e); }
  });

  router.put('/:name', async (req, res, next) => {
    try {
      const { body, expectedMtime } = req.body ?? {};
      const before = await reader.getIdentityFile(req.params.name);
      const updated = await reader.saveIdentityFile(req.params.name, { body, expectedMtime });
      await writeAudit({
        ts: new Date().toISOString(),
        actor: req.user?.email ?? null,
        action: 'identity.put',
        name: req.params.name,
        before_sha256: before ? sha256(before.body) : null,
        after_sha256: sha256(body ?? ''),
        before_size: before ? before.body.length : null,
        after_size: (body ?? '').length,
      });
      res.json(updated);
    } catch (e) {
      if (e.code === 'NOT_ALLOWED') return res.status(404).json({ error: e.message });
      if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message });
      if (e.code === 'CONFLICT') return res.status(409).json({ error: e.message });
      next(e);
    }
  });

  return router;
}
