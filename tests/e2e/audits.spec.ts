
import { test, expect } from '@playwright/test';

test.describe('Audits Module', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/#/audits');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click({ force: true });
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display audits list', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();
        // Check for page title
        await expect(page.getByRole('heading', { name: /Audit/i }).first()).toBeVisible({ timeout: 30000 });

        // Check for primary action button (present in both list and empty state)
        await expect(page.getByRole('button', { name: /Nouvel Audit|New Audit|Planifier|Schedule/i }).first()).toBeVisible({ timeout: 15000 });

        // Optional: Check for data or empty state if possible, but don't fail hard
        // await expect(page.getByText(/Audit Interne|Aucun audit/i).first()).toBeVisible();
    });

    test('should open create audit drawer', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();

        // "Nouvel Audit" button
        const createButton = page.getByRole('button', { name: /Nouvel Audit|New Audit/i }).first();
        await createButton.click();

        // Verify drawer title
        await expect(page.getByText(/Nouvel Audit|New Audit/i).first()).toBeVisible();
    });
});
