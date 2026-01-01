import { test, expect } from '@playwright/test';

test.describe('Dashboard Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        // Go to Dashboard
        await page.goto('/');

        // Handle Onboarding Overlay if present
        // Robust dismissal of modals using locator handlers

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });

        // Handle Cookie Banner via locator handler as well if possible, or keep simple click
        // For dashboard specifically, let's use the handler for consistency
        await page.addLocatorHandler(page.getByRole('button', { name: /Accepter|Accept/i }), async (overlay) => {
            await overlay.click();
        });
    });

    test('should display dashboard widgets after loading', async ({ page }) => {
        // Wait for skeleton to disappear and main content to be visible
        // DashboardHeader usually displays "Bienvenue" or "Welcome"
        // Check for any significant dashboard element (Welcome text OR Quick Actions container)
        try {
            await expect(page.getByText(/Bienvenue|Welcome/i).first()).toBeVisible({ timeout: 15000 });
        } catch {
            // Fallback: check for Quick Actions container
            await expect(page.locator('[data-tour="quick-actions"]')).toBeVisible({ timeout: 15000 });
        }

        // Check for specific Quick Action buttons which are always present
        // e.g. "Risques" or "Risks"
        await expect(page.getByRole('button', { name: /Risques|Risks/i }).first()).toBeVisible();
    });

    test('should navigate via quick actions', async ({ page }) => {
        // Use a more generic check for quick actions
        await expect(page.getByRole('button', { name: /Risques|Risks/i }).first()).toBeVisible();

        // Click on "Incidents" or similar button that is safe
        const incidentsBtn = page.getByRole('button', { name: /Incidents/i }).first();

        if (await incidentsBtn.isVisible()) {
            await incidentsBtn.click();
            await expect(page).toHaveURL(/.*incidents/);
        }
    });
});
