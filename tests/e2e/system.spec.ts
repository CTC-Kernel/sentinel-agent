import { test, expect } from '@playwright/test';

test.describe('System Administration Module', () => {
    test.beforeEach(async ({ page }) => {
        // Robust overlay dismissal
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click();
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click();
        });
    });

    test('should display system health dashboard', async ({ page }) => {
        await page.goto('/#/system-health');

        await expect(page.getByRole('heading', { name: /État du Système|System Status/i })).toBeVisible({ timeout: 30000 });

        // Check for key sections
        await expect(page.getByText(/État des Services|Services Status/i)).toBeVisible();
        await expect(page.getByText(/Alertes Récentes|Recent Alerts/i)).toBeVisible();

        // Check for specific service cards (Static content in component)
        await expect(page.getByText('Firebase Auth')).toBeVisible();
        await expect(page.getByText('AI Engine (Gemini)')).toBeVisible();
    });

    test('should display backup and restore interface', async ({ page }) => {
        await page.goto('/#/backup');

        await expect(page.getByRole('heading', { name: /Sauvegardes & Restauration|Backup & Restore/i })).toBeVisible({ timeout: 30000 });

        // Check tabs
        await expect(page.getByRole('button', { name: /Sauvegarder|Backup/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Restaurer|Restore/i })).toBeVisible();

        // Check default view (Backup Form)
        await expect(page.getByRole('button', { name: /Lancer la sauvegarde|Start Backup/i })).toBeVisible();

        // Switch to Restore
        await page.getByRole('button', { name: /Restaurer|Restore/i }).click();
        await expect(page.getByRole('heading', { name: /Restauration|Restore/i })).toBeVisible();
    });
});
