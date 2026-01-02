
import { test, expect } from '@playwright/test';

test.describe('Risks Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        // Go to Assets to start the flow
        await page.goto('/#/assets');

        // Robust dismissal of modals
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should navigate from Asset to Risk Creation with pre-filled asset', async ({ page }) => {
        // 1. Wait for Assets list to load
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/Inventaire des Actifs|Asset Inventory/i).first()).toBeVisible();

        // 2. Select the first asset in the list (Support Grid View which uses role="button" on cards)
        // AssetList cards have class 'glass-panel' and role 'button'
        // We use a locator that finds the first glass-panel that acts as a button
        const firstAsset = page.locator('.glass-panel[role="button"]').first();
        await expect(firstAsset).toBeVisible();
        await firstAsset.click();

        // 3. Verify Drawer/Page opens (Asset Details)
        // Look for "Détails" or "Informations"
        await expect(page.getByText(/Détails|Details/i).first()).toBeVisible();

        // 4. Click on "Sécurité" tab
        const securityTab = page.getByRole('tab', { name: /Sécurité|Security/i });
        await securityTab.click();

        // 5. Click "Créer un Risque" or "Ajouter un Risque" button
        const createRiskBtn = page.getByRole('button', { name: /Créer un Risque|Create Risk/i });
        await expect(createRiskBtn).toBeVisible();
        await createRiskBtn.click();

        // 6. Assert redirection to Risks page
        // URL should contain /risks
        await expect(page).toHaveURL(/.*\/risks/);

        // 7. Assert "Nouveau Risque" modal is open
        await expect(page.getByText(/Nouveau Risque|New Risk/i).first()).toBeVisible();

        // 8. Assert Asset field is pre-filled
        await expect(page.locator('button[role="combobox"]').filter({ hasText: /Actif|Asset/i }).first()).toBeVisible();
    });
});
