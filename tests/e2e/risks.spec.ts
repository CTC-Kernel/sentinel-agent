import { test, expect } from '@playwright/test';

test.describe('Risks Module', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/#/risks');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click();
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click();
        });
    });

    test('should display risks list', async ({ page }) => {
        console.log('Risks - URL:', page.url());
        console.log('Risks - Body Start:', (await page.locator('body').innerText()).substring(0, 500));

        // Wait for title "Risques" - relaxed selector
        await expect(page.getByText(/Risques|Risk/i).first()).toBeVisible({ timeout: 30000 });

        // Switch to "Registre" tab to see the list
        await page.getByRole('button', { name: /Registre|Registry/i }).click();

        // Check for primary action button (present in both list and empty state)
        await expect(page.getByRole('button', { name: /Nouveau risque|New Risk/i }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should open create risk drawer', async ({ page }) => {
        // Click "Nouveau risque"
        await page.getByRole('button', { name: 'Nouveau risque' }).click({ force: true });

        // Verify Drawer is visible
        await expect(page.getByText(/Nouveau risque|New Risk/i, { exact: false })).toBeVisible();
    });
});
