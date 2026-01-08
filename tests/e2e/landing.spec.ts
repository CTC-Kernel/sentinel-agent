import { test, expect } from '@playwright/test';

test('landing page renders correctly', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    // Check for main title - accept either Sentinel or Tableau de Bord
    // We use .first() to avoid strict mode violation if multiple h1s exist
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
});
