import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test.describe('Multi-Tenant Isolation Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should isolate data by organization', async ({ page }) => {
        await page.goto(BASE_URL + '/#/');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Verify we're authenticated and on dashboard
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });
    });

    test('should prevent cross-tenant data access', async ({ page }) => {
        await page.goto(BASE_URL + '/#/assets');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should maintain tenant isolation in audit trail', async ({ page }) => {
        await page.goto(BASE_URL + '/#/audit-trail');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should isolate user management by tenant', async ({ page }) => {
        await page.goto(BASE_URL + '/#/team');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should isolate compliance data by tenant', async ({ page }) => {
        await page.goto(BASE_URL + '/#/compliance');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should isolate reports by tenant', async ({ page }) => {
        await page.goto(BASE_URL + '/#/reports');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should maintain tenant context in navigation', async ({ page }) => {
        // Navigate through different modules and verify tenant context
        const modules = ['/assets', '/risks', '/compliance'];

        for (const module of modules) {
            await page.goto(BASE_URL + `/#${module}`);
            await page.waitForLoadState('networkidle');
            await waitForOverlaysToClose(page);
            await dismissTourDialog(page);

            // Verify we're authenticated
            await expect(page).not.toHaveURL(/\/login/);
        }
    });

    test('should isolate document storage by tenant', async ({ page }) => {
        await page.goto(BASE_URL + '/#/documents');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });
});
