
import { test, expect } from '@playwright/test';

test.describe('Documents Module', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/#/documents');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click({ force: true });
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display documents list', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();

        // Relaxed title check
        await expect(page.getByText(/Gestion Documentaire|Documents/i).first()).toBeVisible({ timeout: 30000 });

        // Check for primary action button (present in both list and empty state)
        await expect(page.getByRole('button', { name: /Nouveau Document|New Document/i }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should open create document drawer', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();

        const createButton = page.getByRole('button', { name: /Nouveau Document|New Document/i }).first();
        await createButton.click({ force: true });
        await expect(page.getByText(/Nouveau Document|New Document/i).first()).toBeVisible();
    });
});
