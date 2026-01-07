import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose } from './utils';

test.describe('Vulnerabilities Module', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto('/#/vulnerabilities');

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
        await expect(page.getByRole('heading', { name: /Vulnérabilités|Vulnerabilities/i })).toBeVisible({ timeout: 30000 });
    });

    test('should display vulnerabilities list', async ({ page }) => {
        // Wait for overlays to close
        await waitForOverlaysToClose(page);
        
        // Verify list headers - use more specific selectors to avoid strict mode violations
        await expect(page.getByRole('heading', { name: /Distribution par Sévérité/i })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/CVE/i).first()).toBeVisible({ timeout: 5000 });

        // Verify mock data presence - wait for skeleton to disappear
        await expect(page.getByText('CVE-2023-1234').first()).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/High/i).first()).toBeVisible({ timeout: 5000 });
    });
});
