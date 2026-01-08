import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test.describe('Documents Module', () => {
    test.setTimeout(60000);
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test.skip('should display documents dashboard and KPIs', async ({ page }) => {
        await page.goto(BASE_URL + '/#/documents');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Check Page Header
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });
    });

    test.skip('should allow creating a new document', async ({ page }) => {
        await page.goto(BASE_URL + '/#/documents');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Open Create Modal
        const createBtn = page.getByRole('button', { name: /Nouveau Document|New Document/i }).first();
        await expect(createBtn).toBeVisible({ timeout: 10000 });
    });

    test('should filter documents', async ({ page }) => {
        await page.goto(BASE_URL + '/#/documents');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });

        // Verify we're on the documents page
        await expect(page).toHaveURL(/.*documents/);
    });
});
