import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Direct Navigation Tests', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access dashboard directly', async ({ page }) => {
        await page.goto('/#/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('Dashboard URL:', currentUrl);

        // Check if we're not on login page
        expect(currentUrl).not.toContain('/login');

        // Look for any content
        const body = page.locator('body');
        await expect(body).toBeVisible();

        // Try to find dashboard-related content
        const content = page.locator('main, aside, [data-tour], h1, h2');
        if (await content.count() > 0) {
            console.log('✅ Found page content');
        } else {
            console.log('⚠️ No specific content found, but page loaded');
        }

        await page.screenshot({ path: 'test-results/dashboard-direct.png' });
    });

    test('should access assets directly', async ({ page }) => {
        await page.goto('/#/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('Assets URL:', currentUrl);

        expect(currentUrl).not.toContain('/login');

        const body = page.locator('body');
        await expect(body).toBeVisible();

        await page.screenshot({ path: 'test-results/assets-direct.png' });
    });

    test('should access risks directly', async ({ page }) => {
        await page.goto('/#/risks');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('Risks URL:', currentUrl);

        expect(currentUrl).not.toContain('/login');

        const body = page.locator('body');
        await expect(body).toBeVisible();

        await page.screenshot({ path: 'test-results/risks-direct.png' });
    });

    test('should access compliance directly', async ({ page }) => {
        await page.goto('/#/compliance');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('Compliance URL:', currentUrl);

        expect(currentUrl).not.toContain('/login');

        const body = page.locator('body');
        await expect(body).toBeVisible();

        await page.screenshot({ path: 'test-results/compliance-direct.png' });
    });

    test('should access reports directly', async ({ page }) => {
        await page.goto('/#/reports');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('Reports URL:', currentUrl);

        expect(currentUrl).not.toContain('/login');

        const body = page.locator('body');
        await expect(body).toBeVisible();

        await page.screenshot({ path: 'test-results/reports-direct.png' });
    });

    test('should access audit trail directly', async ({ page }) => {
        await page.goto('/#/audit-trail');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('Audit trail URL:', currentUrl);

        expect(currentUrl).not.toContain('/login');

        const body = page.locator('body');
        await expect(body).toBeVisible();

        await page.screenshot({ path: 'test-results/audit-trail-direct.png' });
    });

    test('should access settings directly', async ({ page }) => {
        await page.goto('/#/settings');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log('Settings URL:', currentUrl);

        expect(currentUrl).not.toContain('/login');

        const body = page.locator('body');
        await expect(body).toBeVisible();

        await page.screenshot({ path: 'test-results/settings-direct.png' });
    });
});
