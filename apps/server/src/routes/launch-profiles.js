import { Router } from 'express';

export function launchProfilesRouter(repo) {
  const router = Router();

  router.get('/', (req, res) => res.json({ items: repo.list() }));

  router.get('/:id', (req, res) => {
    const item = repo.get(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json(item);
  });

  router.post('/', (req, res, next) => {
    try { res.status(201).json(repo.create(req.body ?? {})); }
    catch (e) { res.status(e.status ?? 500).json({ error: e.message }); }
  });

  router.patch('/:id', (req, res) => {
    const updated = repo.update(Number(req.params.id), req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const ok = repo.delete(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  });

  return router;
}
