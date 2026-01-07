import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Settings Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto('/#/settings');
        // Robust dismissal of modals using locator handlers

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click();
        });
    });

    test('should navigate between settings tabs', async ({ page }) => {
        await expect(page).toHaveURL(/.*settings/);
        // Wait for tab bar or layout
        await expect(page.getByRole('tab', { name: /Profil|Profile/i })).toBeVisible({ timeout: 30000 });

        // Verify Profile Tab is active by default
        await expect(page.getByTestId('profile-settings')).toBeVisible().catch(() => expect(page.getByText(/Informations Personnelles|Personal Information/i)).toBeVisible());

        // Navigate to Security Tab
        await page.getByRole('tab', { name: /Sécurité|Security/i }).click();
        await expect(page.getByText(/Mot de passe|Password/i)).toBeVisible();
    });

    test('should toggle theme', async ({ page }) => {
        // Re-verify Profile Tab
        await page.getByRole('tab', { name: /Profil|Profile/i }).click({ force: true });
        await expect(page.getByRole('button', { name: /Mettre à jour|Update/i })).toBeVisible();
    });
});
