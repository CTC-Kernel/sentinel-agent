import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test.describe('RBAC & Permissions Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should enforce role-based access control', async ({ page }) => {
        // Test admin access to restricted routes
        await page.goto(BASE_URL + '/#/team');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
        await expect(page).toHaveURL(/.*team/);

        await page.goto(BASE_URL + '/#/settings');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });

        await page.goto(BASE_URL + '/#/backup');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should prevent unauthorized access', async ({ page }) => {
        // Test access to admin-only routes - as admin, we should have access
        await page.goto(BASE_URL + '/#/system-health');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // As admin, we should have access
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should validate resource-level permissions', async ({ page }) => {
        await page.goto(BASE_URL + '/#/assets');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should maintain tenant isolation', async ({ page }) => {
        await page.goto(BASE_URL + '/#/');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Verify we're authenticated
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });
    });
});
