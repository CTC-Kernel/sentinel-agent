import { test, expect } from '@playwright/test';

test.describe('Assets Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        // Ensure localStorage is populated before hydration
        await page.addInitScript(() => {
            window.localStorage.setItem('demoMode', 'true');
            window.localStorage.setItem('E2E_TEST_USER', JSON.stringify({
                uid: "e2e-user-123",
                email: "e2e@sentinel.com",
                displayName: "E2E Sentinel",
                organizationId: "org_default",
                role: "admin",
                onboardingCompleted: true,
                emailVerified: true
            }));
        });

        page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));
        page.on('requestfailed', request => console.log(`[Network Error]: ${request.url()} - ${request.failure()?.errorText}`));
        page.on('response', response => {
            if (response.status() === 403) {
                console.log(`[403 Forbidden]: ${response.url()}`);
            }
        });

        await page.goto('/#/assets');

        // Robust dismissal of modals

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display assets list', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 30000 });
        await expect(page.getByRole('heading', { name: /Actifs|Inventory|Assets/i, level: 1 })).toBeVisible({ timeout: 30000 });
        // Check for "Nouvel Actif" button
        await expect(page.getByRole('button', { name: /Nouvel actif|New Asset|Add Asset/i }).first()).toBeVisible();
    });

    test('should open create asset modal', async ({ page }) => {
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 30000 });

        const createButton = page.getByRole('button', { name: /Nouvel actif|New Asset/i }).first();
        await createButton.click({ force: true });
        await expect(page.getByText(/Créer un nouvel actif|Create Asset|New Asset/i)).toBeVisible();
    });
});
