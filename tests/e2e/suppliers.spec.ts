import { test, expect } from '@playwright/test';

test.describe('Suppliers Module', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/#/suppliers');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click({ force: true });
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display suppliers list', async ({ page }) => {
        // Wait for loading
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();

        await expect(page.getByText(/Fournisseurs|Suppliers/i).first()).toBeVisible({ timeout: 30000 });

        // Check for primary action button (present in both list and empty state)
        await expect(page.getByRole('button', { name: /Nouveau Fournisseur|New Supplier/i }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should open create supplier drawer', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();

        const createButton = page.getByRole('button', { name: /Nouveau Fournisseur|New Supplier/i }).first();
        await createButton.click();
        await expect(page.getByText(/Nouveau Fournisseur|New Supplier/i).first()).toBeVisible();
    });
});
