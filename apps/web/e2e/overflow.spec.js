import { test, guestTest, expect } from './fixtures.js';

// Authenticated routes + the known visible heading on each.
const ROUTES = [
  { path: '/identity', heading: 'IDENTITY' },
  { path: '/skills', heading: 'SKILLS' },
  { path: '/agents', heading: 'AGENTS' },
  { path: '/tasks', heading: 'TASKS' },
  { path: '/memory', heading: 'MEMORY' },
  { path: '/kanban', heading: 'KANBAN' },
  { path: '/sessions', heading: 'SESSIONS' },
  { path: '/profiles', heading: 'LAUNCH PROFILES' },
];

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow, `horizontal overflow px (scrollWidth - innerWidth)`).toBeLessThanOrEqual(1);
}

// Pages to capture as mobile evidence.
const SCREENSHOT = new Set(['/identity', '/kanban', '/memory']);

for (const { path, heading } of ROUTES) {
  test(`no horizontal overflow + heading visible: ${path}`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();

    await assertNoHorizontalOverflow(page);

    if (testInfo.project.name === 'Mobile' && SCREENSHOT.has(path)) {
      const slug = path.replace(/\//g, '') || 'root';
      await page.screenshot({
        path: `e2e/screenshots/mobile-${slug}.png`,
        fullPage: true,
      });
    }
  });
}

// /login is special: an authenticated user is redirected to / by the guard,
// so it must run as a guest (auth.me → 401).
guestTest('no horizontal overflow + heading visible: /login', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'FANCY/CODD', exact: true })).toBeVisible();

  await assertNoHorizontalOverflow(page);

  if (testInfo.project.name === 'Mobile') {
    await page.screenshot({ path: 'e2e/screenshots/mobile-login.png', fullPage: true });
  }
});
