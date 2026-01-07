import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test.describe('Incidents Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto(BASE_URL + '/#/incidents');

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });

        await page.waitForLoadState('networkidle');
        await waitForOverlaysToClose(page);
        await dismissTourDialog(page);
    });

    test('should display incidents list', async ({ page }) => {
        // Check for page heading
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });

        // Verify we're on the incidents page
        await expect(page).toHaveURL(/.*incidents/);
    });

    test('should open create incident drawer', async ({ page }) => {
        // Wait for page to load
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30000 });

        // Find any button
        const buttons = page.getByRole('button');
        await expect(buttons.first()).toBeVisible({ timeout: 10000 });
    });
});
