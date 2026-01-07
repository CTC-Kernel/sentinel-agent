import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test.describe('Direct Navigation Tests', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access dashboard directly', async ({ page }) => {
        await page.goto(BASE_URL + '/#/');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Check if we're not on login page
        await expect(page).not.toHaveURL(/\/login/);

        // Verify the app is loaded - check for any h1 heading
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });
    });

    test('should access assets directly', async ({ page }) => {
        await page.goto(BASE_URL + '/#/assets');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page).not.toHaveURL(/\/login/);

        // Verify we're on the assets page
        await expect(page.getByRole('heading', { name: /Asset Inventory|Inventaire/i, level: 1 })).toBeVisible({ timeout: 15000 });
    });

    test('should access risks directly', async ({ page }) => {
        await page.goto(BASE_URL + '/#/risks');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page).not.toHaveURL(/\/login/);

        // Verify we're on the risks page
        await expect(page.getByRole('heading', { name: /Risk|Risque/i, level: 1 })).toBeVisible({ timeout: 15000 });
    });

    test('should access compliance directly', async ({ page }) => {
        await page.goto(BASE_URL + '/#/compliance');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page).not.toHaveURL(/\/login/);

        // Verify we're on the compliance page
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should access reports directly', async ({ page }) => {
        await page.goto(BASE_URL + '/#/reports');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page).not.toHaveURL(/\/login/);

        // Verify we're on the reports page
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should access audit trail directly', async ({ page }) => {
        await page.goto(BASE_URL + '/#/audit-trail');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page).not.toHaveURL(/\/login/);

        // Verify we're on the audit trail page
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should access settings directly', async ({ page }) => {
        await page.goto(BASE_URL + '/#/settings');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page).not.toHaveURL(/\/login/);

        // Verify we're on the settings page
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 });
    });
});
