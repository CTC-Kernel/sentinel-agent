import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Incidents Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto('/#/incidents');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display incidents list', async ({ page }) => {
        console.log('Incidents - URL:', page.url());
        const bodyText = await page.locator('body').innerText();
        console.log('Incidents - Body Start:', bodyText.substring(0, 500));

        // Check for page title - relaxed
        await expect(page.getByText(/Incidents|Gestion des Incidents/i).first()).toBeVisible({ timeout: 30000 });

        // Check for primary action button (present in both list and empty state)
        await expect(page.getByRole('button', { name: /Déclarer|Declare/i }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should open create incident drawer', async ({ page }) => {
        // Wait for the button to be potentially visible
        await page.waitForTimeout(1000);

        // Try multiple selectors
        const declareButton = page.getByRole('button', { name: /Déclarer|Declare/i }).first();
        await declareButton.click();

        await expect(page.getByText(/Nouvel incident|New Security Incident/i)).toBeVisible();
        // Check form fields presence
        await expect(page.getByLabel(/Titre|Title/i)).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 15000 });
    });
});
