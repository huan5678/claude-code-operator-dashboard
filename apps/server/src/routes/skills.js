import { Router } from 'express';
import { getSkillSchema, validateSkillFrontmatter } from '../services/skill-schema.js';

export function skillsRouter(reader) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      res.json({ items: await reader.listSkills() });
    } catch (e) { next(e); }
  });

  router.get('/_schema', (req, res) => {
    res.json(getSkillSchema());
  });

  // 列出 skill 目錄樹（含 reference/ 等子目錄）
  router.get('/:slug/files', async (req, res, next) => {
    try {
      const files = await reader.listSkillFiles(req.params.slug);
      if (files === null) return res.status(404).json({ error: 'not found' });
      res.json({ items: files });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });

  // 讀 skill 目錄下單一檔案：?path=reference/foo.md
  router.get('/:slug/file', async (req, res, next) => {
    try {
      const file = await reader.getSkillFile(req.params.slug, req.query.path);
      if (file === null) return res.status(404).json({ error: 'not found' });
      res.json(file);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });

  router.get('/:slug', async (req, res, next) => {
    try {
      const skill = await reader.getSkill(req.params.slug);
      if (!skill) return res.status(404).json({ error: 'not found' });
      res.json(skill);
    } catch (e) { next(e); }
  });

  router.put('/:slug', async (req, res, next) => {
    try {
      const { frontmatter, body, expectedMtime } = req.body ?? {};
      const { errors, warnings } = validateSkillFrontmatter(frontmatter);
      if (errors.length) {
        return res.status(422).json({ error: 'validation failed', errors, warnings });
      }
      if (warnings.length) {
        res.setHeader('X-Schema-Warnings', encodeURIComponent(JSON.stringify(warnings)));
      }
      const updated = await reader.saveSkill(req.params.slug, { frontmatter, body, expectedMtime });
      res.json({ ...updated, warnings });
    } catch (e) {
      if (e.code === 'CONFLICT') return res.status(409).json({ error: e.message });
      next(e);
    }
  });

  return router;
}
