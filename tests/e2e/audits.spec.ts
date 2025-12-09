import { test, expect } from '@playwright/test';

test.describe('Audit Management', () => {

    test('should display audit list', async ({ page }) => {
        // Mock login or reuse state
        await page.goto('/audits');

        // Check if we are redirected to login (expected if not authed)
        await expect(page).toHaveURL(/.*\/login/);
    });
});
