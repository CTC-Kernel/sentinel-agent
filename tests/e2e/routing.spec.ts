import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose, dismissTourDialog } from './utils';
import { BASE_URL } from './utils';

test('verify routing basics', async ({ page }) => {
    await setupMockAuth(page);
    await setupFirestoreMocks(page);

    // Navigate to dashboard which should always exist
    await page.goto(BASE_URL + '/#/');
    await page.waitForLoadState('networkidle');
    await waitForOverlaysToClose(page);
    await dismissTourDialog(page);

    // Verify we're on the dashboard and not redirected to login
    await expect(page).not.toHaveURL(/\/login/);

    // Check that the app is loaded
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10000 });
});
