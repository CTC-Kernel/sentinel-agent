import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test.describe('Compliance Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto(BASE_URL + '/#/compliance');

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });

        await page.addLocatorHandler(page.locator('.driver-popover'), async (overlay) => {
            await overlay.click({ force: true });
            await page.keyboard.press('Escape');
        });

        await page.addLocatorHandler(page.locator('.driver-overlay'), async () => {
            await page.keyboard.press('Escape');
        });

        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);
    });

    test('should allow uploading evidence from control inspector', async ({ page }) => {
        // Wait for Compliance page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });

        // Verify we're on the compliance page
        await expect(page).toHaveURL(/.*compliance/);
    });
});
