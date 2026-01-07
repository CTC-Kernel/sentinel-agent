import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Threat Intelligence Module', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto('/#/threat-intelligence');

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
        await expect(page.getByRole('heading', { name: /Threat Intel|Cyber Menaces/i })).toBeVisible({ timeout: 30000 });
    });

    test('should display threat feeds and registry', async ({ page }) => {
        // Verify tabs or sections
        const registryTab = page.getByRole('tab', { name: /Registre|Registry/i });
        if (await registryTab.isVisible()) {
            await registryTab.click();
            await expect(page.getByText('APT-29').first()).toBeVisible();
        } else {
            // If no tabs, check for direct content
            await expect(page.getByText(/Registre|Registry/i)).toBeVisible();
        }
    });
});
