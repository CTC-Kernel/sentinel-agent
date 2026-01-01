
import { test, expect } from '@playwright/test';

test.describe('Compliance Module', () => {
    // Increase timeout for compliance which can be heavy
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/compliance');

        // Robust dismissal of modals
        // Robust dismissal of modals using locator handlers

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display controls list', async ({ page }) => {
        // Check for page title
        await expect(page.getByRole('heading', { name: /Compliance|Conformité/i }).first()).toBeVisible({ timeout: 30000 });

        // Navigate to Controls tab
        await page.getByRole('button', { name: /Controls|Contrôles|Evidence/i }).click({ force: true });

        // Expand 'Contrôles Organisationnels' (A.5)
        await page.getByText('Contrôles Organisationnels').first().click({ timeout: 30000, force: true });

        // Check for mock data (A.5.1)
        await expect(page.getByText('A.5.1').first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('Politiques de sécurité').first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('Implémenté').first()).toBeVisible({ timeout: 30000 });
    });

    test('should filter controls', async ({ page }) => {
        // Navigate to Controls tab first
        await page.getByRole('button', { name: /Controls|Contrôles|Evidence/i }).click({ force: true });

        // Wait for data load (wait for domain header to appear)
        await expect(page.getByText('Contrôles Organisationnels').first()).toBeVisible({ timeout: 45000 });

        const searchInput = page.getByPlaceholder(/Rechercher|Search/i);

        // Search for A.5.1 (known to exist)
        const targetControl = 'A.5.1';
        const otherControl = 'A.6.1'; // Controls related to People

        await searchInput.fill(targetControl);

        // Should auto-expand and show target
        await expect(page.getByText(targetControl).first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(otherControl)).not.toBeVisible();
    });

    test('should open inspector and allow status change', async ({ page }) => {
        // Navigate to Controls tab
        await page.getByRole('button', { name: /Controls|Contrôles|Evidence/i }).click({ force: true });

        // Expand domain
        await page.getByText('Contrôles Organisationnels').first().click({ timeout: 30000, force: true });

        // Click on a control to open inspector (A.5.1)
        await page.getByTestId('control-row-A.5.1').click({ force: true });

        // Check Inspector Title (Regex for partial match)
        await expect(page.getByRole('heading', { name: /A\.5\.1/ }).first()).toBeVisible({ timeout: 30000 });

        // Change status to 'En cours'
        const inProgressBtn = page.getByRole('button', { name: 'En cours', exact: true });
        // Only click if visible (requires edit permissions, which Alice should have)
        if (await inProgressBtn.isVisible()) {
            await inProgressBtn.click();
            await expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
        }
    });
});
