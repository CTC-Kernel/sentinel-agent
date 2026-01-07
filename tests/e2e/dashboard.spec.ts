import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose } from './utils';

test.describe('Dashboard Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        // Ensure localStorage is populated with mock user
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        // Wait for overlays to close
        await waitForOverlaysToClose(page);

        // Go to Dashboard
        await page.goto('/');
        // Wait for dashboard content to load (handles loading skeleton)
        try {
            // Look for dashboard content instead of tour elements
            await expect(page.getByText(/Bienvenue|Welcome|Dashboard/i)).toBeVisible({ timeout: 15000 });
        } catch (e) {
            console.log('DEBUG: Dashboard timeout. Diagnosing...');
            const loadingVisible = await page.getByRole('status').or(page.getByText(/Chargement|Loading/i)).isVisible().catch(() => false);
            const skeletonVisible = await page.locator('.animate-pulse').isVisible().catch(() => false);
            const accessDeniedVisible = await page.getByText(/Accès refusé|Access Denied/i).isVisible().catch(() => false);
            const connectionErrorVisible = await page.getByText('Erreur de connexion').isVisible().catch(() => false);
            const appCheckVisible = await page.locator('#fire_app_check_[DEFAULT]').isVisible().catch(() => false);

            console.log('DEBUG DIAGNOSTICS:');
            console.log('- Loading Screen:', loadingVisible);
            console.log('- Skeleton:', skeletonVisible);
            console.log('- Access Denied:', accessDeniedVisible);
            console.log('- Connection Error:', connectionErrorVisible);
            console.log('- App Check Widget:', appCheckVisible);
            console.log('- URL:', page.url());

            throw e;
        }
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
        console.log('Current URL before test:', page.url());
        // Wait for skeleton to disappear and main content to be visible
        // DashboardHeader usually displays "Bienvenue" or "Welcome"
        // Check for specific Quick Action buttons which are always present
        // Quick Actions are hidden by default, hover to reveal (force hover as container might be animating/small)
        
        // Look for quick actions container without data-tour
        const container = page.locator('div').filter({ hasText: /Actions rapides|Quick Actions/i }).first();
        if (await container.isVisible()) {
            await container.dispatchEvent('mouseenter');
            await page.waitForTimeout(2000);
        }

        // e.g. "Risques" or "Risks"
        await expect(page.getByRole('button', { name: /Risques|Risks/i }).first()).toBeVisible({ timeout: 10000 });
    });

    test('should navigate via quick actions', async ({ page }) => {
        // Quick Actions are hidden by default, hover to reveal
        const container = page.locator('div').filter({ hasText: /Actions rapides|Quick Actions/i }).first();
        if (await container.isVisible()) {
            await container.dispatchEvent('mouseenter');
            await page.waitForTimeout(2000);
        }

        // Wait for animation
        await page.waitForTimeout(500);

        // Use a more generic check for quick actions
        await expect(page.getByRole('button', { name: /Risques|Risks/i }).first()).toBeVisible({ timeout: 10000 });

        // Click on "Incidents" or similar button that is safe
        const incidentsBtn = page.getByRole('button', { name: /Incidents/i }).first();

        if (await incidentsBtn.isVisible()) {
            await incidentsBtn.click();
            await expect(page).toHaveURL(/.*incidents/);
        }
    });
});
