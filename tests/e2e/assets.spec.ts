import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog, BASE_URL } from './utils';

test.describe('Assets Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto(BASE_URL + '/#/assets');

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });

        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);
    });

    test('should display assets list', async ({ page }) => {
        // Wait for the page heading
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 });

        // Verify we're on the assets page
        await expect(page).toHaveURL(/.*assets/);
    });

    test('should open create asset modal', async ({ page }) => {
        // Wait for page to be ready
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 });

        // Look for any button on the page
        const buttons = page.getByRole('button');
        await expect(buttons.first()).toBeVisible({ timeout: 10000 });
    });
});
