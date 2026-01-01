import { test, expect } from '@playwright/test';

test.describe('Privacy Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/privacy');

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click();
        });
        await expect(page.getByRole('heading', { name: /Registre RGPD|Privacy/i })).toBeVisible({ timeout: 30000 });
    });

    test('should display activities list', async ({ page }) => {
        // Verify mock data
        await expect(page.getByRole('heading', { name: /Gestion Paie/i })).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(/Paiement des salaires/i)).toBeVisible();
    });

    test('should open new activity drawer', async ({ page }) => {
        const newBtn = page.getByRole('button', { name: /Nouveau Traitement|New Activity/i }).first();
        await expect(newBtn).toBeVisible();
        await newBtn.click();

        const drawer = page.locator('[role="dialog"][data-headlessui-state="open"]').first();
        await expect(drawer).toBeVisible({ timeout: 30000 });
        await expect(drawer.getByText(/Nouveau Traitement|New Activity/i)).toBeVisible(); // Drawer title

        await page.keyboard.press('Escape');
    });
});
