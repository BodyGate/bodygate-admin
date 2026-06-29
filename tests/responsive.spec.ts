import { test, expect } from '@playwright/test';
const routes = ['/', '/customers', '/customers/new', '/payments', '/reception', '/settings'];
for (const route of routes) {
  test(route + ' responsive', async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    const data = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(data.scrollWidth).toBeLessThanOrEqual(data.clientWidth + 2);
  });
}
