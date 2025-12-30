import { test, expect } from '@playwright/test';

test.describe('Assets Module', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/#/assets');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click({ force: true });
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display assets list', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();
        await expect(page.getByRole('heading', { name: /Actifs|Inventory|Assets/i, level: 1 })).toBeVisible({ timeout: 30000 });
        // Check for "Nouvel Actif" button
        await expect(page.getByRole('button', { name: /Nouvel actif|New Asset|Add Asset/i }).first()).toBeVisible();
    });

    test('should open create asset modal', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();

        const createButton = page.getByRole('button', { name: /Nouvel actif|New Asset/i }).first();
        await createButton.click();
        await expect(page.getByText(/Créer un nouvel actif|Create Asset|New Asset/i)).toBeVisible();
    });
});
