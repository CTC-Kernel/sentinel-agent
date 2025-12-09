import { test, expect } from '@playwright/test';

test.describe('Asset Management Flow', () => {

    test('should perform full CRUD on Assets', async ({ page }) => {
        // 1. Create Asset
        await page.goto('/assets');
        await page.getByRole('button', { name: /Ajouter un actif/i }).click();

        const timestamp = Date.now();
        const assetName = `Test Asset ${timestamp}`;

        await page.getByLabel('Nom de l\'actif').fill(assetName);
        // Select 'Hardware' from dropdown (assuming standard selector)
        // Adjust selectors based on actual implementation if needed
        await page.getByRole('combobox').first().click();
        await page.getByText('Matériel').click();

        await page.getByRole('button', { name: /Créer/i }).click();

        // 2. Read Asset
        await expect(page.getByText(assetName)).toBeVisible();

        // 3. Update Asset
        await page.getByText(assetName).click();
        // Assuming inspector opens or clicking row goes to detail
        await page.getByRole('button', { name: /Modifier/i }).click();
        const updatedName = `${assetName} Updated`;
        await page.getByLabel('Nom de l\'actif').fill(updatedName);
        await page.getByRole('button', { name: /Enregistrer/i }).click();

        await expect(page.getByText(updatedName)).toBeVisible();

        // 4. Delete Asset
        // Assuming there is a delete button in the inspector or list action menu
        await page.getByRole('button', { name: /Supprimer/i }).click();
        await page.getByRole('button', { name: /Confirmer/i }).click();

        await expect(page.getByText(updatedName)).not.toBeVisible();
    });
});
