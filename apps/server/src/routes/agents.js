import { Router } from 'express';
import { getAgentSchema, validateAgentFrontmatter } from '../services/agent-schema.js';

export function agentsRouter(reader) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try { res.json({ items: await reader.listAgents() }); }
    catch (e) { next(e); }
  });

  router.get('/_schema', (req, res) => {
    res.json(getAgentSchema());
  });

  router.get('/:slug', async (req, res, next) => {
    try {
      const item = await reader.getAgent(req.params.slug);
      if (!item) return res.status(404).json({ error: 'not found' });
      res.json(item);
    } catch (e) { next(e); }
  });

  router.put('/:slug', async (req, res, next) => {
    try {
      const { frontmatter, body, expectedMtime } = req.body ?? {};
      const errors = validateAgentFrontmatter(frontmatter);
      if (errors.length) {
        return res.status(422).json({ error: 'validation failed', errors });
      }
      const updated = await reader.saveAgent(req.params.slug, { frontmatter, body, expectedMtime });
      res.json(updated);
    } catch (e) {
      if (e.code === 'CONFLICT') return res.status(409).json({ error: e.message });
      next(e);
    }
  });

  return router;
}
