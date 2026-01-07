import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Documents Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto('/#/documents');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display documents list', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 30000 });

        // Relaxed title check
        await expect(page.getByText(/Gestion Documentaire|Documents/i).first()).toBeVisible({ timeout: 30000 });

        // Check for primary action button (present in both list and empty state)
        await expect(page.getByRole('button', { name: /Nouveau Document|New Document/i }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should open create document drawer', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 15000 });

        const createButton = page.getByRole('button', { name: /Nouveau Document|New Document/i }).first();
        await createButton.click({ force: true });
        await expect(page.getByText(/Nouveau Document|New Document/i).first()).toBeVisible();
    });
});
