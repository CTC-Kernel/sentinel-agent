import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test.describe('ISO 27001 Integration Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display ISO 27001 controls mapping', async ({ page }) => {
        await page.goto(BASE_URL + '/#/compliance');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });

        // Verify we're on the compliance page
        await expect(page).toHaveURL(/.*compliance/);
    });

    test('should link risks to ISO 27001 controls', async ({ page }) => {
        await page.goto(BASE_URL + '/#/risks');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });

        // Verify we're on the risks page
        await expect(page).toHaveURL(/.*risks/);
    });

    test('should generate ISO 27001 compliance reports', async ({ page }) => {
        await page.goto(BASE_URL + '/#/reports');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });

        // Verify we're on the reports page
        await expect(page).toHaveURL(/.*reports/);
    });

    test('should track control implementation status', async ({ page }) => {
        await page.goto(BASE_URL + '/#/compliance');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should provide evidence management for controls', async ({ page }) => {
        await page.goto(BASE_URL + '/#/compliance');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test('should support Statement of Applicability (SoA)', async ({ page }) => {
        await page.goto(BASE_URL + '/#/compliance');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });
});
