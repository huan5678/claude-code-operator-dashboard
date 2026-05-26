import { Router } from 'express';

export function sessionsRouter(terminal) {
  const router = Router();

  router.get('/', (req, res) => res.json({ items: terminal.list() }));

  router.get('/:id', (req, res) => {
    const s = terminal.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    res.json(s);
  });

  router.get('/:id/log', (req, res) => {
    const tail = Number(req.query.tail || 200);
    const text = terminal.logTail(req.params.id, tail);
    if (text === null) return res.status(404).json({ error: 'not found' });
    res.json({ log: text });
  });

  router.post('/', async (req, res, next) => {
    try {
      const profile_id = Number(req.body?.profile_id);
      if (!profile_id) return res.status(400).json({ error: 'profile_id required' });
      res.status(201).json(await terminal.spawn({ profile_id }));
    } catch (e) {
      res.status(e.status ?? 500).json({ error: e.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    const s = await terminal.kill(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    res.json(s);
  });

  router.post('/:id/restart', async (req, res, next) => {
    try {
      const s = await terminal.restart(req.params.id);
      if (!s) return res.status(404).json({ error: 'not found' });
      res.json(s);
    } catch (e) {
      res.status(e.status ?? 500).json({ error: e.message });
    }
  });

  return router;
}
