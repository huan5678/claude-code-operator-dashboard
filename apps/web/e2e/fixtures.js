import { test as base, expect } from '@playwright/test';

/**
 * Auth-bypass + API mocking fixtures.
 *
 * The Pinia auth store (src/stores/auth.js) keeps NO token in localStorage —
 * it hydrates purely from GET /api/auth/me (cookie/session based). The router
 * guard (src/router.js) calls auth.hydrate() and treats a populated `user` as
 * "logged in". So the only thing needed to start authenticated is to make
 * /api/auth/me return a user object. No localStorage/cookie seeding is required.
 *
 * `mockApi` additionally fulfils every endpoint each view fetches with minimal
 * valid JSON, and aborts external Google/font requests so tests are hermetic.
 */

const now = Date.now();

// Minimal valid responses keyed by the path AFTER the /api prefix.
const RESPONSES = {
  '/auth/me': { user: { email: 'operator@test.dev', name: 'Operator' } },
  '/status': { items: [] },
  '/identity': {
    items: [
      { name: 'CLAUDE.md', size: 2048, mtime: now },
      { name: 'IDENTITY.md', size: 1024, mtime: now },
    ],
  },
  '/skills': {
    items: [
      { slug: 'demo-skill', name: 'Demo Skill', description: 'A demo skill for e2e', model: 'sonnet' },
    ],
  },
  '/agents': {
    items: [
      { slug: 'demo-agent', name: 'Demo Agent', description: 'A demo agent for e2e', color: 'amber', model: 'opus' },
    ],
  },
  '/tasks': {
    items: [
      { slug: 'demo-task', name: 'Demo Task', enabled: true, channel: 'discord', schedule: '0 9 * * *' },
    ],
  },
  '/memory': {
    items: [
      { date: '2026-06-29', size: 4096 },
      { date: '2026-06-28', size: 2048 },
    ],
  },
  '/kanban/columns': {
    items: [
      { id: 1, name: 'TODO' },
      { id: 2, name: 'DOING' },
      { id: 3, name: 'DONE' },
    ],
  },
  '/kanban/cards': {
    items: [
      { id: 1, column_id: 1, title: 'First card', description: 'a description here', tags: ['x'], position: 0 },
      { id: 2, column_id: 2, title: 'Second card', description: '', tags: [], position: 0 },
    ],
  },
  '/launch-profiles': {
    items: [
      {
        id: 1,
        name: 'demo',
        command: 'claude --channels plugin:discord@claude-plugins-official',
        cwd: '~/Claude-station',
        env: {},
      },
    ],
  },
  '/terminal/sessions': {
    items: [
      {
        id: 'abcd1234efgh5678',
        profile_name: 'demo',
        status: 'running',
        pid: 4242,
        started_at: '2026-06-29T10:00:00',
        command: 'claude --channels plugin:discord@claude-plugins-official',
        removed: false,
        restart_count: 0,
      },
    ],
  },
};

export async function mockApi(page, { authenticated = true } = {}) {
  // Hermetic: kill external Google Identity + font requests.
  await page.route(/accounts\.google\.com/, (r) => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^\/api/, '');
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (p === '/auth/me') {
      if (!authenticated) return json({ error: 'unauthorized' }, 401);
      return json(RESPONSES['/auth/me']);
    }

    // Dynamic: a single memory day
    if (/^\/memory\/.+/.test(p)) {
      const date = decodeURIComponent(p.split('/').pop());
      return json({ date, body: `# Memory ${date}\n\nSome journal content for the day.` });
    }

    if (RESPONSES[p]) return json(RESPONSES[p]);

    // Safe default for anything unmocked (schemas, detail endpoints, etc.)
    return json({ items: [] });
  });
}

// Authenticated test — the common case.
export const test = base.extend({
  page: async ({ page }, use) => {
    await mockApi(page, { authenticated: true });
    await use(page);
  },
});

// Guest test — for the /login route, where an authenticated user would be
// redirected to / by the router guard.
export const guestTest = base.extend({
  page: async ({ page }, use) => {
    await mockApi(page, { authenticated: false });
    await use(page);
  },
});

export { expect };
