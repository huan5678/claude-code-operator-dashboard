import { Router } from 'express';

export function tasksRouter(reader) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try { res.json({ items: await reader.listTasks() }); }
    catch (e) { next(e); }
  });

  router.get('/:slug', async (req, res, next) => {
    try {
      const item = await reader.getTask(req.params.slug);
      if (!item) return res.status(404).json({ error: 'not found' });
      res.json(item);
    } catch (e) { next(e); }
  });

  router.put('/:slug', async (req, res, next) => {
    try {
      const { frontmatter, body, expectedMtime } = req.body ?? {};
      const updated = await reader.saveTask(req.params.slug, { frontmatter, body, expectedMtime });
      res.json(updated);
    } catch (e) {
      if (e.code === 'CONFLICT') return res.status(409).json({ error: e.message });
      next(e);
    }
  });

  return router;
}
