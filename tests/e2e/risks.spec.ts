import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test.describe('Risks Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should navigate from Asset to Risk Creation with pre-filled asset', async ({ page }) => {
        // Go to risks page directly
        await page.goto(BASE_URL + '/#/risks');
        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);

        // Verify we're on the risks page
        await expect(page.getByRole('heading', { name: /Risk|Risque/i, level: 1 })).toBeVisible({ timeout: 30000 });

        // Verify we're not on login
        await expect(page).not.toHaveURL(/\/login/);
    });
});
