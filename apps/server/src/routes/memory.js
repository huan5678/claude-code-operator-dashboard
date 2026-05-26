import { Router } from 'express';

export function memoryRouter(reader) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : null;
      res.json({ items: await reader.listMemoryDays({ limit }) });
    } catch (e) { next(e); }
  });

  router.get('/:date', async (req, res, next) => {
    try {
      const item = await reader.getMemoryDay(req.params.date);
      if (!item) return res.status(404).json({ error: 'not found' });
      res.json(item);
    } catch (e) {
      if (e.message === 'invalid date format') return res.status(400).json({ error: e.message });
      next(e);
    }
  });

  return router;
}
