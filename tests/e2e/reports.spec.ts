import { test, expect } from '@playwright/test';

test.describe('Reports Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/reports');
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click({ force: true });
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
        await expect(page.getByRole('heading', { name: /Rapports|Reports/i })).toBeVisible({ timeout: 30000 });
    });

    test('should display reports dashboard', async ({ page }) => {
        // Verify existence of report types cards or buttons
        // Assuming there is a "Rapport de Gouvernance" or similar
        await expect(page.getByText(/Gouvernance|Governance/i).first()).toBeVisible();
    });
});
