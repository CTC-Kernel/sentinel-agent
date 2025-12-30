import { test, expect } from '@playwright/test';

test.describe('Vulnerabilities Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/vulnerabilities');
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click({ force: true });
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
        await expect(page.getByRole('heading', { name: /Vulnérabilités|Vulnerabilities/i })).toBeVisible({ timeout: 30000 });
    });

    test('should display vulnerabilities list', async ({ page }) => {
        // Verify list headers
        await expect(page.getByText(/Sévérité|Severity/i)).toBeVisible();
        await expect(page.getByText(/CVE/i)).toBeVisible();

        // Verify mock data presence - wait for skeleton to disappear
        await expect(page.getByText('CVE-2023-1234').first()).toBeVisible();
        await expect(page.getByText(/High/i).first()).toBeVisible();
    });
});
