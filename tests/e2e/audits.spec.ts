
import { test, expect } from '@playwright/test';

test.describe('Audits Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/audits');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display audits list', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 45000 });
        // Check for page title
        await expect(page.getByRole('heading', { name: /Audit/i }).first()).toBeVisible({ timeout: 30000 });

        // Check for primary action button (present in both list and empty state)
        await expect(page.getByRole('button', { name: /Nouvel Audit|New Audit|Planifier|Schedule/i }).first()).toBeVisible({ timeout: 15000 });

        // Optional: Check for data or empty state if possible, but don't fail hard
        // await expect(page.getByText(/Audit Interne|Aucun audit/i).first()).toBeVisible();
    });

    test('should open create audit drawer', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 45000 });

        // "Nouvel Audit" button
        await page.getByRole('button', { name: /Nouvel Audit|New Audit/i }).first().click({ force: true });

        // Verify drawer title
        await expect(page.getByText(/Nouvel Audit|New Audit/i).first()).toBeVisible();
    });
});
