import { test, expect } from './fixtures.js';

const isMobile = (testInfo) => testInfo.project.name === 'Mobile';
const isDesktop = (testInfo) => testInfo.project.name === 'Desktop';

// Nav links carry a CSS ::before '▸' that pollutes the accessible name, so
// target them by href instead of by role name.
const navLink = (page, path) => page.locator(`#sidebar-nav .nav a[href="${path}"]`);

test('mobile: sidebar is an off-canvas drawer with a working hamburger', async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo), 'mobile-only');

  await page.goto('/identity');
  await expect(page.getByRole('heading', { name: 'IDENTITY', exact: true })).toBeVisible();

  const burger = page.getByRole('button', { name: '切換導覽選單' });
  const skillsLink = navLink(page, '/skills');
  const agentsLink = navLink(page, '/agents');

  // Default: drawer closed (nav links off-screen), hamburger visible.
  await expect(burger).toBeVisible();
  await expect(skillsLink).not.toBeInViewport();

  // Sidebar is pushed off the left edge when closed.
  const closedBox = await page.locator('.sidebar').boundingBox();
  expect(closedBox.x + closedBox.width).toBeLessThanOrEqual(1);

  // Tap hamburger → drawer opens, nav links visible, backdrop present.
  await burger.click();
  await expect(skillsLink).toBeInViewport();
  await expect(page.locator('.nav-backdrop')).toBeVisible();
  // Poll until the 220ms slide-in transition settles at x ≈ 0.
  await expect
    .poll(async () => Math.round((await page.locator('.sidebar').boundingBox()).x))
    .toBeGreaterThanOrEqual(-1);

  // Tap backdrop (right region, not covered by the 260px drawer) → closes.
  await page.locator('.nav-backdrop').click({ position: { x: 350, y: 400 } });
  await expect(skillsLink).not.toBeInViewport();

  // Re-open and navigate via a nav link → route changes AND drawer auto-closes.
  await burger.click();
  await expect(agentsLink).toBeInViewport();
  await agentsLink.click();
  await expect(page).toHaveURL(/\/agents$/);
  await expect(page.getByRole('heading', { name: 'AGENTS', exact: true })).toBeVisible();
  await expect(agentsLink).not.toBeInViewport();
});

test('mobile: Escape closes the drawer', async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo), 'mobile-only');

  await page.goto('/identity');
  const burger = page.getByRole('button', { name: '切換導覽選單' });
  const skillsLink = navLink(page, '/skills');

  await burger.click();
  await expect(skillsLink).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(skillsLink).not.toBeInViewport();
});

test('desktop: sidebar always visible, hamburger hidden', async ({ page }, testInfo) => {
  test.skip(!isDesktop(testInfo), 'desktop-only');

  await page.goto('/identity');
  await expect(page.getByRole('heading', { name: 'IDENTITY', exact: true })).toBeVisible();

  // Sidebar nav links are visible without any interaction.
  await expect(navLink(page, '/skills')).toBeInViewport();
  await expect(navLink(page, '/agents')).toBeInViewport();

  // Hamburger is display:none on desktop.
  await expect(page.getByRole('button', { name: '切換導覽選單' })).toBeHidden();
});

test('kanban mobile: columns stack vertically full-width', async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo), 'mobile-only');

  await page.goto('/kanban');
  await expect(page.getByRole('heading', { name: 'KANBAN', exact: true })).toBeVisible();

  const cols = page.locator('.kanban-column');
  await expect(cols).toHaveCount(3);

  const board = await page.locator('.kanban-board').boundingBox();
  const c0 = await cols.nth(0).boundingBox();
  const c1 = await cols.nth(1).boundingBox();

  // Stacked: the 2nd column starts below the 1st (not beside it).
  expect(c1.y).toBeGreaterThan(c0.y + c0.height - 5);
  expect(c1.x).toBeLessThan(c0.x + 5);

  // Full-width: each column spans (nearly) the whole board.
  expect(c0.width).toBeGreaterThan(board.width * 0.9);
});

test('kanban desktop: columns sit side-by-side', async ({ page }, testInfo) => {
  test.skip(!isDesktop(testInfo), 'desktop-only');

  await page.goto('/kanban');
  await expect(page.getByRole('heading', { name: 'KANBAN', exact: true })).toBeVisible();

  const cols = page.locator('.kanban-column');
  const c0 = await cols.nth(0).boundingBox();
  const c1 = await cols.nth(1).boundingBox();

  // Side-by-side: same row, 2nd to the right of the 1st.
  expect(Math.abs(c1.y - c0.y)).toBeLessThan(5);
  expect(c1.x).toBeGreaterThan(c0.x + c0.width - 5);
});
