import { Router } from 'express';

export function kanbanRouter(repo) {
  const router = Router();

  router.get('/columns', (req, res) => {
    res.json({ items: repo.listColumns() });
  });

  router.get('/cards', (req, res) => {
    const columnId = req.query.column ? Number(req.query.column) : null;
    res.json({ items: repo.listCards({ columnId }) });
  });

  router.get('/cards/:id', (req, res) => {
    const card = repo.getCard(Number(req.params.id));
    if (!card) return res.status(404).json({ error: 'not found' });
    res.json(card);
  });

  router.post('/cards', (req, res, next) => {
    try {
      const { title, description, columnId, columnName, tags } = req.body ?? {};
      const card = repo.createCard({ title, description, columnId, columnName, tags });
      res.status(201).json(card);
    } catch (e) { next(e); }
  });

  router.patch('/cards/:id', (req, res, next) => {
    try {
      const card = repo.updateCard(Number(req.params.id), req.body ?? {});
      if (!card) return res.status(404).json({ error: 'not found' });
      res.json(card);
    } catch (e) { next(e); }
  });

  router.delete('/cards/:id', (req, res) => {
    const ok = repo.deleteCard(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  });

  return router;
}
